import * as FileSystem from 'expo-file-system/legacy';

import {
  deleteJobFile,
  downloadJobFile,
  listFolderItems,
  MAX_SCAN_UPLOAD_BYTES,
  resolveJobFilesLocation,
  uploadJobFile,
} from '../../jobFiles/jobFilesService';
import { exportPhotoScanZip } from './featureScanStorage';

const PROCESSING_PREFIX = 'NGONE_PGM_';
const MODEL_EXTENSION = '.glb';
const WORKER_HEARTBEAT_NAME = 'NGONE_PGM_WORKER.json';
const WORKER_HEARTBEAT_MAX_AGE_MS = 45 * 1000;

const clean = (value, fallback = 'SCAN') => String(value || fallback)
  .trim()
  .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  .replace(/\s+/g, '_');

const baseNameFor = (scan) => [
  PROCESSING_PREFIX,
  clean(scan?.jobNumber, 'JOB'),
  clean(scan?.featureId, 'FEATURE'),
  clean(scan?.id, 'SCAN'),
].join('');

export const getPhotogrammetryFileNames = (scan) => {
  const baseName = baseNameFor(scan);
  return {
    baseName,
    uploadName: `${baseName}.ngscan.zip`,
    statusName: `${baseName}.status.json`,
    modelName: `${baseName}${MODEL_EXTENSION}`,
    cancelName: `${baseName}.cancel.json`,
  };
};

const readJsonFile = async (uri) => {
  const raw = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return JSON.parse(raw);
};

const findNamedItem = (items, name) => items.find(
  (item) => String(item?.name || '').toLowerCase() === String(name || '').toLowerCase(),
);

const normaliseProcessingStatus = (status) => {
  const value = String(status || '').toLowerCase();
  if (['queued', 'processing', 'complete', 'failed', 'cancelled'].includes(value)) return value;
  return 'queued';
};

const finiteNumberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const isFreshTimestamp = (value, maximumAge = WORKER_HEARTBEAT_MAX_AGE_MS) => {
  const timestamp = Date.parse(String(value || ''));
  return Number.isFinite(timestamp) && (Date.now() - timestamp) <= maximumAge;
};

const remoteLocationFor = async ({ accessToken, job, scan }) => (
  scan?.processingDriveId && scan?.processingFolderId
    ? {
      drive: { id: scan.processingDriveId },
      folder: { id: scan.processingFolderId },
    }
    : resolveJobFilesLocation({ accessToken, job })
);

const removeNamedRemoteFiles = async ({ accessToken, location, names }) => {
  const items = await listFolderItems({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
  });
  const targets = [names.statusName, names.modelName, names.cancelName]
    .map((name) => findNamedItem(items, name))
    .filter(Boolean);

  for (const item of targets) {
    await deleteJobFile({
      accessToken,
      driveId: location.drive.id,
      itemId: item.id,
    });
  }
};

