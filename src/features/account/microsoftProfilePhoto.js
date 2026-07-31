import * as FileSystem from 'expo-file-system/legacy';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
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

export const downloadMicrosoftProfilePhoto = async ({
  accessToken,
  accountId,
}) => {
  if (!accessToken || !accountId) return '';

  await ensureCacheDirectory();
  const destination = photoPath(accountId);
  const temporary = `${destination}.download`;

  try {
    const result = await FileSystem.downloadAsync(
      `${GRAPH_ROOT}/me/photos/${PHOTO_SIZE}/$value`,
      temporary,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'image/jpeg,image/png,image/*',
        },
      },
    );

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
