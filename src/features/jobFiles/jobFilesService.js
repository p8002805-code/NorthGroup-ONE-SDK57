import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import {
  graphCollection,
  graphFetch,
  graphRequest as sharedGraphRequest,
  syncFetch,
} from '../../services/sync/graphClient';
import {
  createAuthenticatedGraphUploadTask,
  downloadMicrosoftGraphFile,
} from '../../services/sync/graphFileTransfer';
import { trackSyncOperation } from '../../services/sync/syncState';
import {
  JOB_FILES_DOWNLOAD_CACHE_DIRECTORY,
  JOB_FILES_SHARE_CACHE_DIRECTORY,
  JOB_FILES_UPLOAD_CACHE_DIRECTORY,
  removePrivateCacheFile,
} from '../../services/security/privateFileCache';
import {
  buildJobFileCacheName,
  isCompleteJobFileDownload,
  isManagedJobWorkspaceFile,
  isSecureMicrosoftTransferUrl,
  JOB_APP_DATA_FOLDER,
  JOB_APP_DATA_SECTIONS_FOLDER,
  sanitiseJobFileName,
  validateJobFileUploadSource,
} from './jobFilesRules';
export { JOB_APP_DATA_FOLDER, JOB_APP_DATA_SECTIONS_FOLDER } from './jobFilesRules';
import {
  findReusableJobFile,
  jobFileDownloadDirectory,
} from './jobFileCache';
import { secureRandomId } from '../../services/security/secureRandom';
import { MAX_TEXT_PREVIEW_BYTES } from './jobFilePreview';

