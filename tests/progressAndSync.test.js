require('../tools/testSupport/registerAppModules');

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  mergeJobTasksIntoProgress,
  normaliseProgressDocument,
  normaliseProgressTask,
  progressCompletionEvents,
  progressSectionsForJob,
  progressTaskComplete,
  progressTaskRatio,
  scopeProgressSectionsToJob,
  sortProgressTasks,
  updateProgressTaskAmount,
} = require('../src/features/jobs/jobProgressRules');
const {
  kmlLayerPathsMatch,
  normaliseKmlMatchName,
  progressHiddenFeatureIds,
  progressHiddenLayerIds,
} = require('../src/features/kml/progressKmlVisibility');
const {
  loadSharedJobProgress,
  saveSharedJobProgress,
} = require('../src/features/jobs/jobProgressService');
const {
  normaliseAccommodationDocument,
  saveSharedJobAccommodation,
} = require('../src/features/jobs/jobAccommodationService');
const {
  normaliseWorkspaceMetaDocument,
  saveSharedJobWorkspaceMeta,
} = require('../src/features/jobs/jobWorkspaceMetaService');
const {
  buildActiveJobDetailsSections,
  createJobDetailsSection,
  getDailyBriefText,
  isTmrJob,
  normaliseJobDetailsManifest,
  normaliseJobDetailsSectionDocument,
  overviewSectionTitlesFromBrief,
  renameJobDetailsSection,
  upsertDailyBrief,
} = require('../src/features/jobs/jobDetailsHubRules');
const { jobTaskNamesFromText } = require('../src/features/jobs/jobTaskRules');
const { formatShiftBriefLine } = require('../src/features/jobs/teamsShiftsService');
const {
  saveSharedJobDetailsHub,
  saveSharedJobDetailsSection,
} = require('../src/features/jobs/jobDetailsHubService');

const response = ({ status = 200, json = {}, text = '' }) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => json,
  text: async () => text,
});

test('progress tasks clamp amounts and preserve stable KML paths', () => {
  const task = normaliseProgressTask({
    id: ' task-1 ',
    name: '  SX12   Setout ',
    completed: 11.234,
    target: 10,
    unit: ' points ',
    kmlLayerPath: [' Survey Works ', '', ' SX 12 '],
  });
  assert.deepEqual(task, {
    id: 'task-1',
    name: 'SX12 Setout',
    completed: 10,
    target: 10,
    unit: 'points',
    sourceSectionId: '',
    completedAt: '',
    kmlLayerPath: ['Survey Works', 'SX 12'],
    kmlLayerName: 'SX 12',
  });
  assert.equal(progressTaskComplete(task), true);
  assert.equal(progressTaskComplete({ completed: 9.99, target: 10 }), false);
  assert.equal(progressTaskComplete({ completed: 1, target: 0 }), false);
});

test('Progress follows active sections while retaining completed job history', () => {
  const merged = mergeJobTasksIntoProgress([
    { id: 'old-sx12', name: 'SX12', completed: 12, target: 20 },
    {
      id: 'completed-history',
      name: 'GFM',
      completed: 5,
      target: 5,
      completedAt: '2026-08-16T01:00:00.000Z',
    },
    { id: 'stale-incomplete', name: 'Drainage', completed: 1, target: 5 },
  ], [
    { id: 'brief-sx12', title: 'SX12 Control Scans', order: 1 },
    { id: 'custom-static', title: 'Install Control / Long Static', order: 2 },
  ], { authoritative: true });

  assert.deepEqual(merged.map((task) => task.name), [
    'SX12 Control Scans',
    'Install Control / Long Static',
    'GFM',
  ]);
  assert.equal(merged[0].id, 'old-sx12');
  assert.equal(merged[0].sourceSectionId, 'brief-sx12');
  assert.equal(merged[0].completed, 12);
  assert.equal(merged.some((task) => task.name === 'Drainage'), false);
  assert.equal(merged[2].completedAt, '2026-08-16T01:00:00.000Z');

  const renamed = mergeJobTasksIntoProgress(merged, [
    { id: 'brief-sx12', title: '260830 SX12 Control Scans', order: 1 },
  ], { authoritative: true });
  assert.equal(renamed.length, 2);
  assert.equal(renamed[0].id, 'old-sx12');
  assert.equal(renamed[0].name, '260830 SX12 Control Scans');
  assert.equal(renamed[1].id, 'completed-history');
});

