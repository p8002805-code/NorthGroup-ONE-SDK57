import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';

import { accountDirectoryName } from '../../../services/account/accountIdentity';
import { jobStorageKey } from '../../jobs/jobContext';

const SCANS_KEY = 'northgroup_3d_feature_scans_v2';
const LEGACY_SCANS_KEY = 'northgroup_3d_feature_scans_v1';

const scanKey = (job, key = SCANS_KEY) => jobStorageKey(key, job);
const scanRoot = () => (
  `${FileSystem.documentDirectory}${accountDirectoryName()}Feature Scans/`
);

const clean = (value, fallback = 'Unknown') => (
  String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
);

const normalisePhoto = (photo = {}, index = 0) => ({
  id: String(photo.id || `${Date.now()}-${index}`),
  uri: String(photo.uri || ''),
  fileName: String(photo.fileName || `Photo_${String(index + 1).padStart(3, '0')}.jpg`),
  capturedAt: photo.capturedAt || new Date().toISOString(),
  size: Number(photo.size || 0),
});

const normaliseMeasurement = (measurement = {}, index = 0) => {
  const rawFrameIndex = Number(measurement.frameIndex || 0);
  const rawDistance = Number(measurement.distancePx || 0);
  const hasValue = measurement.value !== null
    && measurement.value !== undefined
    && measurement.value !== '';
  const rawValue = hasValue ? Number(measurement.value) : NaN;

  return {
    id: String(measurement.id || `measurement-${Date.now()}-${index}`),
    frameIndex: Number.isFinite(rawFrameIndex) ? Math.max(0, rawFrameIndex) : 0,
    frameName: String(measurement.frameName || ''),
    distancePx: Number.isFinite(rawDistance) ? rawDistance : 0,
    value: Number.isFinite(rawValue) ? rawValue : null,
    unit: String(measurement.unit || 'px'),
    calibrated: Boolean(measurement.calibrated),
    createdAt: measurement.createdAt || new Date().toISOString(),
  };
};

const normaliseScan = (scan = {}) => {
  const scanType = scan.scanType || (scan.modelUri ? 'lidar' : 'photo');
  const photos = (Array.isArray(scan.photos) ? scan.photos : [])
    .map(normalisePhoto)
    .filter((photo) => photo.uri);
  const measurements = (Array.isArray(scan.measurements) ? scan.measurements : [])
    .map(normaliseMeasurement)
    .filter((measurement) => measurement.distancePx > 0);

  const processingProgress = Number(scan.processingProgress);
  const hasPhotogrammetryModel = Boolean(scan.modelUri && scan.scanType !== 'lidar');

  return {
    id: String(scan.id || ''),
    jobNumber: String(scan.jobNumber || '').trim().toUpperCase(),
    featureId: String(scan.featureId || '').trim().toUpperCase(),
    notes: String(scan.notes || '').trim(),
    operator: String(scan.operator || '').trim(),
    scanType,
    captureMode: String(
      scan.captureMode || (scanType === 'lidar' ? 'lidar-object-capture' : 'continuous-auto'),
    ),
    status: scan.status || 'complete',
    modelUri: String(scan.modelUri || ''),
    modelFormat: String(
      scan.modelFormat
      || (scanType === 'lidar' ? 'usdz' : hasPhotogrammetryModel ? 'glb' : ''),
    ),
    scanDirectoryUri: String(scan.scanDirectoryUri || ''),
    photoDirectoryUri: String(scan.photoDirectoryUri || ''),
    photos,
    measurements,
    processingStatus: String(
      scan.processingStatus
      || (hasPhotogrammetryModel ? 'complete' : 'not-started'),
    ),
    processingQueueState: String(scan.processingQueueState || ''),
    processingProgress: Number.isFinite(processingProgress)
      ? Math.min(100, Math.max(0, processingProgress))
      : 0,
    processingStage: String(scan.processingStage || ''),
    processingMessage: String(scan.processingMessage || ''),
    processingJobId: String(scan.processingJobId || ''),
    processingUploadName: String(scan.processingUploadName || ''),
    processingStatusName: String(scan.processingStatusName || ''),
    processingModelName: String(scan.processingModelName || ''),
    processingCancelName: String(scan.processingCancelName || ''),
    processingDriveId: String(scan.processingDriveId || ''),
    processingFolderId: String(scan.processingFolderId || ''),
    processingError: String(scan.processingError || ''),
    processingErrorCode: String(scan.processingErrorCode || ''),
    processingUpdatedAt: scan.processingUpdatedAt || null,
    processingQueuedAt: scan.processingQueuedAt || null,
    processingStartedAt: scan.processingStartedAt || null,
    processingEstimatedSeconds: Number.isFinite(Number(scan.processingEstimatedSeconds))
      ? Math.max(0, Number(scan.processingEstimatedSeconds))
      : null,
    processingElapsedSeconds: Number.isFinite(Number(scan.processingElapsedSeconds))
      ? Math.max(0, Number(scan.processingElapsedSeconds))
      : null,
    processingWorkerSeenAt: scan.processingWorkerSeenAt || null,
    processingWorkerId: String(scan.processingWorkerId || ''),
    processingWorkerOnline: Boolean(scan.processingWorkerOnline),
    processingWorkerHeartbeatAt: scan.processingWorkerHeartbeatAt || null,
    processingWorkerError: String(scan.processingWorkerError || ''),
    processingWaitingForWorker: Boolean(scan.processingWaitingForWorker),
    processingAttempt: Number(scan.processingAttempt || 0) || 0,
    processingCancelledAt: scan.processingCancelledAt || null,
    processedAt: scan.processedAt || null,
    createdAt: scan.createdAt || new Date().toISOString(),
    completedAt: scan.completedAt || null,
    format: scanType === 'lidar'
      ? 'USDZ'
      : hasPhotogrammetryModel
        ? 'GLB MODEL'
        : 'AUTO CAPTURE',
  };
};

