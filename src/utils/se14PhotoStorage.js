import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import piexif from 'piexifjs';
import { reportDevelopmentError } from '../services/security/securityLogger';
import { compactDateForFilename } from './format';
import { resolveUserInitials } from './userInitials';

export const SE14_PHOTO_FIELDS = [
  { key: 'photoStartMarkId', label: 'Start · Mark ID', stage: 'Start', order: 1 },
  { key: 'photoStartReceiverSerial', label: 'Start · Receiver Serial', stage: 'Start', order: 2 },
  { key: 'photoStartHeightMeasurement', label: 'Start · Height Measurement', stage: 'Start', order: 3 },
  { key: 'photoStartBubble', label: 'Start · Bubble', stage: 'Start', order: 4 },
  { key: 'photoStartPlummet', label: 'Start · Plummet', stage: 'Start', order: 5, optional: true },
  { key: 'photoStartObstructions', label: 'Start · Obstructions', stage: 'Start', order: 6 },
  { key: 'photoEndMarkId', label: 'End · Mark ID', stage: 'End', order: 7 },
  { key: 'photoEndHeightMeasurement', label: 'End · Height Measurement', stage: 'End', order: 8 },
];

export const deleteSE14FormPhotos = async (
  form = {},
  { stage } = {}
) => {
  const documentDirectory = String(
    FileSystem.documentDirectory || ''
  );

  if (!documentDirectory) return 0;

  const photoUris = [
    ...new Set(
      SE14_PHOTO_FIELDS
        .filter((definition) => !stage || definition.stage === stage)
        .map((definition) => form?.[definition.key]?.uri)
        .filter(
          (uri) =>
            typeof uri === 'string' &&
            uri.startsWith(documentDirectory)
        )
    ),
  ];

  await Promise.all(
    photoUris.map(async (uri) => {
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (error) {
        reportDevelopmentError('Could not delete cleared SE-14 photo', error);
      }
    })
  );

  return photoUris.length;
};

const cleanPart = (value, fallback = 'Unknown') => {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || fallback;
};

const markFolderName = (value) => {
  const trimmed = String(value || '').trim();

  if (!trimmed) return 'Unassigned_Mark';

  const compact = trimmed.replace(/\s+/g, '');

  if (/^\d+$/.test(compact)) {
    return `PM${compact}`;
  }

  const pmNumberMatch = compact.match(/^PM[-_]?(\d+)$/i);
  if (pmNumberMatch) {
    return `PM${pmNumberMatch[1]}`;
  }

  return cleanPart(trimmed.toUpperCase(), 'Unassigned_Mark');
};

const exifAscii = (value) =>
  String(value || '')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, ' | ')
    .replace(/\s+\|\s+\|\s+/g, ' | ')
    .trim();

