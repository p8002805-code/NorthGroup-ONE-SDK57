import { graphFetch as sharedGraphFetch } from '../../services/sync/graphClient';
import { resolveJobAppDataLocation } from '../jobFiles/jobFilesService';
import {
  normaliseJobDetailsManifest,
  normaliseJobDetailsSectionDocument,
} from './jobDetailsHubRules';

export const JOB_DETAILS_HUB_MANIFEST_FILE = 'Job Hub.json';
export const LEGACY_JOB_DETAILS_HUB_MANIFEST_FILE = 'NorthGroup ONE Job Hub.json';
export const LEGACY_JOB_DETAILS_HUB_SECTION_PREFIX = 'NorthGroup ONE Job Hub Section - ';

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
  operation = 'Sync Job Details Hub',
  acceptedStatuses = [],
) => sharedGraphFetch(path, accessToken, options, {
  feature: 'jobDetailsHub',
  operation,
  acceptedStatuses,
  retryMode: String(options.method || 'GET').toUpperCase() === 'PUT'
    ? 'idempotent'
    : 'safe',
});

const managedFileName = (sectionId) => (
  `${clean(sectionId).replace(/[^a-z0-9-]/gi, '-')}.json`
);

const legacyManagedFileName = (sectionId) => (
  `${LEGACY_JOB_DETAILS_HUB_SECTION_PREFIX}${clean(sectionId).replace(/[^a-z0-9-]/gi, '-')}.json`
);

const findManagedItem = async ({ accessToken, driveId, folderId, fileName, operation }) => {
  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}?$select=id,name,eTag,lastModifiedDateTime,lastModifiedBy`,
    {},
    operation,
    [404],
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(await readError(response, `${operation} failed (${response.status}).`));
  }
  return response.json();
};

const loadJsonItem = async ({ accessToken, driveId, itemId, operation }) => {
  const response = await graphFetch(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`,
    {},
    operation,
  );
  if (!response.ok) {
    throw new Error(await readError(response, `${operation} failed (${response.status}).`));
  }
  try {
    return JSON.parse(await response.text());
  } catch {
    throw new Error(`${operation} returned an invalid shared file.`);
  }
};

const saveJsonItem = async ({
  accessToken,
  location,
  folderId,
  fileName,
  document,
  itemId,
  eTag,
  storageScope,
  operation,
}) => {
  const replacingExisting = Boolean(itemId) && storageScope !== 'legacy-root';
  const path = replacingExisting
    ? `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(itemId)}/content`
    : `/drives/${encodeURIComponent(location.drive.id)}/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(fileName)}:/content?@microsoft.graph.conflictBehavior=fail`;
  return graphFetch(accessToken, path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(replacingExisting && eTag ? { 'If-Match': eTag } : {}),
    },
    body: JSON.stringify(document, null, 2),
  }, operation);
};

export const loadSharedJobDetailsHub = async ({ accessToken, job }) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  let item = await findManagedItem({
    accessToken,
    driveId: location.drive.id,
    folderId: location.appDataFolder.id,
    fileName: JOB_DETAILS_HUB_MANIFEST_FILE,
    operation: 'Locate Job Details Hub',
  });
  let storageScope = 'app-data';
  if (!item) {
    item = await findManagedItem({
      accessToken,
      driveId: location.drive.id,
      folderId: location.jobFolder.id,
      fileName: LEGACY_JOB_DETAILS_HUB_MANIFEST_FILE,
      operation: 'Locate legacy Job Details Hub',
    });
    storageScope = 'legacy-root';
  }

  if (!item) {
    return {
      ...normaliseJobDetailsManifest({ jobNumber: job?.number }),
      itemId: '',
      eTag: '',
      source: 'sharepoint',
      storageScope: 'app-data',
    };
  }

  const payload = await loadJsonItem({
    accessToken,
    driveId: location.drive.id,
    itemId: item.id,
    operation: 'Load Job Details Hub',
  });
  return {
    ...normaliseJobDetailsManifest(payload),
    itemId: clean(item.id),
    eTag: clean(item.eTag),
    source: 'sharepoint',
    storageScope,
  };
};

