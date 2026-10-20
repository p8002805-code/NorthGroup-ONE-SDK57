import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountStorageKey } from '../../services/account/accountIdentity';
import {
  addNotification,
  NOTIFICATION_TYPES,
} from '../notifications/notificationService';
import { progressCompletionEvents } from './jobProgressRules';

export const PROGRESS_CELEBRATIONS_KEY = 'northgroup_one_progress_celebrations_v1';
const MAX_PENDING = 24;
const MAX_SEEN = 120;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const jobKey = (value) => clean(value).toLocaleUpperCase('en-AU');
const storageKey = () => accountStorageKey(PROGRESS_CELEBRATIONS_KEY);

const readState = async () => {
  try {
    const value = JSON.parse(await AsyncStorage.getItem(storageKey()) || '{}');
    return {
      pending: Array.isArray(value?.pending) ? value.pending : [],
      seen: Array.isArray(value?.seen) ? value.seen.map(clean).filter(Boolean) : [],
    };
  } catch {
    return { pending: [], seen: [] };
  }
};

const writeState = (state) => AsyncStorage.setItem(storageKey(), JSON.stringify({
  pending: (Array.isArray(state?.pending) ? state.pending : []).slice(0, MAX_PENDING),
  seen: (Array.isArray(state?.seen) ? state.seen : []).map(clean).filter(Boolean).slice(0, MAX_SEEN),
}));

const formatAmount = (value) => Number(value || 0).toLocaleString('en-AU', {
  maximumFractionDigits: 2,
});

const completionAmount = (event) => {
  const count = `${formatAmount(event.completed)}/${formatAmount(event.target)}`;
  return event.unit ? `${count} ${event.unit}` : count;
};

const queueProgressCelebrations = async (events) => {
  if (!events.length) return;
  const state = await readState();
  const existingIds = new Set([
    ...state.pending.map((event) => clean(event?.eventId)),
    ...state.seen,
  ]);
  const additions = events.filter((event) => (
    event?.eventId && !existingIds.has(clean(event.eventId))
  ));
  if (!additions.length) return;
  await writeState({
    ...state,
    pending: [...additions.reverse(), ...state.pending],
  });
};

export const peekProgressCelebration = async (jobNumber, taskId = '') => {
  const state = await readState();
  const targetJob = jobKey(jobNumber);
  const targetTask = clean(taskId);
  return state.pending.find((event) => (
    jobKey(event?.jobNumber) === targetJob
      && (!targetTask || clean(event?.taskId) === targetTask)
  )) || null;
};

export const consumeProgressCelebration = async (eventId) => {
  const id = clean(eventId);
  if (!id) return;
  const state = await readState();
  const wasPending = state.pending.some((event) => clean(event?.eventId) === id);
  if (!wasPending && state.seen.includes(id)) return;
  await writeState({
    pending: state.pending.filter((event) => clean(event?.eventId) !== id),
    seen: [id, ...state.seen.filter((seenId) => seenId !== id)],
  });
};

export const publishProgressCompletions = async ({
  previousTasks = [],
  nextProgress = {},
  job = {},
} = {}) => {
  const events = progressCompletionEvents({
    previousTasks,
    nextTasks: nextProgress?.tasks,
    jobNumber: job?.number || nextProgress?.jobNumber,
    updatedBy: nextProgress?.updatedBy,
    updatedAt: nextProgress?.updatedAt,
    revision: nextProgress?.eTag,
  });
  if (!events.length) return { addedCount: 0, events: [] };

  await queueProgressCelebrations(events);
  let addedCount = 0;
  const jobLabel = [clean(job?.number), clean(job?.name || job?.jobName)]
    .filter(Boolean)
    .join(' · ') || 'Job workspace';

  for (const event of events) {
    const actor = event.updatedBy || 'A team member';
    const result = await addNotification({
      type: NOTIFICATION_TYPES.WORKSPACE,
      title: `${jobLabel} · Progress updated`,
      message: `${actor} completed ${event.taskName} (${completionAmount(event)})`,
      sourceId: event.eventId,
      target: 'TodaysJob',
      targetParams: {
        focus: 'progress',
        progressEventId: event.eventId,
        progressTaskId: event.taskId,
        progressTaskName: event.taskName,
        progressCompleted: event.completed,
        progressTarget: event.target,
        progressUnit: event.unit,
        progressFromRatio: event.fromRatio,
      },
      jobNumber: event.jobNumber,
      icon: 'trophy-outline',
      dedupeKey: event.eventId,
      createdAt: event.updatedAt,
    });
    if (result.added) addedCount += 1;
  }

  return { addedCount, events };
};
