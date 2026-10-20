require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildJobFileCacheName,
  hasJobFileRevisionIdentity,
  isCompleteJobFileDownload,
  isManagedJobWorkspaceFile,
  isSecureMicrosoftTransferUrl,
  isTrustedJobFileWebUrl,
  jobFilesJobKey,
  sanitiseJobFileName,
  validateJobFileUploadSource,
} = require('../src/features/jobFiles/jobFilesRules');
const {
  isPrivateCacheFile,
  JOB_FILES_DOWNLOAD_CACHE_DIRECTORY,
  jobFilesPersistentDownloadDirectory,
} = require('../src/services/security/privateFileCache');
const {
  clearActiveAccountId,
  setActiveAccountId,
} = require('../src/services/account/accountIdentity');
const {
  clearJobFilesLocationCache,
  createJobFilesWorkspace,
  listJobFiles,
  moveJobItem,
  resolveJobAppDataLocation,
  updateJobTextFile,
} = require('../src/features/jobFiles/jobFilesService');
const {
  formatJobFileText,
  isTextJobFile,
  MAX_TEXT_PREVIEW_BYTES,
} = require('../src/features/jobFiles/jobFilePreview');
const { buildDxfPreviewHtml } = require('../src/features/jobFiles/jobCadPreview');

const graphResponse = ({ status = 200, json = {} }) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: () => null },
  json: async () => json,
  text: async () => JSON.stringify(json),
});

test('Job Files job identity changes with the SharePoint folder identity', () => {
  assert.equal(
    jobFilesJobKey({ number: '205127', name: 'TMR', location: 'Miriam Vale' }),
    '205127|tmr|miriam vale',
  );
  assert.notEqual(
    jobFilesJobKey({ number: '205127', name: 'TMR', location: 'Miriam Vale' }),
    jobFilesJobKey({ number: '205128', name: 'TMR', location: 'Miriam Vale' }),
  );
});

test('NorthGroup ONE App Data remains hidden from the crew Job Files list', () => {
  assert.equal(isManagedJobWorkspaceFile({
    name: 'NorthGroup ONE App Data',
    folder: {},
  }), true);
  assert.equal(isManagedJobWorkspaceFile({
    name: 'NorthGroup ONE Job Progress.json',
    file: {},
  }), true);
  assert.equal(isManagedJobWorkspaceFile({
    name: 'Workspace Overview.json',
    file: {},
  }), true);
  assert.equal(isManagedJobWorkspaceFile({
    name: 'Plans',
    folder: {},
  }), false);
});

test('each job automatically resolves one App Data folder and one Sections child', async (t) => {
  clearJobFilesLocationCache();
  const originalFetch = global.fetch;
  const calls = [];
  const responses = [
    graphResponse({ json: { id: 'site-test', displayName: 'NorthGroup ONE' } }),
    graphResponse({ json: { value: [{ id: 'drive-test', name: 'Job Files' }] } }),
    graphResponse({
      json: { value: [{ id: 'job-folder', name: '205030 - TMR', folder: {} }] },
    }),
    graphResponse({ json: { value: [] } }),
    graphResponse({
      json: { id: 'app-data-folder', name: 'NorthGroup ONE App Data', folder: {} },
    }),
    graphResponse({ json: { value: [] } }),
    graphResponse({ json: { id: 'sections-folder', name: 'Sections', folder: {} } }),
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  };
  t.after(() => {
    clearJobFilesLocationCache();
    global.fetch = originalFetch;
  });

  const [location, concurrent] = await Promise.all([
    resolveJobAppDataLocation({
      accessToken: 'token',
      job: { number: '205030', name: 'TMR' },
    }),
    resolveJobAppDataLocation({
      accessToken: 'token',
      job: { number: '205030', name: 'TMR' },
    }),
  ]);
  assert.equal(location.jobFolder.id, 'job-folder');
  assert.equal(location.appDataFolder.id, 'app-data-folder');
  assert.equal(location.sectionsFolder.id, 'sections-folder');
  assert.equal(concurrent.sectionsFolder.id, 'sections-folder');
  assert.equal(calls.filter((call) => call.options.method === 'POST').length, 2);

  const cached = await resolveJobAppDataLocation({
    accessToken: 'token',
    job: { number: '205030', name: 'TMR' },
  });
  assert.equal(cached.sectionsFolder.id, 'sections-folder');
  assert.equal(calls.length, 7);
});

