import {
  canonicalJobTaskName,
  jobTaskDefinition,
  jobTaskNamesFromText,
  normaliseJobTaskNames,
} from './jobTaskRules';

export const DEFAULT_JOB_DETAILS_SECTIONS = Object.freeze([
  {
    id: 'overview',
    title: 'Overview',
    icon: 'clipboard-outline',
    builtIn: true,
    archived: false,
    order: 0,
  },
]);

const RETIRED_DEFAULT_SECTION_IDS = new Set(['gfm', 'drainage-qq', 'service-locating']);

const CUSTOM_ICONS = Object.freeze([
  'folder-open-outline',
  'school-outline',
  'document-text-outline',
  'construct-outline',
  'shield-checkmark-outline',
  'book-outline',
]);

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const cleanMultiline = (value) => String(value || '').replace(/\r/g, '').trim();
const TMR_JOB_PATTERN = /\b(?:tmr|transport\s+(?:and|&)\s+main\s+roads|department\s+of\s+transport\s+(?:and|&)\s+main\s+roads)\b/i;

export const isTmrJob = (job = {}) => {
  const teamNames = Array.isArray(job?.microsoftTeamNames)
    ? job.microsoftTeamNames
    : [job?.microsoftTeamNames];
  const identifyingValues = [
    ...teamNames,
    job?.client,
    job?.customer,
    job?.authority,
    job?.name,
    job?.workType,
    job?.fieldWorkType,
  ];
  return identifyingValues.some((value) => TMR_JOB_PATTERN.test(clean(value)));
};

const safeId = (value) => clean(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 42);

const isLegacyOverviewDerivedSection = (section = {}) => (
  Boolean(section?.derivedFromOverview)
  || (
    safeId(section?.id).startsWith('brief-')
    && !canonicalJobTaskName(section?.title)
    && section?.derivedFromOverview !== false
    && section?.builtIn !== false
  )
);

const dateKey = (value) => {
  const direct = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (direct) {
    const candidate = new Date(Number(direct[1]), Number(direct[2]) - 1, Number(direct[3]), 12);
    if (
      candidate.getFullYear() === Number(direct[1])
      && candidate.getMonth() === Number(direct[2]) - 1
      && candidate.getDate() === Number(direct[3])
    ) return direct[0];
    return '';
  }
  const date = value instanceof Date ? value : new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getJobDetailsDateKey = (value = new Date()) => dateKey(value);

export const normaliseDailyBriefs = (entries = []) => {
  const byDate = new Map();
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const date = dateKey(entry?.date);
    const text = cleanMultiline(entry?.text);
    if (!date || !text || byDate.has(date)) return;
    byDate.set(date, { date, text });
  });
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
};

export const upsertDailyBrief = ({ entries = [], date = new Date(), text = '' }) => {
  const targetDate = dateKey(date);
  if (!targetDate) throw new Error('The date for this brief could not be determined.');
  const nextText = cleanMultiline(text);
  const remaining = normaliseDailyBriefs(entries)
    .filter((entry) => entry.date !== targetDate);
  return normaliseDailyBriefs([
    ...(nextText ? [{ date: targetDate, text: nextText }] : []),
    ...remaining,
  ]);
};

export const getDailyBriefText = (entries = [], date = new Date()) => {
  const targetDate = dateKey(date);
  return normaliseDailyBriefs(entries).find((entry) => entry.date === targetDate)?.text || '';
};

export const overviewSectionTitlesFromBrief = (brief = '') => jobTaskNamesFromText(brief);

const createBriefSection = ({ title, index, existingIds }) => {
  const definition = jobTaskDefinition(title);
  const baseId = definition?.sectionId || `brief-${safeId(title) || 'section'}`;
  let id = baseId;
  let suffix = 2;
  while (existingIds.has(id)) {
    id = `${baseId.slice(0, 38)}-${suffix}`;
    suffix += 1;
  }
  existingIds.add(id);
  return {
    id,
    title,
    icon: definition?.icon || CUSTOM_ICONS[index % CUSTOM_ICONS.length],
    builtIn: true,
    derivedFromOverview: true,
    archived: false,
    order: index + 1,
  };
};

