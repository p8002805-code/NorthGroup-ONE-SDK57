export { isSecureMicrosoftTransferUrl } from '../../services/security/trustedExternalUrl';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export const JOB_APP_DATA_FOLDER = 'NorthGroup ONE App Data';
export const JOB_APP_DATA_SECTIONS_FOLDER = 'Sections';

const MANAGED_JOB_WORKSPACE_FILES = new Set([
  'northgroup one job details.json',
  'northgroup one accommodation.json',
  'northgroup one job progress.json',
  'northgroup one job hub.json',
  'workspace overview.json',
]);
const JOB_DETAILS_SECTION_PREFIX = 'northgroup one job hub section - ';

export const isManagedJobWorkspaceFile = (item) => {
  const name = clean(item?.name).toLowerCase();
  return name === JOB_APP_DATA_FOLDER.toLowerCase()
    || MANAGED_JOB_WORKSPACE_FILES.has(name)
    || name.startsWith(JOB_DETAILS_SECTION_PREFIX);
};

const stableHash = (value) => {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const truncateFileName = (value, maxLength = 180) => {
  if (value.length <= maxLength) return value;
  const extensionMatch = value.match(/(\.[^.]{1,20})$/);
  const extension = extensionMatch?.[1] || '';
  const baseLength = Math.max(1, maxLength - extension.length);
  return `${value.slice(0, baseLength)}${extension}`;
};

export const jobFilesJobKey = (job) => [
  clean(job?.number).toLowerCase(),
  clean(job?.name).toLowerCase(),
  clean(job?.location).toLowerCase(),
].join('|');

export const isTrustedJobFileWebUrl = (value) => {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:'
      && parsed.hostname.toLowerCase() === 'northsurveys.sharepoint.com'
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
};

export const sanitiseJobFileName = (value, fallback = 'Job file') => {
  const safeFallback = clean(fallback) || 'Job file';
  const nextName = clean(value)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/g, '')
    .trim();

  if (!nextName || nextName === '.' || nextName === '..') return safeFallback;
  return truncateFileName(nextName);
};

export const validateJobFileUploadSource = ({ asset, fileInfo, maxBytes }) => {
  if (!clean(asset?.uri)) {
    throw new Error('The selected file has no readable location on this device. Choose it again.');
  }
  if (!fileInfo?.exists || fileInfo?.isDirectory) {
    throw new Error('The selected file is no longer available on this device. Choose it again.');
  }

  const reportedSize = Number(asset?.size);
  const measuredSize = Number(fileInfo?.size);
  const size = Math.max(
    Number.isFinite(reportedSize) && reportedSize > 0 ? reportedSize : 0,
    Number.isFinite(measuredSize) && measuredSize > 0 ? measuredSize : 0,
  );
  if (size <= 0) {
    throw new Error('The selected file is empty or its size could not be verified.');
  }

  const byteLimit = Number(maxBytes);
  if (Number.isFinite(byteLimit) && byteLimit > 0 && size > byteLimit) {
    const limitMb = Math.round(byteLimit / (1024 * 1024));
    throw new Error(`This upload is larger than the supported ${limitMb} MB limit. Capture fewer frames or lower the capture quality before trying again.`);
  }

  return {
    name: sanitiseJobFileName(asset?.name, 'Uploaded file'),
    size,
  };
};

export const buildJobFileCacheName = ({ jobNumber, driveId, item }) => {
  const jobPart = sanitiseJobFileName(jobNumber, 'job')
    .replace(/[^a-z0-9_-]+/gi, '_')
    .slice(0, 32);
  const itemName = sanitiseJobFileName(item?.name, 'Job file');
  const identity = [
    clean(driveId),
    clean(item?.id),
    clean(item?.eTag),
    clean(item?.lastModifiedDateTime),
  ].join('|');

  return `${jobPart}-${stableHash(identity)}-${itemName}`;
};

export const hasJobFileRevisionIdentity = (item) => Boolean(
  clean(item?.id)
  && (clean(item?.eTag) || clean(item?.lastModifiedDateTime)),
);

export const isCompleteJobFileDownload = ({ fileInfo, expectedSize }) => {
  if (!fileInfo?.exists || fileInfo?.isDirectory) return false;

  const actualBytes = Number(fileInfo?.size);
  if (!Number.isFinite(actualBytes) || actualBytes <= 0) return false;

  const expectedBytes = Number(expectedSize);
  return !Number.isFinite(expectedBytes)
    || expectedBytes <= 0
    || actualBytes === expectedBytes;
};