test('download cache names cannot collide across SharePoint items or revisions', () => {
  const shared = {
    jobNumber: '205127',
    driveId: 'drive-a',
  };
  const first = buildJobFileCacheName({
    ...shared,
    item: { id: 'item-1', name: 'Plan.pdf', eTag: 'one' },
  });
  const otherItem = buildJobFileCacheName({
    ...shared,
    item: { id: 'item-2', name: 'Plan.pdf', eTag: 'one' },
  });
  const newRevision = buildJobFileCacheName({
    ...shared,
    item: { id: 'item-1', name: 'Plan.pdf', eTag: 'two' },
  });

  assert.notEqual(first, otherItem);
  assert.notEqual(first, newRevision);
  assert.match(first, /^205127-[a-z0-9]+-Plan\.pdf$/);
});

test('persistent Job Files downloads are isolated inside the active account workspace', () => {
  clearActiveAccountId();
  assert.throws(jobFilesPersistentDownloadDirectory, /profile setup/i);

  try {
    setActiveAccountId('Patrick.Carroll@NorthGroup.com.au');
    const firstDirectory = jobFilesPersistentDownloadDirectory();
    assert.equal(
      firstDirectory,
      'file:///documents/Accounts/patrick_carroll_northgroup_com_au/JobFiles/Downloads/',
    );

    setActiveAccountId('another-user');
    assert.notEqual(jobFilesPersistentDownloadDirectory(), firstDirectory);
  } finally {
    clearActiveAccountId();
  }
});

test('cached Job Files are reused only for identified, complete SharePoint revisions', () => {
  assert.equal(hasJobFileRevisionIdentity({ id: 'item-1', eTag: 'revision-1' }), true);
  assert.equal(hasJobFileRevisionIdentity({ id: 'item-1' }), false);
  assert.equal(hasJobFileRevisionIdentity({ eTag: 'revision-1' }), false);

  assert.equal(isCompleteJobFileDownload({
    fileInfo: { exists: true, isDirectory: false, size: 2400 },
    expectedSize: 2400,
  }), true);
  assert.equal(isCompleteJobFileDownload({
    fileInfo: { exists: true, isDirectory: false, size: 2399 },
    expectedSize: 2400,
  }), false);
  assert.equal(isCompleteJobFileDownload({
    fileInfo: { exists: true, isDirectory: false, size: 0 },
    expectedSize: 0,
  }), false);
});

test('local file names remove unsafe path characters and preserve extensions', () => {
  assert.equal(sanitiseJobFileName('  Field/Plan:*?.pdf  '), 'Field_Plan___.pdf');
  assert.equal(sanitiseJobFileName('...'), 'Job file');
  assert.ok(sanitiseJobFileName(`${'a'.repeat(220)}.pdf`).endsWith('.pdf'));
});

test('upload validation rejects unavailable, empty and oversized files', () => {
  assert.throws(
    () => validateJobFileUploadSource({
      asset: { uri: 'file:///missing.pdf', name: 'Missing.pdf' },
      fileInfo: { exists: false, size: 100 },
      maxBytes: 1000,
    }),
    /no longer available/i,
  );
  assert.throws(
    () => validateJobFileUploadSource({
      asset: { uri: 'file:///empty.pdf', name: 'Empty.pdf' },
      fileInfo: { exists: true, size: 0 },
      maxBytes: 1000,
    }),
    /empty/i,
  );
  assert.throws(
    () => validateJobFileUploadSource({
      asset: { uri: 'file:///large.pdf', name: 'Large.pdf', size: 2000 },
      fileInfo: { exists: true, size: 1500 },
      maxBytes: 1000,
    }),
    /larger than/i,
  );
});

test('upload validation returns a safe name and trusts the larger known size', () => {
  assert.deepEqual(
    validateJobFileUploadSource({
      asset: { uri: 'file:///plan.pdf', name: 'Field/Plan.pdf', size: 20 },
      fileInfo: { exists: true, isDirectory: false, size: 25 },
      maxBytes: 1000,
    }),
    { name: 'Field_Plan.pdf', size: 25 },
  );
});

