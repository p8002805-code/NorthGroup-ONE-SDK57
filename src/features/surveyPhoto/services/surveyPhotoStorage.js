import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import piexif from 'piexifjs';
import { accountDirectoryName } from '../../../services/account/accountIdentity';
import {
  buildSurveyPhotoFileNameBase,
  buildSurveyPhotoZipName,
  getPhotoDateKey,
  getSurveyorInitials,
  planSurveyPhotoZipParts,
  resolveSurveyPhotoInitials,
  SURVEY_PHOTO_ZIP_MAX_BYTES,
} from './surveyPhotoRules';

export {
  getPhotoDateKey,
  getSurveyorInitials,
} from './surveyPhotoRules';

const rootDir = () =>
  `${FileSystem.documentDirectory}${accountDirectoryName()}SurveyPhotos/`;
const clean = (value, fallback = 'Unknown') =>
  String(value || fallback).trim().replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, '_');
const projectDir = (number) => `${rootDir()}${clean(number)}/`;
const binDir = (number) => `${projectDir(number)}Bin/`;
const jsonUri = (number) => `${projectDir(number)}Project.json`;
const csvUri = (number) => `${projectDir(number)}Photo_Register.csv`;

const normalisePhotoUri = (uri) => {
  const value = String(uri || '').trim();
  if (!value || /^[a-z][a-z\d+.-]*:/i.test(value)) return value;
  return `file://${value}`;
};

const normaliseProject = (project = {}) => {
  const surveyorInitials = resolveSurveyPhotoInitials({
    projectInitials: project.surveyorInitials,
    surveyor: project.surveyor,
  });
  return {
    ...project,
    surveyorInitials,
    photos: (Array.isArray(project.photos) ? project.photos : []).map((photo) => ({
      ...photo,
      uri: normalisePhotoUri(photo.uri),
    })),
  };
};

const ensureDir = async (uri) => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
};

export const listProjects = async () => {
  const root = rootDir();
  await ensureDir(root);
  const names = await FileSystem.readDirectoryAsync(root);
  const projects = [];
  for (const name of names) {
    try { projects.push(await loadProject(name)); } catch (_) {}
  }
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
};

export const loadProject = async (number) =>
  normaliseProject(JSON.parse(await FileSystem.readAsStringAsync(jsonUri(number))));