test('manual Progress sections survive authoritative Job Details syncs', () => {
  const merged = mergeJobTasksIntoProgress([
    { id: 'section-drainage', name: 'Drainage', sourceSectionId: 'drainage', completed: 2, target: 10 },
    { id: 'manual-control', name: 'Install Control', manual: true, completed: 3, target: 8, unit: 'marks' },
    { id: 'stale-incomplete', name: 'Old Section', sourceSectionId: 'old-section', completed: 1, target: 4 },
  ], [
    { id: 'drainage', title: 'Drainage', order: 1 },
  ], { authoritative: true });

  assert.deepEqual(merged.map((task) => task.name), ['Drainage', 'Install Control']);
  assert.equal(merged[1].manual, true);
  assert.equal(merged[1].completed, 3);
  assert.equal(merged.some((task) => task.name === 'Old Section'), false);
});

test('Progress completion events fire only when a section crosses its target', () => {
  const previous = [{ id: 'drainage', name: 'Drainage', completed: 7, target: 10, unit: 'pits' }];
  const completed = updateProgressTaskAmount(previous[0], 10, '2026-08-23T01:15:00.000Z');
  const events = progressCompletionEvents({
    previousTasks: previous,
    nextTasks: [completed],
    jobNumber: '205127',
    updatedBy: 'Patrick Carroll',
    updatedAt: '2026-08-23T01:15:01.000Z',
    revision: 'etag-2',
  });

  assert.equal(progressTaskRatio(previous[0]), 0.7);
  assert.equal(events.length, 1);
  assert.equal(events[0].taskId, 'drainage');
  assert.equal(events[0].fromRatio, 0.7);
  assert.match(events[0].eventId, /^progress-complete:205127:drainage:/);
  assert.equal(progressCompletionEvents({
    previousTasks: [completed],
    nextTasks: [completed],
    jobNumber: '205127',
  }).length, 0);
});

test('Progress section state cannot leak between jobs while details are loading', () => {
  const source = scopeProgressSectionsToJob('205127', [
    { id: 'sx12', title: 'SX12', order: 1 },
  ]);

  assert.deepEqual(progressSectionsForJob(source, '205127'), source.sections);
  assert.equal(progressSectionsForJob(source, '205030'), null);
});

