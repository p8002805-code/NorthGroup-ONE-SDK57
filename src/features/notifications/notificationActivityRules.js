const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const JOB_BRIEF_FILES = new Set(['job details.json', 'northgroup one job details.json']);
const JOB_ACCOMMODATION_FILES = new Set(['accommodation.json', 'northgroup one accommodation.json']);
const JOB_PROGRESS_FILES = new Set(['job progress.json', 'northgroup one job progress.json']);
const JOB_DETAILS_HUB_FILES = new Set(['job hub.json', 'northgroup one job hub.json']);
const JOB_WORKSPACE_META_FILES = new Set(['workspace overview.json']);
const JOB_DETAILS_SECTION_PREFIX = 'northgroup one job hub section - ';
const APP_DATA_SECTIONS_PATTERN = /(?:^|\/)northgroup one app data\/sections(?:\/|$)/i;
const JOB_DETAILS_FOCUS = 'jobDetails';
const FORM_NAME_PATTERN = /(?:^|[^a-z0-9])(s[ -]?500|s[ -]?501|s[ -]?506|se[ -]?14)(?:[^a-z0-9]|$)/i;
const PHOTO_ZIP_PATTERN = /(?:^|[_\s-])photos(?:[_\s-]|$)/i;
const PHOTO_PART_PATTERN = /(?:^|[_\s-])part(\d+)-of-(\d+)(?=[_.\s-]|$)/i;

const jobLabel = (job = {}) => (
  [clean(job.number), clean(job.name || job.jobName)].filter(Boolean).join(' · ') || 'Job workspace'
);

const actorName = (item = {}) => clean(
  item?.lastModifiedBy?.user?.displayName
  || item?.createdBy?.user?.displayName
  || item?.lastModifiedBy?.application?.displayName,
) || 'A team member';

const isFormFile = (item = {}) => {
  const name = clean(item.name);
  const parentPath = clean(item?.parentReference?.path);
  return FORM_NAME_PATTERN.test(name)
    || /(?:^|\/)forms?(?:\/|$)/i.test(parentPath);
};

const isAppDataSectionFile = (item = {}) => (
  /\.json$/i.test(clean(item.name))
  && APP_DATA_SECTIONS_PATTERN.test(clean(item?.parentReference?.path).replace(/\\/g, '/'))
);

const jobDetailsSectionId = (item = {}) => {
  const name = clean(item.name);
  if (!name) return '';

  if (isAppDataSectionFile(item)) {
    return clean(name.replace(/\.json$/i, '')).toLowerCase();
  }

  const lowerName = name.toLowerCase();
  if (!lowerName.startsWith(JOB_DETAILS_SECTION_PREFIX)) return '';
  return clean(name.slice(JOB_DETAILS_SECTION_PREFIX.length).replace(/\.json$/i, '')).toLowerCase();
};

const jobDetailsTargetParams = (sectionId = '') => ({
  focus: JOB_DETAILS_FOCUS,
  ...(sectionId ? { jobDetailsSectionId: sectionId } : {}),
});

