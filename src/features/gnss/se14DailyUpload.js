import { prepareSE14Pdf } from '../../export/exportSE14Pdf';
import { getSE14CompletionIssue, getSE14UploadState } from '../../utils/se14Records';

export const prepareSE14DayUpload = async ({
  group,
  initials = '',
  onProgress,
}) => {
  const pendingRecords = (group?.records || []).filter(
    (record) => getSE14UploadState(record) !== 'uploaded'
  );

  if (!pendingRecords.length) return { state: 'empty' };

  await onProgress?.({
    phase: 'checking',
    current: 0,
    total: pendingRecords.length,
    progress: 0.04,
    record: null,
  });

  const incompleteRecord = pendingRecords.find(
    (record) => getSE14CompletionIssue(record.data)
  );

  if (incompleteRecord) {
    return {
      state: 'incomplete',
      record: incompleteRecord,
      issue: getSE14CompletionIssue(incompleteRecord.data),
    };
  }

  const assets = [];
  for (let index = 0; index < pendingRecords.length; index += 1) {
    const record = pendingRecords[index];
    await onProgress?.({
      phase: 'preparing',
      current: index + 1,
      total: pendingRecords.length,
      progress: 0.08 + (index / pendingRecords.length) * 0.84,
      record,
    });
    const pdf = await prepareSE14Pdf(record.data, initials);
    if (!pdf?.exportUri) {
      throw new Error(`${record?.name || 'A GNSS session'} could not be prepared.`);
    }
    assets.push({
      uri: pdf.exportUri,
      name: pdf.exportName,
      mimeType: 'application/pdf',
      source: 'se14',
      recordId: record.id,
    });
    await onProgress?.({
      phase: 'prepared',
      current: index + 1,
      total: pendingRecords.length,
      progress: 0.08 + ((index + 1) / pendingRecords.length) * 0.84,
      record,
    });
  }

  await onProgress?.({
    phase: 'ready',
    current: pendingRecords.length,
    total: pendingRecords.length,
    progress: 1,
    record: null,
  });

  return {
    state: 'ready',
    payload: {
      source: 'se14-day',
      jobNumber: pendingRecords[0]?.data?.projectNumber || '',
      folderName: group.folderName,
      recordIds: pendingRecords.map((record) => record.id),
      assets,
    },
  };
};