test('Workspace job changes reset the scoped Progress source without a stale setter', () => {
  const workspaceSource = fs.readFileSync(
    path.join(__dirname, '../src/features/jobs/screens/JobWorkspaceScreen.js'),
    'utf8',
  );

  assert.doesNotMatch(workspaceSource, /\bsetProgressSections\s*\(/);
  assert.match(
    workspaceSource,
    /setProgressSectionSource\(scopeProgressSectionsToJob\(job\?\.number, null\)\)/,
  );
});

test('Workspace keeps the Progress completion celebration wired to live task updates', () => {
  const workspaceSource = fs.readFileSync(
    path.join(__dirname, '../src/features/jobs/screens/JobWorkspaceScreen.js'),
    'utf8',
  );
  const progressSource = fs.readFileSync(
    path.join(__dirname, '../src/features/jobs/components/JobProgressSection.js'),
    'utf8',
  );

  assert.match(workspaceSource, /useProgressCelebrationFocus/);
  assert.match(workspaceSource, /ProgressCompletionCelebration/);
  assert.match(workspaceSource, /onTaskCompleted=\{requestProgressFocus\}/);
  assert.match(progressSource, /publishProgressCompletions/);
  assert.match(progressSource, /Add progress section/);
});

test('Job Details opens as a dedicated page instead of expanding in the Workspace', () => {
  const workspaceSource = fs.readFileSync(
    path.join(__dirname, '../src/features/jobs/screens/JobWorkspaceScreen.js'),
    'utf8',
  );
  const pageSource = fs.readFileSync(
    path.join(__dirname, '../src/features/jobs/components/JobDetailsPage.js'),
    'utf8',
  );

  assert.match(workspaceSource, /JobDetailsLaunchCard/);
  assert.match(workspaceSource, /<JobDetailsPage/);
  assert.match(workspaceSource, /useJobDetailsHubDisclosure/);
  assert.match(pageSource, /presentationStyle="fullScreen"/);
  assert.match(pageSource, /<JobDetailsHub/);
});


test('Progress sorts incomplete first and completed newest to oldest', () => {
  const oldest = updateProgressTaskAmount(
    { id: 'old', name: 'Old complete', completed: 0, target: 1 },
    1,
    '2026-08-16T01:00:00.000Z',
  );
  const newest = updateProgressTaskAmount(
    { id: 'new', name: 'New complete', completed: 0, target: 1 },
    1,
    '2026-08-17T01:00:00.000Z',
  );
  const incomplete = normaliseProgressTask({
    id: 'open', name: 'Still working', completed: 1, target: 2,
  });

  assert.deepEqual(sortProgressTasks([oldest, incomplete, newest]).map((task) => task.id), [
    'open',
    'new',
    'old',
  ]);
  assert.equal(updateProgressTaskAmount(newest, 0).completedAt, '');
});

test('Teams shift details become one dated line', () => {
  assert.equal(
    formatShiftBriefLine(
      '2026-08-30T01:00:00.000Z',
      ['Install Control /', 'Long Static'],
    ),
    '260830 Install Control/Long Static',
  );
});

test('progress document drops unnamed legacy tasks safely', () => {
  const document = normaliseProgressDocument({
    jobNumber: ' 24001 ',
    tasks: [{ name: '' }, { name: 'Signs', completed: 2, target: 2 }],
    updatedBy: ' Louis B ',
  });
  assert.equal(document.version, 2);
  assert.equal(document.jobNumber, '24001');
  assert.equal(document.tasks.length, 1);
  assert.equal(document.updatedBy, 'Louis B');
});

test('SX12 matching ignores spaces, punctuation and common layer words', () => {
  assert.equal(normaliseKmlMatchName('SX-12 Features'), 'sx12');
  assert.equal(normaliseKmlMatchName('SX 12 task'), 'sx12');
  assert.equal(kmlLayerPathsMatch(
    ['Root', 'Survey Works', 'SX-12 Layers'],
    ['Survey Work', 'SX 12'],
  ), true);
});

test('explicit nested KML links do not hide same-named sibling layers', () => {
  const tasks = [{
    name: 'Signs',
    completed: 10,
    target: 10,
    kmlLayerPath: ['Survey Works', 'North', 'Signs'],
    kmlLayerName: 'Signs',
  }];
  const hidden = progressHiddenLayerIds(tasks, [
    { id: 'north-signs', name: 'Signs', path: ['Survey Works', 'North', 'Signs'] },
    { id: 'south-signs', name: 'Signs', path: ['Survey Works', 'South', 'Signs'] },
  ]);
  assert.deepEqual(hidden, { 'north-signs': true });
  assert.deepEqual(progressHiddenFeatureIds(tasks, [
    { id: 'unrelated-feature', name: 'Signs' },
  ]), {});
});

test('unlinked completed tasks hide a matching layer or individual feature', () => {
  const tasks = [{ name: 'SX12', completed: 1, target: 1 }];
  assert.deepEqual(progressHiddenLayerIds(tasks, [
    { id: 'sx12-layer', name: 'SX 12', path: ['SX 12'] },
    { id: 'sx13-layer', name: 'SX13', path: ['SX13'] },
  ]), { 'sx12-layer': true });
  assert.deepEqual(progressHiddenFeatureIds(tasks, [
    { id: 'sx12-pin', name: 'SX-12' },
    { id: 'sx13-pin', name: 'SX13' },
  ]), { 'sx12-pin': true });
});

test('incomplete tasks never hide KML content', () => {
  const tasks = [{ name: 'SX12', completed: 9, target: 10 }];
  assert.deepEqual(progressHiddenLayerIds(tasks, [{ id: 'sx12', name: 'SX12', path: ['SX12'] }]), {});
  assert.deepEqual(progressHiddenFeatureIds(tasks, [{ id: 'sx12', name: 'SX12' }]), {});
});

test('shared progress saves use ETag conflict protection', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'progress-item', eTag: 'etag-new' } });
  };
  t.after(() => { global.fetch = originalFetch; });
  const saved = await saveSharedJobProgress({
    accessToken: 'token',
    job: { number: '24001' },
    tasks: [{ id: 'one', name: 'Pins', completed: 2, target: 3 }],
    updatedBy: 'Louis B',
    itemId: 'progress-item',
    eTag: 'etag-old',
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers['If-Match'], 'etag-old');
  assert.equal(JSON.parse(calls[0].options.body).version, 2);
  assert.equal(saved.eTag, 'etag-new');
});

