import { isS500FormFromDate } from '../../utils/dailyFormReset';
import {
  hasMeaningfulS500Draft,
  isS500Complete,
} from '../../utils/s500Status';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const activeGnssRecord = (records = []) => (
  (Array.isArray(records) ? records : []).find((record) => record?.status === 'in_progress')
);

const statusIsCompleteToday = (status, now) => (
  status?.status === 'complete'
  && isS500FormFromDate({ date: status.date }, now)
);

export const buildDashboardWorkflow = ({
  activeJob,
  formProfile,
  formStatuses = {},
  s500,
  se14InProgress = [],
  now = new Date(),
} = {}) => {
  const jobNumber = clean(activeJob?.number);
  const inProgressRecord = activeGnssRecord(se14InProgress);
  const s500CompleteToday = (
    (isS500Complete(s500, formProfile) && isS500FormFromDate(s500, now))
    || statusIsCompleteToday(formStatuses.s500, now)
  );
  const s500Draft = !s500CompleteToday && (
    formStatuses.s500?.status === 'draft'
    || (!formStatuses.s500 && hasMeaningfulS500Draft(s500))
  );
  const preStartAction = s500CompleteToday
    ? {
      label: 'View Pre-Start',
      eyebrow: 'COMPLETED TODAY',
      completed: true,
      accent: false,
    }
    : s500Draft
      ? {
        label: 'Continue Pre-Start',
        eyebrow: 'DRAFT SAVED',
        completed: false,
        accent: true,
      }
      : {
        label: 'Start Pre-Start',
        eyebrow: 'DAILY SAFETY',
        completed: false,
        accent: Boolean(activeJob),
      };

  if (inProgressRecord) {
    const markId = clean(inProgressRecord.data?.markId) || 'Mark pending';
    const sessionNumber = clean(inProgressRecord.data?.sessionNumber);
    const sessionLabel = sessionNumber ? `Session ${sessionNumber}` : 'SE-14 static session';
    return {
      sectionTitle: 'Continue Working',
      recommendedQuickAction: 'gnss',
      preStartAction,
      focus: {
        type: 'se14',
        tone: 'progress',
        eyebrow: 'SESSION IN PROGRESS',
        title: 'GNSS session ready to finish',
        detail: `${markId} · ${sessionLabel}`,
        actionLabel: 'Open GNSS workspace',
        recordId: inProgressRecord.id,
      },
    };
  }

  if (s500Draft) {
    return {
      sectionTitle: 'Continue Working',
      recommendedQuickAction: 'preStart',
      preStartAction,
      focus: {
        type: 's500',
        tone: 'recommended',
        eyebrow: 'S-500 DRAFT',
        title: 'Pre-Start draft incomplete',
        detail: `${jobNumber || 'Active job'} · Saved on this phone`,
        actionLabel: 'Continue pre-start',
      },
    };
  }

  if (formStatuses.s501?.status === 'draft') {
    return {
      sectionTitle: 'Continue Working',
      recommendedQuickAction: '',
      preStartAction,
      focus: {
        type: 's501',
        tone: 'recommended',
        eyebrow: 'S-501 DRAFT',
        title: 'Vehicle pre-start draft incomplete',
        detail: `${jobNumber || 'Active job'} · Saved on this phone`,
        actionLabel: 'Continue S-501',
      },
    };
  }

  if (formStatuses.s506?.status === 'draft') {
    return {
      sectionTitle: 'Continue Working',
      recommendedQuickAction: '',
      preStartAction,
      focus: {
        type: 's506',
        tone: 'recommended',
        eyebrow: 'S-506 DRAFT',
        title: 'Journey plan draft incomplete',
        detail: `${jobNumber || 'Active job'} · Saved on this phone`,
        actionLabel: 'Continue S-506',
      },
    };
  }

  if (!activeJob) {
    return {
      sectionTitle: 'Get Started',
      recommendedQuickAction: '',
      preStartAction,
      focus: {
        type: 'jobs',
        tone: 'recommended',
        eyebrow: 'ACTIVE JOB REQUIRED',
        title: 'Choose today’s job',
        detail: 'Select an assigned job to unlock forms, files and field tools.',
        actionLabel: 'Choose a job',
      },
    };
  }

  if (s500CompleteToday) {
    return {
      sectionTitle: 'Next Best Action',
      recommendedQuickAction: 'gnss',
      preStartAction,
      focus: {
        type: 'workspace',
        tone: 'ready',
        eyebrow: 'FIELD DAY READY',
        title: 'Choose your next field task',
        detail: `${jobNumber} · Pre-Start completed today`,
        actionLabel: 'Open workspace',
      },
    };
  }

  return {
    sectionTitle: 'Recommended Next Step',
    recommendedQuickAction: 'preStart',
    preStartAction,
    focus: {
      type: 's500',
      tone: 'recommended',
      eyebrow: 'DAILY SAFETY',
      title: 'Complete today’s Pre-Start',
      detail: `${jobNumber} · Required before starting field work`,
      actionLabel: 'Start pre-start',
    },
  };
};

