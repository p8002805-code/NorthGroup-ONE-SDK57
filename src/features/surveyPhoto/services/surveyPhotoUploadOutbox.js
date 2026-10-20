import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import {
  accountDirectoryName,
  accountStorageKey,
} from '../../../services/account/accountIdentity';
import { secureRandomId } from '../../../services/security/secureRandom';
import { archiveStaleForm } from '../../../utils/safeStorage';

const OUTBOX_KEY = 'northgroup_survey_photo_upload_outbox_v1';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const safeFileName = (value, fallback = 'Survey-Photo-Upload') => (
  clean(value || fallback)
    .replace(/["*:<>?\\/|\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .slice(0, 150) || fallback
);

const outboxDirectory = () => (
  `${FileSystem.documentDirectory}${accountDirectoryName()}SurveyPhotoUploadOutbox/`
);

const sortItems = (items = []) => [...items].sort((left, right) => (
  new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime()
));

const normaliseItem = (item, { recoverInterrupted = false } = {}) => {
  const interrupted = recoverInterrupted && item?.status === 'uploading';
  return {
    ...item,
    status: interrupted ? 'queued' : item?.status || 'queued',
    progress: interrupted ? 0 : Math.max(0, Math.min(1, Number(item?.progress || 0))),
    attempts: Math.max(0, Number(item?.attempts || 0)),
    nextRetryAt: interrupted ? 0 : Math.max(0, Number(item?.nextRetryAt || 0)),
    error: clean(item?.error),
    asset: {
      ...(item?.asset || {}),
      uri: clean(item?.asset?.uri),
      name: safeFileName(item?.asset?.name),
      mimeType: clean(item?.asset?.mimeType) || 'application/octet-stream',
    },
    job: {
      number: clean(item?.job?.number),
      name: clean(item?.job?.name),
      location: clean(item?.job?.location),
    },
  };
};

// Every change to the queue is "read it all, change it, write it all back".
// Two changes at the same moment (a photo is taken while an upload finishes)
// used to overwrite each other, losing a photo or resurrecting a sent one.
// This lock makes changes happen strictly one after another.
let outboxChanges = Promise.resolve();
const withOutboxLock = (task) => {
  const run = outboxChanges.then(task);
  outboxChanges = run.catch(() => undefined);
  return run;
};

// The reader used before any change. Unlike the display reader below it must
// NEVER turn "could not read" into "queue is empty", because the empty list
// would then be written back over the real queue.
const readForChange = async () => {
  const key = accountStorageKey(OUTBOX_KEY);
  const saved = await AsyncStorage.getItem(key); // a storage error aborts the change
  if (!saved) return [];
  let parsed = null;
  try {
    parsed = JSON.parse(saved);
  } catch {
    parsed = null;
  }
  if (!Array.isArray(parsed)) {
    // Genuinely unreadable. Keep a copy before it can be overwritten; if even
    // that fails, abort the change rather than destroy the evidence.
    await archiveStaleForm(key, saved, { reason: 'corrupt', remove: false });
    return [];
  }
  return sortItems(parsed.map((item) => normaliseItem(item)));
};

export const readSurveyPhotoUploadOutbox = async ({ recoverInterrupted = true } = {}) => {
  try {
    const saved = await AsyncStorage.getItem(accountStorageKey(OUTBOX_KEY));
    const parsed = saved ? JSON.parse(saved) : [];
    return sortItems(
      Array.isArray(parsed)
        ? parsed.map((item) => normaliseItem(item, { recoverInterrupted }))
        : [],
    );
  } catch {
    return [];
  }
};

const writeOutboxUnlocked = async (items = []) => {
  const next = sortItems(
    Array.isArray(items) ? items.map((item) => normaliseItem(item)) : [],
  );
  await AsyncStorage.setItem(accountStorageKey(OUTBOX_KEY), JSON.stringify(next));
  return next;
};

export const writeSurveyPhotoUploadOutbox = (items = []) => (
  withOutboxLock(() => writeOutboxUnlocked(items))
);

const ensureOutboxDirectory = async () => {
  const directory = outboxDirectory();
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  }
  return directory;
};

const copyAssetToOutbox = async ({ id, asset }) => {
  const sourceUri = clean(asset?.uri);
  if (!sourceUri) throw new Error('The upload file could not be found.');
  const sourceInfo = await FileSystem.getInfoAsync(sourceUri, { size: true });
  if (!sourceInfo.exists) throw new Error('The upload file could not be found.');

  const directory = await ensureOutboxDirectory();
  const name = safeFileName(asset?.name);
  const temporaryUri = `${directory}.${id}.pending`;
  const destinationUri = `${directory}${id}_${name}`;
  await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
  await FileSystem.copyAsync({ from: sourceUri, to: temporaryUri });

  const copied = await FileSystem.getInfoAsync(temporaryUri, { size: true });
  if (!copied.exists || (Number.isFinite(Number(copied.size)) && Number(copied.size) <= 0)) {
    await FileSystem.deleteAsync(temporaryUri, { idempotent: true }).catch(() => undefined);
    throw new Error('The upload file could not be copied into the offline queue.');
  }

  await FileSystem.moveAsync({ from: temporaryUri, to: destinationUri });
  return {
    uri: destinationUri,
    name,
    mimeType: clean(asset?.mimeType) || 'application/octet-stream',
    size: Math.max(0, Number(copied.size || sourceInfo.size || asset?.size || 0)),
    captureDateTime: clean(asset?.captureDateTime),
    partNumber: Math.max(0, Number(asset?.partNumber) || 0),
    partCount: Math.max(0, Number(asset?.partCount) || 0),
    photoCount: Math.max(0, Number(asset?.photoCount) || 0),
    totalPhotoCount: Math.max(0, Number(asset?.totalPhotoCount) || 0),
  };
};

export const enqueueSurveyPhotoUpload = async ({
  job,
  initials,
  asset,
  kind = 'photo',
}) => {
  if (!clean(job?.number)) throw new Error('Choose an active job before uploading photos.');
  const id = secureRandomId('photo-upload');
  const managedAsset = await copyAssetToOutbox({ id, asset });
  const now = new Date().toISOString();
  const item = normaliseItem({
    id,
    kind: clean(kind) || 'photo',
    job: {
      number: job.number,
      name: job.name,
      location: job.location,
    },
    initials: clean(initials).toUpperCase() || 'NG',
    asset: managedAsset,
    status: 'queued',
    progress: 0,
    attempts: 0,
    nextRetryAt: 0,
    error: '',
    createdAt: now,
    updatedAt: now,
  });

  try {
    await withOutboxLock(async () => {
      const current = await readForChange();
      await writeOutboxUnlocked([...current, item]);
    });
    return item;
  } catch (error) {
    await FileSystem.deleteAsync(managedAsset.uri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
};

export const updateSurveyPhotoUpload = (itemId, changes) => withOutboxLock(async () => {
  const current = await readForChange();
  const next = current.map((item) => (
    item.id === itemId
      ? normaliseItem({
        ...item,
        ...changes,
        updatedAt: new Date().toISOString(),
      })
      : item
  ));
  return writeOutboxUnlocked(next);
});

export const removeSurveyPhotoUpload = (itemId) => withOutboxLock(async () => {
  const current = await readForChange();
  const removed = current.find((item) => item.id === itemId) || null;
  const items = await writeOutboxUnlocked(
    current.filter((item) => item.id !== itemId),
  );
  return { items, removed };
});

export const deleteSurveyPhotoUploadAsset = async (item) => {
  const uri = clean(item?.asset?.uri);
  const directory = outboxDirectory();
  if (!uri || !uri.startsWith(directory)) return;
  await FileSystem.deleteAsync(uri, { idempotent: true });
};

export const surveyPhotoUploadRetryDelay = (attempts = 1) => (
  Math.min(15 * 60 * 1000, 30 * 1000 * (2 ** Math.max(0, Number(attempts || 1) - 1)))
);

export const surveyPhotoUploadErrorIsRetryable = (error) => {
  const status = Number(error?.status || 0);
  const code = clean(error?.code).toUpperCase();
  if (
    ['SYNC_AUTH', 'SYNC_PERMISSION', 'SYNC_CONFLICT', 'SYNC_NOT_FOUND', 'SYNC_REQUEST', 'SYNC_UNTRUSTED_URL', 'UPLOAD_FILE_MISSING'].includes(code)
  ) return false;
  return !status
    || ['SYNC_OFFLINE', 'SYNC_TIMEOUT', 'SYNC_THROTTLED', 'SYNC_SERVER'].includes(code)
    || [408, 423, 425, 429, 500, 502, 503, 504].includes(status);
};