test('legacy root Progress loads safely and migrates into App Data on save', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  const responses = [
    response({ status: 404 }),
    response({ status: 200, json: { id: 'legacy-progress', eTag: 'legacy-etag' } }),
    response({
      status: 200,
      text: JSON.stringify({
        jobNumber: '24001',
        tasks: [{ id: 'sx12', name: 'SX12', completed: 2, target: 5 }],
      }),
    }),
    response({ status: 200, json: { id: 'app-progress', eTag: 'app-etag' } }),
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  };
  t.after(() => { global.fetch = originalFetch; });

  const legacy = await loadSharedJobProgress({
    accessToken: 'token',
    job: { number: '24001' },
  });
  assert.equal(legacy.storageScope, 'legacy-root');
  assert.equal(legacy.tasks[0].completed, 2);

  const migrated = await saveSharedJobProgress({
    accessToken: 'token',
    job: { number: '24001' },
    tasks: legacy.tasks,
    updatedBy: 'Patrick Carroll',
    itemId: legacy.itemId,
    eTag: legacy.eTag,
    storageScope: legacy.storageScope,
  });
  assert.match(calls[3].url, /items\/app-data-test:.*Job%20Progress\.json.*content/);
  assert.equal(calls[3].options.headers['If-Match'], undefined);
  assert.equal(migrated.itemId, 'app-progress');
  assert.equal(migrated.storageScope, 'app-data');
});

test('shared Progress refuses a file stamped for a different job', async (t) => {
  const originalFetch = global.fetch;
  const responses = [
    response({ status: 200, json: { id: 'progress-item', eTag: 'progress-etag' } }),
    response({
      status: 200,
      text: JSON.stringify({
        jobNumber: '205127',
        tasks: [{ id: 'sx12', name: 'SX12', completed: 1, target: 1 }],
      }),
    }),
  ];
  global.fetch = async () => responses.shift();
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    loadSharedJobProgress({ accessToken: 'token', job: { number: '205030' } }),
    (error) => {
      assert.equal(error.code, 'JOB_PROGRESS_JOB_MISMATCH');
      assert.match(error.message, /belongs to job 205127, not job 205030/);
      return true;
    },
  );
});

test('shared progress returns the latest document after a conflict', async (t) => {
  const originalFetch = global.fetch;
  const responses = [
    response({ status: 412 }),
    response({ status: 200, json: { id: 'progress-item', eTag: 'etag-latest' } }),
    response({
      status: 200,
      text: JSON.stringify({
        jobNumber: '24001',
        tasks: [{ id: 'latest', name: 'Pins', completed: 3, target: 3 }],
        updatedBy: 'Liam B',
      }),
    }),
  ];
  global.fetch = async () => responses.shift();
  t.after(() => { global.fetch = originalFetch; });
  await assert.rejects(
    saveSharedJobProgress({
      accessToken: 'token',
      job: { number: '24001' },
      tasks: [{ id: 'old', name: 'Pins', completed: 2, target: 3 }],
      updatedBy: 'Louis B',
      itemId: 'progress-item',
      eTag: 'etag-old',
    }),
    (error) => {
      assert.equal(error.code, 'JOB_PROGRESS_CONFLICT');
      assert.equal(error.latest.eTag, 'etag-latest');
      assert.equal(error.latest.tasks[0].completed, 3);
      return true;
    },
  );
});

test('shared accommodation normalises multiline job details', () => {
  assert.deepEqual(
    normaliseAccommodationDocument({
      jobNumber: ' 24001 ',
      accommodation: '  Hotel Miriam\r\nBooking: NG-42  ',
      updatedBy: ' Patrick Carroll ',
    }),
    {
      version: 1,
      jobNumber: '24001',
      accommodation: 'Hotel Miriam\nBooking: NG-42',
      updatedAt: '',
      updatedBy: 'Patrick Carroll',
    },
  );
});

