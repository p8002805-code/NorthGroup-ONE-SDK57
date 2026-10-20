import { progressTaskComplete } from '../jobs/jobProgressRules';

const IGNORED_NAME_PARTS = new Set([
  'feature',
  'features',
  'folder',
  'folders',
  'layer',
  'layers',
  'task',
  'tasks',
  'work',
  'works',
]);

export const normaliseKmlMatchName = (value) => (
  (String(value || '').toLocaleLowerCase('en-AU').match(/[a-z]+|\d+/g) || [])
    .map((part) => (
      part.length > 3 && part.endsWith('s') && !part.endsWith('ss')
        ? part.slice(0, -1)
        : part
    ))
    .filter((part) => !IGNORED_NAME_PARTS.has(part))
    .join('')
);

export const normaliseKmlLayerPathKey = (value) => {
  const parts = (Array.isArray(value) ? value : [])
    .map(normaliseKmlMatchName)
    .filter(Boolean);
  while (parts.length && (parts[0] === 'document' || parts[0] === 'root')) parts.shift();
  return parts.join('\u001f');
};

export const kmlLayerPathsMatch = (first, second) => {
  const left = normaliseKmlLayerPathKey(first);
  const right = normaliseKmlLayerPathKey(second);
  return Boolean(left && right && left === right);
};

export const progressHiddenLayerIds = (tasks = [], layers = []) => {
  const completed = tasks.filter(progressTaskComplete);
  return layers.reduce((hidden, layer) => {
    const layerName = normaliseKmlMatchName(layer.name);
    const matched = completed.some((task) => {
      const linkedPath = Array.isArray(task.kmlLayerPath) ? task.kmlLayerPath : [];
      const linkedName = normaliseKmlMatchName(task.kmlLayerName);
      const taskName = normaliseKmlMatchName(task.name);
      if (linkedPath.length) return kmlLayerPathsMatch(linkedPath, layer.path);
      return (linkedName && linkedName === layerName)
        || (taskName && taskName === layerName);
    });
    if (matched) hidden[layer.id] = true;
    return hidden;
  }, {});
};

export const progressHiddenFeatureIds = (tasks = [], features = []) => {
  const completedNames = new Set(
    tasks
      .filter(progressTaskComplete)
      .flatMap((task) => (
        Array.isArray(task.kmlLayerPath) && task.kmlLayerPath.length
          ? []
          : [task.name, task.kmlLayerName]
      ))
      .map(normaliseKmlMatchName)
      .filter(Boolean),
  );
  return features.reduce((hidden, feature) => {
    if (completedNames.has(normaliseKmlMatchName(feature.name))) hidden[feature.id] = true;
    return hidden;
  }, {});
};
