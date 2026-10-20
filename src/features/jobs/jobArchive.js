export const INACTIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

const asTimestamp = (value) => {
  if (Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : NaN;
};

const startOfLocalDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const isTeamsJob = (job = {}) => (
  String(job.source || '').toLowerCase().includes('teams-shifts')
  || Array.isArray(job.microsoftShiftIds) && job.microsoftShiftIds.length > 0
);

/**
 * Returns the reason a job belongs in the single Archived Jobs folder.
 * Teams jobs are completed when their last known shift ended before today.
 * This waits until the following calendar day, so a job does not move while
 * the crew may still be using it on the final shift day.
 */
export const getJobArchiveReason = (job = {}, now = Date.now()) => {
  const nowTimestamp = asTimestamp(now);
  if (!Number.isFinite(nowTimestamp)) return '';

  if (isTeamsJob(job)) {
    const finalSchedule = asTimestamp(job.scheduleEnd || job.scheduleStart);
    if (Number.isFinite(finalSchedule)) {
      return finalSchedule < startOfLocalDay(nowTimestamp) ? 'completed' : '';
    }
  }

  const lastAccessed = asTimestamp(job.lastOpenedAt || job.createdAt);
  return Number.isFinite(lastAccessed)
    && lastAccessed < nowTimestamp - INACTIVE_AFTER_MS
    ? 'inactive'
    : '';
};

export const applyJobArchiveState = (job = {}, now = Date.now()) => {
  const reason = getJobArchiveReason(job, now);
  if (!reason) {
    return {
      ...job,
      isArchived: false,
      archiveReason: '',
      archivedAt: '',
    };
  }

  return {
    ...job,
    isArchived: true,
    archiveReason: reason,
    archivedAt: job.archivedAt || new Date(asTimestamp(now)).toISOString(),
  };
};

export const applyArchiveState = (jobs = [], now = Date.now()) => (
  jobs.map((job) => applyJobArchiveState(job, now))
);