const SHAREPOINT_HOST = 'northsurveys.sharepoint.com';
const SHAREPOINT_SITE_PATH = '/sites/NorthGroupONE';
const JOB_FILES_LIBRARY = 'Job Files';
const JOB_BRIEF_FILE = 'NorthGroup ONE Job Details.json';
const APP_DATA_JOB_BRIEF_FILE = 'Job Details.json';
const JOB_BRIEF_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-job-briefs/`;
const DIRECT_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const UPLOAD_CHUNK_BYTES = 10 * 320 * 1024;
const MAX_JOB_FILE_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_CHUNK_ATTEMPTS = 3;
const MAX_TEST_UPLOAD_BYTES = MAX_JOB_FILE_UPLOAD_BYTES;
export const MAX_SCAN_UPLOAD_BYTES = 200 * 1024 * 1024;
const JOB_LOCATION_CACHE_TTL_MS = 2 * 60 * 1000;
const activeDownloads = new Map();
const jobLocationCache = new Map();
const jobLocationRequests = new Map();
const jobAppDataLocationCache = new Map();
const jobAppDataLocationRequests = new Map();

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const cleanMultiline = (value) => String(value || '').replace(/\r/g, '').trim();
const encodePathPart = (value) => encodeURIComponent(String(value || ''));

const sortJobItems = (items = []) => items
  .filter((item) => !isManagedJobWorkspaceFile(item))
  .sort((a, b) => {
    if (Boolean(a.folder) !== Boolean(b.folder)) return a.folder ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), 'en-AU', { numeric: true });
  });

const validateJobItemName = (name) => {
  const nextName = String(name || '').trim();
  if (!nextName) throw new Error('Enter a name before saving.');
  if (nextName === '.' || nextName === '..') {
    throw new Error('Choose a different file or folder name.');
  }
  if (nextName.length > 255) {
    throw new Error('The name must be 255 characters or fewer.');
  }
  if (/["*:<>?/\\|]/.test(nextName)) {
    throw new Error('Names cannot contain " * : < > ? / \\ or |.');
  }
  return nextName;
};

const jobFilesGraphConfig = (operation, jobNumber = '') => ({
  feature: 'jobFiles',
  operation,
  jobNumber,
});

const graphRequest = (accessToken, path, options = {}, operation = 'Update Job Files') => (
  sharedGraphRequest(path, accessToken, options, jobFilesGraphConfig(operation))
);

const listAll = (accessToken, initialPath, operation = 'Load Job Files') => (
  graphCollection(initialPath, accessToken, jobFilesGraphConfig(operation))
);

const normaliseFolderName = (value) => clean(value)
  .toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/\s*-\s*/g, ' - ');

export const expectedJobFolderName = (job) => [
  clean(job?.number),
  clean(job?.name),
  clean(job?.location),
].filter(Boolean).join(' - ');

const jobLocationCacheKey = (job) => normaliseFolderName(expectedJobFolderName(job));

const resolveJobFilesLibrary = async (accessToken) => {
  const site = await graphRequest(
    accessToken,
    `/sites/${SHAREPOINT_HOST}:${SHAREPOINT_SITE_PATH}?$select=id,displayName,webUrl`,
  );
  const drives = await listAll(accessToken, `/sites/${site.id}/drives?$select=id,name,webUrl`);
  const drive = drives.find((item) => clean(item.name).toLowerCase() === JOB_FILES_LIBRARY.toLowerCase());
  if (!drive) throw new Error(`The SharePoint library “${JOB_FILES_LIBRARY}” could not be found.`);

  const rootItems = await listAll(
    accessToken,
    `/drives/${encodePathPart(drive.id)}/root/children?$select=id,name,folder,file,size,eTag,lastModifiedDateTime,lastModifiedBy,webUrl,@microsoft.graph.downloadUrl`,
  );
  return { site, drive, rootItems };
};

const findJobFolder = ({ job, rootItems }) => {
  const folders = rootItems.filter((item) => item.folder);
  const expected = normaliseFolderName(expectedJobFolderName(job));
  const exact = folders.find((item) => normaliseFolderName(item.name) === expected);
  const numberPrefix = `${clean(job.number).toLowerCase()} `;
  const numberMatches = folders.filter((item) => {
    const name = normaliseFolderName(item.name);
    return name === clean(job.number).toLowerCase()
      || name.startsWith(numberPrefix)
      || name.startsWith(`${clean(job.number).toLowerCase()} -`);
  });
  if (numberMatches.length > 1 && !exact) {
    throw new Error(`More than one SharePoint folder starts with job ${job.number}. Rename them so the job number is unique.`);
  }
  return exact || (numberMatches.length === 1 ? numberMatches[0] : null);
};

export const clearJobFilesLocationCache = (job = null) => {
  if (!job) {
    jobLocationCache.clear();
    jobLocationRequests.clear();
    jobAppDataLocationCache.clear();
    jobAppDataLocationRequests.clear();
    return;
  }
  const cacheKey = jobLocationCacheKey(job);
  jobLocationCache.delete(cacheKey);
  jobLocationRequests.delete(cacheKey);
  jobAppDataLocationCache.delete(cacheKey);
  jobAppDataLocationRequests.delete(cacheKey);
};

const resolveJobFilesLocationUncached = async ({ accessToken, job }) => {
  if (!clean(job?.number)) throw new Error('Choose an active job before opening Job Files.');
  const { site, drive, rootItems } = await resolveJobFilesLibrary(accessToken);
  const folder = findJobFolder({ job, rootItems });

  if (!folder) {
    const error = new Error(
      `No SharePoint folder was found for job ${job.number}. Expected something like “${expectedJobFolderName(job)}”.`,
    );
    error.code = 'JOB_FILES_FOLDER_NOT_FOUND';
    error.expectedFolderName = expectedJobFolderName(job);
    throw error;
  }

  return { site, drive, folder };
};

export const createJobFilesWorkspace = async ({ accessToken, job, name }) => {
  if (!clean(job?.number)) throw new Error('Choose an active job before creating Job Files.');
  const folderName = validateJobItemName(name || expectedJobFolderName(job));
  const jobNumber = clean(job.number);
  const normalisedName = normaliseFolderName(folderName);
  if (
    normalisedName !== jobNumber.toLowerCase()
    && !normalisedName.startsWith(`${jobNumber.toLowerCase()} `)
    && !normalisedName.startsWith(`${jobNumber.toLowerCase()} -`)
  ) {
    throw new Error(`The folder name must begin with job number ${jobNumber}.`);
  }

  const library = await resolveJobFilesLibrary(accessToken);
  const existing = findJobFolder({ job, rootItems: library.rootItems });
  let folder = existing;
  let created = false;
  if (!folder) {
    try {
      folder = await graphRequest(
        accessToken,
        `/drives/${encodePathPart(library.drive.id)}/root/children`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'fail',
          }),
        },
        'Create job workspace',
      );
      created = true;
    } catch (error) {
      if (error?.status !== 409) throw error;
      const refreshed = await resolveJobFilesLibrary(accessToken);
      folder = findJobFolder({ job, rootItems: refreshed.rootItems });
      if (!folder) throw error;
    }
  }

  const location = { site: library.site, drive: library.drive, folder };
  jobLocationCache.set(jobLocationCacheKey(job), { cachedAt: Date.now(), location });
  return { ...location, created };
};

export const resolveJobFilesLocation = async ({ accessToken, job }) => {
  if (!clean(job?.number)) throw new Error('Choose an active job before opening Job Files.');
  const cacheKey = jobLocationCacheKey(job);
  const cached = jobLocationCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < JOB_LOCATION_CACHE_TTL_MS) {
    return cached.location;
  }

  const existingRequest = jobLocationRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = resolveJobFilesLocationUncached({ accessToken, job });
  jobLocationRequests.set(cacheKey, request);
  try {
    const location = await request;
    jobLocationCache.set(cacheKey, { cachedAt: Date.now(), location });
    return location;
  } finally {
    if (jobLocationRequests.get(cacheKey) === request) {
      jobLocationRequests.delete(cacheKey);
    }
  }
};

export const listJobFiles = async ({ accessToken, job }) => {
  const location = await resolveJobFilesLocation({ accessToken, job });
  const items = await listAll(
    accessToken,
    `/drives/${encodePathPart(location.drive.id)}/items/${encodePathPart(location.folder.id)}/children?$select=id,name,folder,file,size,eTag,lastModifiedDateTime,lastModifiedBy,webUrl,@microsoft.graph.downloadUrl`,
  );
  return {
    ...location,
    items: sortJobItems(items),
  };
};

const listFolderItemsRaw = async ({ accessToken, driveId, folderId }) => {
  const items = await listAll(
    accessToken,
    `/drives/${encodePathPart(driveId)}/items/${encodePathPart(folderId)}/children?$select=id,name,folder,file,size,eTag,lastModifiedDateTime,lastModifiedBy,webUrl,@microsoft.graph.downloadUrl`,
  );
  return items;
};

export const listFolderItems = async (parameters) => (
  sortJobItems(await listFolderItemsRaw(parameters))
);

export const loadSharedJobBrief = async ({ accessToken, job }) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const appDataItems = await listAll(
    accessToken,
    `/drives/${encodePathPart(location.drive.id)}/items/${encodePathPart(location.appDataFolder.id)}/children?$select=id,name,file,eTag,@microsoft.graph.downloadUrl`,
  );
  let item = appDataItems.find((entry) => (
    clean(entry?.name).toLowerCase() === APP_DATA_JOB_BRIEF_FILE.toLowerCase()
  ));
  let storageScope = 'app-data';
  if (!item) {
    const legacyItems = await listAll(
      accessToken,
      `/drives/${encodePathPart(location.drive.id)}/items/${encodePathPart(location.jobFolder.id)}/children?$select=id,name,file,eTag,@microsoft.graph.downloadUrl`,
    );
    item = legacyItems.find((entry) => (
      clean(entry?.name).toLowerCase() === JOB_BRIEF_FILE.toLowerCase()
    ));
    storageScope = 'legacy-root';
  }
  if (!item) return null;

  const downloadUrl = item?.['@microsoft.graph.downloadUrl'];
  const response = isSecureMicrosoftTransferUrl(downloadUrl)
    ? await syncFetch(
      downloadUrl,
      {},
      jobFilesGraphConfig('Download shared job details', job?.number),
    )
    : await graphFetch(
      `/drives/${location.drive.id}/items/${item.id}/content`,
      accessToken,
      {},
      jobFilesGraphConfig('Download shared job details', job?.number),
    );

  if (!response.ok) {
    throw new Error(`Shared job details could not be downloaded (${response.status}).`);
  }

  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch (_error) {
    throw new Error('The shared job details file is not valid.');
  }

  return {
    workType: clean(payload?.workType),
    details: cleanMultiline(payload?.details),
    updatedAt: clean(payload?.updatedAt),
    updatedBy: clean(payload?.updatedBy),
    source: 'sharepoint',
    storageScope,
  };
};

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const uploadResultBody = (result) => {
  try {
    return JSON.parse(result?.body || '{}');
  } catch {
    return null;
  }
};

const uploadFailure = (result) => {
  const detail = uploadResultBody(result)?.error?.message || '';
  // Carry the HTTP status on the error. The upload queue uses it to tell a
  // temporary failure (timeout, busy, server error) from a permanent one
  // (no permission, folder gone, file too large). Without it every failed
  // upload looked temporary and was retried forever.
  return Object.assign(
    new Error(detail || `Upload failed (${result?.status || 'unknown status'}).`),
    { status: Number(result?.status) || 0 },
  );
};

const confirmedUploadItem = (result) => {
  const uploaded = uploadResultBody(result);
  if (!uploaded) {
    throw new Error('SharePoint accepted the upload but returned an unreadable confirmation. Refresh Job Files before trying again.');
  }
  if (!clean(uploaded?.id) || !clean(uploaded?.name)) {
    throw new Error('SharePoint did not confirm the uploaded file. Refresh Job Files before trying again.');
  }
  return uploaded;
};

const directJobFileUpload = async ({
  accessToken,
  driveId,
  folderId,
  asset,
  safeName,
  safeConflictBehavior,
  onProgress,
}) => {
  const task = createAuthenticatedGraphUploadTask({
    accessToken,
    urlOrPath: `/drives/${encodePathPart(driveId)}/items/${encodePathPart(folderId)}:/${encodePathPart(safeName)}:/content?@microsoft.graph.conflictBehavior=${safeConflictBehavior}`,
    fileUri: asset.uri,
    options: {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: {
        'Content-Type': asset.mimeType || 'application/octet-stream',
      },
    },
    onProgress: ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) {
        onProgress?.(Math.min(1, totalBytesSent / totalBytesExpectedToSend));
      }
    },
  });

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) throw uploadFailure(result);
  return confirmedUploadItem(result);
};

const createJobFileUploadSession = ({
  accessToken,
  driveId,
  folderId,
  safeName,
  safeConflictBehavior,
}) => graphRequest(
  accessToken,
  `/drives/${encodePathPart(driveId)}/items/${encodePathPart(folderId)}:/${encodePathPart(safeName)}:/createUploadSession`,
  {
    method: 'POST',
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': safeConflictBehavior,
        name: safeName,
      },
    }),
  },
  'Create SharePoint upload session',
);

const uploadJobFileChunk = async ({
  uploadUrl,
  chunkUri,
  offset,
  length,
  total,
  onProgress,
}) => {
  const end = offset + length - 1;
  let lastError = null;
  for (let attempt = 0; attempt < MAX_CHUNK_ATTEMPTS; attempt += 1) {
    try {
      const task = FileSystem.createUploadTask(
        uploadUrl,
        chunkUri,
        {
          httpMethod: 'PUT',
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
          headers: {
            'Content-Length': String(length),
            'Content-Range': `bytes ${offset}-${end}/${total}`,
            'Content-Type': 'application/octet-stream',
          },
        },
        ({ totalBytesSent }) => {
          const sent = offset + Number(totalBytesSent || 0);
          onProgress?.(Math.min(0.995, sent / Math.max(1, total)));
        },
      );
      const result = await task.uploadAsync();
      if (result?.status === 200 || result?.status === 201 || result?.status === 202) {
        return result;
      }
      lastError = uploadFailure(result);
      if (![429, 500, 502, 503, 504].includes(Number(result?.status))) {
        throw Object.assign(lastError, { retryable: false });
      }
    } catch (error) {
      if (error?.retryable === false) throw error;
      lastError = error;
    }
    if (attempt < MAX_CHUNK_ATTEMPTS - 1) await wait(500 * (2 ** attempt));
  }
  throw lastError || new Error('The resumable SharePoint upload could not continue.');
};

const cancelJobFileUploadSession = async (uploadUrl) => {
  if (!isSecureMicrosoftTransferUrl(uploadUrl)) return;
  await syncFetch(
    uploadUrl,
    { method: 'DELETE' },
    {
      ...jobFilesGraphConfig('Cancel SharePoint upload session'),
      acceptedStatuses: [204, 404],
      retryMode: 'idempotent',
      maxRetries: 1,
    },
  ).catch(() => undefined);
};

const resumableJobFileUpload = async ({
  accessToken,
  driveId,
  folderId,
  asset,
  safeName,
  safeConflictBehavior,
  size,
  onProgress,
}) => {
  const session = await createJobFileUploadSession({
    accessToken,
    driveId,
    folderId,
    safeName,
    safeConflictBehavior,
  });
  if (!isSecureMicrosoftTransferUrl(session?.uploadUrl)) {
    throw new Error('Microsoft returned an unsafe upload address. The file was not sent.');
  }

  await FileSystem.makeDirectoryAsync(JOB_FILES_UPLOAD_CACHE_DIRECTORY, { intermediates: true });
  const uploadToken = secureRandomId('upload');
  let offset = 0;
  let completedItem = null;

  try {
    while (offset < size) {
      const length = Math.min(UPLOAD_CHUNK_BYTES, size - offset);
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: offset,
        length,
      });
      const chunkUri = `${JOB_FILES_UPLOAD_CACHE_DIRECTORY}${uploadToken}-${offset}.part`;
      await FileSystem.writeAsStringAsync(chunkUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      try {
        const result = await uploadJobFileChunk({
          uploadUrl: session.uploadUrl,
          chunkUri,
          offset,
          length,
          total: size,
          onProgress,
        });
        if (result.status === 200 || result.status === 201) {
          completedItem = confirmedUploadItem(result);
        }
      } finally {
        await FileSystem.deleteAsync(chunkUri, { idempotent: true }).catch(() => undefined);
      }

      offset += length;
      onProgress?.(Math.min(0.995, offset / Math.max(1, size)));
    }

    if (!completedItem) {
      throw new Error('Microsoft did not confirm the completed resumable upload. Refresh Job Files before trying again.');
    }
    return completedItem;
  } catch (error) {
    await cancelJobFileUploadSession(session.uploadUrl);
    throw error;
  }
};

const uploadJobFileContent = async ({
  accessToken,
  driveId,
  folderId,
  asset,
  onProgress,
  conflictBehavior = 'rename',
  maxBytes = MAX_TEST_UPLOAD_BYTES,
}) => {
  if (!accessToken) {
    throw new Error('Sign in with Microsoft before uploading a job file.');
  }
  if (!clean(driveId) || !clean(folderId)) {
    throw new Error('The SharePoint upload destination could not be identified.');
  }

  let info;
  try {
    info = await FileSystem.getInfoAsync(asset?.uri, { size: true });
  } catch (_error) {
    throw new Error('The selected file could not be read from this device. Choose it again.');
  }
  const { name: safeName, size } = validateJobFileUploadSource({ asset, fileInfo: info, maxBytes });
  const safeConflictBehavior = ['fail', 'replace', 'rename'].includes(conflictBehavior)
    ? conflictBehavior
    : 'rename';
  onProgress?.(0);
  const uploaded = size > DIRECT_UPLOAD_LIMIT_BYTES
    ? await resumableJobFileUpload({
      accessToken,
      driveId,
      folderId,
      asset,
      safeName,
      safeConflictBehavior,
      size,
      onProgress,
    })
    : await directJobFileUpload({
      accessToken,
      driveId,
      folderId,
      asset,
      safeName,
      safeConflictBehavior,
      onProgress,
    });
  onProgress?.(1);
  return uploaded;
};

export const uploadJobFile = async (parameters) => trackSyncOperation(
  {
    feature: 'jobFiles',
    operation: 'Upload SharePoint file',
    jobNumber: parameters?.jobNumber || '',
  },
  () => uploadJobFileContent(parameters),
);

const ensureJobSubfolder = async ({ accessToken, driveId, parentId, name }) => {
  const existing = (await listFolderItemsRaw({ accessToken, driveId, folderId: parentId }))
    .find((item) => item?.folder && clean(item.name).toLowerCase() === clean(name).toLowerCase());
  if (existing) return existing;

  try {
    return await graphRequest(
      accessToken,
      `/drives/${encodePathPart(driveId)}/items/${encodePathPart(parentId)}/children`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: clean(name),
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      },
    );
  } catch (error) {
    if (error?.status !== 409) throw error;
    const concurrent = (await listFolderItemsRaw({ accessToken, driveId, folderId: parentId }))
      .find((item) => item?.folder && clean(item.name).toLowerCase() === clean(name).toLowerCase());
    if (concurrent) return concurrent;
    throw error;
  }
};

export const resolveJobAppDataLocation = async ({ accessToken, job }) => {
  const cacheKey = jobLocationCacheKey(job);
  const cached = jobAppDataLocationCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < JOB_LOCATION_CACHE_TTL_MS) {
    return cached.location;
  }

  const existingRequest = jobAppDataLocationRequests.get(cacheKey);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const location = await resolveJobFilesLocation({ accessToken, job });
    const appDataFolder = await ensureJobSubfolder({
      accessToken,
      driveId: location.drive.id,
      parentId: location.folder.id,
      name: JOB_APP_DATA_FOLDER,
    });
    const sectionsFolder = await ensureJobSubfolder({
      accessToken,
      driveId: location.drive.id,
      parentId: appDataFolder.id,
      name: JOB_APP_DATA_SECTIONS_FOLDER,
    });
    return {
      ...location,
      jobFolder: location.folder,
      appDataFolder,
      sectionsFolder,
    };
  })();

  jobAppDataLocationRequests.set(cacheKey, request);
  try {
    const location = await request;
    jobAppDataLocationCache.set(cacheKey, { cachedAt: Date.now(), location });
    return location;
  } finally {
    if (jobAppDataLocationRequests.get(cacheKey) === request) {
      jobAppDataLocationRequests.delete(cacheKey);
    }
  }
};

export const uploadSurveyPhotoExport = async ({
  accessToken,
  job,
  asset,
  initials,
  onProgress,
  conflictBehavior = 'rename',
}) => {
  const location = await resolveJobFilesLocation({ accessToken, job });
  const photosFolder = await ensureJobSubfolder({
    accessToken,
    driveId: location.drive.id,
    parentId: location.folder.id,
    name: 'Photos',
  });
  const initialsFolderName = clean(initials || 'Unassigned').toUpperCase();
  const initialsFolder = await ensureJobSubfolder({
    accessToken,
    driveId: location.drive.id,
    parentId: photosFolder.id,
    name: initialsFolderName,
  });
  let uploaded = await uploadJobFile({
    accessToken,
    driveId: location.drive.id,
    folderId: initialsFolder.id,
    asset,
    onProgress,
    conflictBehavior,
    maxBytes: MAX_SCAN_UPLOAD_BYTES,
  });
  let metadataWarning = '';
  const capturedAt = new Date(asset?.captureDateTime || '');
  if (uploaded?.id && !Number.isNaN(capturedAt.getTime())) {
    try {
      const updated = await graphRequest(
        accessToken,
        `/drives/${encodePathPart(location.drive.id)}/items/${encodePathPart(uploaded.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            fileSystemInfo: {
              createdDateTime: capturedAt.toISOString(),
              lastModifiedDateTime: capturedAt.toISOString(),
            },
          }),
        },
      );
      uploaded = { ...uploaded, ...(updated || {}) };
    } catch (error) {
      metadataWarning = error?.message || 'SharePoint did not accept the original client file timestamps.';
    }
  }
  return {
    uploaded,
    metadataWarning,
    path: `${location.folder.name} / Photos / ${initialsFolderName}`,
  };
};

