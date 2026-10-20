import {
  getSE14CompletionIssue,
  markSE14RecordsUploaded,
  queueSE14RecordForUpload,
} from '../../utils/se14Records';

export const persistSE14ForUploadDay = async ({
  form,
  pdf,
  recordId,
  records,
  persistRecords,
  updateFormStatus,
}) => {
  const issue = getSE14CompletionIssue(form);
  if (issue) throw Object.assign(new Error(issue.message), { issue });

  const current = records.find((record) => record.id === recordId);
  if (!current) throw new Error('This GNSS session could not be found.');

  const queued = queueSE14RecordForUpload(current, form, pdf);
  await persistRecords(records.map((record) => (
    record.id === recordId ? queued : record
  )));
  await updateFormStatus('se14', 'complete', {
    date: form.startDate,
    completedAt: queued.completedAt,
  });
  return queued;
};

export const persistSE14UploadCompletion = ({
  recordIds,
  records,
  persistRecords,
}) => persistRecords(markSE14RecordsUploaded(records, recordIds));

export const saveSE14ForUploadDayWithFeedback = async (options) => {
  try {
    const queued = await persistSE14ForUploadDay(options);
    options.alert(
      'Saved for later upload',
      `${queued.name} is safe on this phone inside ${queued.data.endDate || 'its completed day'}. Upload the whole day from Archived Sessions when reception returns.`
    );
    return true;
  } catch (error) {
    options.alert(
      error?.issue ? 'More information required' : 'Could not save session',
      String(error?.message || error)
    );
    return false;
  }
};