const dateKeyFromValue = (value) => {
  const date = new Date(value || 0);

  if (Number.isNaN(date.getTime())) return 'Unknown_Date';

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

export const getSE14PhotoDateKey = (photo) =>
  String(photo?.dateFolder || '').trim() ||
  dateKeyFromValue(photo?.capturedAt);

const fallbackFilename = (photo) => {
  const mark = cleanPart(photo?.markId, 'Mark');
  const markLabel = /^PM/i.test(mark) ? mark : `PM${mark}`;

  return [
    markLabel,
    `S${cleanPart(photo?.sessionNumber, '0')}`,
    cleanPart(photo?.photoType || photo?.fieldLabel, 'Photo'),
  ].join('_') + '.jpg';
};

export const collectSE14Photos = (records = []) => {
  const photos = [];

  (Array.isArray(records) ? records : []).forEach((record) => {
    const form = record?.data || {};

    SE14_PHOTO_FIELDS.forEach((definition) => {
      const storedPhoto = form[definition.key];

      if (!storedPhoto?.uri) return;

      const capturedAt =
        storedPhoto.capturedAt ||
        record.updatedAt ||
        record.createdAt ||
        new Date().toISOString();

      const projectNumber = String(
        storedPhoto.projectNumber || form.projectNumber || ''
      );
      const markId = String(storedPhoto.markId || form.markId || '');
      const sessionNumber = String(
        form.sessionNumber || storedPhoto.sessionNumber || ''
      );
      const stampText = [
        projectNumber || 'No Job Number',
        markId || 'No Mark ID',
        `Session ${sessionNumber || '-'}`,
        definition.label,
        storedPhoto.tagText || null,
        new Date(capturedAt).toLocaleString('en-AU'),
      ]
        .filter(Boolean)
        .join('  •  ');

      const photo = {
        ...storedPhoto,
        id: `${record.id}_${definition.key}`,
        recordId: record.id,
        recordStatus: record.status || 'in_progress',
        fieldKey: definition.key,
        fieldLabel: definition.label,
        stage: definition.stage,
        order: definition.order,
        optional: Boolean(definition.optional),
        projectNumber,
        markId,
        sessionNumber,
        capturedAt,
        dateFolder:
          storedPhoto.dateFolder || dateKeyFromValue(capturedAt),
        filename: fallbackFilename({
          ...storedPhoto,
          projectNumber,
          markId,
          sessionNumber,
          capturedAt,
          fieldLabel: definition.label,
        }),
        stampText,
      };

      photos.push(photo);
    });
  });

  return photos.sort((left, right) => {
    const dateComparison = String(right.capturedAt).localeCompare(
      String(left.capturedAt)
    );

    if (dateComparison !== 0) return dateComparison;

    return left.order - right.order;
  });
};

export const groupSE14Photos = (photos = [], mode = 'pm') => {
  const groups = new Map();

  photos.forEach((photo) => {
    const key =
      mode === 'day'
        ? getSE14PhotoDateKey(photo)
        : `${String(photo.markId || '').trim() || 'Unassigned Mark'}::${
            String(photo.sessionNumber || '').trim() || '0'
          }`;
    const [markKey, sessionKey] = key.split('::');
    const pm = /^pm\s*/i.test(markKey)
      ? markKey.toUpperCase()
      : `PM ${markKey}`;
    const label =
      mode === 'day'
        ? key
        : `${pm} · SESSION ${sessionKey}`;
    const exportLabel =
      mode === 'day'
        ? `Day_${key}`
        : `${markFolderName(markKey)}_${cleanPart(sessionKey, '0')}`;

    if (!groups.has(key)) {
      groups.set(key, { key, label, exportLabel, photos: [] });
    }

    groups.get(key).photos.push(photo);
  });

  return [...groups.values()].sort((left, right) =>
    mode === 'day'
      ? right.key.localeCompare(left.key)
      : left.key.localeCompare(right.key, undefined, {
          numeric: true,
          sensitivity: 'base',
        })
  );
};

const exifDate = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}:${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}:${String(date.getDate()).padStart(2, '0')} ${String(
    date.getHours()
  ).padStart(2, '0')}:${String(date.getMinutes()).padStart(
    2,
    '0'
  )}:${String(date.getSeconds()).padStart(2, '0')}`;
};

export const embedSE14PhotoMetadata = async (photo) => {
  if (!photo?.uri) return false;

  const info = await FileSystem.getInfoAsync(photo.uri);
  if (!info.exists) return false;

  try {
    const base64 = await FileSystem.readAsStringAsync(photo.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const dataUrl = `data:image/jpeg;base64,${base64}`;
    let exifData;

    try {
      exifData = piexif.load(dataUrl);
    } catch (_) {
      exifData = {
        '0th': {},
        Exif: {},
        GPS: {},
        '1st': {},
        thumbnail: null,
      };
    }

    exifData['0th'] = exifData['0th'] || {};
    exifData.Exif = exifData.Exif || {};
    exifData['0th'][270] = exifAscii(
      photo.stampText || 'GNSS SE-14 photo'
    );
    exifData['0th'][269] = exifAscii(
      photo.filename || fallbackFilename(photo)
    );
    exifData['0th'][305] = 'NorthGroup One | SE-14 Rev1';

    const capturedAt = exifDate(photo.capturedAt);
    if (capturedAt) {
      exifData['0th'][306] = capturedAt;
      exifData.Exif[36867] = capturedAt;
      exifData.Exif[36868] = capturedAt;
    }

    const output = piexif
      .insert(piexif.dump(exifData), dataUrl)
      .split(',')[1];

    await FileSystem.writeAsStringAsync(photo.uri, output, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return true;
  } catch (error) {
    reportDevelopmentError('Could not embed SE-14 photo metadata', error);
    return false;
  }
};

export const exportSE14PhotoZip = async ({
  photos = [],
  jobNumber,
  scopeLabel = 'All',
  initials = '',
  exportedAt = new Date(),
}) => {
  if (!photos.length) {
    throw new Error('There are no GNSS photos in this selection.');
  }

  const sharingAvailable = await Sharing.isAvailableAsync();
  if (!sharingAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  const zip = new JSZip();
  const exportSuffix = `${compactDateForFilename(exportedAt)}${cleanPart(
    resolveUserInitials({ initials }),
    'NG'
  )}`;
  const rootName = `${cleanPart(jobNumber, 'Job')}_GNSS_Photos_${cleanPart(
    scopeLabel,
    'All'
  )}_${exportSuffix}`;
  const usedNames = new Map();
  let exportedPhotoCount = 0;

  for (const photo of photos) {
    const info = await FileSystem.getInfoAsync(photo.uri);
    if (!info.exists) continue;

    await embedSE14PhotoMetadata(photo);

    const folderName = markFolderName(photo.markId);
    const folder = zip.folder(folderName);
    const originalName = cleanPart(
      String(photo.filename || fallbackFilename(photo)).replace(/\.jpe?g$/i, '')
    );
    const nameKey = `${folderName}/${originalName}`;
    const count = usedNames.get(nameKey) || 0;
    usedNames.set(nameKey, count + 1);
    const exportFilename = `${originalName}${
      count ? `_${String(count + 1).padStart(2, '0')}` : ''
    }.jpg`;

    folder.file(
      exportFilename,
      await FileSystem.readAsStringAsync(photo.uri, {
        encoding: FileSystem.EncodingType.Base64,
      }),
      { base64: true }
    );
    exportedPhotoCount += 1;
  }

  if (!exportedPhotoCount) {
    throw new Error('The selected photo files could not be found on this device.');
  }

  const zipUri = `${FileSystem.cacheDirectory}${rootName}.zip`;
  const base64Zip = await zip.generateAsync({
    type: 'base64',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  await FileSystem.writeAsStringAsync(zipUri, base64Zip, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Sharing.shareAsync(zipUri, {
    mimeType: 'application/zip',
    dialogTitle: `Export ${scopeLabel} GNSS photos`,
  });

  return {
    uri: zipUri,
    count: exportedPhotoCount,
  };
};