export const saveSharedJobDetailsHub = async ({
  accessToken,
  job,
  sections,
  updatedBy,
  itemId,
  eTag,
  storageScope = 'app-data',
}) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const document = normaliseJobDetailsManifest({
    jobNumber: job?.number,
    sections,
    updatedAt: new Date().toISOString(),
    updatedBy: clean(updatedBy) || 'NorthGroup ONE user',
  });
  const response = await saveJsonItem({
    accessToken,
    location,
    folderId: location.appDataFolder.id,
    fileName: JOB_DETAILS_HUB_MANIFEST_FILE,
    document,
    itemId,
    eTag,
    storageScope,
    operation: 'Save Job Details Hub',
  });

  if (!response.ok) {
    if (response.status === 409 || response.status === 412) {
      const conflict = new Error(
        'Another job member changed the Job Details sections first. Their latest layout has been loaded—please apply your change again.',
      );
      conflict.code = 'JOB_DETAILS_HUB_CONFLICT';
      conflict.latest = await loadSharedJobDetailsHub({ accessToken, job }).catch(() => null);
      throw conflict;
    }
    throw new Error(await readError(
      response,
      `The Job Details Hub could not be saved (${response.status}).`,
    ));
  }

  const savedItem = await response.json();
  return {
    ...document,
    itemId: clean(savedItem?.id || (storageScope === 'legacy-root' ? '' : itemId)),
    eTag: clean(savedItem?.eTag),
    source: 'sharepoint',
    storageScope: 'app-data',
  };
};

export const loadSharedJobDetailsSection = async ({ accessToken, job, section }) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const fileName = managedFileName(section?.id);
  let item = await findManagedItem({
    accessToken,
    driveId: location.drive.id,
    folderId: location.sectionsFolder.id,
    fileName,
    operation: `Locate ${section?.title || 'Job Details'} section`,
  });
  let storageScope = 'app-data';
  if (!item) {
    item = await findManagedItem({
      accessToken,
      driveId: location.drive.id,
      folderId: location.jobFolder.id,
      fileName: legacyManagedFileName(section?.id),
      operation: `Locate legacy ${section?.title || 'Job Details'} section`,
    });
    storageScope = 'legacy-root';
  }

  if (!item) {
    return {
      ...normaliseJobDetailsSectionDocument({
        jobNumber: job?.number,
        sectionId: section?.id,
        title: section?.title,
      }, section),
      itemId: '',
      eTag: '',
      source: 'sharepoint',
      storageScope: 'app-data',
    };
  }

  const payload = await loadJsonItem({
    accessToken,
    driveId: location.drive.id,
    itemId: item.id,
    operation: `Load ${section?.title || 'Job Details'} section`,
  });
  return {
    ...normaliseJobDetailsSectionDocument(payload, section),
    itemId: clean(item.id),
    eTag: clean(item.eTag),
    source: 'sharepoint',
    storageScope,
  };
};

export const saveSharedJobDetailsSection = async ({
  accessToken,
  job,
  section,
  brief,
  requirements,
  procedures,
  files,
  updatedBy,
  itemId,
  eTag,
  storageScope = 'app-data',
}) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const document = normaliseJobDetailsSectionDocument({
    jobNumber: job?.number,
    sectionId: section?.id,
    title: section?.title,
    brief,
    requirements,
    procedures,
    files,
    updatedAt: new Date().toISOString(),
    updatedBy: clean(updatedBy) || 'NorthGroup ONE user',
  }, section);
  const response = await saveJsonItem({
    accessToken,
    location,
    folderId: location.sectionsFolder.id,
    fileName: managedFileName(section?.id),
    document,
    itemId,
    eTag,
    storageScope,
    operation: `Save ${section?.title || 'Job Details'} section`,
  });

  if (!response.ok) {
    if (response.status === 409 || response.status === 412) {
      const conflict = new Error(
        `Another job member updated ${section?.title || 'this section'} first. Their latest content has been loaded—review it before saving again.`,
      );
      conflict.code = 'JOB_DETAILS_SECTION_CONFLICT';
      conflict.latest = await loadSharedJobDetailsSection({ accessToken, job, section })
        .catch(() => null);
      throw conflict;
    }
    throw new Error(await readError(
      response,
      `${section?.title || 'The section'} could not be saved (${response.status}).`,
    ));
  }

  const savedItem = await response.json();
  return {
    ...document,
    itemId: clean(savedItem?.id || (storageScope === 'legacy-root' ? '' : itemId)),
    eTag: clean(savedItem?.eTag),
    source: 'sharepoint',
    storageScope: 'app-data',
  };
};
