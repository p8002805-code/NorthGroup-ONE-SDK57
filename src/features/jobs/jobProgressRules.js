import { secureRandomId } from '../../services/security/secureRandom';
import {
  canonicalJobTaskName,
  jobTaskDefinition,
  normaliseJobTaskNames,
} from './jobTaskRules';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const normaliseAmount = (value, fallback = 0) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round(number * 100) / 100);
};

const createTaskId = () => (
  secureRandomId('progress')
);

const normaliseLayerPath = (value) => (
  (Array.isArray(value) ? value : [])
    .map(clean)
    .filter(Boolean)
);

const normaliseTimestamp = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const taskNameKey = (value) => (
  canonicalJobTaskName(value).toLowerCase()
  || clean(value).toLowerCase()
);

const progressNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : fallback;
};

// Progress notifications should describe a meaningful user-facing change,
// not a new ETag, timestamp, generated task id or ordering-only rewrite.
const comparableProgressTask = (task = {}) => ({
  name: taskNameKey(task.name),
  completed: progressNumber(task.completed),
  target: progressNumber(task.target, 1),
  unit: clean(task.unit).toLowerCase(),
  manual: task.manual === true,
});

const comparableProgressTaskKey = (task) => JSON.stringify(comparableProgressTask(task));

export const progressTasksMeaningfullyEqual = (left = [], right = []) => {
  const leftKeys = (Array.isArray(left) ? left : [])
    .map(comparableProgressTaskKey)
    .sort();
  const rightKeys = (Array.isArray(right) ? right : [])
    .map(comparableProgressTaskKey)
    .sort();
  return JSON.stringify(leftKeys) === JSON.stringify(rightKeys);
};

const progressTaskLabel = (task = {}) => clean(task.name) || 'Progress';

const progressTaskValue = (task = {}) => {
  const completed = progressNumber(task.completed);
  const target = progressNumber(task.target, 1);
  const unit = clean(task.unit).toLowerCase();
  return `${completed}/${target}${unit ? ` ${unit}` : ''}`;
};

export const describeProgressTaskChanges = (previousTasks = [], nextTasks = []) => {
  const before = new Map(
    (Array.isArray(previousTasks) ? previousTasks : []).map((task) => [
      taskNameKey(task.name) || clean(task.id),
      task,
    ]),
  );
  const after = new Map(
    (Array.isArray(nextTasks) ? nextTasks : []).map((task) => [
      taskNameKey(task.name) || clean(task.id),
      task,
    ]),
  );
  const keys = new Set([...before.keys(), ...after.keys()]);
  const allChanges = [...keys]
    .map((key) => ({ previous: before.get(key), next: after.get(key) }))
    .filter(({ previous, next }) => !progressTasksMeaningfullyEqual(
      previous ? [previous] : [],
      next ? [next] : [],
    ))
    .slice(0, 3)
    .map(({ previous, next }) => {
      const task = next || previous || {};
      if (!previous) return `${progressTaskLabel(task)} added (${progressTaskValue(task)})`;
      if (!next) return `${progressTaskLabel(previous)} removed`;
      return `${progressTaskLabel(next)} ${progressTaskValue(previous)} → ${progressTaskValue(next)}`;
    });

  if (!allChanges.length) return '';
  const changes = allChanges.slice(0, 3);
  return allChanges.length > 3
    ? `${changes.join('; ')}; more changes`
    : changes.join('; ');
};

export const progressLayerPathKey = (value) => normaliseLayerPath(value)
  .map((part) => part.toLocaleLowerCase('en-AU'))
  .join('\u001f');

export const progressTaskComplete = (task) => (
  Number(task?.target || 0) > 0
  && Number(task?.completed || 0) >= Number(task?.target || 0)
);

export const progressTaskRatio = (task) => {
  const target = Number(task?.target || 0);
  if (!(target > 0)) return 0;
  return Math.min(1, Math.max(0, Number(task?.completed || 0) / target));
};