export const createProject = async (projectNumber, startPhotoId, surveyor, userInitials = '') => {
  const projectNumberClean = clean(projectNumber, '');
  if (!projectNumberClean) throw new Error('Enter a project number.');
  const firstId = Number.parseInt(startPhotoId, 10);
  if (!Number.isFinite(firstId)) throw new Error('Start Photo ID must be a number.');
  const cleanSurveyor = String(surveyor || '').trim();
  if (!cleanSurveyor) throw new Error('Select the surveyor.');
  await ensureDir(projectDir(projectNumberClean));
  const existing = await FileSystem.getInfoAsync(jsonUri(projectNumberClean));
  if (existing.exists) return loadProject(projectNumberClean);
  const project = { projectNumber: projectNumberClean, surveyor: cleanSurveyor, surveyorInitials: resolveSurveyPhotoInitials({ profileInitials: userInitials, surveyor: cleanSurveyor }), startPhotoId: firstId, nextPhotoId: firstId, photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await saveProject(project);
  return project;
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const buildCsv = (project, photos = project.photos) => {
  const header = 'PhotoFile,Project,Surveyor,Initials,ImageType,PhotoID,PointID,Latitude,Longitude,HorizontalAccuracy,GPSFixDateTime,GPSFixAgeSeconds,CaptureDateTime,Comment';
  const rows = photos.map((p) => [p.fileName, project.projectNumber, p.surveyor || project.surveyor, p.surveyorInitials || project.surveyorInitials, p.imageType, p.photoId, p.pointId, p.latitude, p.longitude, p.horizontalAccuracy, p.gpsFixDateTime, p.gpsFixAgeSeconds, p.captureDateTime, p.comment].map(csvEscape).join(','));
  return [header, ...rows].join('\r\n');
};

export const rebuildCsv = async (project) =>
  FileSystem.writeAsStringAsync(
    csvUri(project.projectNumber),
    buildCsv(project, project.photos.filter((photo) => !photo.deletedAt))
  );

export const saveProject = async (project) => {
  const next = { ...normaliseProject(project), updatedAt: new Date().toISOString() };
  await FileSystem.writeAsStringAsync(jsonUri(project.projectNumber), JSON.stringify(next, null, 2));
  await rebuildCsv(next);
  return next;
};

const toRational = (number) => [Math.round(number * 1000), 1000];
const toDms = (value) => {
  const absolute = Math.abs(value); const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60; const minutes = Math.floor(minutesFloat);
  return [[degrees, 1], [minutes, 1], toRational((minutesFloat - minutes) * 60)];
};

const validNumber = (value) => {
  if (value === '' || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const photoLocation = (photo = {}) => {
  const latitude = validNumber(photo.latitude);
  const longitude = validNumber(photo.longitude);
  if (latitude == null || longitude == null) return null;
  return {
    latitude,
    longitude,
    altitude: validNumber(photo.altitude),
    accuracy: validNumber(photo.horizontalAccuracy),
    altitudeAccuracy: validNumber(photo.verticalAccuracy),
    heading: validNumber(photo.heading),
  };
};

const captureTimezoneOffset = (date, offsetMinutes) => {
  if (offsetMinutes === '' || offsetMinutes == null) {
    return date.getTimezoneOffset();
  }
  const savedOffset = Number(offsetMinutes);
  return Number.isFinite(savedOffset) ? savedOffset : date.getTimezoneOffset();
};

// ZIP timestamps and EXIF photo dates do not carry a timezone. Shift the
// instant so their UTC fields contain the original local capture clock time.
const captureWallClockDate = (value, offsetMinutes) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getTime() - captureTimezoneOffset(date, offsetMinutes) * 60 * 1000);
};

const exifDateTime = (value, offsetMinutes) => {
  if (!value) return null;
  const date = captureWallClockDate(value, offsetMinutes);
  if (!date) return null;
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join(':') + ` ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}:${String(date.getUTCSeconds()).padStart(2, '0')}`;
};

const insertPhotoMetadata = (original, location, capturedAt, timezoneOffsetMinutes) => {
  try {
    const dataUrl = `data:image/jpeg;base64,${original}`;
    let exifData;
    try {
      exifData = piexif.load(dataUrl);
    } catch (_) {
      exifData = { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null };
    }

    const capturedDate = capturedAt ? new Date(capturedAt) : null;
    const dateTime = exifDateTime(capturedDate, timezoneOffsetMinutes);
    if (dateTime) {
      exifData['0th'] = { ...(exifData['0th'] || {}), [piexif.ImageIFD.DateTime]: dateTime };
      exifData.Exif = {
        ...(exifData.Exif || {}),
        [piexif.ExifIFD.DateTimeOriginal]: dateTime,
        [piexif.ExifIFD.DateTimeDigitized]: dateTime,
      };
    }

    if (location && validNumber(location.latitude) != null && validNumber(location.longitude) != null) {
      const latitude = Number(location.latitude);
      const longitude = Number(location.longitude);
      const gps = {
        [piexif.GPSIFD.GPSLatitudeRef]: latitude >= 0 ? 'N' : 'S',
        [piexif.GPSIFD.GPSLatitude]: toDms(latitude),
        [piexif.GPSIFD.GPSLongitudeRef]: longitude >= 0 ? 'E' : 'W',
        [piexif.GPSIFD.GPSLongitude]: toDms(longitude),
      };
      if (validNumber(location.altitude) != null) {
        gps[piexif.GPSIFD.GPSAltitudeRef] = Number(location.altitude) < 0 ? 1 : 0;
        gps[piexif.GPSIFD.GPSAltitude] = toRational(Math.abs(Number(location.altitude)));
      }
      if (validNumber(location.heading) != null && Number(location.heading) >= 0) {
        gps[piexif.GPSIFD.GPSImgDirectionRef] = 'T';
        gps[piexif.GPSIFD.GPSImgDirection] = toRational(Number(location.heading));
      }
      if (capturedDate && !Number.isNaN(capturedDate.getTime())) {
        gps[piexif.GPSIFD.GPSDateStamp] = `${capturedDate.getUTCFullYear()}:${String(capturedDate.getUTCMonth() + 1).padStart(2, '0')}:${String(capturedDate.getUTCDate()).padStart(2, '0')}`;
        gps[piexif.GPSIFD.GPSTimeStamp] = [
          [capturedDate.getUTCHours(), 1],
          [capturedDate.getUTCMinutes(), 1],
          [capturedDate.getUTCSeconds(), 1],
        ];
      }
      exifData.GPS = { ...(exifData.GPS || {}), ...gps };
    }

    return {
      base64: piexif.insert(piexif.dump(exifData), dataUrl).split(',')[1],
      metadataWritten: true,
    };
  } catch (_) {
    return { base64: original, metadataWritten: false };
  }
};

const writePhotoMetadata = async (
  sourceUri,
  destinationUri,
  location,
  capturedAt,
  timezoneOffsetMinutes,
) => {
  const original = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
  const result = insertPhotoMetadata(original, location, capturedAt, timezoneOffsetMinutes);
  await FileSystem.writeAsStringAsync(destinationUri, result.base64, { encoding: FileSystem.EncodingType.Base64 });
  return result.metadataWritten;
};

const uniqueDestination = async (dir, base) => {
  let name = `${base}.jpg`; let index = 0;
  while ((await FileSystem.getInfoAsync(`${dir}${name}`)).exists) { index += 1; name = `${base}_${String(index).padStart(2, '0')}.jpg`; }
  return { name, uri: `${dir}${name}` };
};

export const saveCapturedPhoto = async ({ project, sourceUri, photoId, pointId, imageType, comment, location, capturedAt }) => {
  const typeFolder = clean(imageType, 'Others'); const dir = `${projectDir(project.projectNumber)}${typeFolder}/`;
  await ensureDir(dir);
  const initials = clean(project.surveyorInitials || getSurveyorInitials(project.surveyor), '');
  if (!clean(photoId, '')) throw new Error('Photo ID is required.');
  const destination = await uniqueDestination(dir, buildSurveyPhotoFileNameBase({
    initials,
    photoId,
    imageType: typeFolder,
  }));
  const captureDate = new Date(capturedAt || Date.now());
  const captureTimezoneOffsetMinutes = captureDate.getTimezoneOffset();
  const metadataWrittenToJpeg = await writePhotoMetadata(
    sourceUri,
    destination.uri,
    location,
    captureDate,
    captureTimezoneOffsetMinutes,
  );
  if (!(await FileSystem.getInfoAsync(destination.uri)).exists) throw new Error('The JPEG could not be saved.');
  const gpsFixTimestamp = Number(location?.timestamp);
  const hasGpsFixTime = Number.isFinite(gpsFixTimestamp) && gpsFixTimestamp > 0;
  const record = { id: `${Date.now()}`, fileName: destination.name, folder: typeFolder, uri: destination.uri, photoId: String(photoId), pointId: String(pointId || ''), imageType, surveyor: project.surveyor || '', surveyorInitials: project.surveyorInitials || '', comment: String(comment || ''), captureDateTime: captureDate.toISOString(), captureTimezoneOffsetMinutes, captureDateKey: `${captureDate.getFullYear()}-${String(captureDate.getMonth() + 1).padStart(2, '0')}-${String(captureDate.getDate()).padStart(2, '0')}`, latitude: location?.latitude ?? '', longitude: location?.longitude ?? '', altitude: location?.altitude ?? '', horizontalAccuracy: location?.accuracy ?? '', verticalAccuracy: location?.altitudeAccuracy ?? '', heading: location?.heading ?? '', gpsFixDateTime: hasGpsFixTime ? new Date(gpsFixTimestamp).toISOString() : '', gpsFixAgeSeconds: hasGpsFixTime ? Math.max(0, Math.round((captureDate.getTime() - gpsFixTimestamp) / 1000)) : '', gpsWrittenToJpeg: metadataWrittenToJpeg && Boolean(location), captureDateWrittenToJpeg: metadataWrittenToJpeg };
  const next = { ...project, nextPhotoId: Number.parseInt(photoId, 10) + 1, photos: [...project.photos, record] };
  try { return { project: await saveProject(next), record }; } catch (error) { await FileSystem.deleteAsync(destination.uri, { idempotent: true }); throw error; }
};

export const updatePhotoImageType = async (project, record, imageType) => {
  if (!record || record.deletedAt) throw new Error('Restore this photo before changing its image type.');
  const nextType = String(imageType || '').trim();
  if (!nextType) throw new Error('Select an image type.');
  if (nextType === record.imageType) return { project, record };

  const typeFolder = clean(nextType, 'Others');
  const destinationFolder = `${projectDir(project.projectNumber)}${typeFolder}/`;
  await ensureDir(destinationFolder);
  const initials = clean(project.surveyorInitials || record.surveyorInitials || getSurveyorInitials(record.surveyor || project.surveyor), '');
  const destination = await uniqueDestination(destinationFolder, buildSurveyPhotoFileNameBase({
    initials,
    photoId: record.photoId,
    imageType: typeFolder,
  }));
  const sourceInfo = await FileSystem.getInfoAsync(record.uri);
  if (!sourceInfo.exists) throw new Error('The original photo file could not be found.');
  await FileSystem.moveAsync({ from: record.uri, to: destination.uri });

  const nextRecord = {
    ...record,
    imageType: nextType,
    folder: typeFolder,
    fileName: destination.name,
    uri: destination.uri,
    reclassifiedAt: new Date().toISOString(),
  };
  try {
    const nextProject = await saveProject({
      ...project,
      photos: project.photos.map((photo) => photo.id === record.id ? nextRecord : photo),
    });
    return {
      project: nextProject,
      record: nextProject.photos.find((photo) => photo.id === record.id) || nextRecord,
    };
  } catch (error) {
    await FileSystem.moveAsync({ from: destination.uri, to: record.uri }).catch(() => {});
    throw error;
  }
};

export const movePhotoToBin = async (project, record) => {
  if (!record || record.deletedAt) return project;
  await ensureDir(binDir(project.projectNumber));
  const destination = await uniqueDestination(
    binDir(project.projectNumber),
    String(record.fileName || `Photo_${record.id}`).replace(/\.jpe?g$/i, '')
  );
  const sourceInfo = await FileSystem.getInfoAsync(record.uri);
  if (sourceInfo.exists) await FileSystem.moveAsync({ from: record.uri, to: destination.uri });
  const nextRecord = {
    ...record,
    uri: destination.uri,
    fileName: destination.name,
    deletedAt: new Date().toISOString(),
    binOriginalFolder: record.folder,
    binOriginalFileName: record.fileName,
  };
  return saveProject({
    ...project,
    photos: project.photos.map((photo) => photo.id === record.id ? nextRecord : photo),
  });
};

export const restorePhotoFromBin = async (project, record) => {
  if (!record?.deletedAt) return project;
  const folder = clean(record.binOriginalFolder || record.imageType, 'Others');
  const destinationFolder = `${projectDir(project.projectNumber)}${folder}/`;
  await ensureDir(destinationFolder);
  const originalBase = String(record.binOriginalFileName || record.fileName || `Photo_${record.id}`).replace(/\.jpe?g$/i, '');
  const destination = await uniqueDestination(destinationFolder, originalBase);
  const sourceInfo = await FileSystem.getInfoAsync(record.uri);
  if (sourceInfo.exists) await FileSystem.moveAsync({ from: record.uri, to: destination.uri });
  const nextRecord = {
    ...record,
    uri: destination.uri,
    fileName: destination.name,
    folder,
    deletedAt: null,
    restoredAt: new Date().toISOString(),
    binOriginalFolder: null,
    binOriginalFileName: null,
  };
  return saveProject({
    ...project,
    photos: project.photos.map((photo) => photo.id === record.id ? nextRecord : photo),
  });
};

export const permanentlyDeletePhoto = async (project, record) => {
  if (!record?.deletedAt) throw new Error('Only photos in the Bin can be permanently deleted.');
  await FileSystem.deleteAsync(record.uri, { idempotent: true });
  return saveProject({ ...project, photos: project.photos.filter((photo) => photo.id !== record.id) });
};

export const movePhotosToBin = async (project, records = []) => {
  const selectedIds = new Set(records.filter((photo) => photo && !photo.deletedAt).map((photo) => photo.id));
  if (!selectedIds.size) return project;
  await ensureDir(binDir(project.projectNumber));
  const movedById = new Map();
  for (const record of project.photos.filter((photo) => selectedIds.has(photo.id))) {
    const destination = await uniqueDestination(
      binDir(project.projectNumber),
      String(record.fileName || `Photo_${record.id}`).replace(/\.jpe?g$/i, '')
    );
    const sourceInfo = await FileSystem.getInfoAsync(record.uri);
    if (sourceInfo.exists) await FileSystem.moveAsync({ from: record.uri, to: destination.uri });
    movedById.set(record.id, {
      ...record,
      uri: destination.uri,
      fileName: destination.name,
      deletedAt: new Date().toISOString(),
      binOriginalFolder: record.folder,
      binOriginalFileName: record.fileName,
    });
  }
  return saveProject({
    ...project,
    photos: project.photos.map((photo) => movedById.get(photo.id) || photo),
  });
};

export const permanentlyDeletePhotos = async (project, records = []) => {
  const selectedIds = new Set(records.filter((photo) => photo?.deletedAt).map((photo) => photo.id));
  if (!selectedIds.size) return project;
  for (const photo of project.photos.filter((item) => selectedIds.has(item.id))) {
    await FileSystem.deleteAsync(photo.uri, { idempotent: true });
  }
  return saveProject({
    ...project,
    photos: project.photos.filter((photo) => !selectedIds.has(photo.id)),
  });
};

export const emptyPhotoBin = async (project) =>
  permanentlyDeletePhotos(project, project.photos.filter((photo) => photo.deletedAt));

const readPhotoForExport = async (photo) => {
  const original = await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 });
  return insertPhotoMetadata(
    original,
    photoLocation(photo),
    photo.captureDateTime,
    photo.captureTimezoneOffsetMinutes,
  ).base64;
};

