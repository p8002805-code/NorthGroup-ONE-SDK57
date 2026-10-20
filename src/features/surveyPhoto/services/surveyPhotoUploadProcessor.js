import * as FileSystem from 'expo-file-system/legacy';

import { uploadSurveyPhotoExport } from '../../jobFiles/jobFilesService';
import {
  buildSurveyPhotoZipName,
  getSurveyPhotoZipPartInfo,
} from './surveyPhotoRules';
import {
  deleteSurveyPhotoUploadAsset,
  readSurveyPhotoUploadOutbox,
  removeSurveyPhotoUpload,
  surveyPhotoUploadErrorIsRetryable,
  surveyPhotoUploadRetryDelay,
  updateSurveyPhotoUpload,
} from './surveyPhotoUploadOutbox';

let activeProcess = null;

const clampProgress = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const assetSize = (item) => Math.max(1, Number(item?.asset?.size) || 1);
const assetPhotoCount = (item) => Math.max(0, Number(item?.asset?.photoCount) || 0);
const isZipItem = (item) => item?.asset?.mimeType === 'application/zip'
  || /\.zip$/i.test(item?.asset?.name || '');

const eligibleForRun = (item, includeFailed) => {
  // Only this module marks items 'uploading', and only one run happens at a
  // time. So an item still 'uploading' when a run STARTS was left behind by an
  // app that was closed or crashed mid-upload. Pick it up again; uploads use
  // conflictBehavior 'replace', so re-sending is safe.
  const leftBehind = item?.status === 'uploading';
  const eligible = item?.status === 'queued'
    || leftBehind
    || (includeFailed && item?.status === 'failed');
  if (!eligible) return false;
  return leftBehind || includeFailed || Number(item?.nextRetryAt || 0) <= Date.now();
};

const runUploadProcessor = async ({
  getAccessToken,
  includeFailed = false,
  initials = '',
  onChange,
  onProgress,
  onStatus,
}) => {
  if (typeof getAccessToken !== 'function') {
    return {
      uploaded: 0,
      uploadedPhotoCount: 0,
      uploadedPackageCount: 0,
      remaining: 0,
      lastUploaded: null,
    };
  }

  let queue = await readSurveyPhotoUploadOutbox();
  onChange?.(queue);

  const runItems = queue.filter((item) => eligibleForRun(item, includeFailed));
  const totalBytes = runItems.reduce((sum, item) => sum + assetSize(item), 0);
  const knownTotalPhotoCount = runItems.reduce((sum, item) => sum + assetPhotoCount(item), 0);
  let completedBytes = 0;
  let uploadedCount = 0;
  let uploadedPhotoCount = 0;
  let uploadedPackageCount = 0;
  let lastUploaded = null;
  let interrupted = false;
  const emitStatus = (status) => onStatus?.({ context: 'sharepoint', ...status });

  if (runItems.length) {
    emitStatus({
      phase: 'uploading',
      progress: 0,
      packageNumber: 1,
      packageCount: runItems.length,
      totalPhotoCount: knownTotalPhotoCount,
    });
  }

  for (let runIndex = 0; runIndex < runItems.length; runIndex += 1) {
    const savedItem = runItems[runIndex];
    const itemBytes = assetSize(savedItem);
    const zipPartFromName = getSurveyPhotoZipPartInfo(savedItem.asset?.name);
    const partNumber = Math.max(0, Number(savedItem.asset?.partNumber) || zipPartFromName.partNumber || 0);
    const partCount = Math.max(0, Number(savedItem.asset?.partCount) || zipPartFromName.partCount || 0);

    queue = await updateSurveyPhotoUpload(savedItem.id, {
      status: 'uploading',
      progress: 0,
      error: '',
      nextRetryAt: 0,
    });
    onChange?.(queue);

    try {
      const fileInfo = await FileSystem.getInfoAsync(savedItem.asset?.uri, { size: true });
      if (!fileInfo.exists) {
        const missing = new Error('The queued photo export is no longer available on this iPhone.');
        missing.code = 'UPLOAD_FILE_MISSING';
        missing.status = 400;
        throw missing;
      }

      const accessToken = await getAccessToken();
      const authoritativeInitials = String(initials || savedItem.initials || 'NG')
        .trim()
        .toUpperCase() || 'NG';
      const zip = isZipItem(savedItem);
      const uploadAsset = zip
        ? {
          ...savedItem.asset,
          name: buildSurveyPhotoZipName({
            projectNumber: savedItem.job?.number,
            initials: authoritativeInitials,
            exportedAt: savedItem.createdAt || new Date(),
            kind: savedItem.kind,
            partNumber: partNumber || null,
            partCount: partCount || null,
          }),
        }
        : savedItem.asset;
      const statusBase = {
        packageNumber: runIndex + 1,
        packageCount: runItems.length,
        partNumber: partNumber || runIndex + 1,
        partCount: partCount || runItems.length,
        photoCount: assetPhotoCount(savedItem),
        totalPhotoCount: knownTotalPhotoCount,
        fileName: uploadAsset.name,
      };

      emitStatus({
        ...statusBase,
        phase: 'uploading',
        progress: totalBytes ? completedBytes / totalBytes : 0,
        itemProgress: 0,
      });

      const uploaded = await uploadSurveyPhotoExport({
        accessToken,
        job: savedItem.job,
        initials: authoritativeInitials,
        asset: uploadAsset,
        conflictBehavior: 'replace',
        onProgress: (progress) => {
          const nextProgress = clampProgress(progress);
          const overallProgress = totalBytes
            ? (completedBytes + itemBytes * nextProgress) / totalBytes
            : nextProgress;
          onProgress?.(savedItem.id, nextProgress);
          emitStatus({
            ...statusBase,
            phase: nextProgress >= 1 ? 'confirming' : 'uploading',
            progress: clampProgress(overallProgress),
            itemProgress: nextProgress,
          });
        },
      });

      emitStatus({
        ...statusBase,
        phase: 'confirming',
        progress: clampProgress(totalBytes ? (completedBytes + itemBytes) / totalBytes : 1),
        itemProgress: 1,
      });

      const removed = await removeSurveyPhotoUpload(savedItem.id);
      await deleteSurveyPhotoUploadAsset(removed.removed || savedItem).catch(() => undefined);
      queue = removed.items;
      onChange?.(queue);
      completedBytes += itemBytes;
      uploadedCount += 1;
      uploadedPhotoCount += assetPhotoCount(savedItem) || (zip ? 0 : 1);
      if (zip) uploadedPackageCount += 1;
      lastUploaded = { item: savedItem, uploaded };
    } catch (uploadError) {
      const retryable = surveyPhotoUploadErrorIsRetryable(uploadError);
      const attempts = Number(savedItem.attempts || 0) + 1;
      queue = await updateSurveyPhotoUpload(savedItem.id, {
        status: retryable ? 'queued' : 'failed',
        progress: 0,
        attempts,
        nextRetryAt: retryable
          ? Date.now() + surveyPhotoUploadRetryDelay(attempts)
          : 0,
        error: uploadError?.message || 'The SharePoint upload could not be completed.',
      });
      onChange?.(queue);
      interrupted = true;
      emitStatus({
        phase: 'interrupted',
        progress: clampProgress(totalBytes ? completedBytes / totalBytes : 0),
        packageNumber: runIndex + 1,
        packageCount: runItems.length,
        partNumber: partNumber || runIndex + 1,
        partCount: partCount || runItems.length,
        photoCount: assetPhotoCount(savedItem),
        totalPhotoCount: knownTotalPhotoCount,
        fileName: savedItem.asset?.name,
      });
      if (retryable) break;
    }
  }

  if (!interrupted && runItems.length && uploadedCount === runItems.length) {
    emitStatus({
      phase: 'complete',
      progress: 1,
      packageNumber: runItems.length,
      packageCount: runItems.length,
      totalPhotoCount: uploadedPhotoCount || knownTotalPhotoCount,
      uploadedPhotoCount,
      uploadedPackageCount,
    });
  }

  return {
    uploaded: uploadedCount,
    uploadedPhotoCount,
    uploadedPackageCount,
    remaining: queue.length,
    lastUploaded,
  };
};

