import * as FileSystem from 'expo-file-system/legacy';

import { accountDirectoryName } from '../account/accountIdentity';

export const JOB_FILES_DOWNLOAD_CACHE_DIRECTORY = (
  `${FileSystem.cacheDirectory}northgroup-job-files/`
);
export const JOB_FILES_SHARE_CACHE_DIRECTORY = (
  `${FileSystem.cacheDirectory}northgroup-job-file-shares/`
);
export const JOB_FILES_UPLOAD_CACHE_DIRECTORY = (
  `${FileSystem.cacheDirectory}northgroup-job-file-upload-chunks/`
);

export const jobFilesPersistentDownloadDirectory = () => (
  `${FileSystem.documentDirectory}${accountDirectoryName()}JobFiles/Downloads/`
);

const PRIVATE_CACHE_DIRECTORIES = [
  JOB_FILES_DOWNLOAD_CACHE_DIRECTORY,
  JOB_FILES_SHARE_CACHE_DIRECTORY,
  JOB_FILES_UPLOAD_CACHE_DIRECTORY,
  `${FileSystem.cacheDirectory}northgroup-job-briefs/`,
  `${FileSystem.cacheDirectory}northgroup-kml/`,
  `${FileSystem.cacheDirectory}northgroup-profile-photos/`,
  `${FileSystem.cacheDirectory}northgroup-job-chat-attachments/`,
  `${FileSystem.cacheDirectory}northgroup-job-chat-upload-chunks/`,
  `${FileSystem.cacheDirectory}SurveyPhotoExports/`,
];

const normaliseUri = (value) => {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
};

export const isPrivateCacheFile = (uri, directory) => {
  const candidate = normaliseUri(uri);
  const trustedDirectory = normaliseUri(directory);
  return Boolean(
    candidate
    && trustedDirectory
    && candidate.startsWith(trustedDirectory)
    && !candidate.slice(trustedDirectory.length).includes('..'),
  );
};

export const removePrivateCacheFile = async (uri, directory) => {
  if (!isPrivateCacheFile(uri, directory)) return false;
  await FileSystem.deleteAsync(uri, { idempotent: true });
  return true;
};

export const clearPrivateFileCaches = async () => {
  await Promise.all(PRIVATE_CACHE_DIRECTORIES.map((directory) => (
    FileSystem.deleteAsync(directory, { idempotent: true }).catch(() => undefined)
  )));
};
