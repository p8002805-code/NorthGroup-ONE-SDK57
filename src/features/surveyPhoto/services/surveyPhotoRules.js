import { compactDateForFilename } from '../../../utils/format';
import { resolveUserInitials, suggestedUserInitials } from '../../../utils/userInitials';

export const SURVEY_PHOTO_ZIP_TARGET_BYTES = 100 * 1024 * 1024;
export const SURVEY_PHOTO_ZIP_MAX_BYTES = 150 * 1024 * 1024;

export const getSurveyorInitials = (name = '') => (
  suggestedUserInitials({ fullName: name })
);

export const surveyPhotoSafeFilePart = (value, fallback = '') => {
  const cleaned = String(value || '').trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
};

const photoExportDateLabel = (date = new Date()) =>
  compactDateForFilename(date);

const safePartNumber = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
};

export const resolveSurveyPhotoInitials = ({
  profileInitials = '',
  projectInitials = '',
  surveyor = '',
} = {}) => resolveUserInitials({
  fullName: surveyor,
  initials: profileInitials || projectInitials,
});


export const buildSurveyPhotoFileNameBase = ({
  initials = '',
  photoId = '',
  imageType = '',
} = {}) => {
  const safeInitials = surveyPhotoSafeFilePart(resolveUserInitials({ initials }), 'NG');
  const safePhotoId = surveyPhotoSafeFilePart(photoId, 'Photo');
  const safeImageType = surveyPhotoSafeFilePart(imageType, 'Others');
  return `${safeInitials}_${safePhotoId}_${safeImageType}`;
};

export const buildSurveyPhotoZipName = ({
  projectNumber = '',
  initials = '',
  exportedAt = new Date(),
  partNumber = null,
  partCount = null,
} = {}) => {
  const safeProject = surveyPhotoSafeFilePart(projectNumber, 'Job');
  const safeInitials = surveyPhotoSafeFilePart(resolveUserInitials({ initials }), 'NG');
  const photoLabel = 'Photos';
  const safePart = safePartNumber(partNumber);
  const safeCount = safePartNumber(partCount);
  const partLabel = safePart && safeCount && safeCount > 1
    ? `Part${String(safePart).padStart(2, '0')}-of-${String(safeCount).padStart(2, '0')}`
    : '';
  const exportSuffix = `${photoExportDateLabel(exportedAt)}${safeInitials}`;
  return `${safeProject}_${photoLabel}${partLabel ? `_${partLabel}` : ''}_${exportSuffix}.zip`;
};

export const getSurveyPhotoZipPartInfo = (fileName = '') => {
  const match = String(fileName || '').match(/_Part(\d+)-of-(\d+)(?:_[^.]+)?\.zip$/i);
  if (!match) return { partNumber: null, partCount: null };
  const partNumber = safePartNumber(match[1]);
  const partCount = safePartNumber(match[2]);
  if (!partNumber || !partCount || partNumber > partCount) {
    return { partNumber: null, partCount: null };
  }
  return { partNumber, partCount };
};

export const planSurveyPhotoZipParts = (
  entries = [],
  targetBytes = SURVEY_PHOTO_ZIP_TARGET_BYTES,
) => {
  const target = Math.max(1, Number(targetBytes) || SURVEY_PHOTO_ZIP_TARGET_BYTES);
  const parts = [];
  let currentEntries = [];
  let currentBytes = 0;

  const flush = () => {
    if (!currentEntries.length) return;
    parts.push({ entries: currentEntries, estimatedBytes: currentBytes });
    currentEntries = [];
    currentBytes = 0;
  };

  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const sizeBytes = Math.max(0, Number(entry?.sizeBytes || 0));
    if (currentEntries.length && currentBytes + sizeBytes > target) flush();
    currentEntries.push(entry);
    currentBytes += sizeBytes;
    if (currentBytes >= target) flush();
  });
  flush();

  return parts;
};

export const getPhotoDateKey = (photo) => {
  if (photo?.captureDateKey) return photo.captureDateKey;
  const date = new Date(photo?.captureDateTime || 0);
  if (Number.isNaN(date.getTime())) return 'Unknown Date';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getGpsCaptureWarning = ({
  hasLocation,
  accuracy,
  preciseLocationDisabled = false,
  toleranceMetres = 8,
  fixTimestamp,
  now = Date.now(),
  maxFixAgeMs = 10000,
} = {}) => {
  if (preciseLocationDisabled) {
    return 'Precise Location was off when this photo was taken.';
  }
  if (!hasLocation) return 'No GPS position was available for this photo.';

  const numericTimestamp = Number(fixTimestamp);
  const numericNow = Number(now);
  const numericMaxAge = Math.max(1000, Number(maxFixAgeMs) || 10000);
  if (
    Number.isFinite(numericTimestamp)
    && numericTimestamp > 0
    && Number.isFinite(numericNow)
    && numericNow - numericTimestamp > numericMaxAge
  ) {
    const ageSeconds = Math.max(1, Math.round((numericNow - numericTimestamp) / 1000));
    return `GPS position was ${ageSeconds} seconds old when this photo was taken. Refresh GPS and retake for a current position.`;
  }

  const numericAccuracy = Number(accuracy);
  if (!Number.isFinite(numericAccuracy) || numericAccuracy < 0) {
    return 'GPS accuracy was unavailable for this photo.';
  }
  if (numericAccuracy <= toleranceMetres) return '';
  return `GPS accuracy was ±${numericAccuracy.toFixed(1)} m, outside the ${toleranceMetres} m tolerance.`;
};
