import { emptySE14 } from '../data/emptyForms';

export const SE14_DRAFT_KEY = 'se14_form';
export const SE14_IN_PROGRESS_KEY = 'se14_in_progress';

export const SE14_CHECKLIST_KEYS = [
  'levelledStart',
  'antennaNorth',
  'externalPower',
  'levelledEnd',
  'powerStillOn',
  'markConfirmed',
];

export const normaliseSE14Form = (form = {}) => {
  const source = form && typeof form === 'object' ? form : {};
  const isLegacyChecklist = source.checklistAnswersVersion !== 2;
  const checklistAnswers = {};

  SE14_CHECKLIST_KEYS.forEach((key) => {
    const value = source[key];

    checklistAnswers[key] =
      isLegacyChecklist && value === false
        ? null
        : typeof value === 'boolean'
          ? value
          : null;
  });

  return {
    ...emptySE14,
    ...source,
    ...checklistAnswers,
    checklistAnswersVersion: 2,
  };
};

export const normaliseSE14Records = (records = []) =>
  (Array.isArray(records) ? records : []).map((record) => ({
    ...record,
    data: normaliseSE14Form(record?.data),
  }));

export const SE14_START_REQUIREMENTS = [
  { key: 'projectNumber', label: 'Current Job', section: 'project' },
  { key: 'observer', label: 'Observer', section: 'project' },
  { key: 'markId', label: 'PM / Mark Number', section: 'details' },
  { key: 'markType', label: 'Mark Type', section: 'details' },
  { key: 'sessionNumber', label: 'Session Number', section: 'details' },
  { key: 'receiverModel', label: 'Receiver', section: 'details' },
  { key: 'receiverSerial', label: 'Receiver Serial Number', section: 'details' },
  { key: 'hmpStart', label: 'Start Height (HMP)', section: 'start' },
  { key: 'measuredToStart', label: 'Start Measured To', section: 'start' },
  { key: 'bqrStart', label: 'Start Height (BQR)', section: 'start' },
  { key: 'arpBqr', label: 'ARP-BQR Check', section: 'start' },
  {
    key: 'levelledStart',
    label: 'Start Levelled & Centred Check',
    section: 'start',
    requiresYes: true,
    correctiveMessage:
      'Please relevel and centre the antenna before continuing.',
  },
  {
    key: 'antennaNorth',
    label: 'Antenna Oriented North Check',
    section: 'start',
    requiresYes: true,
    correctiveMessage:
      'Please orientate antenna north before continuing.',
  },
  {
    key: 'externalPower',
    label: 'External Power Connected Check',
    section: 'start',
    requiresYes: true,
    correctiveMessage:
      'Please connect external power before continuing.',
  },
  { key: 'startDate', label: 'Start Date', section: 'start' },
  { key: 'startTime', label: 'Start Time', section: 'start' },
  { key: 'photoStartMarkId', label: 'Start Mark ID Photo', section: 'start' },
  { key: 'photoStartReceiverSerial', label: 'Start Receiver Serial Photo', section: 'start' },
  { key: 'photoStartHeightMeasurement', label: 'Start Height Measurement Photo', section: 'start' },
  { key: 'photoStartBubble', label: 'Start Bubble Photo', section: 'start' },
  { key: 'photoStartObstructions', label: 'Start Obstructions Photo', section: 'start' },
];

export const SE14_END_REQUIREMENTS = [
  { key: 'hmpEnd', label: 'End Height (HMP)', section: 'end' },
  { key: 'measuredToEnd', label: 'End Measured To', section: 'end' },
  { key: 'levelledEnd', label: 'End Levelled & Centred Check', section: 'end' },
  { key: 'powerStillOn', label: 'Power Still On Check', section: 'end' },
  { key: 'markConfirmed', label: 'Mark ID Confirmed Check', section: 'end' },
  { key: 'endDate', label: 'End Date', section: 'end' },
  { key: 'endTime', label: 'End Time', section: 'end' },
  { key: 'photoEndMarkId', label: 'End Mark ID Photo', section: 'end' },
  { key: 'photoEndHeightMeasurement', label: 'End Height Measurement Photo', section: 'end' },
];

export const SE14_REVIEW_REQUIREMENTS = [
  { key: 'rawGnssFile', label: 'Raw GNSS Data Filename', section: 'files' },
  { key: 'rinexFile', label: 'RINEX Data Filename', section: 'files' },
];

export const isSE14RequirementComplete = (form, requirement) => {
  const value = form?.[requirement.key];

  if (requirement.key.startsWith('photo')) {
    return Boolean(value?.uri);
  }

  if (SE14_CHECKLIST_KEYS.includes(requirement.key)) {
    if (requirement.requiresYes) {
      return value === true;
    }

    return (
      form?.checklistAnswersVersion === 2 &&
      typeof value === 'boolean'
    );
  }

  if (typeof value === 'boolean') {
    return value === true;
  }

  return String(value || '').trim().length > 0;
};