export const normaliseProgressTask = (task = {}) => {
  const target = Math.max(0.01, normaliseAmount(task.target, 1));
  const completed = Math.min(target, normaliseAmount(task.completed, 0));
  const kmlLayerPath = normaliseLayerPath(task.kmlLayerPath);

  return {
    id: clean(task.id) || createTaskId(),
    name: clean(task.name),
    completed,
    target,
    unit: clean(task.unit),
    sourceSectionId: clean(task.sourceSectionId),
    ...(task.manual === true ? { manual: true } : {}),
    completedAt: completed >= target ? normaliseTimestamp(task.completedAt) : '',
    kmlLayerPath,
    kmlLayerName: clean(task.kmlLayerName) || kmlLayerPath[kmlLayerPath.length - 1] || '',
  };
};

export const updateProgressTaskAmount = (task, completed, completedAt = new Date().toISOString()) => {
  const wasComplete = progressTaskComplete(task);
  const next = normaliseProgressTask({ ...task, completed });
  if (!progressTaskComplete(next)) return { ...next, completedAt: '' };
  return {
    ...next,
    completedAt: wasComplete && normaliseTimestamp(task?.completedAt)
      ? normaliseTimestamp(task.completedAt)
      : normaliseTimestamp(completedAt) || new Date().toISOString(),
  };
};

export const sortProgressTasks = (tasks = []) => (
  [...(Array.isArray(tasks) ? tasks : [])].sort((left, right) => {
    const leftComplete = progressTaskComplete(left);
    const rightComplete = progressTaskComplete(right);
    if (leftComplete !== rightComplete) return leftComplete ? 1 : -1;
    if (!leftComplete) return 0;
    return String(right.completedAt || '').localeCompare(String(left.completedAt || ''));
  })
);

export const scopeProgressSectionsToJob = (jobNumber, sections) => ({
  jobNumber: clean(jobNumber),
  sections: Array.isArray(sections) ? sections : null,
});

export const progressSectionsForJob = (source, jobNumber) => (
  clean(source?.jobNumber) === clean(jobNumber) && Array.isArray(source?.sections)
    ? source.sections
    : null
);

const normaliseSuggestedSections = (suggestedTasks = []) => {
  const seenIds = new Set();
  return (Array.isArray(suggestedTasks) ? suggestedTasks : []).map((suggestion, index) => {
    if (suggestion && typeof suggestion === 'object') {
      const sourceSectionId = clean(suggestion.sourceSectionId || suggestion.id);
      const name = clean(suggestion.title || suggestion.name);
      if (!sourceSectionId || !name || seenIds.has(sourceSectionId.toLowerCase())) return null;
      seenIds.add(sourceSectionId.toLowerCase());
      return { sourceSectionId, name, order: Number(suggestion.order) || index };
    }
    return null;
  }).filter(Boolean);
};

