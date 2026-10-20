import { resolveJobAppDataLocation } from '../jobFiles/jobFilesService';
import { graphFetch as sharedGraphFetch } from '../../services/sync/graphClient';
import {
  describeProgressTaskChanges,
  mergeJobTasksIntoProgress,
  normaliseProgressDocument,
  normaliseProgressTask,
  progressTasksMeaningfullyEqual,
  progressLayerPathKey,
  progressTaskComplete,
  progressTaskRatio,
  sortProgressTasks,
  updateProgressTaskAmount,
} from './jobProgressRules';

export {
  describeProgressTaskChanges,
  mergeJobTasksIntoProgress,
  normaliseProgressTask,
  progressTasksMeaningfullyEqual,
  progressLayerPathKey,
  progressTaskComplete,
  progressTaskRatio,
  sortProgressTasks,
  updateProgressTaskAmount,
} from './jobProgressRules';

export const JOB_PROGRESS_FILE = 'Job Progress.json';
export const LEGACY_JOB_PROGRESS_FILE = 'NorthGroup ONE Job Progress.json';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const readError = async (response, fallback) => {
  let detail = '';
  try {
    detail = (await response.json())?.error?.message || '';
  } catch {
    detail = '';
  }
  return detail || fallback;
};

const graphFetch = (
  accessToken,
  path,
  options = {},
  operation = 'Sync Job Progress',
  acceptedStatuses = [],
) => sharedGraphFetch(path, accessToken, options, {
  feature: 'progress',
  operation,
  acceptedStatuses,
  retryMode: String(options.method || 'GET').toUpperCase() === 'PUT'
    ? 'idempotent'
    : 'safe',
});

const findProgressItem = async ({ accessToken, driveId, folderId, fileName }) => {
  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}?$select=id,name,eTag,lastModifiedDateTime,lastModifiedBy`,
    {},
    'Locate shared Job Progress',
    [404],
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readError(
      response,
      `Shared job progress could not be located (${response.status}).`,
    ));
  }
  return response.json();
};

export const loadSharedJobProgress = async ({ accessToken, job }) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  let item = await findProgressItem({
    accessToken,
    driveId: location.drive.id,
    folderId: location.appDataFolder.id,
    fileName: JOB_PROGRESS_FILE,
  });
  let storageScope = 'app-data';
  if (!item) {
    item = await findProgressItem({
      accessToken,
      driveId: location.drive.id,
      folderId: location.jobFolder.id,
      fileName: LEGACY_JOB_PROGRESS_FILE,
    });
    storageScope = 'legacy-root';
  }

  if (!item) {
    return {
      ...normaliseProgressDocument({ jobNumber: job?.number }),
      itemId: '',
      eTag: '',
      storageScope: 'app-data',
    };
  }

  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(item.id)}/content`,
    {},
    'Load shared Job Progress',
  );
  if (!response.ok) {
    throw new Error(await readError(
      response,
      `Shared job progress could not be downloaded (${response.status}).`,
    ));
  }

  let document;
  try {
    document = normaliseProgressDocument(JSON.parse(await response.text()));
  } catch {
    throw new Error('The shared job progress file is not valid.');
  }

  const requestedJobNumber = clean(job?.number);
  if (document.jobNumber && requestedJobNumber && document.jobNumber !== requestedJobNumber) {
    const mismatch = new Error(
      `This Job Progress file belongs to job ${document.jobNumber}, not job ${requestedJobNumber}. Nothing was changed.`,
    );
    mismatch.code = 'JOB_PROGRESS_JOB_MISMATCH';
    throw mismatch;
  }

  return {
    ...document,
    itemId: clean(item.id),
    eTag: clean(item.eTag),
    storageScope,
  };
};

export const saveSharedJobProgress = async ({
  accessToken,
  job,
  tasks,
  updatedBy,
  itemId,
  eTag,
  storageScope = 'app-data',
}) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const document = normaliseProgressDocument({
    jobNumber: job?.number,
    tasks,
    updatedAt: new Date().toISOString(),
    updatedBy: clean(updatedBy) || 'NorthGroup ONE user',
  });

  const replacingExisting = Boolean(itemId) && storageScope !== 'legacy-root';
  const path = replacingExisting
    ? `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(itemId)}/content`
    : `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(location.appDataFolder.id)}:/${encodeURIComponent(JOB_PROGRESS_FILE)}:/content?@microsoft.graph.conflictBehavior=fail`;
  const response = await graphFetch(accessToken, path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(replacingExisting && eTag ? { 'If-Match': eTag } : {}),
    },
    body: JSON.stringify(document, null, 2),
  }, 'Save shared Job Progress');

  if (!response.ok) {
    if (response.status === 409 || response.status === 412) {
      const conflict = new Error(
        'Another user updated Job Progress first. Their latest changes have been loaded—please apply yours again.',
      );
      conflict.code = 'JOB_PROGRESS_CONFLICT';
      conflict.latest = await loadSharedJobProgress({ accessToken, job }).catch(() => null);
      throw conflict;
    }
    throw new Error(await readError(
      response,
      `Shared job progress could not be saved (${response.status}).`,
    ));
  }

  const savedItem = await response.json();
  return {
    ...document,
    itemId: clean(savedItem?.id || (replacingExisting ? itemId : '')),
    eTag: clean(savedItem?.eTag),
    storageScope: 'app-data',
  };
};

const progressTasksEqual = (left = [], right = []) => (
  JSON.stringify(left) === JSON.stringify(right)
);

export const syncSuggestedJobProgress = async ({
  accessToken,
  job,
  shared,
  suggestedTasks,
  authoritative = false,
  updatedBy,
}) => {
  const mergedTasks = mergeJobTasksIntoProgress(
    shared?.tasks,
    suggestedTasks,
    { authoritative },
  );
  if (progressTasksEqual(mergedTasks, shared?.tasks)) return shared;

  try {
    return await saveSharedJobProgress({
      accessToken,
      job,
      tasks: mergedTasks,
      updatedBy,
      itemId: shared?.itemId,
      eTag: shared?.eTag,
      storageScope: shared?.storageScope,
    });
  } catch (error) {
    if (!error?.latest) throw error;
    const latestTasks = mergeJobTasksIntoProgress(
      error.latest.tasks,
      suggestedTasks,
      { authoritative },
    );
    if (progressTasksEqual(latestTasks, error.latest.tasks)) return error.latest;
    return saveSharedJobProgress({
      accessToken,
      job,
      tasks: latestTasks,
      updatedBy,
      itemId: error.latest.itemId,
      eTag: error.latest.eTag,
      storageScope: error.latest.storageScope,
    });
  }
};
