import { useCallback } from 'react';
import { Alert } from 'react-native';

import { uploadJobFileBatch } from '../jobFileBatchUpload';

const sameJobNumber = (payloadJobNumber, screenJobNumber) => {
  const payload = String(payloadJobNumber || '').trim().toUpperCase();
  return !payload || payload === String(screenJobNumber || '').trim().toUpperCase();
};

export const useQueuedJobFileUpload = ({
  getAccessToken,
  isActiveJobOperation,
  jobKey,
  jobNumber,
  load,
  location,
  onPendingUploadHandled,
  queuedAssets,
  queuedUpload,
  setQueuedUpload,
  setUploadProgress,
  setUploadStatus,
  setUploading,
  uploading,
}) => useCallback(async (folder) => {
  if (!location || !folder || !queuedUpload || !queuedAssets.length || uploading) return;
  const operationJobKey = jobKey;

  // These PDFs belong to one job. Never put them in another job's folder.
  if (!sameJobNumber(queuedUpload.jobNumber, jobNumber)) {
    Alert.alert(
      'Wrong job',
      `These files belong to job ${queuedUpload.jobNumber}. Open that job to upload them.`,
    );
    return;
  }

  try {
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus?.({
      phase: 'connecting',
      current: 0,
      total: queuedAssets.length,
      fileName: '',
    });
    const accessToken = await getAccessToken();
    const { completedRecordIds } = await uploadJobFileBatch({
      accessToken,
      assets: queuedAssets,
      driveId: location.drive.id,
      folderId: folder.id,
      jobNumber,
      previouslyCompletedRecordIds: queuedUpload.completedRecordIds,
      onProgress: (progress, file) => {
        if (isActiveJobOperation(operationJobKey)) {
          setUploadProgress(progress);
          setUploadStatus?.({
            phase: 'uploading',
            current: file?.current || 1,
            total: file?.total || queuedAssets.length,
            fileName: file?.asset?.name || '',
          });
        }
      },
    });

    const handledUpload = {
      ...queuedUpload,
      jobNumber: queuedUpload.jobNumber || jobNumber,
      recordIds: [...new Set([...(queuedUpload.recordIds || []), ...completedRecordIds])],
      uploadedAt: new Date().toISOString(),
    };
    if (isActiveJobOperation(operationJobKey)) setQueuedUpload(null);
    await onPendingUploadHandled?.(handledUpload);
    if (!isActiveJobOperation(operationJobKey)) return;
    await load({ quiet: true });

    Alert.alert(
      queuedAssets.length === 1 ? 'Form saved to SharePoint' : 'GNSS batch uploaded',
      queuedAssets.length === 1
        ? `${queuedAssets[0].name} is now available in ${folder.name || 'this folder'}.`
        : `${queuedAssets.length} session PDFs from ${queuedUpload.folderName || 'this GNSS batch'} are now available in ${folder.name || 'this folder'}.`,
    );
  } catch (uploadError) {
    const completedRecordIds = uploadError?.completedRecordIds || [];
    const completed = new Set(completedRecordIds);
    const remainingAssets = queuedAssets.filter(
      (asset) => !asset.recordId || !completed.has(asset.recordId)
    );
    if (remainingAssets.length < queuedAssets.length) {
      await onPendingUploadHandled?.({
        ...queuedUpload,
        jobNumber: queuedUpload.jobNumber || jobNumber,
        partial: true,
        recordIds: completedRecordIds,
        uploadedAt: new Date().toISOString(),
      });
    }
    if (!isActiveJobOperation(operationJobKey)) return;
    if (remainingAssets.length < queuedAssets.length) {
      setQueuedUpload({ ...queuedUpload, assets: remainingAssets, completedRecordIds });
    }
    Alert.alert(
      'Upload paused',
      completedRecordIds.length
        ? `${completedRecordIds.length} session PDF${completedRecordIds.length === 1 ? '' : 's'} saved before the connection stopped. ${remainingAssets.length} remain queued on this phone.`
        : uploadError?.message || 'The day is still queued on this phone. Try again when reception improves.',
    );
  } finally {
    if (isActiveJobOperation(operationJobKey)) {
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus?.(null);
    }
  }
}, [getAccessToken, isActiveJobOperation, jobKey, jobNumber, load, location, onPendingUploadHandled, queuedAssets, queuedUpload, setQueuedUpload, setUploadProgress, setUploadStatus, setUploading, uploading]);