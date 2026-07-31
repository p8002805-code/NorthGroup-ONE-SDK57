import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

let activeAccountId = '';

const LEGACY_WORKSPACE_OWNER_KEY = 'northgroup_legacy_workspace_owner_v1';
const ACCOUNT_MIGRATION_KEY = 'northgroup_account_workspace_migration_v1';

const cleanSegment = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');

export const setActiveAccountId = (userId) => {
  activeAccountId = cleanSegment(userId);
  return activeAccountId;
};

export const clearActiveAccountId = () => {
  activeAccountId = '';
};

export const getActiveAccountId = () => activeAccountId;

export const accountStorageKey = (base) => {
  if (!activeAccountId) {
    throw new Error('Complete profile setup before accessing account data.');
  }
  return `${base}__account_${activeAccountId}`;
};

export const accountDirectoryName = () => {
  if (!activeAccountId) {
    throw new Error('Complete profile setup before accessing account files.');
  }
  return `Accounts/${activeAccountId}/`;
};

const accountMigrationKey = () => accountStorageKey(ACCOUNT_MIGRATION_KEY);

const parseJson = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
};

const sameIdentity = (legacyProfile, account) => {
  const accountId = String(account?.id || '').trim().toLowerCase();
  const legacyIds = [
    legacyProfile?.userId,
    legacyProfile?.microsoftAccountId,
  ]
    .map((value) => String(value || '').trim().toLowerCase())
    .filter(Boolean);
  if (accountId && legacyIds.includes(accountId)) return true;

  const legacyEmail = String(legacyProfile?.email || '').trim().toLowerCase();
  const accountEmail = String(account?.email || '').trim().toLowerCase();
  return Boolean(legacyEmail && accountEmail && legacyEmail === accountEmail);
};

const hasLegacyIdentity = (profile) => Boolean(
  String(profile?.userId || profile?.microsoftAccountId || profile?.email || '').trim(),
);

const hasMeaningfulLegacyProfile = (profile) => Boolean(
  String(profile?.firstName || profile?.lastName || profile?.fullName || '').trim(),
);

const copyStorageValueIfMissing = async (legacyKey, scopedKey) => {
  const [legacyValue, scopedValue] = await Promise.all([
    AsyncStorage.getItem(legacyKey),
    AsyncStorage.getItem(scopedKey),
  ]);
  if (legacyValue != null && scopedValue == null) {
    await AsyncStorage.setItem(scopedKey, legacyValue);
    return true;
  }
  return false;
};

const ensureDirectory = async (uri) => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
};

const copyDirectoryContents = async (source, destination) => {
  const sourceInfo = await FileSystem.getInfoAsync(source);
  if (!sourceInfo.exists || !sourceInfo.isDirectory) return;

  await ensureDirectory(destination);
  const names = await FileSystem.readDirectoryAsync(source);
  for (const name of names) {
    const sourceUri = `${source}${name}`;
    const destinationUri = `${destination}${name}`;
    const info = await FileSystem.getInfoAsync(sourceUri);
    if (info.isDirectory) {
      await copyDirectoryContents(`${sourceUri}/`, `${destinationUri}/`);
      continue;
    }
    const destinationInfo = await FileSystem.getInfoAsync(destinationUri);
    if (!destinationInfo.exists) {
      await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    }
  }
};

const rebasePhotoProjectFiles = async (directory, legacyRoot, accountRoot) => {
  const info = await FileSystem.getInfoAsync(directory);
  if (!info.exists || !info.isDirectory) return;

  const names = await FileSystem.readDirectoryAsync(directory);
  for (const name of names) {
    const uri = `${directory}${name}`;
    const itemInfo = await FileSystem.getInfoAsync(uri);
    if (itemInfo.isDirectory) {
      await rebasePhotoProjectFiles(`${uri}/`, legacyRoot, accountRoot);
      continue;
    }
    if (name !== 'Project.json') continue;

    const contents = await FileSystem.readAsStringAsync(uri);
    const rebased = contents.split(legacyRoot).join(accountRoot);
    if (rebased !== contents) {
      await FileSystem.writeAsStringAsync(uri, rebased);
    }
  }
};