const ensureDir = async (uri) => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
};

const readSavedScans = async (job) => {
  const saved = await AsyncStorage.getItem(scanKey(job));
  if (saved) return JSON.parse(saved);

  const legacy = await AsyncStorage.getItem(scanKey(job, LEGACY_SCANS_KEY));
  return legacy ? JSON.parse(legacy) : [];
};

const checkPhoto = async (photo) => {
  try {
    const info = await FileSystem.getInfoAsync(photo.uri);
    return info.exists
      ? { ...photo, size: Number(info.size || photo.size || 0) }
      : null;
  } catch {
    return null;
  }
};

const checkScan = async (value) => {
  const scan = normaliseScan(value);

  if (scan.scanType === 'lidar') {
    if (!scan.modelUri) return null;
    try {
      const info = await FileSystem.getInfoAsync(scan.modelUri);
      return info.exists
        ? { ...scan, size: Number(info.size || 0) }
        : null;
    } catch {
      return null;
    }
  }

  const checkedPhotos = await Promise.all(scan.photos.map(checkPhoto));
  const photos = checkedPhotos.filter(Boolean);

  let modelUri = scan.modelUri;
  if (modelUri) {
    try {
      const modelInfo = await FileSystem.getInfoAsync(modelUri);
      if (!modelInfo.exists) modelUri = '';
    } catch {
      modelUri = '';
    }
  }

  if (!photos.length && scan.status !== 'draft') return null;

  return {
    ...scan,
    modelUri,
    photos,
    size: photos.reduce((total, photo) => total + Number(photo.size || 0), 0),
  };
};