export const saveSharedJobBrief = async ({
  accessToken,
  job,
  workType,
  details,
  updatedBy,
}) => {
  const location = await resolveJobAppDataLocation({ accessToken, job });
  const brief = {
    version: 1,
    jobNumber: clean(job?.number),
    workType: clean(workType),
    details: cleanMultiline(details),
    updatedAt: new Date().toISOString(),
    updatedBy: clean(updatedBy) || 'NorthGroup ONE user',
  };
  const safeJobNumber = clean(job?.number).replace(/[^A-Z0-9_-]/gi, '_') || 'job';
  await FileSystem.makeDirectoryAsync(JOB_BRIEF_DIRECTORY, { intermediates: true });
  const localUri = `${JOB_BRIEF_DIRECTORY}${safeJobNumber}-job-details.json`;
  await FileSystem.writeAsStringAsync(localUri, JSON.stringify(brief, null, 2));

  await uploadJobFile({
    accessToken,
    driveId: location.drive.id,
    folderId: location.appDataFolder.id,
    asset: {
      uri: localUri,
      name: APP_DATA_JOB_BRIEF_FILE,
      mimeType: 'application/json',
    },
    conflictBehavior: 'replace',
  });

  return {
    workType: brief.workType,
    details: brief.details,
    updatedAt: brief.updatedAt,
    updatedBy: brief.updatedBy,
    source: 'sharepoint',
  };
};