const photoArchiveDate = (photo) => {
  return captureWallClockDate(
    photo?.captureDateTime || 0,
    photo?.captureTimezoneOffsetMinutes,
  ) || new Date();
};

const addPhotoToZip = async (folder, path, photo) => {
  const info = await FileSystem.getInfoAsync(photo.uri, { size: true });
  if (!info.exists) {
    throw new Error(`${photo?.fileName || 'A photo'} could not be found on this iPhone.`);
  }
  folder.file(path, await readPhotoForExport(photo), {
    base64: true,
    date: photoArchiveDate(photo),
    createFolders: true,
  });
};

const reportZipProgress = (onProgress, details) => {
  if (typeof onProgress !== 'function') return;
  const progress = Math.max(0, Math.min(1, Number(details?.progress) || 0));
  onProgress({ ...details, progress });
};

const exportPhotoPath = (photo, kind) => (
  kind === 'selected'
    ? photo.fileName
    : `${photo.folder || clean(photo.imageType, 'Others')}/${photo.fileName}`
);

const exportManifest = ({
  project,
  photos,
  exportScope,
  exportedAt,
  partNumber,
  partCount,
}) => ({
  ...project,
  photos,
  exportScope,
  ...(partCount > 1 ? {
    exportPart: {
      number: partNumber,
      count: partCount,
    },
  } : {}),
  exportedAt: exportedAt.toISOString(),
});

