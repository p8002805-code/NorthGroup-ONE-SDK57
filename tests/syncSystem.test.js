require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const { asyncStorageMock } = require('../tools/testSupport/registerAppModules');
const {
  setActiveAccountId,
} = require('../src/services/account/accountIdentity');
const {
  retryAfterMilliseconds,
  shouldRetrySyncRequest,
  syncErrorCode,
  syncErrorMessage,
} = require('../src/services/sync/syncRules');
const {
  loadSyncState,
  resetSyncState,
  trackSyncOperation,
} = require('../src/services/sync/syncState');
const {
  graphFetch,
  graphRequest,
} = require('../src/services/sync/graphClient');

const response = ({ status = 200, body = null, headers = {} } = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (name) => headers[name] || headers[name.toLowerCase()] || '' },
  text: async () => (body == null ? '' : JSON.stringify(body)),
});

test('sync retry rules protect unsafe Microsoft writes', () => {
  assert.equal(shouldRetrySyncRequest({ method: 'GET', status: 503 }), true);
  assert.equal(shouldRetrySyncRequest({ method: 'POST', status: 503 }), false);
  assert.equal(shouldRetrySyncRequest({ method: 'PUT', status: 503 }), false);
  assert.equal(shouldRetrySyncRequest({ method: 'PUT', status: 503, retryMode: 'idempotent' }), true);
  assert.equal(shouldRetrySyncRequest({ method: 'GET', status: 412 }), false);
});

test('sync errors distinguish connection, sign-in, permission and conflicts', () => {
  assert.equal(syncErrorCode(0, { networkError: true }), 'SYNC_OFFLINE');
  assert.equal(syncErrorCode(401), 'SYNC_AUTH');
  assert.equal(syncErrorCode(403), 'SYNC_PERMISSION');
  assert.equal(syncErrorCode(412), 'SYNC_CONFLICT');
  assert.match(syncErrorMessage({ timedOut: true }), /timed out/i);
  assert.match(syncErrorMessage({ networkError: true }), /check your connection/i);
});

test('Retry-After supports seconds and Microsoft HTTP dates', () => {
  assert.equal(retryAfterMilliseconds('2', 1000), 2000);
  assert.equal(retryAfterMilliseconds('Thu, 01 Jan 1970 00:00:05 GMT', 1000), 4000);
  assert.equal(retryAfterMilliseconds('invalid', 1000), 0);
});

test('shared sync state records success, failure and retry-safe feature history', async () => {
  await asyncStorageMock.clear();
  setActiveAccountId('sync-user-one');
  await resetSyncState();

  const value = await trackSyncOperation(
    { feature: 'kml', operation: 'Load KML', jobNumber: '24001' },
    async () => 'ready',
  );
  assert.equal(value, 'ready');

  await assert.rejects(
    trackSyncOperation(
      { feature: 'progress', operation: 'Save Progress', jobNumber: '24001' },
      async () => {
        const error = new Error('Another user saved first.');
        error.status = 412;
        error.code = 'SYNC_CONFLICT';
        throw error;
      },
    ),
    /Another user saved first/,
  );

  const state = await loadSyncState();
  assert.equal(state.totals.succeeded, 1);
  assert.equal(state.totals.failed, 1);
  assert.equal(state.features.kml.lastJobNumber, '24001');
  assert.equal(state.features.progress.lastErrorCode, 'SYNC_CONFLICT');
  assert.equal(state.activeCount, 0);
});

test('shared sync history is isolated by Microsoft account', async () => {
  await asyncStorageMock.clear();
  setActiveAccountId('sync-user-alpha');
  await resetSyncState();
  await trackSyncOperation(
    { feature: 'jobFiles', operation: 'Load files' },
    async () => true,
  );
  assert.equal((await loadSyncState()).totals.succeeded, 1);

  setActiveAccountId('sync-user-bravo');
  const other = await loadSyncState();
  assert.equal(other.totals.succeeded, 0);
  assert.deepEqual(other.features, {});

  setActiveAccountId('sync-user-alpha');
  assert.equal((await loadSyncState()).totals.succeeded, 1);
});

test('Graph client applies shared headers and tracks accepted missing items', async (t) => {
  await asyncStorageMock.clear();
  setActiveAccountId('sync-graph-user');
  await resetSyncState();
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return response({ status: 404 });
  };
  t.after(() => { global.fetch = originalFetch; });

  const result = await graphFetch('/me/drive/root:/missing', 'token-one', {
    headers: {
      AUTHORIZATION: 'Bearer attacker-token',
      Cookie: 'session=unsafe',
      'X-Request-Context': 'safe',
    },
  }, {
    feature: 'jobFiles',
    operation: 'Locate optional file',
    acceptedStatuses: [404],
    maxRetries: 0,
  });
  assert.equal(result.status, 404);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer token-one');
  assert.equal(calls[0].options.headers.AUTHORIZATION, undefined);
  assert.equal(calls[0].options.headers.Cookie, undefined);
  assert.equal(calls[0].options.headers['X-Request-Context'], 'safe');
  assert.equal(calls[0].options.headers.Accept, 'application/json');
  const state = await loadSyncState();
  assert.equal(state.features.jobFiles.succeeded, 1);
  assert.equal(state.features.jobFiles.failed, 0);
});

test('Graph client never sends a bearer token to an untrusted origin', async (t) => {
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    calls += 1;
    return response();
  };
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    graphFetch('https://evil.example/collect', 'sensitive-token'),
    (error) => error?.code === 'SYNC_UNTRUSTED_URL',
  );
  await assert.rejects(
    graphFetch('http://graph.microsoft.com/v1.0/me', 'sensitive-token'),
    (error) => error?.code === 'SYNC_UNTRUSTED_URL',
  );
  assert.equal(calls, 0);
});

test('Graph client does not automatically repeat POST actions', async (t) => {
  await asyncStorageMock.clear();
  setActiveAccountId('sync-post-user');
  await resetSyncState();
  let calls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    calls += 1;
    return response({ status: 503, body: { error: { message: 'Busy' } } });
  };
  t.after(() => { global.fetch = originalFetch; });

  await assert.rejects(
    graphRequest('/chats', 'token-two', { method: 'POST', body: '{}' }, {
      feature: 'jobChat',
      operation: 'Create Job Chat',
      maxRetries: 2,
    }),
    /Busy/,
  );
  assert.equal(calls, 1);
  const state = await loadSyncState();
  assert.equal(state.features.jobChat.failed, 1);
});