test('shared accommodation saves use ETag conflict protection', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'accommodation-item', eTag: 'etag-new' } });
  };
  t.after(() => { global.fetch = originalFetch; });

  const saved = await saveSharedJobAccommodation({
    accessToken: 'token',
    job: { number: '24001' },
    accommodation: 'Hotel Miriam\nBooking: NG-42',
    updatedBy: 'Patrick Carroll',
    itemId: 'accommodation-item',
    eTag: 'etag-old',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, 'PUT');
  assert.equal(calls[0].options.headers['If-Match'], 'etag-old');
  assert.equal(JSON.parse(calls[0].options.body).accommodation, 'Hotel Miriam\nBooking: NG-42');
  assert.equal(saved.eTag, 'etag-new');
  assert.equal(saved.updatedBy, 'Patrick Carroll');
});

test('shared Workspace shift and site saves use ETag conflict protection', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'workspace-item', eTag: 'etag-new' } });
  };
  t.after(() => { global.fetch = originalFetch; });

  assert.deepEqual(normaliseWorkspaceMetaDocument({
    jobNumber: ' 24001 ',
    scheduleStart: '2026-10-19T21:00:00.000Z',
    scheduleEnd: '2026-10-20T05:00:00.000Z',
    location: '  Miriam   Vale ',
    updatedBy: ' Patrick Carroll ',
  }), {
    version: 1,
    jobNumber: '24001',
    scheduleStart: '2026-10-19T21:00:00.000Z',
    scheduleEnd: '2026-10-20T05:00:00.000Z',
    location: 'Miriam Vale',
    updatedAt: '',
    updatedBy: 'Patrick Carroll',
  });

  const saved = await saveSharedJobWorkspaceMeta({
    accessToken: 'token',
    job: { number: '24001' },
    scheduleStart: '2026-10-19T21:00:00.000Z',
    scheduleEnd: '2026-10-20T05:00:00.000Z',
    location: 'Miriam Vale',
    updatedBy: 'Patrick Carroll',
    itemId: 'workspace-item',
    eTag: 'etag-old',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers['If-Match'], 'etag-old');
  assert.equal(JSON.parse(calls[0].options.body).location, 'Miriam Vale');
  assert.equal(saved.eTag, 'etag-new');
});

test('legacy Accommodation writes migrate into the App Data folder', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'app-accommodation', eTag: 'app-etag' } });
  };
  t.after(() => { global.fetch = originalFetch; });

  const saved = await saveSharedJobAccommodation({
    accessToken: 'token',
    job: { number: '24001' },
    accommodation: 'Hotel Miriam',
    updatedBy: 'Patrick Carroll',
    itemId: 'legacy-accommodation',
    eTag: 'legacy-etag',
    storageScope: 'legacy-root',
  });
  assert.match(calls[0].url, /items\/app-data-test:.*Accommodation\.json.*content/);
  assert.equal(calls[0].options.headers['If-Match'], undefined);
  assert.equal(saved.itemId, 'app-accommodation');
  assert.equal(saved.storageScope, 'app-data');
});

test('shared accommodation conflicts return the latest job member update', async (t) => {
  const originalFetch = global.fetch;
  const responses = [
    response({ status: 412 }),
    response({
      status: 200,
      json: { id: 'accommodation-item', eTag: 'etag-latest' },
    }),
    response({
      status: 200,
      text: JSON.stringify({
        jobNumber: '24001',
        accommodation: 'Latest hotel from another member',
        updatedBy: 'Liam B',
      }),
    }),
  ];
  global.fetch = async () => responses.shift();
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    saveSharedJobAccommodation({
      accessToken: 'token',
      job: { number: '24001' },
      accommodation: 'Stale local hotel',
      updatedBy: 'Patrick Carroll',
      itemId: 'accommodation-item',
      eTag: 'etag-old',
    }),
    (error) => {
      assert.equal(error.code, 'JOB_ACCOMMODATION_CONFLICT');
      assert.equal(error.latest.eTag, 'etag-latest');
      assert.equal(error.latest.accommodation, 'Latest hotel from another member');
      assert.equal(error.latest.updatedBy, 'Liam B');
      return true;
    },
  );
});

