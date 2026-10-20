import * as FileSystem from 'expo-file-system/legacy';

import {
  JOB_FILES_DOWNLOAD_CACHE_DIRECTORY,
  jobFilesPersistentDownloadDirectory,
  removePrivateCacheFile,
} from '../../services/security/privateFileCache';
import {
  buildJobFileCacheName,
  hasJobFileRevisionIdentity,
  isCompleteJobFileDownload,
} from './jobFilesRules';

export const jobFileDownloadDirectory = (persist = false) => (
  persist
    ? jobFilesPersistentDownloadDirectory()
    : JOB_FILES_DOWNLOAD_CACHE_DIRECTORY
);

export const findReusableJobFile = async ({
  directory,
  jobNumber,
  driveId,
  item,
}) => {
  if (!hasJobFileRevisionIdentity(item)) return '';

  const localName = buildJobFileCacheName({ jobNumber, driveId, item });
  const localUri = `${directory}${localName}`;
  const fileInfo = await FileSystem.getInfoAsync(localUri, { size: true })
    .catch(() => ({ exists: false }));

  if (isCompleteJobFileDownload({ fileInfo, expectedSize: item?.size })) {
    return localUri;
  }
  if (fileInfo?.exists) {
    await removePrivateCacheFile(localUri, directory).catch(() => false);
  }
  return '';
};