const createPhotoZip = async ({
  project,
  photos,
  userInitials = '',
  kind = 'project',
  exportScope,
  exportedAt = new Date(),
  partNumber = 1,
  partCount = 1,
  photoOffset = 0,
  totalPhotoCount = photos.length,
  progressStart = 0,
  progressEnd = 1,
  maxBytes = null,
  onProgress,
}) => {
  const zip = new JSZip();
  const root = zip.folder(project.projectNumber);
  const span = Math.max(0, progressEnd - progressStart);
  const addEnd = progressStart + span * 0.66;
  const generateEnd = progressStart + span * 0.97;

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    await addPhotoToZip(root, exportPhotoPath(photo, kind), photo);
    reportZipProgress(onProgress, {
      phase: 'adding',
      progress: progressStart + (addEnd - progressStart) * ((index + 1) / photos.length),
      photoNumber: photoOffset + index + 1,
      photoCount: totalPhotoCount,
      partPhotoNumber: index + 1,
      partPhotoCount: photos.length,
      partNumber,
      partCount,
    });
  }

  root.file(
    'Project.json',
    JSON.stringify(exportManifest({
      project,
      photos,
      exportScope,
      exportedAt,
      partNumber,
      partCount,
    }), null, 2),
  );
  root.file('Photo_Register.csv', buildCsv(project, photos));

  const fileName = buildSurveyPhotoZipName({
    projectNumber: project.projectNumber,
    initials: userInitials || project.surveyorInitials,
    exportedAt,
    kind,
    partNumber,
    partCount,
  });
  const uri = `${FileSystem.cacheDirectory}${fileName}`;

  reportZipProgress(onProgress, {
    phase: 'finalising',
    progress: addEnd,
    photoNumber: photoOffset + photos.length,
    photoCount: totalPhotoCount,
    partNumber,
    partCount,
  });

  // JPEGs are already compressed. STORE avoids wasting CPU re-compressing them
  // while keeping the package fully compatible with normal ZIP tools.
  const zipBase64 = await zip.generateAsync(
    { type: 'base64', compression: 'STORE' },
    (metadata) => {
      const fraction = Math.max(0, Math.min(1, Number(metadata?.percent || 0) / 100));
      reportZipProgress(onProgress, {
        phase: 'finalising',
        progress: addEnd + (generateEnd - addEnd) * fraction,
        photoNumber: photoOffset + photos.length,
        photoCount: totalPhotoCount,
        partNumber,
        partCount,
      });
    },
  );

  reportZipProgress(onProgress, {
    phase: 'saving',
    progress: generateEnd,
    photoNumber: photoOffset + photos.length,
    photoCount: totalPhotoCount,
    partNumber,
    partCount,
  });
  await FileSystem.writeAsStringAsync(uri, zipBase64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(uri, { size: true });
  const sizeBytes = Number(info.size) || Math.floor((zipBase64.length * 3) / 4);

  if (Number.isFinite(Number(maxBytes)) && sizeBytes > Number(maxBytes)) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
    throw new Error(
      `A photo package reached ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB, which is larger than the safe SharePoint package size. Upload that unusually large photo separately.`,
    );
  }

  reportZipProgress(onProgress, {
    phase: 'complete',
    progress: progressEnd,
    photoNumber: photoOffset + photos.length,
    photoCount: totalPhotoCount,
    partNumber,
    partCount,
  });

  return {
    uri,
    fileName,
    sizeBytes,
    partNumber,
    partCount,
    photoCount: photos.length,
    totalPhotoCount,
  };
};