export const buildActiveJobDetailsSections = ({
  sections = [],
  taskNames = [],
  taskNotes = '',
  overviewBrief = '',
}) => {
  const active = (Array.isArray(sections) ? sections : [])
    .filter((section) => (
      !section?.archived
      && !(RETIRED_DEFAULT_SECTION_IDS.has(safeId(section?.id)) && section?.builtIn)
      && !isLegacyOverviewDerivedSection(section)
    ));
  const overview = active.find((section) => safeId(section?.id) === 'overview')
    || DEFAULT_JOB_DETAILS_SECTIONS[0];
  const manualSections = active.filter((section) => safeId(section?.id) !== 'overview');
  const manualByTitle = new Map();
  const manualById = new Map();
  manualSections.forEach((section) => {
    const key = (canonicalJobTaskName(section?.title) || clean(section?.title)).toLowerCase();
    if (!manualByTitle.has(key)) manualByTitle.set(key, section);
    manualById.set(safeId(section?.id), section);
  });
  const usedManualIds = new Set();
  const existingIds = new Set(active.map((section) => safeId(section?.id)));
  const suppliedTasks = normaliseJobTaskNames(taskNames);
  const detectedTasks = normaliseJobTaskNames([
    ...suppliedTasks,
    ...jobTaskNamesFromText(taskNotes || overviewBrief),
  ]);
  const detectedTaskKeys = new Set(detectedTasks.map((title) => title.toLowerCase()));
  const briefSections = detectedTasks.map((title, index) => {
    const definition = jobTaskDefinition(title);
    const matchingManual = manualById.get(safeId(definition?.sectionId))
      || manualByTitle.get(title.toLowerCase());
    if (matchingManual) {
      usedManualIds.add(matchingManual.id);
      return matchingManual;
    }
    return createBriefSection({ title, index, existingIds });
  });
  const remainingManual = manualSections.filter((section) => {
    if (usedManualIds.has(section.id)) return false;
    if (isLegacyOverviewDerivedSection(section)) return false;
    const taskName = canonicalJobTaskName(section.title);
    return !taskName || !detectedTaskKeys.has(taskName.toLowerCase());
  });
  return [overview, ...briefSections, ...remainingManual]
    .map((section, order) => ({ ...section, order }));
};

export const createJobDetailsSection = ({ title, existingSections = [], now = Date.now() }) => {
  const cleanTitle = clean(title);
  if (!cleanTitle) throw new Error('Enter a section name.');
  if (cleanTitle.length > 60) throw new Error('Section names must be 60 characters or fewer.');

  const taskName = canonicalJobTaskName(cleanTitle);
  const duplicate = existingSections.some((section) => {
    if (clean(section?.title).toLowerCase() === cleanTitle.toLowerCase()) return true;
    return taskName && canonicalJobTaskName(section?.title) === taskName;
  });
  if (duplicate) throw new Error(`A section named “${cleanTitle}” already exists.`);

  const baseId = safeId(cleanTitle) || 'section';
  const usedIds = new Set(existingSections.map((section) => safeId(section?.id)));
  let id = `custom-${baseId}`;
  if (usedIds.has(id)) id = `${id}-${String(now).slice(-6)}`;

  return {
    id,
    title: cleanTitle,
    icon: CUSTOM_ICONS[existingSections.length % CUSTOM_ICONS.length],
    builtIn: false,
    archived: false,
    order: existingSections.length,
  };
};

export const renameJobDetailsSection = ({ sectionId, title, sections = [] }) => {
  const id = safeId(sectionId);
  if (!id || id === 'overview') throw new Error('The Overview title cannot be changed.');
  const cleanTitle = clean(title);
  if (!cleanTitle) throw new Error('Enter a section name.');
  if (cleanTitle.length > 60) throw new Error('Section names must be 60 characters or fewer.');

  const taskName = canonicalJobTaskName(cleanTitle);
  const duplicate = (Array.isArray(sections) ? sections : []).some((section) => {
    if (safeId(section?.id) === id) return false;
    if (clean(section?.title).toLowerCase() === cleanTitle.toLowerCase()) return true;
    return taskName && canonicalJobTaskName(section?.title) === taskName;
  });
  if (duplicate) throw new Error(`A section named “${cleanTitle}” already exists.`);

  let found = false;
  const renamed = (Array.isArray(sections) ? sections : []).map((section) => {
    if (safeId(section?.id) !== id) return section;
    found = true;
    return {
      ...section,
      title: cleanTitle,
      builtIn: false,
      derivedFromOverview: false,
    };
  });
  if (!found) throw new Error('The Job Details section could not be found.');
  return renamed;
};

