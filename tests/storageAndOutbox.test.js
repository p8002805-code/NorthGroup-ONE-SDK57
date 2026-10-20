const {
  asyncStorageMock,
  fileSystemMock,
  resetTestState,
} = require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const { setActiveAccountId } = require('../src/services/account/accountIdentity');
const { jobStorageKey } = require('../src/features/jobs/jobContext');
const { FORM_STATUS_STORAGE_KEY, loadFormStatuses, saveFormStatus } = require('../src/utils/formStatus');
const {
  createJobChatOutboxItem,
  enqueueJobChatOutboxItem,
  jobChatOutboxItemToMessage,
  readJobChatOutbox,
  updateJobChatOutboxItem,
  writeJobChatOutbox,
} = require('../src/features/chat/jobChatOutbox');
const {
  enqueueSurveyPhotoUpload,
  readSurveyPhotoUploadOutbox,
  removeSurveyPhotoUpload,
  surveyPhotoUploadErrorIsRetryable,
  surveyPhotoUploadRetryDelay,
  updateSurveyPhotoUpload,
} = require('../src/features/surveyPhoto/services/surveyPhotoUploadOutbox');

test.beforeEach(async () => {
  await resetTestState();
  setActiveAccountId('Louis.B@example.com');
});

test('form status storage is isolated by active job', async () => {
  const firstJob = { number: '24001' };
  const secondJob = { number: '24002' };
  await saveFormStatus(firstJob, 's500', 'draft', { date: '10/08/2026' });
  await saveFormStatus(secondJob, 's500', 'complete', { date: '10/08/2026' });
  assert.equal((await loadFormStatuses(firstJob)).s500.status, 'draft');
  assert.equal((await loadFormStatuses(secondJob)).s500.status, 'complete');
  assert.notEqual(
    jobStorageKey(FORM_STATUS_STORAGE_KEY, firstJob),
    jobStorageKey(FORM_STATUS_STORAGE_KEY, secondJob),
  );
});

test('invalid stored form statuses are ignored instead of crashing hydration', async () => {
  const job = { number: '24001' };
  await asyncStorageMock.setItem(
    jobStorageKey(FORM_STATUS_STORAGE_KEY, job),
    JSON.stringify({ s500: { status: 'mystery' }, se14: { status: 'draft', date: '10/08/2026' } }),
  );
  assert.deepEqual(await loadFormStatuses(job), {
    se14: { status: 'draft', date: '10/08/2026', completedAt: null, updatedAt: null },
  });
});

test('job chat outbox queues and updates pending messages', async () => {
  const job = { number: '24001' };
  const item = createJobChatOutboxItem({
    chatId: 'chat-1',
    senderId: 'user-1',
    senderName: 'Louis B',
    text: 'Field update',
    attachments: [{ id: 'photo-1', name: 'SX12.jpg' }],
  });
  await enqueueJobChatOutboxItem({ accountId: 'user-1', job, item });
  let queued = await readJobChatOutbox({ accountId: 'user-1', job });
  assert.equal(queued.length, 1);
  assert.equal(queued[0].status, 'queued');
  queued = await updateJobChatOutboxItem({
    accountId: 'user-1',
    job,
    itemId: item.id,
    changes: { status: 'uploading', progress: 55 },
  });
  assert.equal(queued[0].progress, 55);
  assert.equal(jobChatOutboxItemToMessage(queued[0]).attachments[0].uploadProgress, 55);
});

test('interrupted job chat uploads recover as queued after restart', async () => {
  const job = { number: '24001' };
  const item = {
    ...createJobChatOutboxItem({ chatId: 'chat-1', text: 'Retry me' }),
    status: 'uploading',
    progress: 72,
    nextRetryAt: Date.now() + 10000,
  };
  await writeJobChatOutbox({ accountId: 'user-1', job, items: [item] });
  const recovered = await readJobChatOutbox({ accountId: 'user-1', job });
  assert.equal(recovered[0].status, 'queued');
  assert.equal(recovered[0].progress, 0);
  assert.equal(recovered[0].nextRetryAt, 0);
});

test('job chat outbox is isolated by job number', async () => {
  const item = createJobChatOutboxItem({ chatId: 'chat-1', text: 'Only job 24001' });
  await enqueueJobChatOutboxItem({ accountId: 'user-1', job: { number: '24001' }, item });
  assert.equal((await readJobChatOutbox({ accountId: 'user-1', job: { number: '24001' } })).length, 1);
  assert.equal((await readJobChatOutbox({ accountId: 'user-1', job: { number: '24002' } })).length, 0);
});

test('survey photo uploads are copied into a durable account outbox before upload', async () => {
  const originalGetInfo = fileSystemMock.getInfoAsync;
  const originalCopy = fileSystemMock.copyAsync;
  const originalMove = fileSystemMock.moveAsync;
  const knownFiles = new Set(['file:///cache/Photo_1001.jpg']);
  fileSystemMock.getInfoAsync = async (uri) => ({
    exists: knownFiles.has(uri),
    isDirectory: false,
    size: knownFiles.has(uri) ? 1024 : 0,
  });
  fileSystemMock.copyAsync = async ({ to }) => { knownFiles.add(to); };
  fileSystemMock.moveAsync = async ({ from, to }) => {
    knownFiles.delete(from);
    knownFiles.add(to);
  };

  try {
    const item = await enqueueSurveyPhotoUpload({
      job: { number: '24001', name: 'TMR', location: 'Miriam Vale' },
      initials: 'LB',
      kind: 'photo',
      asset: {
        uri: 'file:///cache/Photo_1001.jpg',
        name: 'LB_1001_Sign.jpg',
        mimeType: 'image/jpeg',
      },
    });
    assert.match(item.asset.uri, /^file:\/\/\/documents\/Accounts\/louis_b_example_com\/SurveyPhotoUploadOutbox\//);
    assert.equal(item.status, 'queued');
    assert.equal((await readSurveyPhotoUploadOutbox()).length, 1);

    await updateSurveyPhotoUpload(item.id, { status: 'uploading', progress: 0.7 });
    const recovered = await readSurveyPhotoUploadOutbox();
    assert.equal(recovered[0].status, 'queued');
    assert.equal(recovered[0].progress, 0);

    const removed = await removeSurveyPhotoUpload(item.id);
    assert.equal(removed.removed.id, item.id);
    assert.equal(removed.items.length, 0);
  } finally {
    fileSystemMock.getInfoAsync = originalGetInfo;
    fileSystemMock.copyAsync = originalCopy;
    fileSystemMock.moveAsync = originalMove;
  }
});

test('survey photo upload retry policy backs off only transient failures', () => {
  assert.equal(surveyPhotoUploadRetryDelay(1), 30000);
  assert.equal(surveyPhotoUploadRetryDelay(3), 120000);
  assert.equal(surveyPhotoUploadRetryDelay(20), 900000);
  assert.equal(surveyPhotoUploadErrorIsRetryable({ code: 'SYNC_OFFLINE' }), true);
  assert.equal(surveyPhotoUploadErrorIsRetryable({ status: 503 }), true);
  assert.equal(surveyPhotoUploadErrorIsRetryable({ status: 403 }), false);
  assert.equal(surveyPhotoUploadErrorIsRetryable({ code: 'SYNC_AUTH' }), false);
  assert.equal(surveyPhotoUploadErrorIsRetryable({ code: 'UPLOAD_FILE_MISSING' }), false);
});
