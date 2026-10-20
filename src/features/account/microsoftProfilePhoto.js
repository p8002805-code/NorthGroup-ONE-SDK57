import * as FileSystem from 'expo-file-system/legacy';
import { downloadAuthenticatedGraphFile } from '../../services/sync/graphFileTransfer';
import { trackSyncOperation } from '../../services/sync/syncState';

const PHOTO_SIZE = '240x240';
const CACHE_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-profile-photos/`;

const safeId = (value) => (
  String(value || 'employee').replace(/[^A-Za-z0-9_-]/g, '')
);

const ensureCacheDirectory = async () => {
  const info = await FileSystem.getInfoAsync(CACHE_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIRECTORY, { intermediates: true });
  }
};

const photoPath = (accountId) => `${CACHE_DIRECTORY}${safeId(accountId)}.jpg`;

export const readCachedMicrosoftProfilePhoto = async (accountId) => {
  if (!accountId) return '';
  try {
    const path = photoPath(accountId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists && Number(info.size || 0) > 0 ? path : '';
  } catch {
    return '';
  }
};

const downloadMicrosoftProfilePhotoContent = async ({
  accessToken,
  accountId,
}) => {
  if (!accessToken || !accountId) return '';

  await ensureCacheDirectory();
  const destination = photoPath(accountId);
  const temporary = `${destination}.download`;

  try {
    const result = await downloadAuthenticatedGraphFile({
      accessToken,
      urlOrPath: `/me/photos/${PHOTO_SIZE}/$value`,
      destination: temporary,
      options: {
        headers: {
          Accept: 'image/jpeg,image/png,image/*',
        },
      },
    });

    if (result.status === 404) {
      await FileSystem.deleteAsync(temporary, { idempotent: true });
      await FileSystem.deleteAsync(destination, { idempotent: true });
      return '';
    }
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Microsoft profile photo request failed (${result.status}).`);
    }

    await FileSystem.deleteAsync(destination, { idempotent: true });
    await FileSystem.moveAsync({ from: temporary, to: destination });
    return destination;
  } catch (error) {
    await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => {});
    if (error?.message?.includes('(404)')) {
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
      return '';
    }
    throw error;
  }
};

export const downloadMicrosoftProfilePhoto = async (parameters) => trackSyncOperation(
  { feature: 'microsoftProfile', operation: 'Download Microsoft profile photo' },
  () => downloadMicrosoftProfilePhotoContent(parameters),
);