const validTimestamp = (value) => {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const workspaceActivityTimestamp = (item = {}) => (
  item?.lastModifiedDateTime || item?.createdDateTime || ''
);

export const photoZipUploadInfo = (item = {}) => {
  const name = clean(item?.name);
  if (!item?.file || item?.deleted || !/\.zip$/i.test(name) || !PHOTO_ZIP_PATTERN.test(name)) {
    return null;
  }

  const partMatch = name.match(PHOTO_PART_PATTERN);
  const partNumber = partMatch ? Number(partMatch[1]) : 1;
  const partCount = partMatch ? Math.max(1, Number(partMatch[2]) || 1) : 1;
  const groupId = name
    .replace(/\.zip$/i, '')
    .replace(PHOTO_PART_PATTERN, '_')
    .replace(/[_\s-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return {
    groupId,
    partNumber,
    partCount,
    fileName: name,
  };
};

export const describePhotoUploadGroup = (items = [], job = {}) => {
  const photoItems = (Array.isArray(items) ? items : [])
    .map((item) => ({ item, info: photoZipUploadInfo(item) }))
    .filter(({ info }) => info);
  if (!photoItems.length) return null;

  const latest = [...photoItems].sort((left, right) => (
    validTimestamp(workspaceActivityTimestamp(right.item))
    - validTimestamp(workspaceActivityTimestamp(left.item))
  ))[0];
  const packageCount = Math.max(
    photoItems.length,
    ...photoItems.map(({ info }) => Number(info.partCount || 1)),
  );
  const actor = actorName(latest.item);

  return {
    target: 'JobFiles',
    icon: 'cloud-upload-outline',
    title: `${jobLabel(job)} · Photos uploaded`,
    message: packageCount > 1
      ? `${actor} uploaded ${packageCount} photo packages`
      : `${actor} uploaded photos`,
    groupId: latest.info.groupId,
    packageCount,
  };
};

export const isJobProgressWorkspaceItem = (item = {}) => (
  JOB_PROGRESS_FILES.has(clean(item?.name).toLowerCase())
);

export const workspaceChangeEditorId = (item = {}) => clean(
  item?.lastModifiedBy?.user?.id || item?.createdBy?.user?.id,
).toLowerCase();

export const isOwnWorkspaceChange = (item = {}, accountId = '') => {
  const editorId = workspaceChangeEditorId(item);
  const currentAccountId = clean(accountId).toLowerCase();
  return Boolean(editorId && currentAccountId && editorId === currentAccountId);
};

export const describeWorkspaceChange = (item = {}, job = {}, options = {}) => {
  if (!item?.file || item?.deleted) return null;

  const name = clean(item.name) || 'Shared file';
  const lowerName = name.toLowerCase();
  const actor = actorName(item);
  const titlePrefix = jobLabel(job);
  const sharedTarget = {
    target: 'TodaysJob',
    icon: 'create-outline',
  };

  if (JOB_BRIEF_FILES.has(lowerName)) {
    return {
      ...sharedTarget,
      title: `${titlePrefix} · Brief updated`,
      message: `${actor} edited the shared job brief`,
      targetParams: jobDetailsTargetParams('overview'),
    };
  }

  if (JOB_ACCOMMODATION_FILES.has(lowerName)) {
    return {
      ...sharedTarget,
      title: `${titlePrefix} · Stay updated`,
      message: `${actor} edited the shared accommodation details`,
      icon: 'bed-outline',
    };
  }

  if (JOB_WORKSPACE_META_FILES.has(lowerName)) {
    return {
      ...sharedTarget,
      title: `${titlePrefix} · Workspace updated`,
      message: `${actor} updated the shared shift or site details`,
      icon: 'briefcase-outline',
    };
  }

  if (JOB_PROGRESS_FILES.has(lowerName)) {
    return {
      ...sharedTarget,
      title: `${titlePrefix} · Progress updated`,
      message: options.progressSummary
        ? `${actor} changed the shared job progress · ${options.progressSummary}`
        : `${actor} changed the shared job progress`,
      icon: 'checkmark-done-outline',
      targetParams: { focus: 'progress' },
    };
  }

  if (JOB_DETAILS_HUB_FILES.has(lowerName)) {
    return {
      ...sharedTarget,
      title: `${titlePrefix} · Job Details updated`,
      message: `${actor} changed the Job Details workspace sections`,
      icon: 'grid-outline',
      targetParams: jobDetailsTargetParams(),
    };
  }

  if (lowerName.startsWith(JOB_DETAILS_SECTION_PREFIX) || isAppDataSectionFile(item)) {
    return {
      ...sharedTarget,
      title: `${titlePrefix} · Job Details edited`,
      message: `${actor} updated shared brief, requirements, procedures or files`,
      icon: 'document-text-outline',
      targetParams: jobDetailsTargetParams(jobDetailsSectionId(item)),
    };
  }

  if (/\.(kml|kmz)$/i.test(name)) {
    return {
      target: 'KmlEditor',
      icon: 'map-outline',
      title: `${titlePrefix} · KML updated`,
      message: `${actor} edited ${name}`,
    };
  }

  const photoUpload = describePhotoUploadGroup([item], job);
  if (photoUpload) return photoUpload;

  if (isFormFile(item)) {
    return {
      target: 'JobFiles',
      icon: 'document-text-outline',
      title: `${titlePrefix} · Form uploaded`,
      message: `${actor} uploaded ${name}`,
    };
  }

  return {
    target: 'JobFiles',
    icon: 'cloud-upload-outline',
    title: `${titlePrefix} · File uploaded`,
    message: `${actor} uploaded ${name}`,
  };
};
