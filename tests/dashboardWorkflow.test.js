require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildDashboardWorkflow } = require('../src/features/dashboard/dashboardWorkflow');

const now = new Date(2026, 7, 12, 9, 15, 0);
const activeJob = { number: '205127', name: 'TMR' };
const formProfile = { firstName: 'Patrick', lastName: 'Carroll' };

const completePreStart = (date = '12/08/2026') => ({
  date,
  jobNumber: '205127',
  activity: 'Detail Survey',
  wmsRequired: false,
  hazard1: 'Traffic',
  control1: 'Use approved traffic controls',
  riskP1: '2',
  riskC1: '3',
  riskR1: '6',
  hazardInclude1: true,
  ppeSafetyBoots: true,
});

test('a completed daily Pre-Start advances the Dashboard to the next field action', () => {
  const workflow = buildDashboardWorkflow({
    activeJob,
    formProfile,
    s500: completePreStart(),
    formStatuses: { s500: { status: 'complete', date: '12/08/2026' } },
    now,
  });

  assert.equal(workflow.sectionTitle, 'Next Best Action');
  assert.equal(workflow.focus.type, 'workspace');
  assert.equal(workflow.focus.title, 'Choose your next field task');
  assert.match(workflow.focus.detail, /Pre-Start completed today/);
  assert.equal(workflow.preStartAction.label, 'View Pre-Start');
  assert.equal(workflow.preStartAction.completed, true);
  assert.equal(workflow.recommendedQuickAction, 'gnss');
});

test('an active GNSS session outranks completed readiness', () => {
  const workflow = buildDashboardWorkflow({
    activeJob,
    formProfile,
    s500: completePreStart(),
    se14InProgress: [{
      id: 'gnss-one',
      status: 'in_progress',
      data: { markId: 'PM210057', sessionNumber: '2' },
    }],
    now,
  });

  assert.equal(workflow.sectionTitle, 'Continue Working');
  assert.equal(workflow.focus.type, 'se14');
  assert.equal(workflow.focus.recordId, 'gnss-one');
  assert.match(workflow.focus.detail, /PM210057 · Session 2/);
});

test('saved form drafts stay ahead of generic next-step recommendations', () => {
  const workflow = buildDashboardWorkflow({
    activeJob,
    formProfile,
    s500: { date: '12/08/2026', jobNumber: '205127', activity: 'Detail Survey' },
    formStatuses: { s500: { status: 'draft', date: '12/08/2026' } },
    now,
  });

  assert.equal(workflow.sectionTitle, 'Continue Working');
  assert.equal(workflow.focus.type, 's500');
  assert.match(workflow.focus.title, /draft incomplete/);
  assert.equal(workflow.preStartAction.label, 'Continue Pre-Start');
});

test('yesterday’s completed Pre-Start never marks today ready', () => {
  const workflow = buildDashboardWorkflow({
    activeJob,
    formProfile,
    s500: completePreStart('11/08/2026'),
    formStatuses: { s500: { status: 'complete', date: '11/08/2026' } },
    now,
  });

  assert.equal(workflow.sectionTitle, 'Recommended Next Step');
  assert.equal(workflow.focus.type, 's500');
  assert.equal(workflow.preStartAction.label, 'Start Pre-Start');
  assert.equal(workflow.recommendedQuickAction, 'preStart');
});

test('no active job directs the user to choose one before field work', () => {
  const workflow = buildDashboardWorkflow({ formProfile, now });
  assert.equal(workflow.sectionTitle, 'Get Started');
  assert.equal(workflow.focus.type, 'jobs');
  assert.equal(workflow.focus.actionLabel, 'Choose a job');
});

