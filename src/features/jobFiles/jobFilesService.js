import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const SHAREPOINT_HOST = 'northsurveys.sharepoint.com';
const SHAREPOINT_SITE_PATH = '/sites/NorthGroupONE';
const JOB_FILES_LIBRARY = 'Job Files';
const DOWNLOAD_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-job-files/`;
const MAX_TEST_UPLOAD_BYTES = 50 * 1024 * 1024;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const encodePathPart = (value) => encodeURIComponent(String(value || ''));

const graphRequest = async (accessToken, path, options = {}) => {
  const response = await fetch(`${GRAPH_ROOT}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.error?.message || '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `Microsoft Graph request failed (${response.status}).`);
  }

  if (response.status === 204) return null;
  return response.json();
};

const listAll = async (accessToken, initialPath) => {
  const items = [];
  let next = `${GRAPH_ROOT}${initialPath}`;

  while (next) {
    const response = await fetch(next, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      let detail = '';
      try {
        const body = await response.json();
        detail = body?.error?.message || '';
      } catch {
        detail = '';
      }
      throw new Error(detail || `Microsoft Graph request failed (${response.status}).`);
    }
    const body = await response.json();
    items.push(...(body.value || []));
    next = body['@odata.nextLink'] || '';
  }

  return items;
};

const normaliseFolderName = (value) => clean(value)
  .toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/\s*-\s*/g, ' - ');

export const expectedJobFolderName = (job) => [
  clean(job?.number),
  clean(job?.name),
  clean(job?.location),
].filter(Boolean).join(' - ');

export const resolveJobFilesLocation = async ({ accessToken, job }) => {
  if (!clean(job?.number)) throw new Error('Choose an active job before opening Job Files.');

  const site = await graphRequest(
    accessToken,
    `/sites/${SHAREPOINT_HOST}:${SHAREPOINT_SITE_PATH}?$select=id,displayName,webUrl`,
  );
  const drives = await listAll(accessToken, `/sites/${site.id}/drives?$select=id,name,webUrl`);
  const drive = drives.find((item) => clean(item.name).toLowerCase() === JOB_FILES_LIBRARY.toLowerCase());
  if (!drive) throw new Error(`The SharePoint library “${JOB_FILES_LIBRARY}” could not be found.`);

  const rootItems = await listAll(
    accessToken,
    `/drives/${drive.id}/root/children?$select=id,name,folder,file,size,lastModifiedDateTime,lastModifiedBy,webUrl,@microsoft.graph.downloadUrl`,
  );
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
  const folder = exact || (numberMatches.length === 1 ? numberMatches[0] : null);

  if (!folder) {
    if (numberMatches.length > 1) {
      throw new Error(`More than one SharePoint folder starts with job ${job.number}. Rename them so the job number is unique.`);
    }
    throw new Error(
      `No SharePoint folder was found for job ${job.number}. Expected something like “${expectedJobFolderName(job)}”.`,
    );
  }

  return { site, drive, folder };
};

export const listJobFiles = async ({ accessToken, job }) => {
  const location = await resolveJobFilesLocation({ accessToken, job });
  const items = await listAll(
    accessToken,
    `/drives/${location.drive.id}/items/${location.folder.id}/children?$select=id,name,folder,file,size,lastModifiedDateTime,lastModifiedBy,webUrl,@microsoft.graph.downloadUrl`,
  );
  return {
    ...location,
    items: items.sort((a, b) => {
      if (Boolean(a.folder) !== Boolean(b.folder)) return a.folder ? -1 : 1;
      return String(a.name).localeCompare(String(b.name), 'en-AU', { numeric: true });
    }),
  };
};

export const listFolderItems = async ({ accessToken, driveId, folderId }) => {
  const items = await listAll(
    accessToken,
    `/drives/${driveId}/items/${folderId}/children?$select=id,name,folder,file,size,lastModifiedDateTime,lastModifiedBy,webUrl,@microsoft.graph.downloadUrl`,
  );
  return items.sort((a, b) => {
    if (Boolean(a.folder) !== Boolean(b.folder)) return a.folder ? -1 : 1;
    return String(a.name).localeCompare(String(b.name), 'en-AU', { numeric: true });
  });
};

export const uploadJobFile = async ({ accessToken, driveId, folderId, asset, onProgress }) => {
  const info = await FileSystem.getInfoAsync(asset.uri, { size: true });
  const size = Number(asset.size || info?.size || 0);
  if (size > MAX_TEST_UPLOAD_BYTES) {
    throw new Error('This first test version supports files up to 50 MB. Larger resumable uploads will be added after the connection test.');
  }

  const safeName = clean(asset.name || 'Uploaded file').replace(/["*:<>?\\/|]/g, '_');
  const uploadUrl = `${GRAPH_ROOT}/drives/${driveId}/items/${folderId}:/${encodePathPart(safeName)}:/content?@microsoft.graph.conflictBehavior=rename`;
  const task = FileSystem.createUploadTask(
    uploadUrl,
    asset.uri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': asset.mimeType || 'application/octet-stream',
      },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      if (totalBytesExpectedToSend > 0) {
        onProgress?.(Math.min(1, totalBytesSent / totalBytesExpectedToSend));
      }
    },
  );

  const result = await task.uploadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    let detail = '';
    try {
      detail = JSON.parse(result?.body || '{}')?.error?.message || '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `Upload failed (${result?.status || 'unknown status'}).`);
  }
  return JSON.parse(result.body || '{}');
};

export const downloadJobFile = async ({ accessToken, driveId, item }) => {
  await FileSystem.makeDirectoryAsync(DOWNLOAD_DIRECTORY, { intermediates: true });
  const localName = clean(item?.name || 'Job file').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  const localUri = `${DOWNLOAD_DIRECTORY}${localName}`;
  const url = item?.['@microsoft.graph.downloadUrl']
    || `${GRAPH_ROOT}/drives/${driveId}/items/${item.id}/content`;
  const download = await FileSystem.downloadAsync(url, localUri, item?.['@microsoft.graph.downloadUrl']
    ? undefined
    : { headers: { Authorization: `Bearer ${accessToken}` } });
  if (download.status < 200 || download.status >= 300) {
    throw new Error(`Download failed (${download.status}).`);
  }
  return download.uri;
};

export const downloadAndShareJobFile = async ({ accessToken, driveId, item }) => {
  const localUri = await downloadJobFile({ accessToken, driveId, item });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('The iPhone share sheet is not available on this device.');
  }
  await Sharing.shareAsync(localUri, {
    dialogTitle: item.name || 'Share job file',
    mimeType: item?.file?.mimeType || undefined,
  });
};