// ---------------------------------------------------------------------------
// One upload "drain" at a time. Anyone who asks while it is running:
//   - gets their progress callbacks added to the running drain, and
//   - makes the drain go round once more when it finishes, so photos queued
//     (or "retry failed" pressed) mid-run are not left waiting for the next
//     app-foreground or network-change event.
// ---------------------------------------------------------------------------
let drain = null;
let rerun = null;
let lastStatus = null;
let latestAuth = { getAccessToken: null, initials: '' };
const subscribers = new Set();

const notify = (name, ...args) => {
  subscribers.forEach((subscriber) => {
    try {
      subscriber[name]?.(...args);
    } catch (_error) {
      // A broken listener must never stop an upload.
    }
  });
};

const mergeResults = (first, second) => ({
  uploaded: first.uploaded + second.uploaded,
  uploadedPhotoCount: first.uploadedPhotoCount + second.uploadedPhotoCount,
  uploadedPackageCount: first.uploadedPackageCount + second.uploadedPackageCount,
  remaining: second.remaining,
  lastUploaded: second.lastUploaded || first.lastUploaded,
});

const runOnce = (includeFailed) => runUploadProcessor({
  getAccessToken: latestAuth.getAccessToken,
  initials: latestAuth.initials,
  includeFailed,
  onChange: (queue) => notify('onChange', queue),
  onProgress: (id, progress) => notify('onProgress', id, progress),
  onStatus: (status) => {
    lastStatus = status;
    notify('onStatus', status);
  },
});

export const processSurveyPhotoUploadOutbox = (options = {}) => {
  const {
    getAccessToken,
    initials,
    includeFailed = false,
    onChange,
    onProgress,
    onStatus,
  } = options;

  if (typeof getAccessToken === 'function') {
    latestAuth = { getAccessToken, initials: initials ?? latestAuth.initials };
  }
  subscribers.add({ onChange, onProgress, onStatus });

  if (drain) {
    rerun = { includeFailed: Boolean(rerun?.includeFailed || includeFailed) };
    if (lastStatus && onStatus) {
      try {
        onStatus(lastStatus);
      } catch (_error) {
        // ignore
      }
    }
    return drain;
  }

  const run = (async () => {
    try {
      let total = await runOnce(includeFailed);
      while (rerun) {
        const next = rerun;
        rerun = null;
        total = mergeResults(total, await runOnce(next.includeFailed));
      }
      return total;
    } finally {
      // No await between the `while (rerun)` check above and this block, so a
      // request can never slip in unseen.
      drain = null;
      rerun = null;
      lastStatus = null;
      subscribers.clear();
    }
  })();
  drain = run;
  return run;
};