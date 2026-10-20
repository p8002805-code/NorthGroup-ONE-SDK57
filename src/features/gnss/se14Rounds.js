const LEGACY_ROUND_WINDOW_MS = 4 * 60 * 60 * 1000;
const NEXT_ROUND_AGE_MS = 4 * 60 * 60 * 1000;
const NEXT_ROUND_GAP_MS = 45 * 60 * 1000;

const parseFormDate = (value) => {
  const match = String(value || '').trim().match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );
  if (!match) return null;

  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const applyFormTime = (date, value) => {
  const match = String(value || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return date;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return date;

  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const getSE14RoundDayKey = (date = new Date()) => {
  const validDate = date instanceof Date && !Number.isNaN(date.getTime())
    ? date
    : new Date();
  return [
    validDate.getFullYear(),
    String(validDate.getMonth() + 1).padStart(2, '0'),
    String(validDate.getDate()).padStart(2, '0'),
  ].join('-');
};

export const getSE14SessionStartedAt = (recordOrForm = {}) => {
  const record = recordOrForm?.data ? recordOrForm : null;
  const form = record?.data || recordOrForm || {};
  const formDate = parseFormDate(form.startDate);

  if (formDate) return applyFormTime(formDate, form.startTime);

  const stored = new Date(
    record?.createdAt || form.fieldRoundStartedAt || record?.updatedAt || 0
  );
  return Number.isNaN(stored.getTime()) ? new Date(0) : stored;
};

const defaultRoundLabel = (startedAt) => {
  const hour = startedAt.getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
};

const nextRoundLabel = (previousLabel, startedAt) => {
  if (previousLabel === 'Morning') return 'Afternoon';
  if (previousLabel === 'Afternoon') return 'Evening';
  return defaultRoundLabel(startedAt);
};

export const getSE14StoredRound = (recordOrForm = {}) => {
  const form = recordOrForm?.data || recordOrForm || {};
  const sequence = Number.parseInt(form.fieldRoundSequence, 10);
  if (!Number.isFinite(sequence) || sequence < 1) return null;

  const sessionStartedAt = getSE14SessionStartedAt(recordOrForm);
  const storedStartedAt = form.fieldRoundStartedAt
    ? new Date(form.fieldRoundStartedAt)
    : null;
  const startedAt = !storedStartedAt || Number.isNaN(storedStartedAt.getTime())
    ? sessionStartedAt
    : storedStartedAt;
  const dayKey = getSE14RoundDayKey(startedAt);

  return {
    id: String(form.fieldRoundId || `${dayKey}-round-${sequence}`),
    sequence,
    label: String(form.fieldRoundLabel || defaultRoundLabel(startedAt)),
    startedAt,
    dayKey,
    stored: true,
  };
};

const roundStartDetail = (records) => {
  const dates = records
    .map(getSE14SessionStartedAt)
    .filter((date) => date.getTime() > 0)
    .sort((left, right) => left.getTime() - right.getTime());
  if (!dates.length) return 'Start times unavailable';

  const format = (date) => date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const first = format(dates[0]);
  const last = format(dates[dates.length - 1]);
  return first === last ? `Started ${first}` : `Starts ${first}–${last}`;
};

export const groupSE14RecordsByRound = (records = [], { dayKey = '' } = {}) => {
  const source = Array.isArray(records) ? records : [];
  const groups = new Map();
  const legacyRecords = [];

  source.forEach((record) => {
    const storedRound = getSE14StoredRound(record);
    if (!storedRound) {
      legacyRecords.push(record);
      return;
    }

    if (!groups.has(storedRound.id)) {
      groups.set(storedRound.id, {
        ...storedRound,
        records: [],
      });
    }
    groups.get(storedRound.id).records.push(record);
  });

  let legacySequence = 0;
  let legacyAnchor = null;
  legacyRecords
    .slice()
    .sort((left, right) => (
      getSE14SessionStartedAt(left).getTime() -
      getSE14SessionStartedAt(right).getTime()
    ))
    .forEach((record) => {
      const startedAt = getSE14SessionStartedAt(record);
      if (!legacyAnchor || startedAt.getTime() - legacyAnchor.getTime() > LEGACY_ROUND_WINDOW_MS) {
        legacySequence += 1;
        legacyAnchor = startedAt;
      }

      const id = `${dayKey || getSE14RoundDayKey(startedAt)}-legacy-round-${legacySequence}`;
      if (!groups.has(id)) {
        groups.set(id, {
          id,
          sequence: legacySequence,
          label: defaultRoundLabel(startedAt),
          startedAt,
          dayKey: dayKey || getSE14RoundDayKey(startedAt),
          stored: false,
          records: [],
        });
      }
      groups.get(id).records.push(record);
    });

  return [...groups.values()]
    .map((group) => ({
      ...group,
      detail: roundStartDetail(group.records),
    }))
    .sort((left, right) => (
      left.sequence - right.sequence || left.startedAt.getTime() - right.startedAt.getTime()
    ));
};

export const getSE14CurrentRound = (records = [], now = new Date()) => {
  const dayKey = getSE14RoundDayKey(now);
  const todaysRecords = (Array.isArray(records) ? records : []).filter(
    (record) => getSE14RoundDayKey(getSE14SessionStartedAt(record)) === dayKey
  );
  const rounds = groupSE14RecordsByRound(todaysRecords, { dayKey });
  const active = rounds[rounds.length - 1];

  if (!active) {
    return {
      id: `${dayKey}-round-1`,
      sequence: 1,
      label: defaultRoundLabel(now),
      startedAt: now,
      dayKey,
      recordCount: 0,
      shouldSuggestNext: false,
    };
  }

  const latestStart = active.records
    .map(getSE14SessionStartedAt)
    .sort((left, right) => right.getTime() - left.getTime())[0];
  const age = now.getTime() - active.startedAt.getTime();
  const gap = now.getTime() - latestStart.getTime();

  return {
    ...active,
    recordCount: active.records.length,
    shouldSuggestNext: age >= NEXT_ROUND_AGE_MS && gap >= NEXT_ROUND_GAP_MS,
  };
};

export const createSE14RoundAssignment = (
  records = [],
  { now = new Date(), startNext = false } = {}
) => {
  const current = getSE14CurrentRound(records, now);
  if (!startNext || current.recordCount === 0) {
    return current;
  }

  const sequence = current.sequence + 1;
  const dayKey = getSE14RoundDayKey(now);
  return {
    id: `${dayKey}-round-${sequence}`,
    sequence,
    label: nextRoundLabel(current.label, now),
    startedAt: now,
    dayKey,
    recordCount: 0,
    shouldSuggestNext: false,
  };
};

export const resolveSE14RoundAssignment = ({
  records = [],
  form = {},
  roundMode = 'current',
  now = new Date(),
}) => {
  const storedRound = getSE14StoredRound(form);
  if (
    roundMode !== 'next' &&
    storedRound?.dayKey === getSE14RoundDayKey(now)
  ) {
    return storedRound;
  }

  return createSE14RoundAssignment(records, {
    now,
    startNext: roundMode === 'next',
  });
};

export const applySE14RoundAssignment = (form = {}, round = {}) => ({
  ...form,
  fieldRoundId: String(round.id || ''),
  fieldRoundSequence: round.sequence || '',
  fieldRoundLabel: String(round.label || ''),
  fieldRoundStartedAt: round.startedAt instanceof Date
    ? round.startedAt.toISOString()
    : String(round.startedAt || ''),
});