test('Job Files opens only secure NorthGroup SharePoint browser links', () => {
  assert.equal(
    isTrustedJobFileWebUrl('https://northsurveys.sharepoint.com/sites/NorthGroupONE/file.pdf'),
    true,
  );
  assert.equal(isTrustedJobFileWebUrl('http://northsurveys.sharepoint.com/file.pdf'), false);
  assert.equal(isTrustedJobFileWebUrl('https://northsurveys.sharepoint.com.evil.test/file.pdf'), false);
  assert.equal(isTrustedJobFileWebUrl('https://evil.test/file.pdf'), false);
});

test('preauthenticated Microsoft transfers must remain on secure transport', () => {
  assert.equal(isSecureMicrosoftTransferUrl('https://tenant.sharepoint.com/download?id=1'), true);
  assert.equal(isSecureMicrosoftTransferUrl('http://tenant.sharepoint.com/download?id=1'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://user:secret@tenant.sharepoint.com/file'), false);
});

test('moving a Job Files item updates only its SharePoint parent folder', async (t) => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return graphResponse({ json: { id: 'item-1', name: 'Plan.txt' } });
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  await moveJobItem({
    accessToken: 'token',
    driveId: 'drive-test',
    itemId: 'item-1',
    destinationFolderId: 'folder-2',
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/drives\/drive-test\/items\/item-1$/);
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    parentReference: { id: 'folder-2' },
  });

  await assert.rejects(
    moveJobItem({
      accessToken: 'token',
      driveId: 'drive-test',
      itemId: 'folder-2',
      destinationFolderId: 'folder-2',
    }),
    /cannot be moved into itself/i,
  );
});

test('a missing job folder is identified and can be created at the library root', async (t) => {
  clearJobFilesLocationCache();
  const originalFetch = global.fetch;
  const calls = [];
  const responses = [
    graphResponse({ json: { id: 'site-test', displayName: 'NorthGroup ONE' } }),
    graphResponse({ json: { value: [{ id: 'drive-test', name: 'Job Files' }] } }),
    graphResponse({ json: { value: [] } }),
  ];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return responses.shift();
  };
  t.after(() => {
    clearJobFilesLocationCache();
    global.fetch = originalFetch;
  });

  await assert.rejects(
    listJobFiles({ accessToken: 'token', job: { number: '205127', name: 'TMR', location: 'Miriam Vale' } }),
    (error) => error.code === 'JOB_FILES_FOLDER_NOT_FOUND'
      && error.expectedFolderName === '205127 - TMR - Miriam Vale',
  );

  responses.push(
    graphResponse({ json: { id: 'site-test', displayName: 'NorthGroup ONE' } }),
    graphResponse({ json: { value: [{ id: 'drive-test', name: 'Job Files' }] } }),
    graphResponse({ json: { value: [] } }),
    graphResponse({ json: { id: 'folder-new', name: '205127 - TMR - Miriam Vale', folder: {} } }),
  );
  const created = await createJobFilesWorkspace({
    accessToken: 'token',
    job: { number: '205127', name: 'TMR', location: 'Miriam Vale' },
    name: '205127 - TMR - Miriam Vale',
  });

  assert.equal(created.created, true);
  assert.equal(created.folder.id, 'folder-new');
  const createCall = calls.find((call) => call.options.method === 'POST');
  assert.match(createCall.url, /\/drives\/drive-test\/root\/children$/);
  assert.equal(JSON.parse(createCall.options.body).name, '205127 - TMR - Miriam Vale');
});

test('job workspace folder names must retain the active job number', async () => {
  await assert.rejects(
    createJobFilesWorkspace({
      accessToken: 'token',
      job: { number: '205127', name: 'TMR' },
      name: 'Wrong folder',
    }),
    /must begin with job number 205127/i,
  );
});