export const queuePhotogrammetryScan = async ({
  accessToken,
  job,
  scan,
  onProgress,
}) => {
  if (!accessToken) throw new Error('Microsoft sign-in is required to process a scan.');
  if (!job?.number) throw new Error('Choose an active job before processing a scan.');
  if (!scan?.photos?.length) throw new Error('The scan does not contain any captured frames.');

  const location = await resolveJobFilesLocation({ accessToken, job });
  const names = getPhotogrammetryFileNames(scan);

  // A retry must reuse the same stable names. SharePoint's default rename
  // behaviour creates "(1)" files that the mobile app does not poll.
  await removeNamedRemoteFiles({ accessToken, location, names }).catch(() => {});

  const zipUri = await exportPhotoScanZip(scan);
  const info = await FileSystem.getInfoAsync(zipUri, { size: true });

  const uploaded = await uploadJobFile({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
    asset: {
      uri: zipUri,
      name: names.uploadName,
      mimeType: 'application/zip',
      size: Number(info?.size || 0),
    },
    conflictBehavior: 'replace',
    maxBytes: MAX_SCAN_UPLOAD_BYTES,
    onProgress,
  });

  const now = new Date().toISOString();
  return {
    processingStatus: 'queued',
    processingProgress: 2,
    processingStage: 'QUEUED',
    processingMessage: 'The scan is uploaded and waiting for the NorthGroup processing computer.',
    processingQueueState: 'waiting-for-processor',
    processingJobId: String(uploaded?.id || names.baseName),
    processingUploadName: names.uploadName,
    processingStatusName: names.statusName,
    processingModelName: names.modelName,
    processingCancelName: names.cancelName,
    processingDriveId: String(location.drive.id || ''),
    processingFolderId: String(location.folder.id || ''),
    processingError: '',
    processingErrorCode: '',
    processingUpdatedAt: now,
    processingQueuedAt: now,
    processingStartedAt: null,
    processingEstimatedSeconds: null,
    processingElapsedSeconds: null,
    processingWorkerSeenAt: null,
    processingWorkerId: '',
    processingWorkerOnline: false,
    processingWorkerHeartbeatAt: null,
    processingWorkerError: '',
    processingWaitingForWorker: true,
    processingAttempt: Number(scan.processingAttempt || 0) + 1,
    processingCancelledAt: null,
    modelUri: '',
    modelFormat: '',
    processedAt: null,
  };
};