const normaliseSection = (section, index) => {
  const id = safeId(section?.id);
  const title = clean(section?.title);
  if (!id || !title) return null;

  return {
    id,
    title: title.slice(0, 60),
    icon: clean(section?.icon) || CUSTOM_ICONS[index % CUSTOM_ICONS.length],
    builtIn: Boolean(section?.builtIn),
    derivedFromOverview: Boolean(section?.derivedFromOverview),
    archived: Boolean(section?.archived),
    order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index,
  };
};

export const normaliseJobDetailsManifest = (payload = {}) => {
  const supplied = Array.isArray(payload?.sections)
    ? payload.sections
      .filter((section) => !isLegacyOverviewDerivedSection(section))
      .map(normaliseSection)
      .filter(Boolean)
    : [];
  const suppliedById = new Map(supplied.map((section) => [section.id, section]));

  const defaults = DEFAULT_JOB_DETAILS_SECTIONS.map((section) => ({
    ...section,
    ...(suppliedById.get(section.id) || {}),
    title: section.title,
    icon: section.icon,
    builtIn: true,
    archived: false,
    order: section.order,
  }));

  const custom = supplied
    .filter((section) => (
      !DEFAULT_JOB_DETAILS_SECTIONS.some((item) => item.id === section.id)
      && !(RETIRED_DEFAULT_SECTION_IDS.has(section.id) && section.builtIn)
      && !isLegacyOverviewDerivedSection(section)
    ))
    .map((section) => ({ ...section, builtIn: false, derivedFromOverview: false }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'en-AU'));

  return {
    version: 2,
    jobNumber: clean(payload?.jobNumber),
    sections: [...defaults, ...custom].map((section, order) => ({ ...section, order })),
    updatedAt: clean(payload?.updatedAt),
    updatedBy: clean(payload?.updatedBy),
  };
};

export const normaliseJobDetailsFileReference = (file = {}) => {
  const id = clean(file?.id);
  const name = clean(file?.name);
  if (!id || !name) return null;

  return {
    id,
    name,
    webUrl: clean(file?.webUrl),
    mimeType: clean(file?.mimeType || file?.file?.mimeType),
    size: Math.max(0, Number(file?.size) || 0),
    parentPath: clean(file?.parentPath),
  };
};

export const normaliseJobDetailsSectionDocument = (payload = {}, section = {}) => {
  const files = [];
  const seenFileIds = new Set();
  (Array.isArray(payload?.files) ? payload.files : []).forEach((file) => {
    const normalised = normaliseJobDetailsFileReference(file);
    if (!normalised || seenFileIds.has(normalised.id)) return;
    seenFileIds.add(normalised.id);
    files.push(normalised);
  });

  const sectionId = safeId(payload?.sectionId || section?.id);
  const updatedAt = clean(payload?.updatedAt);
  let brief = cleanMultiline(payload?.brief);
  const legacyDailyBriefs = sectionId === 'overview'
    ? normaliseDailyBriefs(payload?.dailyBriefs)
    : [];
  // Older versions stored a dated brief history. Read the newest legacy entry once,
  // then persist only the single shared brief field on the next save.
  if (sectionId === 'overview' && !brief && legacyDailyBriefs.length) {
    brief = legacyDailyBriefs[0].text;
  }

  return {
    version: 2,
    jobNumber: clean(payload?.jobNumber),
    sectionId,
    title: clean(payload?.title || section?.title).slice(0, 60),
    brief,
    requirements: cleanMultiline(payload?.requirements),
    procedures: cleanMultiline(payload?.procedures),
    files,
    updatedAt,
    updatedBy: clean(payload?.updatedBy),
  };
};

export const jobDetailsSectionHasContent = (document = {}) => Boolean(
  cleanMultiline(document?.brief)
  || normaliseDailyBriefs(document?.dailyBriefs).length
  || cleanMultiline(document?.requirements)
  || cleanMultiline(document?.procedures)
  || document?.files?.length
);