export const createJobFolder = async ({ accessToken, driveId, parentFolderId, name }) => {
  if (!accessToken || !driveId || !parentFolderId) {
    throw new Error('The SharePoint destination could not be identified.');
  }

  const folderName = validateJobItemName(name);
  return graphRequest(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentFolderId)}/children`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: folderName,
        folder: {},
        '@microsoft.graph.conflictBehavior': 'fail',
      }),
    },
  );
};

export const renameJobItem = async ({ accessToken, driveId, itemId, name }) => {
  if (!accessToken || !driveId || !itemId) {
    throw new Error('The SharePoint item could not be identified for renaming.');
  }

  const nextName = validateJobItemName(name);

  return graphRequest(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nextName }),
    },
  );
};

export const moveJobItem = async ({
  accessToken,
  driveId,
  itemId,
  destinationFolderId,
}) => {
  if (!accessToken || !driveId || !itemId || !destinationFolderId) {
    throw new Error('The SharePoint move destination could not be identified.');
  }
  if (String(itemId) === String(destinationFolderId)) {
    throw new Error('A folder cannot be moved into itself.');
  }

  return graphRequest(
    accessToken,
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentReference: { id: destinationFolderId } }),
    },
    'Move SharePoint item',
  );
};

export const updateJobTextFile = async ({
  accessToken,
  driveId,
  itemId,
  content,
  eTag,
  mimeType,
}) => {
  if (!accessToken || !driveId || !itemId) {
    throw new Error('The SharePoint text file could not be identified.');
  }
  if (!eTag) {
    throw new Error('Refresh Job Files before editing so the latest file version can be protected.');
  }
  const text = String(content ?? '');
  if (text.length > MAX_TEXT_PREVIEW_BYTES) {
    throw new Error('Edited text files must remain under 2 MB.');
  }
  const safeMimeType = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(String(mimeType || ''))
    ? String(mimeType)
    : 'text/plain';

  let pendingSessionUrl = '';
  try {
    if (!text.length) {
      return await graphRequest(
        accessToken,
        `/drives/${encodePathPart(driveId)}/items/${encodePathPart(itemId)}/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': `${safeMimeType}; charset=utf-8`,
            'If-Match': eTag,
          },
          body: text,
        },
        'Update empty SharePoint text file',
      );
    }

    const session = await graphRequest(
      accessToken,
      `/drives/${encodePathPart(driveId)}/items/${encodePathPart(itemId)}/createUploadSession`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': eTag,
        },
        body: JSON.stringify({
          item: { '@microsoft.graph.conflictBehavior': 'replace' },
        }),
      },
      'Create protected text update session',
    );
    if (!isSecureMicrosoftTransferUrl(session?.uploadUrl)) {
      throw new Error('Microsoft returned an unsafe text update address. The file was not changed.');
    }
    pendingSessionUrl = session.uploadUrl;

    await FileSystem.makeDirectoryAsync(JOB_FILES_UPLOAD_CACHE_DIRECTORY, { intermediates: true });
    const localUri = `${JOB_FILES_UPLOAD_CACHE_DIRECTORY}${secureRandomId('text-edit')}.txt`;
    await FileSystem.writeAsStringAsync(localUri, text);
    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri, { size: true });
      const size = Number(fileInfo?.size || 0);
      if (!size) throw new Error('The edited text could not be prepared for upload.');
      const result = await uploadJobFileChunk({
        uploadUrl: session.uploadUrl,
        chunkUri: localUri,
        offset: 0,
        length: size,
        total: size,
      });
      const uploaded = confirmedUploadItem(result);
      pendingSessionUrl = '';
      return uploaded;
    } finally {
      await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    }
  } catch (error) {
    if (pendingSessionUrl) await cancelJobFileUploadSession(pendingSessionUrl);
    if (error?.status === 409 || error?.status === 412) {
      const conflict = new Error('Someone else updated this file. Your changes were not overwritten. Copy any important text, close the editor, then refresh and try again.');
      conflict.code = 'JOB_FILE_EDIT_CONFLICT';
      conflict.status = error.status;
      throw conflict;
    }
    throw error;
  }
};

