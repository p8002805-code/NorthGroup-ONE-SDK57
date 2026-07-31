import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const ATTACHMENT_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-job-chat-attachments/`;
const OUTBOX_DIRECTORY = `${FileSystem.documentDirectory}northgroup-job-chat-outbox/`;
const CHUNK_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-job-chat-upload-chunks/`;
const DIRECT_UPLOAD_LIMIT_BYTES = 10 * 1024 * 1024;
const CHUNK_SIZE_BYTES = 10 * 320 * 1024;
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const MAX_TOTAL_UPLOAD_BYTES = 250 * 1024 * 1024;

export const JOB_CHAT_ATTACHMENT_LIMIT = 5;
export const JOB_CHAT_ATTACHMENT_MAX_BYTES = MAX_UPLOAD_BYTES;
export const JOB_CHAT_ATTACHMENT_TOTAL_MAX_BYTES = MAX_TOTAL_UPLOAD_BYTES;

const activeUploadTasks = new Map();
const cancelledUploadIds = new Set();
const cancelledQueueIds = new Set();
const folderCache = new Map();

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const encodePath = (value) => encodeURIComponent(String(value || ''));
const safeToken = (value, fallback = 'item') => clean(value)
  .replace(/[^A-Za-z0-9._-]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^[_\.]+|[_\.]+$/g, '')
  .slice(0, 100) || fallback;

const uuid = () => {
  const pattern = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  return pattern.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : ((random & 0x3) | 0x8);
    return value.toString(16);
  });
};

const fileExtension = (name = '') => {
  const match = String(name || '').match(/\.([A-Za-z0-9]{1,12})$/);
  return match ? match[1].toLowerCase() : '';
};

