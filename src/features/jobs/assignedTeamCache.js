import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountStorageKey } from '../../services/account/accountIdentity';

const ASSIGNED_TEAM_CACHE_PREFIX = 'northgroup_one_assigned_team_v1';
export const ASSIGNED_TEAM_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

const memoryCache = new Map();
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const unique = (values) => [...new Set(values.map(clean).filter(Boolean))];

const jobNumberFor = (job) => clean(job?.number).toUpperCase();
const teamIdsFor = (job) => unique(
  Array.isArray(job?.microsoftTeamIds) ? job.microsoftTeamIds : [],
).sort();

export const assignedTeamJobSignature = (job) => [
  jobNumberFor(job),
  ...teamIdsFor(job),
].join(':');

const safeJobKey = (job) => jobNumberFor(job)
  .replace(/[^A-Z0-9_-]/g, '_')
  .slice(0, 100);

const cacheStorageKey = (job) => {
  const jobKey = safeJobKey(job);
  if (!jobKey) return '';
  return accountStorageKey(`${ASSIGNED_TEAM_CACHE_PREFIX}__job_${jobKey}`);
};

const normaliseMember = (member, index) => ({
  id: clean(member?.id || member?.userId),
  displayName: clean(member?.displayName) || `Assigned employee ${index + 1}`,
  email: clean(member?.email),
  jobTitle: clean(member?.jobTitle),
  directoryResolved: Boolean(member?.directoryResolved),
});

const normaliseCache = (value, job) => {
  if (!value || typeof value !== 'object') return null;
  const signature = assignedTeamJobSignature(job);
  if (!signature || clean(value.jobSignature) !== signature) return null;

  const suppliedMembers = (Array.isArray(value.members) ? value.members : [])
    .map(normaliseMember)
    .filter((member) => member.id);
  const memberById = new Map(
    suppliedMembers.map((member) => [member.id.toLowerCase(), member]),
  );
  const userIds = unique([
    ...(Array.isArray(value.userIds) ? value.userIds : []),
    ...suppliedMembers.map((member) => member.id),
  ]);
  const members = userIds.map((userId, index) => (
    memberById.get(userId.toLowerCase())
    || normaliseMember({ id: userId }, index)
  ));
  const cachedAt = clean(value.cachedAt);
  if (!Number.isFinite(Date.parse(cachedAt))) return null;

  return {
    schemaVersion: 1,
    jobSignature: signature,
    jobNumber: jobNumberFor(job),
    teamIds: teamIdsFor(job),
    userIds,
    members,
    directoryMembersResolved: Boolean(
      value.directoryMembersResolved
      && members.length === userIds.length
      && members.every((member) => member.directoryResolved),
    ),
    directoryError: clean(value.directoryError),
    cachedAt,
  };
};

export const isAssignedTeamCacheFresh = (cache, now = Date.now()) => {
  const cachedAt = Date.parse(cache?.cachedAt || '');
  if (!Number.isFinite(cachedAt)) return false;
  const age = Number(now) - cachedAt;
  return age >= 0 && age <= ASSIGNED_TEAM_CACHE_MAX_AGE_MS;
};

export const peekCachedAssignedTeam = ({ job }) => {
  try {
    const key = cacheStorageKey(job);
    return key ? memoryCache.get(key) || null : null;
  } catch {
    return null;
  }
};

export const readCachedAssignedTeam = async ({ job }) => {
  const key = cacheStorageKey(job);
  if (!key) return null;
  const memoryValue = memoryCache.get(key);
  if (memoryValue) return memoryValue;

  try {
    const saved = await AsyncStorage.getItem(key);
    if (!saved) return null;
    const cached = normaliseCache(JSON.parse(saved), job);
    if (!cached) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    memoryCache.set(key, cached);
    return cached;
  } catch {
    return null;
  }
};

export const writeCachedAssignedTeam = async ({ job, assignment, now = new Date() }) => {
  const key = cacheStorageKey(job);
  if (!key) return null;
  const cached = normaliseCache({
    ...assignment,
    jobSignature: assignedTeamJobSignature(job),
    cachedAt: now.toISOString(),
  }, job);
  if (!cached) return null;

  memoryCache.set(key, cached);
  await AsyncStorage.setItem(key, JSON.stringify(cached));
  return cached;
};

export const clearCachedAssignedTeam = async ({ job }) => {
  const key = cacheStorageKey(job);
  if (!key) return;
  memoryCache.delete(key);
  await AsyncStorage.removeItem(key);
};

export const clearAssignedTeamMemoryCache = () => {
  memoryCache.clear();
};
