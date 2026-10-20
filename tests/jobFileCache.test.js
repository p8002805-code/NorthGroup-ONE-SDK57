require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const { fileSystemMock } = require('../tools/testSupport/registerAppModules');
const { setActiveAccountId, clearActiveAccountId } = require('../src/services/account/accountIdentity');
const {
  findReusableJobFile,
  jobFileDownloadDirectory,
} = require('../src/features/jobFiles/jobFileCache');

const ITEM = {
  id: 'sharepoint-item-1',
  name: 'Field plan.pdf',
  eTag: 'revision-7',
  lastModifiedDateTime: '2026-08-13T08:00:00Z',
  size: 4096,
};

test('a complete protected SharePoint revision reopens without a network request', async () => {
  const originalGetInfo = fileSystemMock.getInfoAsync;
  setActiveAccountId('cache-test-user');
  try {
    const directory = jobFileDownloadDirectory(true);
    let inspectedUri = '';
    fileSystemMock.getInfoAsync = async (uri) => {
      inspectedUri = uri;
      return { exists: true, isDirectory: false, size: 4096 };
    };

    const localUri = await findReusableJobFile({
      directory,
      jobNumber: '205127',
      driveId: 'drive-1',
      item: ITEM,
    });

    assert.equal(localUri, inspectedUri);
    assert.ok(localUri.startsWith('file:///documents/Accounts/cache-test-user/'));
    assert.ok(localUri.endsWith('-Field plan.pdf'));
  } finally {
    fileSystemMock.getInfoAsync = originalGetInfo;
    clearActiveAccountId();
  }
});

test('an incomplete cached revision is removed instead of being displayed', async () => {
  const originalGetInfo = fileSystemMock.getInfoAsync;
  const originalDelete = fileSystemMock.deleteAsync;
  setActiveAccountId('cache-test-user');
  try {
    const removed = [];
    fileSystemMock.getInfoAsync = async () => ({
      exists: true,
      isDirectory: false,
      size: 2048,
    });
    fileSystemMock.deleteAsync = async (uri) => { removed.push(uri); };

    const localUri = await findReusableJobFile({
      directory: jobFileDownloadDirectory(true),
      jobNumber: '205127',
      driveId: 'drive-1',
      item: ITEM,
    });

    assert.equal(localUri, '');
    assert.equal(removed.length, 1);
  } finally {
    fileSystemMock.getInfoAsync = originalGetInfo;
    fileSystemMock.deleteAsync = originalDelete;
    clearActiveAccountId();
  }
});
