const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

export const JOB_TASK_CATALOG = Object.freeze([
  Object.freeze({
    name: 'GFM',
    sectionId: 'gfm',
    icon: 'layers-outline',
    patterns: Object.freeze([/\bGFM\b/i]),
  }),
  Object.freeze({
    name: 'Service Location',
    sectionId: 'service-locating',
    icon: 'locate-outline',
    patterns: Object.freeze([/\bservice\s+locat(?:ion|ing)\b/i, /\bSL\b/i]),
  }),
  Object.freeze({
    name: 'Cadastral',
    sectionId: 'brief-cadastral',
    icon: 'map-outline',
    patterns: Object.freeze([/\bcadastral\b/i]),
  }),
  Object.freeze({
    name: 'SX12',
    sectionId: 'brief-sx12',
    icon: 'school-outline',
    patterns: Object.freeze([/\bSX[\s-]*12\b/i]),
  }),
  Object.freeze({
    name: 'MLS Scanning',
    // Keep the previous section id so existing MLS Capture content remains linked.
    sectionId: 'brief-mls-capture',
    icon: 'scan-outline',
    patterns: Object.freeze([/\bMLS\s+(?:scanning|scans?|capture)\b/i]),
  }),
  Object.freeze({
    name: 'Drainage',
    // Keep the previous section id so existing Drainage/QQ content remains linked.
    sectionId: 'drainage-qq',
    icon: 'water-outline',
    patterns: Object.freeze([/\bdrainage\b/i]),
  }),
]);

const matchDefinition = (value) => {
  const text = clean(value);
  if (!text) return null;
  return JOB_TASK_CATALOG.find((definition) => (
    definition.name.toLowerCase() === text.toLowerCase()
    || definition.patterns.some((pattern) => pattern.test(text))
  )) || null;
};

export const canonicalJobTaskName = (value) => matchDefinition(value)?.name || '';

export const jobTaskDefinition = (value) => matchDefinition(value);

export const normaliseJobTaskNames = (values = []) => {
  const names = [];
  const seen = new Set();
  (Array.isArray(values) ? values : [values]).forEach((value) => {
    const name = canonicalJobTaskName(value);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return;
    seen.add(key);
    names.push(name);
  });
  return names;
};

export const jobTaskNamesFromText = (value = '') => {
  const text = String(value || '');
  const matches = [];
  JOB_TASK_CATALOG.forEach((definition, catalogIndex) => {
    let firstIndex = -1;
    definition.patterns.forEach((pattern) => {
      const match = pattern.exec(text);
      if (match && (firstIndex < 0 || match.index < firstIndex)) firstIndex = match.index;
    });
    if (firstIndex >= 0) matches.push({ name: definition.name, firstIndex, catalogIndex });
  });
  return matches
    .sort((a, b) => a.firstIndex - b.firstIndex || a.catalogIndex - b.catalogIndex)
    .map((match) => match.name);
};