const requirementIssue = (form, requirements, stageLabel) => {
  const missing = requirements.find(
    (requirement) => !isSE14RequirementComplete(form, requirement)
  );

  if (!missing) {
    return null;
  }

  return {
    ...missing,
    message:
      missing.correctiveMessage && form?.[missing.key] === false
        ? missing.correctiveMessage
        : `Complete “${missing.label}” before ${stageLabel}.`,
  };
};

export const getSE14StartIssue = (form) => {
  const missing = requirementIssue(
    form,
    SE14_START_REQUIREMENTS,
    'moving this record to End Session'
  );

  if (missing) {
    return missing;
  }

  const arpBqr = Number(
    String(form?.arpBqr || '').trim().replace(',', '.')
  );

  if (!Number.isFinite(arpBqr) || Math.abs(arpBqr) > 0.005) {
    return {
      key: 'arpBqr',
      label: 'ARP-BQR Check',
      section: 'start',
      message:
        'ARP-BQR must be a valid measurement within ±0.005 m before moving this record to End Session.',
    };
  }

  return null;
};

export const getSE14FieldCompletionIssue = (form) => {
  const startIssue = getSE14StartIssue(form);

  if (startIssue) {
    return startIssue;
  }

  return requirementIssue(
    form,
    SE14_END_REQUIREMENTS,
    'completing this session'
  );
};

export const getSE14CompletionIssue = (form) => {
  const fieldIssue = getSE14FieldCompletionIssue(form);

  if (fieldIssue) {
    return fieldIssue;
  }

  return requirementIssue(
    form,
    SE14_REVIEW_REQUIREMENTS,
    'exporting the final record'
  );
};

export const isSE14StartComplete = (form) =>
  !getSE14StartIssue(form);

export const isSE14Complete = (form) =>
  !getSE14CompletionIssue(form);

export const getSE14RequirementProgress = (form, requirements) => ({
  complete: requirements.filter((requirement) =>
    isSE14RequirementComplete(form, requirement)
  ).length,
  total: requirements.length,
});

const cleanPart = (value, fallback) => {
  const cleaned = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || fallback;
};

export const buildSE14RecordName = (form) => {
  const projectNumber = cleanPart(
    form?.projectNumber,
    'Project'
  );
  const markId = cleanPart(form?.markId, 'Mark');
  const sessionNumber = cleanPart(
    form?.sessionNumber,
    '1'
  );

  return `${projectNumber}_${markId}_Session_${sessionNumber}`;
};

export const createSE14Record = (form) => {
  const now = new Date().toISOString();
  const normalisedForm = normaliseSE14Form(form);

  return {
    id: `se14_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    status: 'in_progress',
    createdAt: now,
    updatedAt: now,
    name: buildSE14RecordName(normalisedForm),
    data: normalisedForm,
  };
};

export const updateSE14Record = (record, form) => {
  const normalisedForm = normaliseSE14Form(form);

  return {
    ...record,
    updatedAt: new Date().toISOString(),
    name: buildSE14RecordName(normalisedForm),
    data: normalisedForm,
  };
};

const sessionSortValue = (value) => {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number)
    ? number
    : Number.MAX_SAFE_INTEGER;
};

const parseFormDate = (value) => {
  const match = String(value || '').trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return Number.isNaN(date.getTime()) ? null : date;
};

export const getSE14RecordDate = (record) => {
  const formDate = parseFormDate(record?.data?.startDate);

  if (formDate) {
    return formDate;
  }

  const storedDate = new Date(
    record?.createdAt || record?.updatedAt || 0
  );

  return Number.isNaN(storedDate.getTime())
    ? new Date(0)
    : storedDate;
};

export const getSE14CompletedDate = (record) => {
  const endDate = parseFormDate(record?.data?.endDate);

  if (endDate) {
    return endDate;
  }

  const completedDate = new Date(
    record?.completedAt || record?.updatedAt || record?.createdAt || 0
  );

  return Number.isNaN(completedDate.getTime())
    ? getSE14RecordDate(record)
    : completedDate;
};

export const sortSE14Records = (records) => {
  return [...records].sort((left, right) => {
    const dateComparison =
      getSE14RecordDate(right).getTime() -
      getSE14RecordDate(left).getTime();

    if (dateComparison !== 0) {
      return dateComparison;
    }

    const leftMark = String(
      left?.data?.markId || ''
    );
    const rightMark = String(
      right?.data?.markId || ''
    );
    const markComparison = leftMark.localeCompare(
      rightMark,
      undefined,
      {
        numeric: true,
        sensitivity: 'base',
      }
    );

    if (markComparison !== 0) {
      return markComparison;
    }

    return (
      sessionSortValue(
        left?.data?.sessionNumber
      ) -
      sessionSortValue(
        right?.data?.sessionNumber
      )
    );
  });
};

export const hasRequiredSE14StartFields = (form) => {
  return isSE14StartComplete(form);
};
