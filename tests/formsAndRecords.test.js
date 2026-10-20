require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getLocalDateKey,
  getS500DateKey,
  isS500FormFromDate,
  operationalFormForToday,
  stampOperationalForm,
} = require('../src/utils/dailyFormReset');
const { isS500Complete } = require('../src/utils/s500Status');
const {
  SE14_CHECKLIST_KEYS,
  SE14_END_REQUIREMENTS,
  SE14_REVIEW_REQUIREMENTS,
  SE14_START_REQUIREMENTS,
  archiveSE14Record,
  getSE14CompletionIssue,
  getSE14RequirementProgress,
  getSE14StartIssue,
  isSE14Complete,
  normaliseSE14Form,
  restoreSE14Record,
  sortSE14Records,
} = require('../src/utils/se14Records');

const completedRequirementValue = (requirement) => {
  if (requirement.key === 'sessionNumber') return '1';
  if (requirement.key.startsWith('photo')) return { uri: 'file:///photo.jpg' };
  if (SE14_CHECKLIST_KEYS.includes(requirement.key)) return true;
  if (requirement.measurement) return requirement.tolerance ? '0.004' : '1.234';
  return 'Complete';
};

const completeSE14 = () => {
  const form = { checklistAnswersVersion: 2 };
  [...SE14_START_REQUIREMENTS, ...SE14_END_REQUIREMENTS, ...SE14_REVIEW_REQUIREMENTS]
    .forEach((requirement) => { form[requirement.key] = completedRequirementValue(requirement); });
  return form;
};

test('daily S-500 date rules detect local midnight rollover', () => {
  const beforeMidnight = new Date(2026, 7, 10, 23, 59, 59);
  const afterMidnight = new Date(2026, 7, 11, 0, 0, 1);
  assert.equal(getLocalDateKey(beforeMidnight), '2026-08-10');
  assert.equal(getLocalDateKey(afterMidnight), '2026-08-11');
  assert.equal(getS500DateKey('10/08/2026'), '2026-08-10');
  assert.equal(isS500FormFromDate({ date: '10/08/2026' }, beforeMidnight), true);
  assert.equal(isS500FormFromDate({ date: '10/08/2026' }, afterMidnight), false);
  assert.equal(isS500FormFromDate(null, beforeMidnight), false);
});

test('vehicle and journey drafts reset when their saved workday changes', () => {
  const firstDay = new Date(2026, 7, 10, 12);
  const nextDay = new Date(2026, 7, 11, 12);
  const saved = stampOperationalForm({ date: '', completedBy: 'Field User' }, firstDay);
  assert.equal(operationalFormForToday(saved, firstDay), true);
  assert.equal(operationalFormForToday(saved, nextDay), false);
  assert.equal(operationalFormForToday({ date: '10/08/2026' }, firstDay), true);
});

test('a complete S-500 requires hazard decisions, PPE and employee identity', () => {
  const form = {
    date: '10/08/2026',
    jobNumber: '24001',
    wmsRequired: false,
    activity: 'Detail Survey',
    hazard1: 'Traffic',
    control1: 'Use approved traffic controls',
    riskP1: '2',
    riskC1: '3',
    riskR1: '6',
    hazardInclude1: true,
    ppeSafetyBoots: true,
  };
  const profile = { firstName: 'Louis', lastName: 'B', email: 'louis@example.com' };
  assert.equal(isS500Complete(form, profile), true);
  assert.equal(isS500Complete({ ...form, hazardInclude1: null }, profile), false);
  assert.equal(isS500Complete({ ...form, ppeSafetyBoots: false }, profile), false);
  assert.equal(isS500Complete(form, {}), false);
});

test('legacy SE-14 checklist false values migrate to unanswered', () => {
  const migrated = normaliseSE14Form({ levelledStart: false });
  assert.equal(migrated.checklistAnswersVersion, 2);
  assert.equal(migrated.levelledStart, null);
  const current = normaliseSE14Form({ checklistAnswersVersion: 2, levelledStart: false });
  assert.equal(current.levelledStart, false);
});

test('SE-14 rejects a corrective start check and out-of-tolerance ARP-BQR', () => {
  const form = completeSE14();
  form.levelledStart = false;
  assert.match(getSE14StartIssue(form).message, /relevel and centre/i);
  form.levelledStart = true;
  form.arpBqr = '0.006';
  assert.match(getSE14StartIssue(form).message, /±0\.005 m/);
});

test('SE-14 completion and progress require all start, end and review fields', () => {
  const form = completeSE14();
  assert.equal(getSE14CompletionIssue(form), null);
  assert.equal(isSE14Complete(form), true);
  assert.deepEqual(getSE14RequirementProgress(form, SE14_START_REQUIREMENTS), {
    complete: SE14_START_REQUIREMENTS.length,
    total: SE14_START_REQUIREMENTS.length,
  });
  form.rawGnssFile = '';
  assert.equal(isSE14Complete(form), false);
  assert.equal(getSE14CompletionIssue(form).key, 'rawGnssFile');
});

test('SE-14 records sort newest first, then mark and session', () => {
  const records = [
    { id: 'b', createdAt: '2026-08-10T00:00:00Z', data: { startDate: '10/08/2026', markId: 'PM10', sessionNumber: '2' } },
    { id: 'a', createdAt: '2026-08-10T00:00:00Z', data: { startDate: '10/08/2026', markId: 'PM2', sessionNumber: '2' } },
    { id: 'c', createdAt: '2026-08-11T00:00:00Z', data: { startDate: '11/08/2026', markId: 'PM1', sessionNumber: '1' } },
    { id: 'd', createdAt: '2026-08-10T00:00:00Z', data: { startDate: '10/08/2026', markId: 'PM2', sessionNumber: '1' } },
  ];
  assert.deepEqual(sortSE14Records(records).map((record) => record.id), ['c', 'd', 'a', 'b']);
});

test('SE-14 archive and restore preserve the previous completed state', () => {
  const record = { id: 'one', status: 'complete', completedAt: '2026-08-10T10:00:00Z' };
  const archived = archiveSE14Record(record);
  assert.equal(archived.status, 'archived');
  assert.equal(archived.archivedFromStatus, 'complete');
  const restored = restoreSE14Record(archived);
  assert.equal(restored.status, 'complete');
  assert.equal(restored.archivedAt, null);
});
