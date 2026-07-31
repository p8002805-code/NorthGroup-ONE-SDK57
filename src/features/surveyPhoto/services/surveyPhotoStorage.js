import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import piexif from 'piexifjs';
import { accountDirectoryName } from '../../account/accountWorkspace';

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

const normaliseProject = (project = {}) => ({
  ...project,
  photos: (Array.isArray(project.photos) ? project.photos : []).map((photo) => ({
    ...photo,
    uri: normalisePhotoUri(photo.uri),
  })),
});

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

export const getSurveyorInitials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export const getPhotoDateKey = (photo) => {
  if (photo?.captureDateKey) return photo.captureDateKey;
  const date = new Date(photo?.captureDateTime || 0);
  if (Number.isNaN(date.getTime())) return 'Unknown Date';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createProject = async (projectNumber, startPhotoId, surveyor) => {
  const projectNumberClean = clean(projectNumber, '');
  if (!projectNumberClean) throw new Error('Enter a project number.');
  const firstId = Number.parseInt(startPhotoId, 10);
  if (!Number.isFinite(firstId)) throw new Error('Start Photo ID must be a number.');
  const cleanSurveyor = String(surveyor || '').trim();
  if (!cleanSurveyor) throw new Error('Select the surveyor.');
  await ensureDir(projectDir(projectNumberClean));
  const existing = await FileSystem.getInfoAsync(jsonUri(projectNumberClean));
  if (existing.exists) return loadProject(projectNumberClean);
  const project = { projectNumber: projectNumberClean, surveyor: cleanSurveyor, surveyorInitials: getSurveyorInitials(cleanSurveyor), startPhotoId: firstId, nextPhotoId: firstId, photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await saveProject(project);
  return project;
};

const csvEscape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
const buildCsv = (project, photos = project.photos) => {
  const header = 'PhotoFile,Project,Surveyor,Initials,ImageType,PhotoID,PointID,Latitude,Longitude,HorizontalAccuracy,CaptureDateTime,Comment';
  const rows = photos.map((p) => [p.fileName, project.projectNumber, p.surveyor || project.surveyor, p.surveyorInitials || project.surveyorInitials, p.imageType, p.photoId, p.pointId, p.latitude, p.longitude, p.horizontalAccuracy, p.captureDateTime, p.comment].map(csvEscape).join(','));
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

const writeGpsExif = async (sourceUri, destinationUri, location) => {
  const original = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
  if (!location) { await FileSystem.copyAsync({ from: sourceUri, to: destinationUri }); return false; }
  try {
    const gps = {};
    gps[piexif.GPSIFD.GPSLatitudeRef] = location.latitude >= 0 ? 'N' : 'S';
    gps[piexif.GPSIFD.GPSLatitude] = toDms(location.latitude);
    gps[piexif.GPSIFD.GPSLongitudeRef] = location.longitude >= 0 ? 'E' : 'W';
    gps[piexif.GPSIFD.GPSLongitude] = toDms(location.longitude);
    if (location.altitude != null) { gps[piexif.GPSIFD.GPSAltitudeRef] = location.altitude < 0 ? 1 : 0; gps[piexif.GPSIFD.GPSAltitude] = toRational(Math.abs(location.altitude)); }
    if (location.heading != null && location.heading >= 0) { gps[piexif.GPSIFD.GPSImgDirectionRef] = 'T'; gps[piexif.GPSIFD.GPSImgDirection] = toRational(location.heading); }
    const dataUrl = `data:image/jpeg;base64,${original}`;
    let exifData;
    try {
      exifData = piexif.load(dataUrl);
    } catch (_) {
      exifData = { '0th': {}, Exif: {}, GPS: {}, '1st': {}, thumbnail: null };
    }
    exifData.GPS = { ...(exifData.GPS || {}), ...gps };
    const output = piexif.insert(piexif.dump(exifData), dataUrl).split(',')[1];
    await FileSystem.writeAsStringAsync(destinationUri, output, { encoding: FileSystem.EncodingType.Base64 });
    return true;
  } catch (_) { await FileSystem.copyAsync({ from: sourceUri, to: destinationUri }); return false; }
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
  const parts = [initials || null, clean(photoId, ''), pointId ? clean(pointId, '') : null, typeFolder].filter(Boolean);
  if (!clean(photoId, '')) throw new Error('Photo ID is required.');
  const destination = await uniqueDestination(dir, parts.join('_'));
  const gpsWrittenToJpeg = await writeGpsExif(sourceUri, destination.uri, location);
  if (!(await FileSystem.getInfoAsync(destination.uri)).exists) throw new Error('The JPEG could not be saved.');
  const captureDate = new Date(capturedAt || Date.now());
  const record = { id: `${Date.now()}`, fileName: destination.name, folder: typeFolder, uri: destination.uri, photoId: String(photoId), pointId: String(pointId || ''), imageType, surveyor: project.surveyor || '', surveyorInitials: project.surveyorInitials || '', comment: String(comment || ''), captureDateTime: captureDate.toISOString(), captureDateKey: `${captureDate.getFullYear()}-${String(captureDate.getMonth() + 1).padStart(2, '0')}-${String(captureDate.getDate()).padStart(2, '0')}`, latitude: location?.latitude ?? '', longitude: location?.longitude ?? '', altitude: location?.altitude ?? '', horizontalAccuracy: location?.accuracy ?? '', verticalAccuracy: location?.altitudeAccuracy ?? '', heading: location?.heading ?? '', gpsWrittenToJpeg };
  const next = { ...project, nextPhotoId: Number.parseInt(photoId, 10) + 1, photos: [...project.photos, record] };
  try { return { project: await saveProject(next), record }; } catch (error) { await FileSystem.deleteAsync(destination.uri, { idempotent: true }); throw error; }
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

export const exportSelectedPhotosZip = async (project, records = []) => {
  const selectedIds = new Set(records.filter((photo) => photo && !photo.deletedAt).map((photo) => photo.id));
  const photos = project.photos.filter((photo) => selectedIds.has(photo.id) && !photo.deletedAt);
  if (!photos.length) throw new Error('Select at least one photo to export.');
  const zip = new JSZip();
  const root = zip.folder(project.projectNumber);
  for (const photo of photos) {
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) continue;
    root.file(
      photo.fileName,
      await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 }),
      { base64: true }
    );
  }
  const uri = `${FileSystem.cacheDirectory}${clean(project.projectNumber)}_Selected_Photos.zip`;
  const zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  await FileSystem.writeAsStringAsync(uri, zipBase64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(uri);
  const sizeBytes = Number(info.size) || Math.floor((zipBase64.length * 3) / 4);
  return { uri, sizeBytes };
};

export const exportProjectZip = async (project, selectedDateKeys = null) => {
  const includeAll = !selectedDateKeys || selectedDateKeys.length === 0;
  const selected = new Set(selectedDateKeys || []);
  const activePhotos = project.photos.filter((photo) => !photo.deletedAt);
  const photos = includeAll
    ? activePhotos
    : activePhotos.filter((photo) => selected.has(getPhotoDateKey(photo)));
  if (!photos.length) throw new Error('No photos are available for the selected dates.');

  const zip = new JSZip();
  const root = zip.folder(project.projectNumber);
  for (const photo of photos) {
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) continue;
    root.file(`${photo.folder}/${photo.fileName}`, await FileSystem.readAsStringAsync(photo.uri, { encoding: FileSystem.EncodingType.Base64 }), { base64: true });
  }
  const exportProject = { ...project, photos, exportScope: includeAll ? 'Whole Project' : [...selected].sort(), exportedAt: new Date().toISOString() };
  root.file('Project.json', JSON.stringify(exportProject, null, 2));
  root.file('Photo_Register.csv', buildCsv(project, photos));

  const suffix = includeAll ? 'Photos' : `Photos_${[...selected].sort().join('_')}`;
  const uri = `${FileSystem.cacheDirectory}${clean(project.projectNumber)}_${clean(suffix)}.zip`;
  const zipBase64 = await zip.generateAsync({ type: 'base64', compression: 'DEFLATE' });
  await FileSystem.writeAsStringAsync(uri, zipBase64, { encoding: FileSystem.EncodingType.Base64 });
  const info = await FileSystem.getInfoAsync(uri);
  const sizeBytes = Number(info.size) || Math.floor((zipBase64.length * 3) / 4);
  return { uri, sizeBytes };
};