const copyLegacyPhotos = async () => {
  const legacySurveyRoot = `${FileSystem.documentDirectory}SurveyPhotos/`;
  const accountSurveyRoot =
    `${FileSystem.documentDirectory}${accountDirectoryName()}SurveyPhotos/`;
  await copyDirectoryContents(legacySurveyRoot, accountSurveyRoot);
  await rebasePhotoProjectFiles(
    accountSurveyRoot,
    legacySurveyRoot,
    accountSurveyRoot,
  );

  const legacyGnssRoot = `${FileSystem.documentDirectory}GNSS Photos/`;
  const accountGnssRoot =
    `${FileSystem.documentDirectory}${accountDirectoryName()}GNSS Photos/`;
  await copyDirectoryContents(legacyGnssRoot, accountGnssRoot);

  const suffix = `__account_${getActiveAccountId()}`;
  const scopedKeys = (await AsyncStorage.getAllKeys()).filter((key) =>
    key.endsWith(suffix),
  );
  for (const key of scopedKeys) {
    const value = await AsyncStorage.getItem(key);
    if (!value || !value.includes(legacyGnssRoot)) continue;
    await AsyncStorage.setItem(
      key,
      value.split(legacyGnssRoot).join(accountGnssRoot),
    );
  }
};

const jobToken = (job) =>
  String(job?.id || job?.number || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_');

export const migrateLegacyAccountWorkspace = async ({
  account,
  profileKey,
  storageKeys = [],
  jobStorageBases = [],
}) => {
  if (!getActiveAccountId()) {
    throw new Error('Microsoft account storage was not initialised.');
  }

  const existingMigration = parseJson(
    await AsyncStorage.getItem(accountMigrationKey()),
  );
  if (existingMigration?.complete) return existingMigration;

  const accountId = String(account?.id || '').trim();
  const accountKey = cleanSegment(accountId);
  const legacyProfile = parseJson(await AsyncStorage.getItem(profileKey));
  const existingOwner = await AsyncStorage.getItem(LEGACY_WORKSPACE_OWNER_KEY);
  const allKeys = await AsyncStorage.getAllKeys();
  const hasLegacyWorkspace = allKeys.some((key) => (
    storageKeys.includes(key)
    || jobStorageBases.some((base) => key === base || key.startsWith(`${base}__job_`))
  ));

  let claimedLegacy = existingOwner === accountKey;
  if (!existingOwner && hasLegacyWorkspace) {
    claimedLegacy = sameIdentity(legacyProfile, account)
      || (!hasLegacyIdentity(legacyProfile) && hasMeaningfulLegacyProfile(legacyProfile))
      || (!legacyProfile && hasLegacyWorkspace);
    if (claimedLegacy) {
      await AsyncStorage.setItem(LEGACY_WORKSPACE_OWNER_KEY, accountKey);
    }
  }

  if (claimedLegacy) {
    for (const key of storageKeys) {
      await copyStorageValueIfMissing(key, accountStorageKey(key));
    }

    for (const key of allKeys) {
      if (key.includes('__account_')) continue;
      const isJobValue = jobStorageBases.some((base) =>
        key.startsWith(`${base}__job_`),
      );
      if (isJobValue) {
        await copyStorageValueIfMissing(key, accountStorageKey(key));
      }
    }

    const activeJobKey = storageKeys.find((key) =>
      key.includes('active_job'),
    );
    const activeJob = activeJobKey
      ? parseJson(await AsyncStorage.getItem(activeJobKey))
      : null;
    const token = jobToken(activeJob);
    if (token) {
      for (const base of jobStorageBases) {
        const legacyJobKey = `${base}__job_${token}`;
        const hasJobValue = await AsyncStorage.getItem(legacyJobKey);
        if (hasJobValue == null) {
          await copyStorageValueIfMissing(
            base,
            accountStorageKey(legacyJobKey),
          );
        }
      }
    }

    await copyLegacyPhotos();
  }

  const result = {
    complete: true,
    claimedLegacy,
    accountId,
    completedAt: new Date().toISOString(),
  };
  await AsyncStorage.setItem(accountMigrationKey(), JSON.stringify(result));
  return result;
};
