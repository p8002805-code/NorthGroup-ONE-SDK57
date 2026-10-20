import {
  getSE14UploadState,
  SE14_SESSION_NUMBER_OPTIONS,
  updateSE14Record,
} from '../../utils/se14Records';

const cleanIdentityPart = (value) => String(value || '').trim().toLowerCase();

const sessionIdentity = (record) => {
  const form = record?.data || {};
  const project = cleanIdentityPart(form.projectNumber);
  const mark = cleanIdentityPart(form.markId);
  const session = cleanIdentityPart(form.sessionNumber);
  return project && mark && session ? `${project}::${mark}::${session}` : '';
};

const findDuplicateIdentity = (records = []) => {
  const seen = new Map();

  for (const record of records) {
    const identity = sessionIdentity(record);
    if (!identity) continue;
    if (seen.has(identity)) {
      return {
        first: seen.get(identity),
        second: record,
      };
    }
    seen.set(identity, record);
  }

  return null;
};

const markCorrectedRecordForUpload = (record, changedAt) => {
  if (getSE14UploadState(record) !== 'uploaded') return record;

  return {
    ...record,
    sharePointUpload: {
      ...(record.sharePointUpload || {}),
      state: 'pending',
      queuedAt: changedAt,
      previousUploadedAt:
        record.sharePointUpload?.uploadedAt ||
        record.lastSharePointUploadAt ||
        null,
      uploadedAt: null,
      pdfName: '',
      pdfUri: '',
      lastError: null,
      reason: 'session_number_changed',
    },
  };
};

export const applySE14BulkSessionNumberEdit = ({
  records = [],
  recordIds = [],
  sessionNumber,
  changedAt = new Date().toISOString(),
}) => {
  const selectedNumber = String(sessionNumber || '').trim();
  if (!SE14_SESSION_NUMBER_OPTIONS.includes(selectedNumber)) {
    return { error: 'Choose a Session Number from 1 to 10.' };
  }

  const selectedIds = new Set(recordIds);
  if (!selectedIds.size) return { error: 'Select at least one saved session.' };

  let changedCount = 0;
  let reuploadCount = 0;
  const nextRecords = records.map((record) => {
    if (
      !selectedIds.has(record?.id) ||
      String(record?.data?.sessionNumber || '').trim() === selectedNumber
    ) {
      return record;
    }

    const wasUploaded = getSE14UploadState(record) === 'uploaded';
    const updated = updateSE14Record(record, {
      ...record.data,
      sessionNumber: selectedNumber,
    });
    changedCount += 1;
    if (wasUploaded) reuploadCount += 1;
    return markCorrectedRecordForUpload(updated, changedAt);
  });

  const duplicate = findDuplicateIdentity(nextRecords);
  if (duplicate) {
    const form = duplicate.second?.data || {};
    return {
      error: `${form.markId || 'This mark'} already has Session ${form.sessionNumber}. Change the selection so the same mark is not duplicated.`,
    };
  }

  return { records: nextRecords, changedCount, reuploadCount };
};

export const saveSE14BulkSessionNumberEdit = async ({
  records,
  recordIds,
  sessionNumber,
  persistRecords,
  alert,
}) => {
  const result = applySE14BulkSessionNumberEdit({
    records,
    recordIds,
    sessionNumber,
  });

  if (result.error) {
    alert?.('Session number not changed', result.error);
    return false;
  }

  if (!result.changedCount) {
    alert?.('No changes needed', `The selected records are already Session ${sessionNumber}.`);
    return true;
  }

  try {
    await persistRecords(result.records);
    alert?.(
      'Session numbers updated',
      `${result.changedCount} saved session${result.changedCount === 1 ? '' : 's'} changed to Session ${sessionNumber}.${result.reuploadCount ? ` ${result.reuploadCount} corrected PDF${result.reuploadCount === 1 ? '' : 's'} now need to be uploaded again.` : ''}`
    );
    return true;
  } catch (error) {
    alert?.('Could not update sessions', String(error?.message || error));
    return false;
  }
};
