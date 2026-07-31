import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobStorageKey } from '../features/jobs/jobContext';

export const FORM_STATUS_STORAGE_KEY = 'northgroup_form_status';

const VALID_STATUSES = new Set(['none', 'draft', 'complete']);

const normaliseStatus = (value) => {
  if (!value || typeof value !== 'object') return null;
  const status = VALID_STATUSES.has(value.status) ? value.status : null;
  if (!status) return null;
  return {
    status,
    date: String(value.date || ''),
    completedAt: value.completedAt || null,
    updatedAt: value.updatedAt || null,
  };
};

export const loadFormStatuses = async (job) => {
  if (!job?.number && !job?.id) return {};

  try {
    const saved = await AsyncStorage.getItem(
      jobStorageKey(FORM_STATUS_STORAGE_KEY, job)
    );
    const parsed = saved ? JSON.parse(saved) : {};
    return Object.fromEntries(
      Object.entries(parsed || {})
        .map(([formId, value]) => [formId, normaliseStatus(value)])
        .filter(([, value]) => value)
    );
  } catch (_error) {
    return {};
  }
};

export const saveFormStatus = async (job, formId, status, details = {}) => {
  if (!job?.number && !job?.id) return {};

  const current = await loadFormStatuses(job);
  const next = { ...current };

  if (status === 'none') {
    delete next[formId];
  } else if (VALID_STATUSES.has(status)) {
    next[formId] = {
      status,
      date: String(details.date || ''),
      completedAt: status === 'complete'
        ? details.completedAt || new Date().toISOString()
        : null,
      updatedAt: new Date().toISOString(),
    };
  }

  await AsyncStorage.setItem(
    jobStorageKey(FORM_STATUS_STORAGE_KEY, job),
    JSON.stringify(next)
  );

  return next;
};