const activeSelectedPhotos = (project, records = []) => {
  const selectedIds = new Set(
    records.filter((photo) => photo && !photo.deletedAt).map((photo) => photo.id),
  );
  return project.photos.filter((photo) => selectedIds.has(photo.id) && !photo.deletedAt);
};

const activeProjectPhotos = (project, selectedDateKeys = null) => {
  const includeAll = !selectedDateKeys || selectedDateKeys.length === 0;
  const selected = new Set(selectedDateKeys || []);
  const activePhotos = project.photos.filter((photo) => !photo.deletedAt);
  return includeAll
    ? activePhotos
    : activePhotos.filter((photo) => selected.has(getPhotoDateKey(photo)));
};

const buildPhotoZipParts = async ({
  project,
  photos,
  userInitials = '',
  kind,
  exportScope,
  onProgress,
  onPartReady,
}) => {
  if (!photos.length) {
    throw new Error(kind === 'selected'
      ? 'Select at least one photo to export.'
      : 'No photos are available for the selected dates.');
  }

  const entries = [];
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const info = await FileSystem.getInfoAsync(photo.uri, { size: true });
    if (!info.exists) {
      throw new Error(`${photo?.fileName || 'A photo'} could not be found on this iPhone.`);
    }
    entries.push({ photo, sizeBytes: Math.max(0, Number(info.size || 0)) });
    reportZipProgress(onProgress, {
      phase: 'planning',
      progress: 0.06 * ((index + 1) / photos.length),
      photoNumber: index + 1,
      photoCount: photos.length,
      partNumber: null,
      partCount: null,
    });
  }

  const plannedParts = planSurveyPhotoZipParts(entries);
  const partCount = plannedParts.length;
  const exportedAt = new Date();
  const results = [];
  let photoOffset = 0;

  for (let index = 0; index < plannedParts.length; index += 1) {
    const partNumber = index + 1;
    const partPhotos = plannedParts[index].entries.map((entry) => entry.photo);
    const progressStart = 0.06 + 0.94 * (index / partCount);
    const progressEnd = 0.06 + 0.94 * ((index + 1) / partCount);
    const result = await createPhotoZip({
      project,
      photos: partPhotos,
      userInitials,
      kind,
      exportScope,
      exportedAt,
      partNumber,
      partCount,
      photoOffset,
      totalPhotoCount: photos.length,
      progressStart,
      progressEnd,
      maxBytes: SURVEY_PHOTO_ZIP_MAX_BYTES,
      onProgress,
    });

    if (typeof onPartReady === 'function') {
      await onPartReady(result);
    }
    results.push(result);
    photoOffset += partPhotos.length;
  }

  return {
    parts: results,
    partCount,
    photoCount: photos.length,
    totalSizeBytes: results.reduce((sum, item) => sum + Number(item.sizeBytes || 0), 0),
  };
};

