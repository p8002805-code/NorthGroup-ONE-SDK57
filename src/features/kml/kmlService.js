import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

import {
  listFolderItems,
  resolveJobFilesLocation,
} from '../jobFiles/jobFilesService';
import {
  buildKmlDocument,
  parseKmlDocument,
} from './kmlDocument';
import {
  graphFetch,
  graphErrorFromResponse,
  syncFetch,
} from '../../services/sync/graphClient';
import { createAuthenticatedGraphUploadTask } from '../../services/sync/graphFileTransfer';
import { trackSyncOperation } from '../../services/sync/syncState';
import { isSecureMicrosoftTransferUrl } from '../../services/security/trustedExternalUrl';

const KML_FOLDER_NAME = 'Most Recent KML';
const KML_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-kml/`;
const KML_EXTENSION_PATTERN = /\.(kml|kmz)$/i;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const normaliseName = (value) => clean(value).toLowerCase().replace(/[–—]/g, '-');
const encodeId = (value) => encodeURIComponent(String(value || ''));

const normaliseArchivePath = (value) => {
  const parts = [];
  String(value || '').replace(/\\/g, '/').split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') parts.pop();
    else parts.push(part);
  });
  return parts.join('/');
};

const decodePath = (value) => {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return String(value || '');
  }
};

const remoteIconUri = (href) => {
  const value = String(href || '').trim();
  if (!value) return '';
  if (/^(data|file|content):/i.test(value)) return value;
  if (/^https:/i.test(value)) return value;
  if (/^http:\/\/(maps\.google\.com|maps\.gstatic\.com)\//i.test(value)) {
    return value.replace(/^http:/i, 'https:');
  }
  return /^http:/i.test(value) ? value : '';
};

const extractArchiveIcon = async ({ archive, archiveEntryName, href, cacheKey }) => {
  if (!archive || !href || remoteIconUri(href)) return '';
  const documentPath = normaliseArchivePath(archiveEntryName);
  const documentFolder = documentPath.includes('/')
    ? documentPath.slice(0, documentPath.lastIndexOf('/'))
    : '';
  const targetPath = normaliseArchivePath(`${documentFolder}/${decodePath(href)}`);
  const entry = Object.values(archive.files || {}).find((candidate) => (
    !candidate.dir && normaliseArchivePath(candidate.name).toLowerCase() === targetPath.toLowerCase()
  ));
  if (!entry) return '';

  const extension = entry.name.match(/\.(png|jpe?g|gif|webp)$/i)?.[0]?.toLowerCase() || '.png';
  const entryStem = entry.name.replace(/\.[^.]+$/, '');
  const safeKey = `${cacheKey}-${entryStem}`.replace(/[^a-z0-9.-]+/gi, '-').slice(-150);
  const iconDirectory = `${KML_CACHE_DIRECTORY}icons/`;
  await FileSystem.makeDirectoryAsync(iconDirectory, { intermediates: true });
  const localUri = `${iconDirectory}${safeKey}${extension}`;
  await FileSystem.writeAsStringAsync(localUri, await entry.async('base64'), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return localUri;
};

const hydrateParsedIcons = async ({ parsed, archive, archiveEntryName, item }) => {
  const features = [
    ...(parsed.pins || []),
    ...(parsed.overlays?.lines || []),
    ...(parsed.overlays?.polygons || []),
  ];
  const hrefs = [...new Set(features.map((feature) => String(feature.style?.iconHref || '').trim()).filter(Boolean))];
  const cacheKey = clean(item?.id || item?.name || 'shared-kml').replace(/[^a-z0-9.-]+/gi, '-');
  const resolved = new Map();

  await Promise.all(hrefs.map(async (href) => {
    const remote = remoteIconUri(href);
    const local = remote || await extractArchiveIcon({
      archive,
      archiveEntryName,
      href,
      cacheKey,
    });
    if (local) resolved.set(href, local);
  }));

  const hydrateFeature = (feature) => ({
    ...feature,
    style: {
      ...(feature.style || {}),
      iconUri: resolved.get(String(feature.style?.iconHref || '').trim()) || '',
    },
  });
  const pins = (parsed.pins || []).map(hydrateFeature);
  const lines = (parsed.overlays?.lines || []).map(hydrateFeature);
  const polygons = (parsed.overlays?.polygons || []).map(hydrateFeature);
  const firstByLayer = new Map([...pins, ...lines, ...polygons].map((feature) => [feature.folderId, feature]));
  return {
    pins,
    overlays: { lines, polygons },
    layers: (parsed.layers || []).map((layer) => ({
      ...layer,
      style: firstByLayer.get(layer.id)?.style || layer.style,
    })),
  };
};

const fetchItemContent = async ({ accessToken, driveId, item }) => {
  const downloadUrl = item?.['@microsoft.graph.downloadUrl'];
  const response = isSecureMicrosoftTransferUrl(downloadUrl)
    ? await syncFetch(
      downloadUrl,
      {},
      { feature: 'kml', operation: 'Download shared KML' },
    )
    : await graphFetch(
      `/drives/${encodeId(driveId)}/items/${encodeId(item.id)}/content`,
      accessToken,
      {},
      { feature: 'kml', operation: 'Download shared KML' },
    );
  if (!response.ok) {
    throw await graphErrorFromResponse(response, {
      fallback: `The shared KML could not be downloaded (${response.status}).`,
    });
  }
  return response;
};

const loadKmlArchive = async (response) => {
  const archive = await JSZip.loadAsync(await response.arrayBuffer());
  const entries = Object.values(archive.files || {}).filter(
    (entry) => !entry.dir && /\.kml$/i.test(entry.name),
  );
  if (!entries.length) {
    throw new Error('The KMZ file does not contain a KML document.');
  }
  const preferred = entries.find((entry) => /(^|\/)doc\.kml$/i.test(entry.name)) || entries[0];
  return {
    archive,
    archiveEntryName: preferred.name,
    xml: await preferred.async('string'),
  };
};

const findKmlFolder = (items) => items.find((item) => (
  item?.folder && normaliseName(item.name) === normaliseName(KML_FOLDER_NAME)
));

const newestKmlItem = (items) => items
  .filter((item) => item?.file && KML_EXTENSION_PATTERN.test(clean(item.name)))
  .sort((left, right) => (
    new Date(right.lastModifiedDateTime || 0).getTime()
    - new Date(left.lastModifiedDateTime || 0).getTime()
  ))[0];

export const loadSharedKml = async ({ accessToken, job }) => {
  const location = await resolveJobFilesLocation({ accessToken, job });
  const jobItems = await listFolderItems({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
  });
  const kmlFolder = findKmlFolder(jobItems);
  if (!kmlFolder) {
    throw new Error(`The “${KML_FOLDER_NAME}” folder could not be found for job ${clean(job?.number)}.`);
  }

  const folderItems = await listFolderItems({
    accessToken,
    driveId: location.drive.id,
    folderId: kmlFolder.id,
  });
  const item = newestKmlItem(folderItems);
  if (!item) {
    throw new Error(`No KML or KMZ file was found in “${KML_FOLDER_NAME}”.`);
  }

  const response = await fetchItemContent({
    accessToken,
    driveId: location.drive.id,
    item,
  });
  const isKmz = /\.kmz$/i.test(item.name);
  const loaded = isKmz
    ? await loadKmlArchive(response)
    : { archive: null, archiveEntryName: '', xml: await response.text() };
  const parsed = await hydrateParsedIcons({
    parsed: parseKmlDocument(loaded.xml),
    archive: loaded.archive,
    archiveEntryName: loaded.archiveEntryName,
    item,
  });

  return {
    driveId: location.drive.id,
    folderId: kmlFolder.id,
    item,
    eTag: item.eTag || '',
    format: isKmz ? 'kmz' : 'kml',
    xml: loaded.xml,
    archive: loaded.archive,
    archiveEntryName: loaded.archiveEntryName,
    pins: parsed.pins,
    overlays: parsed.overlays,
    layers: parsed.layers,
  };
};

const uploadContentFile = async ({
  accessToken,
  driveId,
  item,
  eTag,
  localUri,
  mimeType,
}) => {
  const task = createAuthenticatedGraphUploadTask({
    accessToken,
    urlOrPath: `/drives/${encodeId(driveId)}/items/${encodeId(item.id)}/content`,
    fileUri: localUri,
    options: {
      httpMethod: 'PUT',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        'Content-Type': mimeType,
        ...(eTag ? { 'If-Match': eTag } : {}),
      },
    },
  });
  const result = await task.uploadAsync();
  if (result?.status === 409 || result?.status === 412) {
    const conflict = new Error('Another user saved a newer version of this KML. Reload it before saving your changes.');
    conflict.code = 'KML_VERSION_CONFLICT';
    throw conflict;
  }
  if (!result || result.status < 200 || result.status >= 300) {
    let detail = '';
    try {
      detail = JSON.parse(result?.body || '{}')?.error?.message || '';
    } catch {
      detail = '';
    }
    throw new Error(detail || `The shared KML could not be saved (${result?.status || 'unknown status'}).`);
  }
  try {
    return JSON.parse(result.body || '{}');
  } catch {
    return {};
  }
};

const uploadContent = async (parameters) => trackSyncOperation(
  { feature: 'kml', operation: 'Save shared KML' },
  () => uploadContentFile(parameters),
);

export const saveSharedKml = async ({ accessToken, document, pins, lines, polygons }) => {
  if (!document?.item?.id || !document?.driveId) {
    throw new Error('The shared KML destination is unavailable. Reload the file and try again.');
  }

  const xml = buildKmlDocument(document.xml, { pins, lines, polygons });
  const safeName = clean(document.item.name || 'shared.kml')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
  await FileSystem.makeDirectoryAsync(KML_CACHE_DIRECTORY, { intermediates: true });
  const localUri = `${KML_CACHE_DIRECTORY}${Date.now()}-${safeName}`;
  let mimeType = 'application/vnd.google-earth.kml+xml';

  if (document.format === 'kmz') {
    if (!document.archive || !document.archiveEntryName) {
      throw new Error('The KMZ archive is unavailable. Reload the file and try again.');
    }
    document.archive.file(document.archiveEntryName, xml);
    const base64 = await document.archive.generateAsync({
      type: 'base64',
      compression: 'DEFLATE',
    });
    await FileSystem.writeAsStringAsync(localUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    mimeType = 'application/vnd.google-earth.kmz';
  } else {
    await FileSystem.writeAsStringAsync(localUri, xml, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  let item;
  try {
    item = await uploadContent({
      accessToken,
      driveId: document.driveId,
      item: document.item,
      eTag: document.eTag,
      localUri,
      mimeType,
    });
  } finally {
    await FileSystem.deleteAsync(localUri, { idempotent: true }).catch(() => undefined);
  }

  const parsed = await hydrateParsedIcons({
    parsed: parseKmlDocument(xml),
    archive: document.archive,
    archiveEntryName: document.archiveEntryName,
    item: { ...document.item, ...item },
  });
  return {
    ...document,
    item: { ...document.item, ...item },
    eTag: item.eTag || document.eTag,
    xml,
    pins: parsed.pins,
    overlays: parsed.overlays,
    layers: parsed.layers,
  };
};