export const cancelPhotogrammetryScan = async ({
  accessToken,
  job,
  scan,
}) => {
  if (!accessToken) throw new Error('Microsoft sign-in is required to cancel this build.');
  if (!job?.number) throw new Error('Choose an active job before cancelling a build.');
  if (!scan?.id) throw new Error('The scan could not be identified for cancellation.');

  const location = await remoteLocationFor({ accessToken, job, scan });
  const names = getPhotogrammetryFileNames(scan);
  const markerUri = `${FileSystem.cacheDirectory}${names.cancelName}`;
  const marker = {
    schemaVersion: 1,
    status: 'cancelled',
    scanId: scan.id,
    requestedAt: new Date().toISOString(),
    message: 'Cancellation requested from NorthGroup ONE.',
  };

  await FileSystem.writeAsStringAsync(markerUri, JSON.stringify(marker, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const info = await FileSystem.getInfoAsync(markerUri, { size: true });

  await uploadJobFile({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
    asset: {
      uri: markerUri,
      name: names.cancelName,
      mimeType: 'application/json',
      size: Number(info?.size || 0),
    },
    conflictBehavior: 'replace',
  });

  return {
    processingStatus: 'cancelled',
    processingProgress: 0,
    processingStage: 'CANCELLED',
    processingMessage: 'Cancellation requested. The processing computer will stop this build.',
    processingError: '',
    processingCancelName: names.cancelName,
    processingCancelledAt: marker.requestedAt,
    processingUpdatedAt: marker.requestedAt,
    processingWaitingForWorker: false,
  };
};

export const removePhotogrammetryArtifacts = async ({
  accessToken,
  job,
  scan,
}) => {
  if (!accessToken) throw new Error('Microsoft sign-in is required to remove this queue item.');
  const location = await remoteLocationFor({ accessToken, job, scan });
  const names = getPhotogrammetryFileNames(scan);
  const items = await listFolderItems({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
  });
  const targets = [names.uploadName, names.statusName, names.modelName, names.cancelName]
    .map((name) => findNamedItem(items, name))
    .filter(Boolean);

  for (const item of targets) {
    await deleteJobFile({
      accessToken,
      driveId: location.drive.id,
      itemId: item.id,
    });
  }
  return true;
};

export const readPhotogrammetryProcessingState = async ({
  accessToken,
  job,
  scan,
}) => {
  if (!accessToken) throw new Error('Microsoft sign-in is required to check processing.');
  if (!job?.number) throw new Error('Choose an active job before checking processing.');

  const names = getPhotogrammetryFileNames(scan);
  const location = await remoteLocationFor({ accessToken, job, scan });
  const items = await listFolderItems({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
  });
  const statusItem = findNamedItem(items, scan?.processingStatusName || names.statusName);
  const modelItem = findNamedItem(items, scan?.processingModelName || names.modelName);
  const cancelItem = findNamedItem(items, scan?.processingCancelName || names.cancelName);
  const uploadItem = findNamedItem(items, scan?.processingUploadName || names.uploadName);
  const workerItem = findNamedItem(items, WORKER_HEARTBEAT_NAME);

  const readRemoteJson = async (item) => {
    if (!item) return null;
    try {
      const uri = await downloadJobFile({
        accessToken,
        driveId: location.drive.id,
        item,
      });
      return await readJsonFile(uri);
    } catch {
      return null;
    }
  };

  const heartbeat = await readRemoteJson(workerItem);
  const heartbeatUpdatedAt = heartbeat?.updatedAt
    || workerItem?.lastModifiedDateTime
    || null;
  const workerOnline = heartbeat?.status === 'online'
    && isFreshTimestamp(heartbeatUpdatedAt);
  const workerStale = Boolean(heartbeatUpdatedAt)
    && !isFreshTimestamp(heartbeatUpdatedAt);
  const baseState = {
    processingDriveId: String(location.drive.id || ''),
    processingFolderId: String(location.folder.id || ''),
    processingUploadName: uploadItem?.name || scan?.processingUploadName || names.uploadName,
    processingStatusName: scan?.processingStatusName || names.statusName,
    processingModelName: scan?.processingModelName || names.modelName,
    processingCancelName: scan?.processingCancelName || names.cancelName,
    processingWorkerId: String(heartbeat?.workerId || scan?.processingWorkerId || ''),
    processingWorkerOnline: workerOnline,
    processingWorkerHeartbeatAt: heartbeatUpdatedAt,
    processingWorkerError: String(heartbeat?.error || ''),
  };

  if (!statusItem && cancelItem) {
    return {
      ...baseState,
      processingStatus: 'cancelled',
      processingProgress: 0,
      processingStage: 'CANCELLED',
      processingQueueState: 'cancelled',
      processingMessage: 'This build was cancelled before the processor started.',
      processingError: '',
      processingCancelName: cancelItem.name,
      processingWaitingForWorker: false,
    };
  }

  if (!statusItem) {
    const synchronising = !uploadItem;
    const processorUnavailable = Boolean(heartbeat?.status === 'offline' || workerStale || !workerOnline);
    const processingMessage = synchronising
      ? 'The scan is still synchronising to the SharePoint job folder.'
      : heartbeat?.error
        ? `Processor unavailable: ${heartbeat.error}`
        : processorUnavailable
          ? 'The scan is uploaded, but no active NorthGroup processing worker is online.'
          : 'The processor is online and waiting to pick up this scan.';
    return {
      ...baseState,
      processingStatus: 'queued',
      processingProgress: Math.max(2, Number(scan?.processingProgress || 0)),
      processingStage: synchronising
        ? 'SYNCING'
        : processorUnavailable
          ? 'PROCESSOR OFFLINE'
          : 'QUEUED',
      processingQueueState: synchronising
        ? 'syncing'
        : processorUnavailable
          ? 'processor-offline'
          : 'waiting-for-processor',
      processingMessage,
      processingWaitingForWorker: true,
    };
  }

  let status = {};
  try {
    const statusUri = await downloadJobFile({
      accessToken,
      driveId: location.drive.id,
      item: statusItem,
    });
    status = await readJsonFile(statusUri);
  } catch {
    return {
      ...baseState,
      processingStatus: 'processing',
      processingProgress: Math.max(4, Number(scan?.processingProgress || 0)),
      processingStage: 'PREPARING',
      processingMessage: 'The processing computer has picked up this scan.',
      processingStatusName: statusItem.name,
      processingWaitingForWorker: false,
      processingUpdatedAt: scan?.processingUpdatedAt || null,
    };
  }

  const processingStatus = normaliseProcessingStatus(status.status);
  const statusProgress = Number(status.progress);
  const progress = Number.isFinite(statusProgress)
    ? Math.min(100, Math.max(0, statusProgress))
    : processingStatus === 'complete'
      ? 100
      : processingStatus === 'queued'
        ? 2
        : Math.max(4, Number(scan?.processingProgress || 0));

  const statusWorkerSeenAt = status.workerSeenAt || null;
  const statusWorkerFresh = isFreshTimestamp(statusWorkerSeenAt, 60 * 1000);
  const resolvedWorkerOnline = workerOnline || statusWorkerFresh;
  const processingQueueState = processingStatus === 'queued'
    ? resolvedWorkerOnline ? 'waiting-for-processor' : 'processor-offline'
    : processingStatus === 'processing' && workerStale && !statusWorkerFresh
      ? 'processor-stale'
      : processingStatus;
  const statusMessage = String(status.message || '');
  const next = {
    ...baseState,
    processingStatus,
    processingProgress: progress,
    processingStage: String(status.stage || processingStatus.toUpperCase()),
    processingQueueState,
    processingMessage: processingStatus === 'queued' && !resolvedWorkerOnline
      ? 'The processing worker is offline or has stopped reporting. The captured scan is safe and can be retried when the processor is online.'
      : statusMessage,
    processingError: String(status.error || ''),
    processingStatusName: statusItem.name,
    processingModelName: String(status.modelFileName || scan?.processingModelName || names.modelName),
    processingCancelName: String(status.cancelFileName || scan?.processingCancelName || names.cancelName),
    processingUpdatedAt: status.updatedAt || null,
    processingWorkerSeenAt: status.workerSeenAt || null,
    processingWorkerId: String(status.workerId || ''),
    processingWorkerOnline: resolvedWorkerOnline,
    processingWorkerHeartbeatAt: heartbeatUpdatedAt,
    processingWorkerError: String(heartbeat?.error || ''),
    processingWaitingForWorker: processingStatus === 'queued' && !resolvedWorkerOnline,
    processingCancelledAt: status.cancelledAt || null,
    processedAt: status.completedAt || null,
    processingErrorCode: String(status.errorCode || ''),
    processingQueuedAt: status.queuedAt || scan?.processingQueuedAt || null,
    processingStartedAt: status.startedAt || scan?.processingStartedAt || null,
    processingEstimatedSeconds: finiteNumberOrNull(
      status.estimatedRemainingSeconds ?? status.estimation,
    ),
    processingElapsedSeconds: finiteNumberOrNull(status.elapsedSeconds),
  };

  const resolvedModelItem = modelItem || findNamedItem(
    items,
    status.modelFileName || scan?.processingModelName || names.modelName,
  );

  if (processingStatus === 'complete' && resolvedModelItem) {
    const existingModelInfo = scan?.modelUri
      ? await FileSystem.getInfoAsync(scan.modelUri).catch(() => ({ exists: false }))
      : { exists: false };
    let modelUri = existingModelInfo.exists ? scan.modelUri : '';
    if (!modelUri) {
      try {
        modelUri = await downloadJobFile({
          accessToken,
          driveId: location.drive.id,
          item: resolvedModelItem,
        });
      } catch {
        return {
          ...next,
          processingProgress: 98,
          processingStage: 'FINALISING',
          processingMessage: 'The model is built. NorthGroup ONE is downloading the mobile model.',
        };
      }
    }

    return {
      ...next,
      processingProgress: 100,
      processingStage: 'COMPLETE',
      modelUri,
      modelFormat: 'glb',
    };
  }

  if (processingStatus === 'complete' && !resolvedModelItem) {
    return {
      ...next,
      processingProgress: 98,
      processingStage: 'FINALISING',
      processingMessage: 'The processor finished the build and is synchronising the mobile model.',
    };
  }

  return next;
};
