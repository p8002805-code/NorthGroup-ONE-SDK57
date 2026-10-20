import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountStorageKey } from '../account/accountIdentity';
import { normaliseSyncFeature, syncErrorCode } from './syncRules';

const SYNC_STATE_KEY = 'northgroup_one_sync_state_v1';
const MAX_RECENT_EVENTS = 12;

const listeners = new Set();
const activeOperations = new Map();
let operationSequence = 0;
let memoryState = null;
let memoryStorageKey = '';
let writeQueue = Promise.resolve();

const clean = (value) => String(value || '').trim();
const isoNow = () => new Date().toISOString();

const emptyState = () => ({
  version: 1,
  updatedAt: '',
  lastSuccessAt: '',
  lastFailureAt: '',
  lastError: '',
  lastErrorCode: '',
  totals: { succeeded: 0, failed: 0, retried: 0 },
  features: {},
  recent: [],
});

const normaliseFeatureState = (value) => ({
  lastOperation: clean(value?.lastOperation),
  lastJobNumber: clean(value?.lastJobNumber),
  lastSuccessAt: clean(value?.lastSuccessAt),
  lastFailureAt: clean(value?.lastFailureAt),
  lastError: clean(value?.lastError),
  lastErrorCode: clean(value?.lastErrorCode),
  succeeded: Math.max(0, Number(value?.succeeded || 0)),
  failed: Math.max(0, Number(value?.failed || 0)),
  retried: Math.max(0, Number(value?.retried || 0)),
});

export const normaliseSyncState = (value) => {
  const supplied = value && typeof value === 'object' ? value : {};
  const features = Object.fromEntries(
    Object.entries(supplied.features || {}).map(([key, feature]) => [
      normaliseSyncFeature(key),
      normaliseFeatureState(feature),
    ]),
  );
  return {
    ...emptyState(),
    ...supplied,
    version: 1,
    totals: {
      succeeded: Math.max(0, Number(supplied.totals?.succeeded || 0)),
      failed: Math.max(0, Number(supplied.totals?.failed || 0)),
      retried: Math.max(0, Number(supplied.totals?.retried || 0)),
    },
    features,
    recent: (Array.isArray(supplied.recent) ? supplied.recent : [])
      .filter((event) => event && typeof event === 'object')
      .slice(0, MAX_RECENT_EVENTS),
  };
};

const storageKey = () => {
  try {
    return accountStorageKey(SYNC_STATE_KEY);
  } catch {
    return '';
  }
};

const activeSnapshot = () => [...activeOperations.values()].map((operation) => ({ ...operation }));

const snapshot = () => ({
  ...normaliseSyncState(memoryState),
  active: activeSnapshot(),
  activeCount: activeOperations.size,
});

const emit = () => {
  const current = snapshot();
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch {
      // A screen listener must never interrupt a save or Microsoft request.
    }
  });
};

export const loadSyncState = async () => {
  const key = storageKey();
  if (!key) {
    if (memoryStorageKey) memoryState = emptyState();
    memoryStorageKey = '';
    memoryState = normaliseSyncState(memoryState);
    return snapshot();
  }
  try {
    const stored = await AsyncStorage.getItem(key);
    const fallback = memoryStorageKey === key ? memoryState : null;
    memoryState = normaliseSyncState(stored ? JSON.parse(stored) : fallback);
    memoryStorageKey = key;
  } catch {
    memoryState = normaliseSyncState(memoryStorageKey === key ? memoryState : null);
    memoryStorageKey = key;
  }
  return snapshot();
};

const persistState = async (next) => {
  memoryState = normaliseSyncState(next);
  const key = storageKey();
  memoryStorageKey = key;
  if (key) await AsyncStorage.setItem(key, JSON.stringify(memoryState));
  emit();
  return snapshot();
};

const queueStateUpdate = (update) => {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      if (!memoryState) await loadSyncState();
      return persistState(update(normaliseSyncState(memoryState)));
    });
  return writeQueue;
};

export const subscribeSyncState = (listener) => {
  if (typeof listener !== 'function') return () => undefined;
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
};

export const beginSyncOperation = ({
  feature = 'microsoft',
  operation = 'request',
  jobNumber = '',
} = {}) => {
  operationSequence += 1;
  const id = `sync-${Date.now()}-${operationSequence}`;
  activeOperations.set(id, {
    id,
    feature: normaliseSyncFeature(feature),
    operation: clean(operation) || 'request',
    jobNumber: clean(jobNumber),
    startedAt: isoNow(),
  });
  emit();
  return id;
};

export const finishSyncOperation = async (id, {
  error = null,
  retries = 0,
  status = 0,
  accepted = false,
} = {}) => {
  const operation = activeOperations.get(id);
  activeOperations.delete(id);
  if (!operation) {
    emit();
    return snapshot();
  }

  const finishedAt = isoNow();
  const succeeded = !error && (
    accepted
    || (Number(status || 200) >= 200 && Number(status || 200) < 400)
  );
  const featureKey = normaliseSyncFeature(operation.feature);
  const message = clean(error?.message);
  const errorCode = clean(error?.code) || (succeeded ? '' : syncErrorCode(status, {
    timedOut: error?.timedOut,
    networkError: error?.networkError,
  }));

  return queueStateUpdate((current) => {
    const feature = normaliseFeatureState(current.features[featureKey]);
    const nextFeature = {
      ...feature,
      lastOperation: operation.operation,
      lastJobNumber: operation.jobNumber || feature.lastJobNumber,
      succeeded: feature.succeeded + (succeeded ? 1 : 0),
      failed: feature.failed + (succeeded ? 0 : 1),
      retried: feature.retried + Math.max(0, Number(retries || 0)),
      ...(succeeded ? {
        lastSuccessAt: finishedAt,
        lastError: '',
        lastErrorCode: '',
      } : {
        lastFailureAt: finishedAt,
        lastError: message,
        lastErrorCode: errorCode,
      }),
    };
    const event = {
      id,
      feature: featureKey,
      operation: operation.operation,
      jobNumber: operation.jobNumber,
      status: succeeded ? 'success' : 'failed',
      statusCode: Number(status || 0),
      errorCode,
      message,
      retries: Math.max(0, Number(retries || 0)),
      finishedAt,
    };
    return {
      ...current,
      updatedAt: finishedAt,
      lastSuccessAt: succeeded ? finishedAt : current.lastSuccessAt,
      lastFailureAt: succeeded ? current.lastFailureAt : finishedAt,
      lastError: succeeded ? current.lastError : message,
      lastErrorCode: succeeded ? current.lastErrorCode : errorCode,
      totals: {
        succeeded: current.totals.succeeded + (succeeded ? 1 : 0),
        failed: current.totals.failed + (succeeded ? 0 : 1),
        retried: current.totals.retried + Math.max(0, Number(retries || 0)),
      },
      features: { ...current.features, [featureKey]: nextFeature },
      recent: [event, ...current.recent].slice(0, MAX_RECENT_EVENTS),
    };
  });
};

export const trackSyncOperation = async (metadata, task) => {
  const id = beginSyncOperation(metadata);
  try {
    const result = await task();
    await finishSyncOperation(id, { status: 200 });
    return result;
  } catch (error) {
    await finishSyncOperation(id, { error, status: error?.status || 0 });
    throw error;
  }
};

export const resetSyncState = async () => {
  activeOperations.clear();
  return queueStateUpdate(() => emptyState());
};
