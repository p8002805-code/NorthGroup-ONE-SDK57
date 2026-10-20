import { graphFetch as sharedGraphFetch } from '../../services/sync/graphClient';
import { resolveJobAppDataLocation } from '../jobFiles/jobFilesService';

export const JOB_WORKSPACE_META_FILE = 'Workspace Overview.json';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const readError = async (response, fallback) => {
  try {
    return (await response.json())?.error?.message || fallback;
  } catch {
    return fallback;
  }
};

const graphFetch = (
  accessToken,
  path,
  options = {},
  operation = 'Sync Workspace Overview',
  acceptedStatuses = [],
) => sharedGraphFetch(path, accessToken, options, {
  feature: 'workspaceOverview',
  operation,
  acceptedStatuses,
  retryMode: String(options.method || 'GET').toUpperCase() === 'PUT'
    ? 'idempotent'
    : 'safe',
});

export const normaliseWorkspaceMetaDocument = (payload = {}) => ({
  version: 1,
  jobNumber: clean(payload.jobNumber),
  scheduleStart: clean(payload.scheduleStart),
  scheduleEnd: clean(payload.scheduleEnd),
  location: clean(payload.location),
  updatedAt: clean(payload.updatedAt),
  updatedBy: clean(payload.updatedBy),
});

const locateWorkspaceMeta = async ({ accessToken, driveId, folderId }) => {
  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(JOB_WORKSPACE_META_FILE)}?$select=id,name,eTag,lastModifiedDateTime,lastModifiedBy`,
    {},
    'Locate Workspace Overview',
    [404],
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readError(response, `Workspace Overview could not be located (${response.status}).`));
  }
  return response.json();
};

export const loadSharedJobWorkspaceMeta = async ({ accessToken, job }) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const item = await locateWorkspaceMeta({
    accessToken,
    driveId: location.drive.id,
    folderId: location.appDataFolder.id,
  });
  if (!item) {
    return {
      ...normaliseWorkspaceMetaDocument({ jobNumber: job?.number }),
      itemId: '',
      eTag: '',
      source: 'sharepoint',
    };
  }

  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(item.id)}/content`,
    {},
    'Load Workspace Overview',
  );
  if (!response.ok) {
    throw new Error(await readError(response, `Workspace Overview could not be downloaded (${response.status}).`));
  }

  let document;
  try {
    document = normaliseWorkspaceMetaDocument(JSON.parse(await response.text()));
  } catch {
    throw new Error('The shared Workspace Overview file is not valid.');
  }
  const expectedJob = clean(job?.number).toUpperCase();
  if (document.jobNumber && expectedJob && document.jobNumber.toUpperCase() !== expectedJob) {
    throw new Error(`The shared Workspace Overview belongs to job ${document.jobNumber}, not job ${job.number}.`);
  }

  return {
    ...document,
    itemId: clean(item.id),
    eTag: clean(item.eTag),
    source: 'sharepoint',
  };
};

export const saveSharedJobWorkspaceMeta = async ({
  accessToken,
  job,
  scheduleStart,
  scheduleEnd,
  location: siteLocation,
  updatedBy,
  itemId,
  eTag,
}) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const document = normaliseWorkspaceMetaDocument({
    jobNumber: job?.number,
    scheduleStart,
    scheduleEnd,
    location: siteLocation,
    updatedAt: new Date().toISOString(),
    updatedBy: clean(updatedBy) || 'NorthGroup ONE user',
  });
  const replacingExisting = Boolean(itemId);
  const path = replacingExisting
    ? `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(itemId)}/content`
    : `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(location.appDataFolder.id)}:/${encodeURIComponent(JOB_WORKSPACE_META_FILE)}:/content?@microsoft.graph.conflictBehavior=fail`;
  const response = await graphFetch(accessToken, path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(replacingExisting && eTag ? { 'If-Match': eTag } : {}),
    },
    body: JSON.stringify(document, null, 2),
  }, 'Save Workspace Overview');

  if (!response.ok) {
    if (response.status === 409 || response.status === 412) {
      const conflict = new Error(
        'Another job member updated the Workspace first. Their latest details have been loaded—review them before saving again.',
      );
      conflict.code = 'JOB_WORKSPACE_META_CONFLICT';
      conflict.latest = await loadSharedJobWorkspaceMeta({ accessToken, job }).catch(() => null);
      throw conflict;
    }
    throw new Error(await readError(response, `Workspace Overview could not be saved (${response.status}).`));
  }

  const savedItem = await response.json();
  return {
    ...document,
    itemId: clean(savedItem?.id || itemId),
    eTag: clean(savedItem?.eTag),
    source: 'sharepoint',
  };
};