test('Job Details Hub keeps Overview and retires the old fixed work sections', () => {
  const manifest = normaliseJobDetailsManifest({
    jobNumber: ' 24001 ',
    sections: [
      { id: 'overview', title: 'Renamed', archived: true },
      { id: 'gfm', title: 'GFM', builtIn: true, archived: false, order: 1 },
      { id: 'custom-training', title: 'Training', archived: true, order: 8 },
    ],
  });

  assert.equal(manifest.jobNumber, '24001');
  assert.deepEqual(
    manifest.sections.map(({ id, title, archived }) => ({ id, title, archived })),
    [
      { id: 'overview', title: 'Overview', archived: false },
      { id: 'custom-training', title: 'Training', archived: true },
    ],
  );
  assert.equal(manifest.version, 2);
});

test('only approved shift-note tasks create ordered, de-duplicated work bubbles', () => {
  const manifest = normaliseJobDetailsManifest({});
  const brief = [
    'TMR Detail Survey',
    'Roughly 3km - extents to the fence line',
    'Location: north of Miriam Vale',
    'Wednesday - Reading Control + Cadastral',
    'Thursday - Drainage or GFM or SL?',
    'Bodhi: SL',
    'MLS capture',
    'SX-12 scans',
  ].join('\n');
  assert.deepEqual(overviewSectionTitlesFromBrief(brief), [
    'Cadastral',
    'Drainage',
    'GFM',
    'Service Location',
    'MLS Scanning',
    'SX12',
  ]);
  assert.deepEqual(
    buildActiveJobDetailsSections({ sections: manifest.sections, overviewBrief: brief })
      .map(({ id, title }) => ({ id, title })),
    [
      { id: 'overview', title: 'Overview' },
      { id: 'brief-cadastral', title: 'Cadastral' },
      { id: 'drainage-qq', title: 'Drainage' },
      { id: 'gfm', title: 'GFM' },
      { id: 'service-locating', title: 'Service Location' },
      { id: 'brief-mls-capture', title: 'MLS Scanning' },
      { id: 'brief-sx12', title: 'SX12' },
    ],
  );
  assert.equal(
    buildActiveJobDetailsSections({ sections: manifest.sections, overviewBrief: 'GFM' })[1].id,
    'gfm',
  );
  assert.deepEqual(
    buildActiveJobDetailsSections({
      sections: manifest.sections,
      taskNames: ['GFM'],
      taskNotes: 'Drainage and GFM',
    }).map((section) => section.title),
    ['Overview', 'GFM', 'Drainage'],
  );
});

test('shift-note task detection ignores general Overview information', () => {
  assert.deepEqual(jobTaskNamesFromText([
    'TMR Detail Survey',
    'Roughly 3km - extents to the fence line',
    'Location: north of Miriam Vale',
    'Friday - Home Time and app instructions',
    '17th-23rd: All travel up',
  ].join('\n')), []);
});

test('legacy brief-derived text cannot reappear as a Job Details bubble', () => {
  const overviewBrief = [
    'MLS capture',
    'SX12 scans',
    'SX12 scans',
    'SX12 scans',
    '',
    'Testing extra information',
  ].join('\n');
  const legacySections = [
    { id: 'overview', title: 'Overview', builtIn: true },
    { id: 'brief-mls-capture', title: 'MLS Capture', derivedFromOverview: true },
    { id: 'brief-sx12', title: 'SX12', derivedFromOverview: true },
    { id: 'brief-testing-extra-information', title: 'Testing Extra Information' },
    { id: 'custom-safety', title: 'Safety', builtIn: false },
  ];

  assert.deepEqual(
    buildActiveJobDetailsSections({ sections: legacySections, overviewBrief })
      .map((section) => section.title),
    ['Overview', 'MLS Scanning', 'SX12', 'Safety'],
  );
  assert.deepEqual(
    normaliseJobDetailsManifest({ sections: legacySections }).sections
      .map((section) => section.title),
    ['Overview', 'Safety'],
  );
});

