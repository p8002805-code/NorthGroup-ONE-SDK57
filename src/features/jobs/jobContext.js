import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  accountDirectoryName,
  accountStorageKey,
} from '../account/accountWorkspace';

export const JOBS_KEY = 'northgroup_jobs_v1';
export const ACTIVE_JOB_KEY = 'northgroup_active_job_v1';
export const JOB_MIGRATION_KEY = 'northgroup_jobs_migrated_v2';

const cleanText = (value) => String(value || '').trim();
export const normaliseJob = (job = {}) => ({
  id: cleanText(job.id || job.number).toUpperCase(),
  number: cleanText(job.number).toUpperCase(),
  name: cleanText(job.name),
  location: cleanText(job.location),
  latitude: cleanText(job.latitude) && Number.isFinite(Number(job.latitude)) ? Number(job.latitude) : null,
  longitude: cleanText(job.longitude) && Number.isFinite(Number(job.longitude)) ? Number(job.longitude) : null,
  source: cleanText(job.source) || 'manual',
  microsoftShiftIds: Array.isArray(job.microsoftShiftIds) ? [...new Set(job.microsoftShiftIds.filter(Boolean))] : [],
  microsoftTeamIds: Array.isArray(job.microsoftTeamIds) ? [...new Set(job.microsoftTeamIds.filter(Boolean))] : [],
  microsoftTeamNames: Array.isArray(job.microsoftTeamNames) ? [...new Set(job.microsoftTeamNames.filter(Boolean))] : [],
  scheduleStart: cleanText(job.scheduleStart),
  scheduleEnd: cleanText(job.scheduleEnd),
  workType: cleanText(job.workType),
  details: cleanText(job.details),
  teamsLastSyncedAt: cleanText(job.teamsLastSyncedAt),
  createdAt: job.createdAt || new Date().toISOString(),
  lastOpenedAt: job.lastOpenedAt || new Date().toISOString(),
});

export const mergeTeamsJobs = async (importedJobs = [], jobs = []) => {
  const importedNumbers = new Set(
    importedJobs.map((job) => cleanText(job?.number).toUpperCase()).filter(Boolean),
  );
  const next = jobs.filter((job) => (
    job?.source !== 'teams-shifts'
    || importedNumbers.has(cleanText(job?.number).toUpperCase())
  ));
  importedJobs.forEach((incomingValue) => {
    const incoming = normaliseJob(incomingValue);
    const index = next.findIndex((item) => cleanText(item.number).toUpperCase() === incoming.number);
    if (index < 0) {
      next.push(incoming);
      return;
    }

    const current = normaliseJob(next[index]);
    next[index] = normaliseJob({
      ...current,
      ...incoming,
      // Keep a user's manually refined title/location, while still attaching
      // the live Teams schedule and instructions to the same workspace.
      name: current.source === 'manual' ? current.name : incoming.name,
      location: current.source === 'manual' ? current.location : incoming.location,
      latitude: current.latitude,
      longitude: current.longitude,
      source: current.source === 'manual' ? 'manual+teams-shifts' : 'teams-shifts',
      createdAt: current.createdAt,
      lastOpenedAt: current.lastOpenedAt,
    });
  });
  const sorted = next.sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)));
  await AsyncStorage.setItem(accountStorageKey(JOBS_KEY), JSON.stringify(sorted));
  return sorted;
};

const legacyJobStorageKey = (base, job) =>
  `${base}__job_${cleanText(job?.id || job?.number).toUpperCase().replace(/[^A-Z0-9_-]/g, '_')}`;

export const jobStorageKey = (base, job) =>
  accountStorageKey(legacyJobStorageKey(base, job));

