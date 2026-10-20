import { emptySE14 } from '../data/emptyForms';
import {
  getSE14SessionStartedAt,
  getSE14StoredRound,
  groupSE14RecordsByRound,
} from '../features/gnss/se14Rounds';

import { secureRandomId } from '../services/security/secureRandom';

export const SE14_DRAFT_KEY = 'se14_form';
export const SE14_IN_PROGRESS_KEY = 'se14_in_progress';
export const SE14_SESSION_NUMBER_OPTIONS = Object.freeze(
  Array.from({ length: 10 }, (_, index) => String(index + 1))
);

const SE14_RECORD_STATUSES = new Set([
  'in_progress',
  'review',
  'complete',
  'archived',
]);

const normaliseSE14RecordStatus = (record = {}) => {
  if (SE14_RECORD_STATUSES.has(record?.status)) {
    return record.status;
  }

  if (record?.completedAt) return 'complete';
  if (record?.fieldCompletedAt) return 'review';
  return 'in_progress';
};

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
    rinexFile: String(source.rinexFile || '').trim()
      ? source.rinexFile
      : 'N/A',
    checklistAnswersVersion: 2,
  };
};

const normaliseSE14SharePointUpload = (record = {}) => {
  const upload = record?.sharePointUpload;
  const state = upload?.state;

  if (state === 'pending' || state === 'uploaded') {
    return {
      ...upload,
      state,
    };
  }

  if (record?.archiveReason === 'sharepoint') {
    return {
      state: 'uploaded',
      uploadedAt:
        record?.lastSharePointUploadAt ||
        record?.archivedAt ||
        record?.updatedAt ||
        null,
    };
  }

  return null;
};

export const normaliseSE14Records = (records = []) =>
  (Array.isArray(records) ? records : []).map((record) => {
    const status = normaliseSE14RecordStatus(record);

    return {
      ...record,
      status,
      archivedAt:
        status === 'archived'
          ? record?.archivedAt || record?.updatedAt || record?.completedAt || null
          : record?.archivedAt || null,
      archivedFromStatus:
        status === 'archived'
          ? record?.archivedFromStatus || (record?.completedAt ? 'complete' : 'review')
          : record?.archivedFromStatus || null,
      sharePointUpload: normaliseSE14SharePointUpload(record),
      data: normaliseSE14Form(record?.data),
    };
  });

export const SE14_START_REQUIREMENTS = [
  { key: 'projectNumber', label: 'Current Job', section: 'project' },
  { key: 'observer', label: 'Observer', section: 'project' },
  { key: 'markId', label: 'PM / Mark Number', section: 'details' },
  { key: 'markType', label: 'Mark Type', section: 'details' },
  {
    key: 'sessionNumber',
    label: 'Session Number',
    section: 'details',
    invalidMessage: 'Select a Session Number from 1 to 10 before moving this record to End Session.',
  },
  { key: 'receiverModel', label: 'Receiver', section: 'details' },
  { key: 'receiverSerial', label: 'Receiver Serial Number', section: 'details' },
  {
    key: 'hmpStart',
    label: 'Start Height (HMP)',
    section: 'start',
    measurement: true,
    invalidMessage: 'Enter a valid decimal Start Height (HMP) before moving this record to End Session.',
  },
  { key: 'measuredToStart', label: 'Start Measured To', section: 'start' },
  {
    key: 'bqrStart',
    label: 'Start Height (BQR)',
    section: 'start',
    measurement: true,
    invalidMessage: 'Enter a valid decimal Start Height (BQR) before moving this record to End Session.',
  },
  {
    key: 'arpBqr',
    label: 'ARP-BQR Check',
    section: 'start',
    measurement: true,
    tolerance: 0.005,
    invalidMessage: 'ARP-BQR must be a valid measurement within ±0.005 m before moving this record to End Session.',
  },
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
  {
    key: 'hmpEnd',
    label: 'End Height (HMP)',
    section: 'end',
    measurement: true,
    invalidMessage: 'Enter a valid decimal End Height (HMP) before completing this session.',
  },
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

  if (requirement.key === 'sessionNumber') {
    return SE14_SESSION_NUMBER_OPTIONS.includes(
      String(value || '').trim()
    );
  }

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

  if (requirement.measurement) {
    const cleanedMeasurement = String(value || '')
      .trim()
      .replace(',', '.');

    if (!cleanedMeasurement) return false;

    const measurement = Number(cleanedMeasurement);

    if (!Number.isFinite(measurement)) return false;

    return typeof requirement.tolerance === 'number'
      ? Math.abs(measurement) <= requirement.tolerance
      : true;
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
        : missing.invalidMessage && String(form?.[missing.key] || '').trim()
          ? missing.invalidMessage
          : `Complete “${missing.label}” before ${stageLabel}.`,
  };
};

export const getSE14StartIssue = (form) => {
  return requirementIssue(
    form,
    SE14_START_REQUIREMENTS,
    'moving this record to End Session'
  );
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
    id: secureRandomId('se14'),
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

const applyFormTime = (date, value) => {
  const match = String(value || '').trim().match(
    /^(\d{1,2}):(\d{2})$/
  );

  if (!match) return date;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return date;

  date.setHours(hours, minutes, 0, 0);
  return date;
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
    return applyFormTime(endDate, record?.data?.endTime);
  }

  const completedDate = new Date(
    record?.completedAt || record?.updatedAt || record?.createdAt || 0
  );

  return Number.isNaN(completedDate.getTime())
    ? getSE14RecordDate(record)
    : completedDate;
};