export const loadFeatureScans = async (job) => {
  if (!job?.number) return [];

  const scans = await readSavedScans(job);
  const checked = await Promise.all(
    (Array.isArray(scans) ? scans : []).map(checkScan),
  );

  return checked
    .filter(Boolean)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

export const saveFeatureScan = async (job, scan) => {
  const current = await loadFeatureScans(job);
  const nextScan = normaliseScan(scan);
  const next = [
    nextScan,
    ...current.filter((item) => item.id !== nextScan.id),
  ];
  await AsyncStorage.setItem(scanKey(job), JSON.stringify(next));
  return next;
};

export const createPhotoScanDraft = async ({
  job,
  featureId,
  notes,
  operator,
}) => {
  const createdAt = new Date().toISOString();
  const timestamp = createdAt.replace(/[-:.TZ]/g, '').slice(0, 14);
  const id = `${clean(job?.number, 'JOB')}-${clean(featureId, 'SCAN')}-${Date.now()}`;
  const photoDirectoryUri = (
    `${scanRoot()}${clean(job?.number, 'JOB')}/${clean(featureId, 'SCAN')}_${timestamp}/`
  );

  await ensureDir(photoDirectoryUri);

  return normaliseScan({
    id,
    jobNumber: job?.number,
    featureId,
    notes,
    operator,
    scanType: 'photo',
    captureMode: 'continuous-auto',
    status: 'draft',
    photoDirectoryUri,
    scanDirectoryUri: photoDirectoryUri,
    photos: [],
    createdAt,
  });
};

export const addPhotoScanImage = async (scan, sourceUri) => {
  if (!scan?.photoDirectoryUri || !sourceUri) {
    throw new Error('The photo scan folder is not ready.');
  }

  await ensureDir(scan.photoDirectoryUri);
  const sequence = scan.photos.length + 1;
  const fileName = (
    `${clean(scan.featureId, 'SCAN')}_${String(sequence).padStart(3, '0')}.jpg`
  );
  const destinationUri = `${scan.photoDirectoryUri}${fileName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  const info = await FileSystem.getInfoAsync(destinationUri);
  if (!info.exists) throw new Error('The captured image could not be saved.');

  return normaliseScan({
    ...scan,
    photos: [
      ...scan.photos,
      {
        id: `${scan.id}-${sequence}-${Date.now()}`,
        uri: destinationUri,
        fileName,
        capturedAt: new Date().toISOString(),
        size: Number(info.size || 0),
      },
    ],
  });
};

export const removeLastPhotoScanImage = async (scan) => {
  const photos = [...(scan?.photos || [])];
  const removed = photos.pop();
  if (removed?.uri) {
    await FileSystem.deleteAsync(removed.uri, { idempotent: true });
  }
  return normaliseScan({ ...scan, photos });
};

export const completePhotoScan = (scan) => normaliseScan({
  ...scan,
  status: 'complete',
  completedAt: new Date().toISOString(),
});

export const discardEmptyPhotoScan = async (scan) => {
  if ((scan?.photos || []).length || !scan?.photoDirectoryUri) return;
  await FileSystem.deleteAsync(scan.photoDirectoryUri, { idempotent: true });
};

const buildPhotoManifest = (scan) => ({
  schemaVersion: 2,
  scanType: 'continuous-auto-capture',
  captureMode: scan.captureMode || 'continuous-auto',
  jobNumber: scan.jobNumber,
  featureId: scan.featureId,
  notes: scan.notes,
  operator: scan.operator,
  status: scan.status,
  createdAt: scan.createdAt,
  completedAt: scan.completedAt,
  imageCount: scan.photos.length,
  processingStatus: scan.processingStatus || 'not-started',
  processingQueueState: scan.processingQueueState || '',
  processingStage: scan.processingStage || '',
  processingProgress: scan.processingProgress || 0,
  processingUpdatedAt: scan.processingUpdatedAt || null,
  processingQueuedAt: scan.processingQueuedAt || null,
  processingStartedAt: scan.processingStartedAt || null,
  processingEstimatedSeconds: scan.processingEstimatedSeconds || null,
  processingElapsedSeconds: scan.processingElapsedSeconds || null,
  processingWorkerSeenAt: scan.processingWorkerSeenAt || null,
  processingWorkerHeartbeatAt: scan.processingWorkerHeartbeatAt || null,
  processingAttempt: scan.processingAttempt || 0,
  measurements: scan.measurements || [],
  images: scan.photos.map((photo, index) => ({
    sequence: index + 1,
    fileName: photo.fileName,
    capturedAt: photo.capturedAt,
  })),
});

export const exportPhotoScanZip = async (scan) => {
  if (!scan?.photos?.length) {
    throw new Error('Capture at least one photo before sharing this scan.');
  }

  const zip = new JSZip();
  const rootName = `${clean(scan.jobNumber)}_${clean(scan.featureId)}_Auto_Scan`;
  const root = zip.folder(rootName);

  for (const photo of scan.photos) {
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) continue;
    const base64 = await FileSystem.readAsStringAsync(photo.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    root.file(photo.fileName, base64, { base64: true });
  }

  root.file('Scan_Details.json', JSON.stringify(buildPhotoManifest(scan), null, 2));

  const zipUri = `${FileSystem.cacheDirectory}${rootName}.zip`;
  const zipBase64 = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 4 },
  });
  await FileSystem.writeAsStringAsync(zipUri, zipBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return zipUri;
};
