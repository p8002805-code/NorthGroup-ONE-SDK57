import { COMPACT_RECENT_ITEMS_LIMIT } from '../constants/recentItems';

export const RECENTLY_OPENED_KEY = 'northgroup_one_recently_opened_v1';
export const RECENTLY_OPENED_LIMIT = COMPACT_RECENT_ITEMS_LIMIT;

export const RECENTLY_OPENED_ITEMS = Object.freeze({
  account: {
    id: 'account',
    icon: '◌',
    eyebrow: 'SETTINGS',
    title: 'Profile Settings',
    detail: 'Account, job and appearance settings',
  },
  weather: {
    id: 'weather',
    icon: '☼',
    eyebrow: 'FIELD CONDITIONS',
    title: 'Weather',
    detail: 'Open the latest field forecast',
  },
  fieldTools: {
    id: 'fieldTools',
    icon: '+',
    eyebrow: 'TOOLS',
    title: 'Field Tools',
    detail: 'Photo capture, TMR Guide and Compass',
  },
  surveyPhoto: {
    id: 'surveyPhoto',
    icon: '◉',
    eyebrow: 'FIELD TOOL',
    title: 'Survey Photo Capture',
    detail: 'Return to the photo workspace',
  },
  tmrFeatureGuide: {
    id: 'tmrFeatureGuide',
    icon: '▦',
    eyebrow: 'FIELD TOOL',
    title: 'TMR Feature Guide',
    detail: 'Search and browse feature codes',
  },
  compass: {
    id: 'compass',
    icon: '⌖',
    eyebrow: 'FIELD TOOL',
    title: 'Compass',
    detail: 'Open live bearing pointer',
  },
  s500: {
    id: 's500',
    icon: '✓',
    eyebrow: 'S-500',
    title: 'Pre-Start Risk Assessment',
    detail: 'Open the daily pre-start form',
  },
  se14: {
    id: 'se14',
    icon: '⌖',
    eyebrow: 'SE-14',
    title: 'GNSS Static Sessions',
    detail: 'Open the GNSS session workspace',
  },
  s501: {
    id: 's501',
    icon: '✓',
    eyebrow: 'S-501',
    title: 'Vehicle Pre-Start',
    detail: 'Open the light vehicle checklist',
  },
  s506: {
    id: 's506',
    icon: '↗',
    eyebrow: 'S-506',
    title: 'Journey Management Plan',
    detail: 'Open the journey plan form',
  },
});

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const jobFileIcon = (item = {}) => {
  if (item.folder) return '\u25a3';

  const name = clean(item.name).toLowerCase();
  const mime = clean(item.file?.mimeType).toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'PDF';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)) return '\u25c9';
  return '\u25a4';
};

const jobFileTypeLabel = (item = {}) => {
  if (item.folder) return 'SHAREPOINT FOLDER';

  const name = clean(item.name).toLowerCase();
  const mime = clean(item.file?.mimeType).toLowerCase();
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'SHAREPOINT PDF';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)) return 'SHAREPOINT IMAGE';
  return 'SHAREPOINT FILE';
};

export const createRecentlyOpenedJobFile = ({
  item,
  driveId,
  job,
  folderPath = [],
}) => {
  const itemId = clean(item?.id);
  const resolvedDriveId = clean(driveId);
  const title = clean(item?.name);
  if (!itemId || !resolvedDriveId || !title) return null;

  const jobNumber = clean(job?.number);
  const path = folderPath.map(clean).filter(Boolean);
  const location = [jobNumber, path.join(' / ')].filter(Boolean).join(' \u00b7 ');

  return {
    id: `job-file:${resolvedDriveId}:${itemId}`,
    type: 'jobFile',
    itemKind: item.folder ? 'folder' : 'file',
    icon: jobFileIcon(item),
    eyebrow: jobFileTypeLabel(item),
    title,
    detail: location || 'Job Files',
    jobNumber,
    driveId: resolvedDriveId,
    itemId,
    webUrl: clean(item.webUrl),
  };
};

export const normaliseRecentlyOpenedItem = (value) => {
  const staticItem = RECENTLY_OPENED_ITEMS[value?.id || value];
  if (staticItem) return staticItem;

  if (
    value?.type !== 'jobFile'
    || !clean(value.id).startsWith('job-file:')
    || !clean(value.title)
    || !clean(value.driveId)
    || !clean(value.itemId)
  ) return null;

  return {
    id: clean(value.id),
    type: 'jobFile',
    itemKind: value.itemKind === 'folder' ? 'folder' : 'file',
    icon: clean(value.icon) || '\u25a4',
    eyebrow: clean(value.eyebrow) || 'SHAREPOINT FILE',
    title: clean(value.title),
    detail: clean(value.detail) || 'Job Files',
    jobNumber: clean(value.jobNumber),
    driveId: clean(value.driveId),
    itemId: clean(value.itemId),
    webUrl: clean(value.webUrl),
  };
};
