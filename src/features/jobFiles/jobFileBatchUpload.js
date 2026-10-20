import { uploadJobFile } from './jobFilesService';

export const uploadJobFileBatch = async ({
  accessToken,
  assets,
  driveId,
  folderId,
  jobNumber,
  onProgress,
  previouslyCompletedRecordIds = [],
}) => {
  const completedRecordIds = [...previouslyCompletedRecordIds];

  try {
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      await uploadJobFile({
        accessToken,
        driveId,
        folderId,
        asset,
        jobNumber,
        onProgress: (progress) => onProgress?.(
          (index + progress) / assets.length,
          {
            asset,
            current: index + 1,
            total: assets.length,
            fileProgress: progress,
          },
        ),
      });
      if (asset.recordId) completedRecordIds.push(asset.recordId);
    }
  } catch (error) {
    const batchError = new Error(error?.message || 'The batch upload was interrupted.');
    batchError.completedRecordIds = completedRecordIds;
    batchError.cause = error;
    throw batchError;
  }

  return { completedRecordIds };
};