test('approved shift tasks seed Progress once and preserve existing amounts', () => {
  const merged = mergeJobTasksIntoProgress([
    { id: 'gfm-one', name: 'GFM', completed: 2, target: 5, unit: 'km' },
    { id: 'gfm-duplicate', name: 'gfm', completed: 0, target: 1 },
    { id: 'manual', name: 'Clear Culverts', completed: 0, target: 3 },
  ], ['GFM', 'SL', 'Service Locating', 'Drainage']);

  assert.deepEqual(merged.map((task) => task.name), [
    'GFM',
    'Clear Culverts',
    'Service Location',
    'Drainage',
  ]);
  assert.deepEqual(
    merged.find((task) => task.name === 'GFM'),
    {
      id: 'gfm-one',
      name: 'GFM',
      completed: 2,
      target: 5,
      unit: 'km',
      sourceSectionId: '',
      completedAt: '',
      kmlLayerPath: [],
      kmlLayerName: '',
    },
  );
});

test('legacy Overview brief helpers keep dated entries readable during migration', () => {
  const entries = upsertDailyBrief({
    entries: [{ date: '2026-08-14', text: 'GFM' }],
    date: '2026-08-15',
    text: 'MLS capture\nSX12 scans',
  });
  assert.deepEqual(entries.map((entry) => entry.date), ['2026-08-15', '2026-08-14']);
  assert.equal(getDailyBriefText(entries, '2026-08-15'), 'MLS capture\nSX12 scans');

  const replaced = upsertDailyBrief({
    entries,
    date: '2026-08-15',
    text: 'SX12 scans',
  });
  assert.equal(replaced.length, 2);
  assert.equal(replaced[0].text, 'SX12 scans');
});

test('Overview migrates dated brief history into one shared brief', () => {
  const current = normaliseJobDetailsSectionDocument({
    sectionId: 'overview',
    title: 'Overview',
    brief: 'Current edited brief',
    dailyBriefs: [
      { date: '2026-08-17', text: 'Dated copy' },
      { date: '2026-08-16', text: 'Earlier copy' },
    ],
  });
  assert.equal(current.brief, 'Current edited brief');
  assert.equal('dailyBriefs' in current, false);

  const legacy = normaliseJobDetailsSectionDocument({
    sectionId: 'overview',
    title: 'Overview',
    dailyBriefs: [
      { date: '2026-08-16', text: 'Earlier copy' },
      { date: '2026-08-17', text: 'Newest legacy brief' },
    ],
  });
  assert.equal(legacy.brief, 'Newest legacy brief');
  assert.equal('dailyBriefs' in legacy, false);
});

test('TMR jobs expose the shared Feature Library across Job Details sections', () => {
  assert.equal(isTmrJob({ microsoftTeamNames: ['TMR Detail Survey'] }), true);
  assert.equal(isTmrJob({ client: 'Department of Transport and Main Roads' }), true);
  assert.equal(isTmrJob({ workType: 'TMR GFM survey' }), true);
  assert.equal(isTmrJob({ name: 'Private cadastral survey', microsoftTeamNames: ['Cadastral'] }), false);
});

test('custom Job Details sections reject duplicate names and receive stable ids', () => {
  const existingSections = normaliseJobDetailsManifest({}).sections;
  const section = createJobDetailsSection({
    title: ' Traffic Management ',
    existingSections,
    now: 123456,
  });
  assert.equal(section.id, 'custom-traffic-management');
  assert.equal(section.title, 'Traffic Management');
  assert.equal(section.builtIn, false);

  assert.throws(
    () => createJobDetailsSection({ title: ' overview ', existingSections }),
    /already exists/,
  );

  const renamed = renameJobDetailsSection({
    sectionId: section.id,
    title: 'Install Control / Long Static',
    sections: [...existingSections, section],
  });
  assert.equal(
    renamed.find((item) => item.id === section.id).title,
    'Install Control / Long Static',
  );
  assert.equal(renamed.find((item) => item.id === section.id).builtIn, false);
});

test('Job Details section documents preserve content and unique file links', () => {
  const document = normaliseJobDetailsSectionDocument({
    jobNumber: '24001',
    sectionId: 'service-locating',
    title: 'Service Locating',
    brief: '  Dial before you dig\r\nConfirm plans  ',
    files: [
      { id: 'one', name: 'Plan.pdf', webUrl: 'https://example.test/one', size: 2048 },
      { id: 'one', name: 'Duplicate.pdf' },
      { name: 'Missing id.pdf' },
    ],
  });
  assert.equal(document.brief, 'Dial before you dig\nConfirm plans');
  assert.equal(document.files.length, 1);
  assert.equal(document.files[0].name, 'Plan.pdf');
});