export const loadJobs = async (profile) => {
  const jobsKey = accountStorageKey(JOBS_KEY);
  const migrationKey = accountStorageKey(JOB_MIGRATION_KEY);
  const saved = await AsyncStorage.getItem(jobsKey);
  const migrationComplete = await AsyncStorage.getItem(migrationKey);
  const stored = saved ? JSON.parse(saved) : [];
  const legacy = !saved && !migrationComplete
    ? (profile?.jobs || []).map((item) => normaliseJob(item))
    : [];
  if (!saved && !migrationComplete && profile?.defaultJob) legacy.unshift(normaliseJob({ number: profile.defaultJob, name: profile.defaultJobName }));
  const merged = [...stored, ...legacy].filter((job, index, all) =>
    job.number && all.findIndex((item) => cleanText(item.number).toUpperCase() === cleanText(job.number).toUpperCase()) === index
  );
  await AsyncStorage.multiSet([[jobsKey, JSON.stringify(merged)], [migrationKey, 'true']]);
  return merged.sort((a, b) => String(b.lastOpenedAt).localeCompare(String(a.lastOpenedAt)));
};

export const loadActiveJob = async () => {
  const saved = await AsyncStorage.getItem(accountStorageKey(ACTIVE_JOB_KEY));
  return saved ? normaliseJob(JSON.parse(saved)) : null;
};

export const saveActiveJob = async (job, jobs = []) => {
  const active = normaliseJob({ ...job, lastOpenedAt: new Date().toISOString() });
  const next = [active, ...jobs.filter((item) => item.number !== active.number)];
  await AsyncStorage.multiSet([
    [accountStorageKey(ACTIVE_JOB_KEY), JSON.stringify(active)],
    [accountStorageKey(JOBS_KEY), JSON.stringify(next)],
  ]);
  return { active, jobs: next };
};

export const createJob = async (values, jobs = []) => {
  const job = normaliseJob(values);
  if (!job.number || !job.name || !job.location) throw new Error('Enter the job number, job name and job location.');
  const existing = jobs.find((item) => item.number === job.number);
  return saveActiveJob(existing ? { ...existing, ...job } : job, jobs);
};

export const updateJob = async (originalNumber, values, jobs = []) => {
  const current = jobs.find((item) => item.number === originalNumber) || {};
  const updated = normaliseJob({ ...current, ...values });
  if (!updated.number || !updated.name || !updated.location) throw new Error('Enter the job number, job name and job location.');
  const duplicate = jobs.some((item) => item.number === updated.number && item.number !== originalNumber);
  if (duplicate) throw new Error('A different job already uses that job number.');
  const next = jobs.map((item) => item.number === originalNumber ? { ...item, ...updated, id: updated.number } : item);
  await AsyncStorage.setItem(accountStorageKey(JOBS_KEY), JSON.stringify(next));
  return next;
};

export const removeJob = async (number, jobs = []) => {
  const next = jobs.filter((item) => item.number !== number);
  const target = normaliseJob({ number });
  await AsyncStorage.multiRemove([
    jobStorageKey('s500_form', target),
    jobStorageKey('se14_form', target),
    jobStorageKey('se14_in_progress', target),
    jobStorageKey('s501_form', target),
    jobStorageKey('s506_form', target),
    jobStorageKey('northgroup_form_status', target),
  ]);
  const photoFolder =
    `${FileSystem.documentDirectory}${accountDirectoryName()}SurveyPhotos/`
    + `${target.number.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_')}/`;
  await FileSystem.deleteAsync(photoFolder, { idempotent: true });
  const gnssPhotoFolder =
    `${FileSystem.documentDirectory}${accountDirectoryName()}GNSS Photos/`
    + `${target.number.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_')} GNSS Photos/`;
  await FileSystem.deleteAsync(gnssPhotoFolder, { idempotent: true });
  const active = await loadActiveJob();
  if (active?.number === target.number) {
    await AsyncStorage.removeItem(accountStorageKey(ACTIVE_JOB_KEY));
  }
  await AsyncStorage.setItem(accountStorageKey(JOBS_KEY), JSON.stringify(next));
  return next;
};

export const attachJob = (form, job, field = 'jobNumber') => ({
  ...form,
  [field]: job?.number || '',
  jobId: job?.id || job?.number || '',
  jobSnapshot: job ? { ...job } : null,
});
