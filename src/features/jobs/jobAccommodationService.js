import { graphFetch as sharedGraphFetch } from '../../services/sync/graphClient';
import { resolveJobAppDataLocation } from '../jobFiles/jobFilesService';

export const JOB_ACCOMMODATION_FILE = 'Accommodation.json';
export const LEGACY_JOB_ACCOMMODATION_FILE = 'NorthGroup ONE Accommodation.json';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const cleanMultiline = (value) => String(value || '').replace(/\r/g, '').trim();

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
  operation = 'Sync Accommodation',
  acceptedStatuses = [],
) => sharedGraphFetch(path, accessToken, options, {
  feature: 'accommodation',
  operation,
  acceptedStatuses,
  retryMode: String(options.method || 'GET').toUpperCase() === 'PUT'
    ? 'idempotent'
    : 'safe',
});

export const normaliseAccommodationDocument = (payload = {}) => ({
  version: 1,
  jobNumber: clean(payload.jobNumber),
  accommodation: cleanMultiline(payload.accommodation),
  updatedAt: clean(payload.updatedAt),
  updatedBy: clean(payload.updatedBy),
});

const findAccommodationItem = async ({ accessToken, driveId, folderId, fileName }) => {
  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}?$select=id,name,eTag,lastModifiedDateTime,lastModifiedBy`,
    {},
    'Locate shared Accommodation',
    [404],
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readError(
      response,
      `Shared accommodation could not be located (${response.status}).`,
    ));
  }
  return response.json();
};

export const loadSharedJobAccommodation = async ({ accessToken, job }) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  let item = await findAccommodationItem({
    accessToken,
    driveId: location.drive.id,
    folderId: location.appDataFolder.id,
    fileName: JOB_ACCOMMODATION_FILE,
  });
  let storageScope = 'app-data';
  if (!item) {
    item = await findAccommodationItem({
      accessToken,
      driveId: location.drive.id,
      folderId: location.jobFolder.id,
      fileName: LEGACY_JOB_ACCOMMODATION_FILE,
    });
    storageScope = 'legacy-root';
  }

  if (!item) {
    return {
      ...normaliseAccommodationDocument({ jobNumber: job?.number }),
      itemId: '',
      eTag: '',
      source: 'sharepoint',
      storageScope: 'app-data',
    };
  }

  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(item.id)}/content`,
    {},
    'Load shared Accommodation',
  );
  if (!response.ok) {
    throw new Error(await readError(
      response,
      `Shared accommodation could not be downloaded (${response.status}).`,
    ));
  }

  let document;
  try {
    document = normaliseAccommodationDocument(JSON.parse(await response.text()));
  } catch {
    throw new Error('The shared accommodation file is not valid.');
  }

  return {
    ...document,
    itemId: clean(item.id),
    eTag: clean(item.eTag),
    source: 'sharepoint',
    storageScope,
  };
};

export const saveSharedJobAccommodation = async ({
  accessToken,
  job,
  accommodation,
  updatedBy,
  itemId,
  eTag,
  storageScope = 'app-data',
}) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const document = normaliseAccommodationDocument({
    jobNumber: job?.number,
    accommodation,
    updatedAt: new Date().toISOString(),
    updatedBy: clean(updatedBy) || 'NorthGroup ONE user',
  });
  const replacingExisting = Boolean(itemId) && storageScope !== 'legacy-root';
  const path = replacingExisting
    ? `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(itemId)}/content`
    : `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(location.appDataFolder.id)}:/${encodeURIComponent(JOB_ACCOMMODATION_FILE)}:/content?@microsoft.graph.conflictBehavior=fail`;
  const response = await graphFetch(accessToken, path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(replacingExisting && eTag ? { 'If-Match': eTag } : {}),
    },
    body: JSON.stringify(document, null, 2),
  }, 'Save shared Accommodation');

  if (!response.ok) {
    if (response.status === 409 || response.status === 412) {
      const conflict = new Error(
        'Another job member updated Accommodation first. Their latest details have been loaded—review them before saving again.',
      );
      conflict.code = 'JOB_ACCOMMODATION_CONFLICT';
      conflict.latest = await loadSharedJobAccommodation({ accessToken, job }).catch(() => null);
      throw conflict;
    }
    throw new Error(await readError(
      response,
      `Shared accommodation could not be saved (${response.status}).`,
    ));
  }

  const savedItem = await response.json();
  return {
    ...document,
    itemId: clean(savedItem?.id || (replacingExisting ? itemId : '')),
    eTag: clean(savedItem?.eTag),
    source: 'sharepoint',
    storageScope: 'app-data',
  };
};