test('Overview keeps one shared brief without creating a dated entry', () => {
  const document = normaliseJobDetailsSectionDocument({
    jobNumber: '24001',
    sectionId: 'overview',
    title: 'Overview',
    brief: 'MLS capture\nSX12 scans',
    updatedAt: '2026-08-15T02:00:00.000Z',
  });
  assert.equal(document.brief, 'MLS capture\nSX12 scans');
  assert.equal('dailyBriefs' in document, false);
});

test('Job Details Hub manifest saves use ETag conflict protection', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'hub-item', eTag: 'hub-etag-new' } });
  };
  t.after(() => { global.fetch = originalFetch; });

  const saved = await saveSharedJobDetailsHub({
    accessToken: 'token',
    job: { number: '24001' },
    sections: normaliseJobDetailsManifest({}).sections,
    updatedBy: 'Patrick Carroll',
    itemId: 'hub-item',
    eTag: 'hub-etag-old',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers['If-Match'], 'hub-etag-old');
  assert.equal(JSON.parse(calls[0].options.body).sections.length, 1);
  assert.equal(saved.eTag, 'hub-etag-new');
});

test('individual Job Details section saves use their own ETag', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'section-item', eTag: 'section-etag-new' } });
  };
  t.after(() => { global.fetch = originalFetch; });

  const saved = await saveSharedJobDetailsSection({
    accessToken: 'token',
    job: { number: '24001' },
    section: { id: 'gfm', title: 'GFM' },
    brief: 'GFM project brief',
    requirements: 'Use the supplied model',
    procedures: 'Review before field work',
    files: [{ id: 'file-one', name: 'GFM Manual.pdf' }],
    updatedBy: 'Patrick Carroll',
    itemId: 'section-item',
    eTag: 'section-etag-old',
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers['If-Match'], 'section-etag-old');
  assert.equal(JSON.parse(calls[0].options.body).sectionId, 'gfm');
  assert.equal(saved.files[0].name, 'GFM Manual.pdf');
  assert.equal(saved.eTag, 'section-etag-new');
});

test('legacy Job Details sections migrate into App Data Sections on save', async (t) => {
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return response({ status: 200, json: { id: 'app-section', eTag: 'app-etag' } });
  };
  t.after(() => { global.fetch = originalFetch; });

  const saved = await saveSharedJobDetailsSection({
    accessToken: 'token',
    job: { number: '24001' },
    section: { id: 'brief-sx12', title: 'SX12' },
    brief: 'Legacy brief content',
    updatedBy: 'Patrick Carroll',
    itemId: 'legacy-section',
    eTag: 'legacy-etag',
    storageScope: 'legacy-root',
  });
  assert.match(calls[0].url, /items\/sections-test:.*brief-sx12\.json.*content/);
  assert.equal(calls[0].options.headers['If-Match'], undefined);
  assert.equal(saved.itemId, 'app-section');
  assert.equal(saved.storageScope, 'app-data');
});

test('Job Details section conflicts load the latest member update', async (t) => {
  const originalFetch = global.fetch;
  const responses = [
    response({ status: 412 }),
    response({ status: 200, json: { id: 'section-item', eTag: 'section-etag-latest' } }),
    response({
      status: 200,
      text: JSON.stringify({
        jobNumber: '24001',
        sectionId: 'gfm',
        title: 'GFM',
        brief: 'Latest GFM brief',
        updatedBy: 'Liam B',
      }),
    }),
  ];
  global.fetch = async () => responses.shift();
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    saveSharedJobDetailsSection({
      accessToken: 'token',
      job: { number: '24001' },
      section: { id: 'gfm', title: 'GFM' },
      brief: 'Stale GFM brief',
      updatedBy: 'Patrick Carroll',
      itemId: 'section-item',
      eTag: 'section-etag-old',
    }),
    (error) => {
      assert.equal(error.code, 'JOB_DETAILS_SECTION_CONFLICT');
      assert.equal(error.latest.eTag, 'section-etag-latest');
      assert.equal(error.latest.brief, 'Latest GFM brief');
      assert.equal(error.latest.updatedBy, 'Liam B');
      return true;
    },
  );
});