export const preparePhotoForExport = async (photo) => {
  if (!photo?.uri) throw new Error('The photo file could not be found.');
  const info = await FileSystem.getInfoAsync(photo.uri);
  if (!info.exists) throw new Error('The photo file could not be found.');
  const dir = `${FileSystem.cacheDirectory}SurveyPhotoExports/`;
  await ensureDir(dir);
  const fileName = clean(photo.fileName || `Photo_${photo.id}.jpg`, `Photo_${Date.now()}.jpg`);
  const uri = `${dir}${fileName.toLowerCase().endsWith('.jpg') ? fileName : `${fileName}.jpg`}`;
  await FileSystem.writeAsStringAsync(uri, await readPhotoForExport(photo), { encoding: FileSystem.EncodingType.Base64 });
  return { uri, fileName: uri.split('/').pop() };
};

export const exportSelectedPhotosZip = async (
  project,
  records = [],
  userInitials = '',
  onProgress = null,
) => {
  const photos = activeSelectedPhotos(project, records);
  if (!photos.length) throw new Error('Select at least one photo to export.');
  const exportedAt = new Date();
  return createPhotoZip({
    project,
    photos,
    userInitials,
    kind: 'selected',
    exportScope: 'Selected Photos',
    exportedAt,
    totalPhotoCount: photos.length,
    onProgress,
  });
};