test('text edits use revision protection and preserve concurrent SharePoint changes', async (t) => {
  const originalFetch = global.fetch;
  const fileSystem = require('expo-file-system/legacy');
  const originalGetInfo = fileSystem.getInfoAsync;
  const originalCreateUploadTask = fileSystem.createUploadTask;
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url, options });
    return graphResponse({ json: { uploadUrl: 'https://northsurveys.sharepoint.com/upload/session-1' } });
  };
  fileSystem.getInfoAsync = async () => ({ exists: true, isDirectory: false, size: 19 });
  fileSystem.createUploadTask = () => ({
    uploadAsync: async () => ({
      status: 200,
      body: JSON.stringify({ id: 'item-1', name: 'notes.txt', eTag: 'revision-2' }),
    }),
  });
  t.after(() => {
    global.fetch = originalFetch;
    fileSystem.getInfoAsync = originalGetInfo;
    fileSystem.createUploadTask = originalCreateUploadTask;
  });

  const updated = await updateJobTextFile({
    accessToken: 'token',
    driveId: 'drive-test',
    itemId: 'item-1',
    content: 'updated field notes',
    eTag: 'revision-1',
    mimeType: 'text/plain',
  });
  assert.equal(updated.eTag, 'revision-2');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['If-Match'], 'revision-1');
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    item: { '@microsoft.graph.conflictBehavior': 'replace' },
  });
  assert.match(calls[0].url, /\/items\/item-1\/createUploadSession$/);

  global.fetch = async () => graphResponse({ status: 412, json: { error: { message: 'changed' } } });
  await assert.rejects(
    updateJobTextFile({
      accessToken: 'token',
      driveId: 'drive-test',
      itemId: 'item-1',
      content: 'stale edit',
      eTag: 'revision-1',
      mimeType: 'text/plain',
    }),
    (error) => error.code === 'JOB_FILE_EDIT_CONFLICT',
  );
});

test('Job Files previews common lightweight text formats and formats JSON safely', () => {
  assert.equal(isTextJobFile({ name: 'notes.md', file: {} }), true);
  assert.equal(isTextJobFile({ name: 'settings.yaml', file: {} }), true);
  assert.equal(isTextJobFile({ name: 'points.csv', file: {} }), true);
  assert.equal(isTextJobFile({ name: 'boundary.kml', file: {} }), true);
  assert.equal(isTextJobFile({ name: 'drawing.dwg', file: {} }), false);
  assert.equal(isTextJobFile({ name: 'data', file: { mimeType: 'application/json' } }), true);
  assert.equal(MAX_TEXT_PREVIEW_BYTES, 2 * 1024 * 1024);
  assert.equal(formatJobFileText('{"name":"Field"}', 'details.json'), '{\n  "name": "Field"\n}');
  assert.equal(formatJobFileText('{invalid', 'details.json'), '{invalid');
  assert.equal(formatJobFileText('\uFEFFHeading', 'notes.md'), 'Heading');
});

test('the mobile DXF viewer renders common survey drawing entities without a network service', () => {
  const dxf = [
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LINE', '10', '0', '20', '0', '11', '100', '21', '50',
    '0', 'CIRCLE', '10', '25', '20', '25', '40', '10',
    '0', 'LWPOLYLINE', '70', '1', '10', '0', '20', '0', '10', '10', '20', '0', '10', '10', '20', '10',
    '0', 'ENDSEC', '0', 'EOF',
  ].join('\n');
  const html = buildDxfPreviewHtml(dxf);
  assert.match(html, /"type":"line"/);
  assert.match(html, /"type":"circle"/);
  assert.match(html, /"type":"polyline"/);
  assert.match(html, /touch-action:none/);
});

test('private cache cleanup refuses paths outside its assigned directory', () => {
  assert.equal(
    isPrivateCacheFile(`${JOB_FILES_DOWNLOAD_CACHE_DIRECTORY}205127-plan.pdf`, JOB_FILES_DOWNLOAD_CACHE_DIRECTORY),
    true,
  );
  assert.equal(
    isPrivateCacheFile('file:///documents/205127-plan.pdf', JOB_FILES_DOWNLOAD_CACHE_DIRECTORY),
    false,
  );
  assert.equal(
    isPrivateCacheFile(`${JOB_FILES_DOWNLOAD_CACHE_DIRECTORY}%2E%2E/escape.pdf`, JOB_FILES_DOWNLOAD_CACHE_DIRECTORY),
    false,
  );
});