export const mergeJobTasksIntoProgress = (
  tasks = [],
  suggestedTasks = [],
  { authoritative = false } = {},
) => {
  if (authoritative) {
    const existingTasks = (Array.isArray(tasks) ? tasks : []).map(normaliseProgressTask);
    const usedTaskIndexes = new Set();
    const currentSectionTasks = normaliseSuggestedSections(suggestedTasks)
      .sort((left, right) => left.order - right.order)
      .map((section) => {
        let matchIndex = existingTasks.findIndex((task, index) => (
          !usedTaskIndexes.has(index)
          && task.sourceSectionId
          && task.sourceSectionId.toLowerCase() === section.sourceSectionId.toLowerCase()
        ));
        if (matchIndex < 0) {
          matchIndex = existingTasks.findIndex((task, index) => (
            !usedTaskIndexes.has(index)
            && taskNameKey(task.name) === taskNameKey(section.name)
          ));
        }
        if (matchIndex >= 0) usedTaskIndexes.add(matchIndex);
        const existing = matchIndex >= 0 ? existingTasks[matchIndex] : null;
        return normaliseProgressTask({
          ...(existing || {}),
          id: existing?.id || `section-${section.sourceSectionId}`,
          name: section.name,
          sourceSectionId: section.sourceSectionId,
          completed: existing?.completed || 0,
          target: existing?.target || 1,
        });
      });

    const manualTasks = existingTasks.filter((task, index) => (
      !usedTaskIndexes.has(index) && task.manual === true
    ));
    const completedHistory = existingTasks.filter((task, index) => (
      !usedTaskIndexes.has(index)
      && task.manual !== true
      && progressTaskComplete(task)
    ));

    return [...currentSectionTasks, ...manualTasks, ...completedHistory];
  }

  const requestedNames = normaliseJobTaskNames(suggestedTasks);
  const seenTaskNames = new Set();
  const merged = [];

  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    const canonicalName = canonicalJobTaskName(task?.name);
    if (canonicalName) {
      const key = canonicalName.toLowerCase();
      if (seenTaskNames.has(key)) return;
      seenTaskNames.add(key);
      merged.push(normaliseProgressTask({ ...task, name: canonicalName }));
      return;
    }
    merged.push(normaliseProgressTask(task));
  });

  requestedNames.forEach((name) => {
    const key = name.toLowerCase();
    if (seenTaskNames.has(key)) return;
    const definition = jobTaskDefinition(name);
    merged.push(normaliseProgressTask({
      id: `shift-${definition?.sectionId || key.replace(/[^a-z0-9]+/g, '-')}`,
      name,
      completed: 0,
      target: 1,
      unit: '',
    }));
    seenTaskNames.add(key);
  });

  return merged;
};

export const normaliseProgressDocument = (payload = {}) => ({
  version: 2,
  jobNumber: clean(payload.jobNumber),
  tasks: (Array.isArray(payload.tasks) ? payload.tasks : [])
    .map(normaliseProgressTask)
    .filter((task) => task.name),
  updatedAt: clean(payload.updatedAt),
  updatedBy: clean(payload.updatedBy),
});

const progressTaskMatch = (tasks, task) => {
  const candidates = Array.isArray(tasks) ? tasks : [];
  const id = clean(task?.id);
  if (id) {
    const byId = candidates.find((candidate) => clean(candidate?.id) === id);
    if (byId) return byId;
  }

  const sectionId = clean(task?.sourceSectionId);
  if (sectionId) {
    const bySection = candidates.find((candidate) => (
      clean(candidate?.sourceSectionId).toLowerCase() === sectionId.toLowerCase()
    ));
    if (bySection) return bySection;
  }

  const name = taskNameKey(task?.name);
  return candidates.find((candidate) => taskNameKey(candidate?.name) === name) || null;
};

const completionEventId = ({ jobNumber, task, updatedAt, revision }) => ([
  'progress-complete',
  clean(jobNumber).toLocaleUpperCase('en-AU') || 'job',
  clean(task?.id) || taskNameKey(task?.name) || 'task',
  clean(task?.completedAt) || clean(updatedAt) || clean(revision) || 'complete',
].join(':'));

export const progressCompletionEvents = ({
  previousTasks = [],
  nextTasks = [],
  jobNumber = '',
  updatedBy = '',
  updatedAt = '',
  revision = '',
} = {}) => (
  (Array.isArray(nextTasks) ? nextTasks : [])
    .map(normaliseProgressTask)
    .filter(progressTaskComplete)
    .map((task) => {
      const previous = progressTaskMatch(previousTasks, task);
      if (previous && progressTaskComplete(previous)) return null;
      return {
        eventId: completionEventId({ jobNumber, task, updatedAt, revision }),
        jobNumber: clean(jobNumber),
        taskId: task.id,
        taskName: task.name,
        completed: task.completed,
        target: task.target,
        unit: task.unit,
        completedAt: task.completedAt || clean(updatedAt),
        updatedAt: clean(updatedAt),
        updatedBy: clean(updatedBy),
        revision: clean(revision),
        fromRatio: previous ? progressTaskRatio(previous) : 0,
      };
    })
    .filter(Boolean)
);