export const exportSelectedPhotosZipParts = async (
  project,
  records = [],
  userInitials = '',
  options = {},
) => {
  const photos = activeSelectedPhotos(project, records);
  return buildPhotoZipParts({
    project,
    photos,
    userInitials,
    kind: 'selected',
    exportScope: 'Selected Photos',
    onProgress: options?.onProgress,
    onPartReady: options?.onPartReady,
  });
};

export const exportProjectZip = async (
  project,
  selectedDateKeys = null,
  userInitials = '',
  onProgress = null,
) => {
  const photos = activeProjectPhotos(project, selectedDateKeys);
  if (!photos.length) throw new Error('No photos are available for the selected dates.');
  const includeAll = !selectedDateKeys || selectedDateKeys.length === 0;
  const selected = new Set(selectedDateKeys || []);
  const exportedAt = new Date();
  return createPhotoZip({
    project,
    photos,
    userInitials,
    kind: 'project',
    exportScope: includeAll ? 'Whole Project' : [...selected].sort(),
    exportedAt,
    totalPhotoCount: photos.length,
    onProgress,
  });
};

export const exportProjectZipParts = async (
  project,
  selectedDateKeys = null,
  userInitials = '',
  options = {},
) => {
  const photos = activeProjectPhotos(project, selectedDateKeys);
  const includeAll = !selectedDateKeys || selectedDateKeys.length === 0;
  const selected = new Set(selectedDateKeys || []);
  return buildPhotoZipParts({
    project,
    photos,
    userInitials,
    kind: 'project',
    exportScope: includeAll ? 'Whole Project' : [...selected].sort(),
    onProgress: options?.onProgress,
    onPartReady: options?.onPartReady,
  });
};
