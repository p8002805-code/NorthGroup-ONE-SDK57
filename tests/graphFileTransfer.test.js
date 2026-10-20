require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  fileSystemMock,
} = require('../tools/testSupport/registerAppModules');
const {
  createAuthenticatedGraphUploadTask,
  downloadAuthenticatedGraphFile,
  downloadMicrosoftGraphFile,
} = require('../src/services/sync/graphFileTransfer');

test('Graph file uploads centralise and protect bearer authentication', (t) => {
  const original = fileSystemMock.createUploadTask;
  let captured = null;
  fileSystemMock.createUploadTask = (...args) => {
    captured = args;
    return { uploadAsync: async () => ({ status: 200, body: '{}' }) };
  };
  t.after(() => { fileSystemMock.createUploadTask = original; });

  createAuthenticatedGraphUploadTask({
    accessToken: 'real-token',
    urlOrPath: '/me/drive/root:/test.txt:/content',
    fileUri: 'file:///cache/test.txt',
    options: {
      headers: {
        Authorization: 'Bearer attacker-token',
        authorization: 'Bearer attacker-token-lowercase',
        AUTHORIZATION: 'Bearer attacker-token-uppercase',
        Cookie: 'session=should-not-leave',
        Host: 'evil.test',
        'Content-Type': 'text/plain',
      },
    },
  });

  assert.equal(captured[0], 'https://graph.microsoft.com/v1.0/me/drive/root:/test.txt:/content');
  assert.equal(captured[1], 'file:///cache/test.txt');
  assert.equal(captured[2].headers.Authorization, 'Bearer real-token');
  assert.equal(captured[2].headers.authorization, undefined);
  assert.equal(captured[2].headers.AUTHORIZATION, undefined);
  assert.equal(captured[2].headers.Cookie, undefined);
  assert.equal(captured[2].headers.Host, undefined);
  assert.equal(captured[2].headers['Content-Type'], 'text/plain');
});

test('Graph file transfers reject missing credentials and untrusted origins', () => {
  assert.throws(
    () => createAuthenticatedGraphUploadTask({
      accessToken: '',
      urlOrPath: '/me/drive/root:/test.txt:/content',
      fileUri: 'file:///cache/test.txt',
    }),
    /sign in with microsoft/i,
  );

  assert.throws(
    () => downloadAuthenticatedGraphFile({
      accessToken: 'real-token',
      urlOrPath: 'https://evil.test/collect',
      destination: 'file:///cache/download.txt',
    }),
    /untrusted request address/i,
  );

  assert.throws(
    () => createAuthenticatedGraphUploadTask({
      accessToken: 'valid-token\r\nX-Attack: true',
      urlOrPath: '/me/drive/root:/test.txt:/content',
      fileUri: 'file:///cache/test.txt',
    }),
    /sign in with microsoft/i,
  );
});

test('Graph file downloads attach authentication only after URL validation', async (t) => {
  const original = fileSystemMock.downloadAsync;
  let captured = null;
  fileSystemMock.downloadAsync = async (...args) => {
    captured = args;
    return { uri: args[1], status: 200, headers: {} };
  };
  t.after(() => { fileSystemMock.downloadAsync = original; });

  await downloadAuthenticatedGraphFile({
    accessToken: 'download-token',
    urlOrPath: '/me/photo/$value',
    destination: 'file:///cache/photo.jpg',
    options: { headers: { Accept: 'image/*' } },
  });

  assert.equal(captured[0], 'https://graph.microsoft.com/v1.0/me/photo/$value');
  assert.equal(captured[2].headers.Authorization, 'Bearer download-token');
  assert.equal(captured[2].headers.Accept, 'image/*');
});

test('Microsoft preauthenticated downloads never receive the Graph bearer token', async (t) => {
  const original = fileSystemMock.downloadAsync;
  let captured = null;
  fileSystemMock.downloadAsync = async (...args) => {
    captured = args;
    return { uri: args[1], status: 200, headers: {} };
  };
  t.after(() => { fileSystemMock.downloadAsync = original; });

  await downloadMicrosoftGraphFile({
    accessToken: 'download-token',
    graphUrlOrPath: '/drives/drive-a/items/item-a/content',
    preauthenticatedUrl: 'https://download.spo.svc.ms/file-token',
    destination: 'file:///cache/plan.pdf',
    options: {
      headers: {
        Accept: 'application/pdf',
        Authorization: 'Bearer caller-token',
        Cookie: 'session=caller-cookie',
      },
    },
  });

  assert.equal(captured[0], 'https://download.spo.svc.ms/file-token');
  assert.equal(captured[2].headers.Accept, 'application/pdf');
  assert.equal(captured[2].headers.Authorization, undefined);
  assert.equal(captured[2].headers.Cookie, undefined);
});

test('unknown Microsoft delivery hosts fall back to authenticated Graph content', async (t) => {
  const original = fileSystemMock.downloadAsync;
  let captured = null;
  fileSystemMock.downloadAsync = async (...args) => {
    captured = args;
    return { uri: args[1], status: 200, headers: {} };
  };
  t.after(() => { fileSystemMock.downloadAsync = original; });

  await downloadMicrosoftGraphFile({
    accessToken: 'download-token',
    graphUrlOrPath: '/drives/drive-a/items/item-a/content',
    preauthenticatedUrl: 'https://new-delivery-host.example.test/file-token',
    destination: 'file:///cache/plan.pdf',
    options: { headers: { Accept: 'application/pdf' } },
  });

  assert.equal(captured[0], 'https://graph.microsoft.com/v1.0/drives/drive-a/items/item-a/content');
  assert.equal(captured[2].headers.Authorization, 'Bearer download-token');
  assert.equal(captured[2].headers.Accept, 'application/pdf');
});

test('expired Microsoft delivery links retry through authenticated Graph content', async (t) => {
  const original = fileSystemMock.downloadAsync;
  const captured = [];
  fileSystemMock.downloadAsync = async (...args) => {
    captured.push(args);
    return {
      uri: args[1],
      status: captured.length === 1 ? 403 : 200,
      headers: {},
    };
  };
  t.after(() => { fileSystemMock.downloadAsync = original; });

  const result = await downloadMicrosoftGraphFile({
    accessToken: 'download-token',
    graphUrlOrPath: '/drives/drive-a/items/item-a/content',
    preauthenticatedUrl: 'https://tenant.sharepoint.com/expired-token',
    destination: 'file:///cache/plan.pdf',
    options: { headers: { Accept: 'application/pdf' } },
  });

  assert.equal(result.status, 200);
  assert.equal(captured.length, 2);
  assert.equal(captured[0][0], 'https://tenant.sharepoint.com/expired-token');
  assert.equal(captured[0][2].headers.Authorization, undefined);
  assert.equal(captured[1][0], 'https://graph.microsoft.com/v1.0/drives/drive-a/items/item-a/content');
  assert.equal(captured[1][2].headers.Authorization, 'Bearer download-token');
});