const safeOneDriveName = (value, fallback = 'Attachment') => {
  const prepared = clean(value || fallback)
    .replace(/["*:<>?\\/|]/g, '_')
    .replace(/[\. ]+$/g, '')
    .replace(/^\.+/g, '')
    .slice(0, 120);
  return prepared || fallback;
};

const ensureFileName = ({ name, mimeType, kind }) => {
  const fallback = kind === 'photo' ? 'Job-Chat-Photo.jpg' : 'Job-Chat-File';
  const supplied = safeOneDriveName(name, fallback);
  if (fileExtension(supplied)) return supplied;

  const extensionByMime = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/zip': 'zip',
    'application/vnd.google-earth.kml+xml': 'kml',
    'application/vnd.google-earth.kmz': 'kmz',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  const extension = extensionByMime[String(mimeType || '').toLowerCase()]
    || (kind === 'photo' ? 'jpg' : '');
  return extension ? `${supplied}.${extension}` : supplied;
};

export const mimeTypeForJobChatFile = (name = '', supplied = '') => {
  const mime = String(supplied || '').toLowerCase();
  if (mime && mime !== 'application/octet-stream') return mime;

  const table = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/heic',
    heif: 'image/heif',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
    txt: 'text/plain',
    zip: 'application/zip',
    kml: 'application/vnd.google-earth.kml+xml',
    kmz: 'application/vnd.google-earth.kmz',
    dxf: 'application/dxf',
    dwg: 'application/acad',
  };
  return table[fileExtension(name)] || mime || 'application/octet-stream';
};

export const mimeTypeForJobChatAttachment = mimeTypeForJobChatFile;

export const isImageJobChatAttachment = (attachment = {}) => (
  attachment?.kind === 'image'
  || attachment?.kind === 'photo'
  || String(attachment?.mimeType || '').toLowerCase().startsWith('image/')
  || /\.(jpe?g|png|heic|heif|gif|webp|bmp|tiff?)$/i.test(String(attachment?.name || ''))
);

export const isPhotoJobChatAttachment = isImageJobChatAttachment;

export const jobChatAttachmentKind = (name = '', mimeType = '') => (
  isImageJobChatAttachment({ name, mimeType }) ? 'photo' : 'file'
);

export const isMapJobChatAttachment = (attachment = {}) => (
  ['kml', 'kmz'].includes(fileExtension(attachment?.name || attachment))
);

export const jobChatFileExtension = (attachment = {}) => (
  fileExtension(attachment?.name || attachment) || 'file'
).toUpperCase();

export const jobChatAttachmentCategory = (attachment = {}) => {
  if (isImageJobChatAttachment(attachment)) return 'PHOTO';
  const extension = fileExtension(attachment?.name);
  if (extension === 'kml' || extension === 'kmz') return 'MAP FILE';
  if (extension === 'pdf') return 'PDF';
  if (['doc', 'docx'].includes(extension)) return 'WORD';
  if (['xls', 'xlsx', 'csv'].includes(extension)) return 'SPREADSHEET';
  if (extension === 'zip') return 'ARCHIVE';
  if (['dwg', 'dxf'].includes(extension)) return 'CAD FILE';
  return extension ? extension.toUpperCase() : 'FILE';
};

export const jobChatAttachmentIcon = (attachment = {}) => {
  const category = jobChatAttachmentCategory(attachment);
  if (category === 'PHOTO') return 'image-outline';
  if (category === 'MAP FILE') return 'map-outline';
  if (category === 'PDF') return 'document-text-outline';
  if (category === 'WORD') return 'document-text-outline';
  if (category === 'SPREADSHEET') return 'grid-outline';
  if (category === 'ARCHIVE') return 'archive-outline';
  if (category === 'CAD FILE') return 'layers-outline';
  return 'document-attach-outline';
};

export const formatJobChatFileSize = (bytes) => {
  const size = Number(bytes || 0);
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  if (size < 1024 * 1024 * 1024) {
    const value = size / (1024 * 1024);
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} MB`;
  }
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const ensureDirectory = async (uri) => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
};

export const validateJobChatAttachmentSelection = (attachments = []) => {
  const values = Array.isArray(attachments) ? attachments.filter(Boolean) : [];
  if (!values.length) throw new Error('Choose at least one photo or file.');
  if (values.length > JOB_CHAT_ATTACHMENT_LIMIT) {
    throw new Error(`Choose up to ${JOB_CHAT_ATTACHMENT_LIMIT} attachments per message.`);
  }

  let total = 0;
  values.forEach((attachment) => {
    if (!attachment?.localUri && !attachment?.contentUrl) {
      throw new Error('One selected attachment is unavailable.');
    }
    const size = Number(attachment?.size || 0);
    if (size > MAX_UPLOAD_BYTES) {
      throw new Error(`${attachment?.name || 'This file'} is larger than the 100 MB Job Chat limit.`);
    }
    total += size;
  });

  if (total > MAX_TOTAL_UPLOAD_BYTES) {
    throw new Error('The selected attachments exceed the 250 MB combined message limit.');
  }
  return values;
};

const optimisePhotoForChat = async ({ uri, name, mimeType, width, height }) => ({
  uri,
  name: ensureFileName({ name, mimeType, kind: 'photo' }),
  mimeType: mimeTypeForJobChatFile(name, mimeType),
  width: Number(width || 0),
  height: Number(height || 0),
  temporary: false,
  // ImagePicker creates a compressed local copy using the quality setting in
  // JobChatScreen. Keeping preparation here lossless avoids a second encode.
  optimised: true,
});

export const prepareJobChatAttachment = async ({
  uri,
  name,
  mimeType,
  size,
  kind,
  width,
  height,
}) => {
  if (!uri) throw new Error('The selected attachment does not include a local file.');
  await ensureDirectory(OUTBOX_DIRECTORY);

  const sourceInfo = await FileSystem.getInfoAsync(uri, { size: true });
  if (!sourceInfo.exists) {
    throw new Error('The selected file is no longer available on this iPhone.');
  }

  const initialMime = mimeTypeForJobChatFile(name, mimeType);
  const initialKind = kind === 'photo' || isImageJobChatAttachment({ name, mimeType: initialMime })
    ? 'photo'
    : 'file';
  const preparedSource = initialKind === 'photo'
    ? await optimisePhotoForChat({ uri, name, mimeType: initialMime, width, height })
    : {
      uri,
      name: ensureFileName({ name, mimeType: initialMime, kind: initialKind }),
      mimeType: initialMime,
      width: Number(width || 0),
      height: Number(height || 0),
      temporary: false,
      optimised: false,
    };

  const id = uuid();
  const resolvedName = ensureFileName({
    name: preparedSource.name,
    mimeType: preparedSource.mimeType,
    kind: initialKind,
  });
  const destination = `${OUTBOX_DIRECTORY}${safeToken(id)}-${safeToken(resolvedName, 'attachment')}`;

  try {
    await FileSystem.copyAsync({ from: preparedSource.uri, to: destination });
  } catch (error) {
    throw new Error(error?.message || 'The selected file could not be copied into NorthGroup One.');
  } finally {
    if (preparedSource.temporary && preparedSource.uri !== uri) {
      FileSystem.deleteAsync(preparedSource.uri, { idempotent: true }).catch(() => {});
    }
  }

  const copiedInfo = await FileSystem.getInfoAsync(destination, { size: true });
  if (!copiedInfo.exists) throw new Error('The selected attachment could not be prepared.');

  const attachment = {
    id,
    name: resolvedName,
    originalName: safeOneDriveName(name, resolvedName),
    mimeType: preparedSource.mimeType,
    size: Number(copiedInfo.size || size || sourceInfo.size || 0),
    originalSize: Number(size || sourceInfo.size || 0),
    width: preparedSource.width,
    height: preparedSource.height,
    kind: initialKind,
    localUri: destination,
    managedLocal: true,
    optimised: preparedSource.optimised,
    createdAt: new Date().toISOString(),
  };
  validateJobChatAttachmentSelection([attachment]);
  return attachment;
};

export const deleteLocalJobChatAttachment = async (attachment = {}) => {
  const uri = String(attachment?.localUri || attachment?.uri || '');
  const managed = Boolean(attachment?.managedLocal) || uri.startsWith(OUTBOX_DIRECTORY);
  if (!uri || !managed) return false;
  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
    return true;
  } catch {
    return false;
  }
};

const graphErrorMessage = (status, body) => {
  const message = body?.error?.message || '';
  const code = String(body?.error?.code || '').toLowerCase();

  if (status === 401) {
    return 'Your Microsoft session needs to be refreshed.';
  }

  if (status === 403) {
    if (code.includes('accessdenied') || code.includes('forbidden')) {
      return message
        ? `Microsoft denied access to this file: ${message}`
        : 'Microsoft denied access to this file. Reopen the chat and try again.';
    }

    return message
      || 'Microsoft denied the file request. Reopen the chat and try again.';
  }

  if (status === 404) {
    return 'The Microsoft file or folder could not be found.';
  }

  if (status === 409) {
    return message || 'Microsoft reported a file naming conflict.';
  }

  if (status === 413) {
    return 'This attachment is too large for Microsoft Teams.';
  }

  if (status === 429) {
    return 'Microsoft is busy. The attachment will retry shortly.';
  }

  return message || `Microsoft attachment request failed (${status}).`;
};

const parseBody = (text) => {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const graphRequest = async (url, accessToken, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = parseBody(text);
  if (!response.ok) {
    const error = new Error(graphErrorMessage(response.status, body));
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
};

const getOrCreateFolder = async ({ accessToken, parentId, name }) => {
  const folderName = safeOneDriveName(name, 'Folder');
  const pathUrl = `${GRAPH_ROOT}/me/drive/items/${encodePath(parentId)}:/${encodeURIComponent(folderName)}?$select=id,name,folder,webUrl`;
  try {
    return await graphRequest(pathUrl, accessToken);
  } catch (error) {
    if (error?.status !== 404) throw error;
  }

  try {
    return await graphRequest(
      `${GRAPH_ROOT}/me/drive/items/${encodePath(parentId)}/children`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          name: folderName,
          folder: {},
          '@microsoft.graph.conflictBehavior': 'fail',
        }),
      },
    );
  } catch (error) {
    if (error?.status === 409) return graphRequest(pathUrl, accessToken);
    throw error;
  }
};

const ensureJobFolder = async ({ accessToken, accountId, job }) => {
  const cacheKey = [
    safeToken(accountId || 'employee'),
    safeToken(job?.number || job?.id || 'job'),
  ].join(':');
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  const root = await graphRequest(`${GRAPH_ROOT}/me/drive/root?$select=id`, accessToken);
  const appFolder = await getOrCreateFolder({
    accessToken,
    parentId: root.id,
    name: 'NorthGroup One',
  });
  const chatFolder = await getOrCreateFolder({
    accessToken,
    parentId: appFolder.id,
    name: 'Job Chat Files',
  });
  const jobNumber = clean(job?.number || 'Job');
  const jobName = clean(job?.jobName || job?.name || job?.location || 'Files');
  const jobFolder = await getOrCreateFolder({
    accessToken,
    parentId: chatFolder.id,
    name: [jobNumber, jobName].filter(Boolean).join(' - ').slice(0, 110),
  });
  folderCache.set(cacheKey, jobFolder);
  return jobFolder;
};

const storageNameFor = (attachment) => (
  safeOneDriveName(attachment?.name, 'Attachment').slice(0, 180)
);

const uploadQueueId = (uploadId) => String(uploadId || '').split(':')[0];

const cancelledError = () => {
  const error = new Error('Attachment upload cancelled.');
  error.cancelled = true;
  error.status = 499;
  return error;
};

const assertNotCancelled = (uploadId) => {
  if (cancelledUploadIds.has(uploadId) || cancelledQueueIds.has(uploadQueueId(uploadId))) {
    throw cancelledError();
  }
};

const registerTask = (uploadId, task) => {
  if (!uploadId || !task) return;
  activeUploadTasks.set(uploadId, task);
};

const clearTask = (uploadId, task) => {
  if (!uploadId) return;
  if (!task || activeUploadTasks.get(uploadId) === task) {
    activeUploadTasks.delete(uploadId);
  }
};

export const cancelJobChatUpload = async (uploadId) => {
  if (!uploadId) return false;
  cancelledUploadIds.add(uploadId);
  const task = activeUploadTasks.get(uploadId);
  if (!task) return false;
  try {
    await task.cancelAsync();
  } catch {
    // The task may have completed between the tap and cancellation request.
  }
  activeUploadTasks.delete(uploadId);
  return true;
};

export const cancelJobChatUploadsForQueue = async (queueId) => {
  if (!queueId) return 0;
  cancelledQueueIds.add(String(queueId));
  const matching = [...activeUploadTasks.entries()]
    .filter(([uploadId]) => uploadQueueId(uploadId) === String(queueId));
  await Promise.all(matching.map(async ([uploadId, task]) => {
    cancelledUploadIds.add(uploadId);
    try {
      await task.cancelAsync();
    } catch {
      // Ignore races with completed tasks.
    }
    activeUploadTasks.delete(uploadId);
  }));
  return matching.length;
};

const assertUploadResult = (result, uploadId) => {
  assertNotCancelled(uploadId);
  const body = parseBody(result?.body || '');
  const status = Number(result?.status || 0);
  if (status >= 200 && status < 300) return body;
  const error = new Error(graphErrorMessage(status, body));
  error.status = status;
  error.body = body;
  throw error;
};

const directUpload = async ({
  accessToken,
  folderId,
  attachment,
  uploadId,
  onProgress,
}) => {
  assertNotCancelled(uploadId);
  const fileName = storageNameFor(attachment);
  const url = `${GRAPH_ROOT}/me/drive/items/${encodePath(folderId)}:/${encodeURIComponent(fileName)}:/content?@microsoft.graph.conflictBehavior=rename`;
  const task = FileSystem.createUploadTask(
    url,
    attachment.localUri,
    {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': mimeTypeForJobChatFile(attachment.name, attachment.mimeType),
      },
    },
    ({ totalBytesSent, totalBytesExpectedToSend }) => {
      const expected = Number(totalBytesExpectedToSend || attachment.size || 1);
      onProgress?.(Math.min(1, Number(totalBytesSent || 0) / Math.max(1, expected)));
    },
  );
  registerTask(uploadId, task);
  try {
    const result = await task.uploadAsync();
    assertNotCancelled(uploadId);
    onProgress?.(1);
    return assertUploadResult(result, uploadId);
  } catch (error) {
    if (cancelledUploadIds.has(uploadId) || cancelledQueueIds.has(uploadQueueId(uploadId))) {
      throw cancelledError();
    }
    throw error;
  } finally {
    clearTask(uploadId, task);
  }
};

const createUploadSession = ({ accessToken, folderId, attachment }) => {
  const fileName = storageNameFor(attachment);
  return graphRequest(
    `${GRAPH_ROOT}/me/drive/items/${encodePath(folderId)}:/${encodeURIComponent(fileName)}:/createUploadSession`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        item: {
          '@microsoft.graph.conflictBehavior': 'rename',
          name: fileName,
        },
      }),
    },
  );
};

const chunkedUpload = async ({
  accessToken,
  folderId,
  attachment,
  uploadId,
  onProgress,
}) => {
  assertNotCancelled(uploadId);
  const session = await createUploadSession({ accessToken, folderId, attachment });
  if (!session?.uploadUrl) throw new Error('Microsoft did not create an upload session.');

  await ensureDirectory(CHUNK_DIRECTORY);
  const total = Number(attachment.size || 0);
  let offset = 0;
  let finalItem = null;

  while (offset < total) {
    assertNotCancelled(uploadId);
    const length = Math.min(CHUNK_SIZE_BYTES, total - offset);
    const end = offset + length - 1;
    const base64 = await FileSystem.readAsStringAsync(attachment.localUri, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    });
    const chunkUri = `${CHUNK_DIRECTORY}${safeToken(uploadId, 'upload')}-${offset}.part`;
    await FileSystem.writeAsStringAsync(chunkUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const task = FileSystem.createUploadTask(
      session.uploadUrl,
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
    registerTask(uploadId, task);
    try {
      const result = await task.uploadAsync();
      const body = assertUploadResult(result, uploadId);
      if (result?.status === 200 || result?.status === 201) finalItem = body;
    } catch (error) {
      if (cancelledUploadIds.has(uploadId) || cancelledQueueIds.has(uploadQueueId(uploadId))) {
        throw cancelledError();
      }
      throw error;
    } finally {
      clearTask(uploadId, task);
      await FileSystem.deleteAsync(chunkUri, { idempotent: true }).catch(() => {});
    }

    offset += length;
    onProgress?.(Math.min(0.995, offset / Math.max(1, total)));
  }

  if (!finalItem?.id) throw new Error('Microsoft did not finish the attachment upload.');
  onProgress?.(1);
  return finalItem;
};

const uploadDriveItem = async ({
  accessToken,
  folderId,
  attachment,
  uploadId,
  onProgress,
}) => {
  assertNotCancelled(uploadId);
  const info = await FileSystem.getInfoAsync(attachment.localUri, { size: true });
  if (!info.exists) {
    throw new Error(`${attachment.name || 'Attachment'} is no longer on this iPhone.`);
  }
  const size = Number(attachment.size || info.size || 0);
  if (size > MAX_UPLOAD_BYTES) {
    throw new Error('Job Chat attachments are limited to 100 MB each.');
  }
  const withSize = { ...attachment, size };
  return size > DIRECT_UPLOAD_LIMIT_BYTES
    ? chunkedUpload({ accessToken, folderId, attachment: withSize, uploadId, onProgress })
    : directUpload({ accessToken, folderId, attachment: withSize, uploadId, onProgress });
};

const deleteDriveItem = async ({ accessToken, driveItemId }) => {
  if (!driveItemId) return false;
  try {
    await graphRequest(
      `${GRAPH_ROOT}/me/drive/items/${encodePath(driveItemId)}`,
      accessToken,
      { method: 'DELETE' },
    );
    return true;
  } catch (error) {
    if (error?.status === 404) return true;
    return false;
  }
};

export const deleteUploadedJobChatAttachment = async ({
  accessToken,
  attachment,
}) => deleteDriveItem({
  accessToken,
  driveItemId: attachment?.driveItemId,
});

const createOrganisationLink = async ({ accessToken, driveItemId }) => {
  const result = await graphRequest(
    `${GRAPH_ROOT}/me/drive/items/${encodePath(driveItemId)}/createLink`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ type: 'view', scope: 'organization' }),
    },
  );
  const webUrl = result?.link?.webUrl || result?.webUrl || '';
  if (!webUrl) throw new Error('Microsoft did not create a NorthGroup-only file link.');
  return webUrl;
};

export const uploadJobChatAttachments = async ({
  accessToken,
  accountId,
  job,
  queueId,
  attachments,
  onProgress,
}) => {
  const selected = validateJobChatAttachmentSelection(attachments);
  const folder = await ensureJobFolder({ accessToken, accountId, job });
  const uploaded = [];

  for (let index = 0; index < selected.length; index += 1) {
    const attachment = selected[index];
    if (attachment?.contentUrl && attachment?.id) {
      uploaded.push({
        ...attachment,
        kind: isImageJobChatAttachment(attachment) ? 'photo' : 'file',
        source: 'reference',
      });
      continue;
    }

    const taskId = `${queueId || attachment.id}:${attachment.id}`;
    assertNotCancelled(taskId);
    onProgress?.({
      overall: index / selected.length,
      attachmentId: attachment.id,
      attachmentProgress: 0,
      status: 'uploading',
    });

    const driveItem = await uploadDriveItem({
      accessToken,
      folderId: folder.id,
      attachment,
      uploadId: taskId,
      onProgress: (attachmentProgress) => {
        onProgress?.({
          overall: (index + attachmentProgress) / selected.length,
          attachmentId: attachment.id,
          attachmentProgress,
          status: 'uploading',
        });
      },
    });
    assertNotCancelled(taskId);

    let contentUrl = '';
    try {
      contentUrl = await createOrganisationLink({
        accessToken,
        driveItemId: driveItem.id,
      });
      assertNotCancelled(taskId);
    } catch (error) {
      if (error?.cancelled) {
        await deleteDriveItem({ accessToken, driveItemId: driveItem.id });
      }
      throw error;
    }
    uploaded.push({
      id: attachment.id || uuid(),
      localAttachmentId: attachment.id || '',
      driveItemId: driveItem.id,
      contentUrl,
      webUrl: driveItem.webUrl || contentUrl,
      name: attachment.name || driveItem.name || 'Attachment',
      size: Number(attachment.size || driveItem.size || 0),
      mimeType: mimeTypeForJobChatFile(
        attachment.name || driveItem.name,
        attachment.mimeType || driveItem?.file?.mimeType,
      ),
      localUri: attachment.localUri,
      kind: isImageJobChatAttachment(attachment) ? 'photo' : 'file',
      source: 'reference',
    });
  }

  onProgress?.({ overall: 1, status: 'uploaded' });
  return uploaded;
};

export const uploadJobChatAttachment = async ({
  accessToken,
  accountId = '',
  job,
  queueId = '',
  attachment,
  onProgress,
}) => {
  const [uploaded] = await uploadJobChatAttachments({
    accessToken,
    accountId,
    job,
    queueId: queueId || attachment?.id || uuid(),
    attachments: [attachment],
    onProgress: (event) => {
      onProgress?.(Number(event?.attachmentProgress ?? event?.overall ?? 0));
    },
  });
  if (!uploaded) throw new Error('Microsoft did not return the uploaded attachment.');
  return uploaded;
};

const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const utf8BinaryString = (value) => {
  const encoded = encodeURIComponent(String(value || ''));
  let output = '';
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] === '%' && /^[0-9A-Fa-f]{2}$/.test(encoded.slice(index + 1, index + 3))) {
      output += String.fromCharCode(parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      output += encoded[index];
    }
  }
  return output;
};

const base64EncodeAscii = (value) => {
  const input = utf8BinaryString(value);
  let output = '';
  for (let index = 0; index < input.length; index += 3) {
    const first = input.charCodeAt(index);
    const second = index + 1 < input.length ? input.charCodeAt(index + 1) : Number.NaN;
    const third = index + 2 < input.length ? input.charCodeAt(index + 2) : Number.NaN;
    const combined = (first << 16)
      | ((Number.isNaN(second) ? 0 : second) << 8)
      | (Number.isNaN(third) ? 0 : third);
    output += base64Alphabet[(combined >> 18) & 63];
    output += base64Alphabet[(combined >> 12) & 63];
    output += Number.isNaN(second) ? '=' : base64Alphabet[(combined >> 6) & 63];
    output += Number.isNaN(third) ? '=' : base64Alphabet[combined & 63];
  }
  return output;
};

const sharingToken = (url) => `u!${base64EncodeAscii(url)
  .replace(/=/g, '')
  .replace(/\//g, '_')
  .replace(/\+/g, '-')}`;

const cacheNameFor = ({ attachment, messageId }) => {
  const extension = fileExtension(attachment?.name)
    || (isImageJobChatAttachment(attachment) ? 'jpg' : 'bin');
  return [
    safeToken(messageId || attachment?.messageId || 'message'),
    '-',
    safeToken(attachment?.id || attachment?.name || 'attachment'),
    '.',
    extension,
  ].join('');
};

const existingLocalFile = async (uri) => {
  if (!uri || !String(uri).startsWith('file://')) return false;
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  return Boolean(info.exists);
};

export const resolveJobChatAttachment = async ({
  attachment,
  accessToken,
  messageId = '',
}) => {
  if (!attachment) throw new Error('This attachment is unavailable.');
  if (await existingLocalFile(attachment.localUri)) return attachment;

  await ensureDirectory(ATTACHMENT_CACHE_DIRECTORY);
  const destination = `${ATTACHMENT_CACHE_DIRECTORY}${cacheNameFor({ attachment, messageId })}`;
  if (await existingLocalFile(destination)) {
    return { ...attachment, localUri: destination };
  }

  const resolvedMessageId = messageId || attachment.messageId || '';
  const hostedContentUrl = attachment.hostedContentId
    && attachment.chatId
    && resolvedMessageId
    ? `${GRAPH_ROOT}/chats/${encodePath(attachment.chatId)}/messages/${encodePath(resolvedMessageId)}/hostedContents/${encodePath(attachment.hostedContentId)}/$value`
    : '';

  if ((attachment.source === 'hosted' || attachment.remoteType === 'hosted') && hostedContentUrl) {
    const result = await FileSystem.downloadAsync(
      hostedContentUrl,
      destination,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: attachment.mimeType || 'image/*',
        },
      },
    );
    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
      throw new Error('The Teams photo could not be downloaded.');
    }
    const info = await FileSystem.getInfoAsync(destination, { size: true });
    return {
      ...attachment,
      localUri: destination,
      size: Number(info?.size || attachment.size || 0),
    };
  }

  const fileUrl = attachment.contentUrl || attachment.webUrl || '';
  if (!fileUrl) throw new Error('This Teams attachment does not include a file link.');

  const token = sharingToken(fileUrl);
const item = await graphRequest(
  `${GRAPH_ROOT}/shares/${encodeURIComponent(token)}/driveItem`,
  accessToken,
  {
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'redeemSharingLink',
    },
  },
);
  const downloadUrl = item?.['@microsoft.graph.downloadUrl'];
  if (!downloadUrl) throw new Error('Microsoft did not provide a download link for this file.');

  const result = await FileSystem.downloadAsync(downloadUrl, destination);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(destination, { idempotent: true }).catch(() => {});
    throw new Error('The Teams file could not be downloaded.');
  }

  const resolvedMime = mimeTypeForJobChatFile(
    item?.name || attachment.name,
    item?.file?.mimeType || attachment.mimeType,
  );
  return {
    ...attachment,
    localUri: destination,
    name: item?.name || attachment.name,
    size: Number(item?.size || attachment.size || 0),
    mimeType: resolvedMime,
    kind: isImageJobChatAttachment({
      ...attachment,
      name: item?.name || attachment.name,
      mimeType: resolvedMime,
    }) ? 'photo' : 'file',
    driveItemId: item?.id || attachment.driveItemId || '',
    webUrl: item?.webUrl || attachment.webUrl || attachment.contentUrl,
  };
};

export const jobChatFileSharingOptions = (attachment = {}) => {
  const extension = fileExtension(attachment?.name);
  const base = {
    mimeType: mimeTypeForJobChatFile(attachment?.name, attachment?.mimeType),
    dialogTitle: extension === 'kml' || extension === 'kmz'
      ? 'Open map file'
      : `Open ${attachment?.name || 'attachment'}`,
  };
  if (extension === 'kml') return { ...base, UTI: 'com.google.earth.kml' };
  if (extension === 'kmz') return { ...base, UTI: 'com.google.earth.kmz' };
  if (extension === 'pdf') return { ...base, UTI: 'com.adobe.pdf' };
  return base;
};

export const downloadJobChatAttachment = async ({
  accessToken,
  attachment,
  messageId = '',
}) => {
  const resolved = await resolveJobChatAttachment({
    attachment,
    accessToken,
    messageId: messageId || attachment?.messageId || '',
  });
  if (!resolved?.localUri) throw new Error('The attachment could not be downloaded.');
  return resolved.localUri;
};

export const shareJobChatAttachment = async ({
  accessToken,
  attachment,
  messageId = '',
  onProgress,
}) => {
  onProgress?.(0.08);
  const resolved = await resolveJobChatAttachment({
    attachment,
    accessToken,
    messageId: messageId || attachment?.messageId || '',
  });
  onProgress?.(0.82);
  if (!resolved?.localUri) throw new Error('The attachment could not be downloaded.');
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('The iPhone share sheet is unavailable.');
  await Sharing.shareAsync(resolved.localUri, jobChatFileSharingOptions(resolved));
  onProgress?.(1);
  return resolved;
};

export const saveJobChatPhotoToLibrary = async ({
  accessToken,
  attachment,
  messageId = '',
}) => {
  const resolved = await resolveJobChatAttachment({
    attachment,
    accessToken,
    messageId: messageId || attachment?.messageId || '',
  });
  if (!resolved?.localUri) throw new Error('The photo could not be downloaded.');
  if (!isImageJobChatAttachment(resolved)) throw new Error('This attachment is not a photo.');

  const permission = await MediaLibrary.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Allow Photos access in iPhone Settings to save this image.');
  }
  await MediaLibrary.createAssetAsync(resolved.localUri);
  return resolved;
};