export const getSE14ArchiveFolderName = (record) => {
  const date = getSE14CompletedDate(record);
  const weekday = date.toLocaleDateString('en-AU', { weekday: 'long' });
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${weekday}${year}${month}${day}`;
};

export const getSE14ArchivePeriod = (record) => {
  const storedRound = getSE14StoredRound(record);
  if (storedRound) {
    return {
      key: storedRound.id,
      sequence: storedRound.sequence,
      label: storedRound.label,
      detail: 'Assigned when the field round started',
    };
  }

  const date = getSE14SessionStartedAt(record);
  const morning = date.getHours() < 12;

  return {
    key: morning ? 'legacy-morning' : 'legacy-afternoon',
    sequence: morning ? 1 : 2,
    label: morning ? 'Morning' : 'Afternoon',
    detail: 'Legacy start-time estimate',
  };
};

export const getSE14UploadState = (record) => {
  const state = record?.sharePointUpload?.state;
  if (state === 'pending' || state === 'uploaded') return state;
  if (record?.archiveReason === 'sharepoint') return 'uploaded';
  return 'not_queued';
};

export const groupSE14ArchivedRecords = (records = []) => {
  const groups = new Map();

  (Array.isArray(records) ? records : [])
    .filter((record) => record?.status === 'archived')
    .forEach((record) => {
      const date = getSE14CompletedDate(record);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          date,
          folderName: getSE14ArchiveFolderName(record),
          records: [],
        });
      }

      groups.get(key).records.push(record);
    });

  return [...groups.values()]
    .sort((left, right) => right.date.getTime() - left.date.getTime())
    .map((group) => {
      const records = [...group.records].sort(
        (left, right) =>
          getSE14CompletedDate(right).getTime() -
          getSE14CompletedDate(left).getTime()
      );
      const rounds = groupSE14RecordsByRound(records, { dayKey: group.key })
        .map((round) => ({
          ...round,
          key: `${group.key}:${round.id}`,
          folderName: `${group.folderName}_Round-${round.sequence}_${round.label}`,
          pendingCount: round.records.filter(
            (record) => getSE14UploadState(record) !== 'uploaded'
          ).length,
        }));

      return {
        ...group,
        records,
        rounds,
        pendingCount: records.filter(
        (record) => getSE14UploadState(record) !== 'uploaded'
        ).length,
      };
    });
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

export const archiveSE14Record = (record, reason = 'manual') => {
  if (!record || record.status === 'archived') return record;
  if (!['review', 'complete'].includes(record.status)) return record;

  const archivedAt = new Date().toISOString();

  return {
    ...record,
    status: 'archived',
    archivedAt,
    archivedFromStatus: record.status,
    archiveReason: reason,
    sharePointUpload:
      reason === 'sharepoint'
        ? {
            ...(record.sharePointUpload || {}),
            state: 'uploaded',
            uploadedAt: archivedAt,
          }
        : record.sharePointUpload || null,
    updatedAt: archivedAt,
  };
};

export const queueSE14RecordForUpload = (record, form, pdf = {}) => {
  if (!record) return record;

  const queuedAt = new Date().toISOString();
  const completedAt = record.completedAt || queuedAt;

  return {
    ...updateSE14Record(record, form),
    status: 'archived',
    completedAt,
    archivedAt: record.archivedAt || queuedAt,
    archivedFromStatus: record.archivedFromStatus || record.status || 'complete',
    archiveReason: 'daily_queue',
    sharePointUpload: {
      state: 'pending',
      queuedAt,
      pdfName: pdf?.name || record?.sharePointUpload?.pdfName || '',
      pdfUri: pdf?.uri || record?.sharePointUpload?.pdfUri || '',
      lastError: null,
    },
    updatedAt: queuedAt,
  };
};

export const markSE14RecordsUploaded = (
  records = [],
  recordIds = [],
  uploadedAt = new Date().toISOString()
) => {
  const ids = new Set(recordIds);

  return (Array.isArray(records) ? records : []).map((record) =>
    ids.has(record?.id)
      ? {
          ...record,
          sharePointUpload: {
            ...(record.sharePointUpload || {}),
            state: 'uploaded',
            uploadedAt,
            lastError: null,
          },
          lastSharePointUploadAt: uploadedAt,
          updatedAt: uploadedAt,
        }
      : record
  );
};

export const restoreSE14Record = (record) => {
  if (!record || record.status !== 'archived') return record;

  const restoredAt = new Date().toISOString();
  const restoredStatus = ['review', 'complete'].includes(
    record.archivedFromStatus
  )
    ? record.archivedFromStatus
    : record.completedAt
      ? 'complete'
      : 'review';

  return {
    ...record,
    status: restoredStatus,
    lastArchivedAt: record.archivedAt || null,
    archivedAt: null,
    archivedFromStatus: null,
    archiveReason: null,
    restoredAt,
    updatedAt: restoredAt,
  };
};

export const hasRequiredSE14StartFields = (form) => {
  return isSE14StartComplete(form);
};