export const deleteJobItem = async ({ accessToken, driveId, itemId }) => {
  if (!accessToken || !driveId || !itemId) {
    throw new Error('The SharePoint item could not be identified for removal.');
  }

  const response = await graphFetch(
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`,
    accessToken,
    {
      method: 'DELETE',
    },
    {
      ...jobFilesGraphConfig('Delete SharePoint item'),
      acceptedStatuses: [404],
      retryMode: 'idempotent',
    },
  );

  if (response.status === 204 || response.status === 404) return true;

  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || '';
  } catch {
    detail = '';
  }
  throw new Error(detail || `SharePoint item removal failed (${response.status}).`);
};

// Retain the existing export used by the scanner cleanup workflow.
export const deleteJobFile = deleteJobItem;

const fetchFreshDownloadItem = async ({ accessToken, driveId, itemId }) => {
  if (!accessToken) throw new Error('Sign in with Microsoft before downloading a job file.');
  if (!clean(driveId) || !clean(itemId)) {
    throw new Error('The SharePoint file could not be identified for download.');
  }

  return graphRequest(
    accessToken,
    `/drives/${encodePathPart(driveId)}/items/${encodePathPart(itemId)}?$select=id,name,size,eTag,lastModifiedDateTime,file,@microsoft.graph.downloadUrl`,
    {},
    'Prepare SharePoint download',
  );
};

const performJobFileDownload = async ({
  accessToken: suppliedAccessToken,
  getAccessToken,
  driveId,
  item,
  jobNumber,
  persist = false,
}) => {
  const downloadDirectory = jobFileDownloadDirectory(persist);
  await FileSystem.makeDirectoryAsync(downloadDirectory, { intermediates: true });

  const existingUri = await findReusableJobFile({
    directory: downloadDirectory,
    jobNumber,
    driveId,
    item,
  });
  if (existingUri) return existingUri;

  const accessToken = suppliedAccessToken || await getAccessToken?.();
  const freshItem = await fetchFreshDownloadItem({
    accessToken,
    driveId,
    itemId: item?.id,
  });
  const resolvedItem = { ...item, ...freshItem };
  const downloadUrl = resolvedItem?.['@microsoft.graph.downloadUrl'];

  const localName = buildJobFileCacheName({ jobNumber, driveId, item: resolvedItem });
  const localUri = `${downloadDirectory}${localName}`;
  const partialUri = `${localUri}.download`;

  const freshExistingUri = await findReusableJobFile({
    directory: downloadDirectory,
    jobNumber,
    driveId,
    item: resolvedItem,
  });
  if (freshExistingUri) return freshExistingUri;

  await FileSystem.deleteAsync(partialUri, { idempotent: true }).catch(() => undefined);
  try {
    const download = await downloadMicrosoftGraphFile({
      accessToken,
      graphUrlOrPath: `/drives/${encodePathPart(driveId)}/items/${encodePathPart(resolvedItem.id)}/content`,
      preauthenticatedUrl: downloadUrl,
      destination: partialUri,
      options: {
        headers: { Accept: 'application/octet-stream' },
      },
    });
    if (!download || download.status < 200 || download.status >= 300) {
      throw new Error(`Download failed (${download?.status || 'unknown status'}).`);
    }

    const info = await FileSystem.getInfoAsync(partialUri, { size: true });
    if (!isCompleteJobFileDownload({ fileInfo: info, expectedSize: resolvedItem?.size })) {
      throw new Error('The downloaded file was incomplete. Try again when the connection is stable.');
    }

    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
    await FileSystem.moveAsync({ from: partialUri, to: localUri });
    return localUri;
  } catch (error) {
    await FileSystem.deleteAsync(partialUri, { idempotent: true }).catch(() => undefined);
    throw error;
  }
};

const downloadJobFileContent = async (parameters) => {
  const downloadKey = [
    jobFileDownloadDirectory(parameters?.persist),
    clean(parameters?.driveId),
    clean(parameters?.item?.id),
    clean(parameters?.item?.eTag),
  ].join('|');
  if (!clean(parameters?.item?.id)) {
    throw new Error('The SharePoint file could not be identified for download.');
  }

  const activeDownload = activeDownloads.get(downloadKey);
  if (activeDownload) return activeDownload;

  const downloadPromise = performJobFileDownload(parameters);
  activeDownloads.set(downloadKey, downloadPromise);
  try {
    return await downloadPromise;
  } finally {
    if (activeDownloads.get(downloadKey) === downloadPromise) {
      activeDownloads.delete(downloadKey);
    }
  }
};

export const downloadJobFile = async (parameters) => trackSyncOperation(
  {
    feature: 'jobFiles',
    operation: 'Download SharePoint file',
    jobNumber: parameters?.jobNumber || '',
  },
  () => downloadJobFileContent(parameters),
);

export const removeDownloadedJobFile = (localUri) => (
  removePrivateCacheFile(localUri, JOB_FILES_DOWNLOAD_CACHE_DIRECTORY).catch(() => false)
);

export const downloadAndShareJobFile = async ({ accessToken, driveId, item, jobNumber }) => {
  const localUri = await downloadJobFile({ accessToken, driveId, item, jobNumber });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('The iPhone share sheet is not available on this device.');
  }
  await FileSystem.makeDirectoryAsync(JOB_FILES_SHARE_CACHE_DIRECTORY, { intermediates: true });
  const shareName = `${secureRandomId('share')}-${sanitiseJobFileName(item?.name, 'Job file')}`;
  const shareUri = `${JOB_FILES_SHARE_CACHE_DIRECTORY}${shareName}`;
  try {
    await FileSystem.copyAsync({ from: localUri, to: shareUri });
    await Sharing.shareAsync(shareUri, {
      dialogTitle: item.name || 'Share job file',
      mimeType: item?.file?.mimeType || undefined,
    });
  } finally {
    await removePrivateCacheFile(shareUri, JOB_FILES_SHARE_CACHE_DIRECTORY)
      .catch(() => false);
  }
};