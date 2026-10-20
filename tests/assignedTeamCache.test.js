require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clearActiveAccountId,
  setActiveAccountId,
} = require('../src/services/account/accountIdentity');
const {
  ASSIGNED_TEAM_CACHE_MAX_AGE_MS,
  assignedTeamJobSignature,
  clearAssignedTeamMemoryCache,
  isAssignedTeamCacheFresh,
  readCachedAssignedTeam,
  writeCachedAssignedTeam,
} = require('../src/features/jobs/assignedTeamCache');
const {
  resetTestState,
} = require('../tools/testSupport/registerAppModules');

const job = {
  number: '205127',
  microsoftTeamIds: ['team-b', 'team-a'],
};

const assignment = {
  userIds: ['user-a', 'user-b'],
  members: [
    {
      id: 'user-a',
      displayName: 'Patrick Carroll',
      email: 'pcarroll@northgroup.com.au',
      directoryResolved: true,
    },
    {
      id: 'user-b',
      displayName: 'Matthew Copley',
      email: 'mcopley@northgroup.com.au',
      directoryResolved: true,
    },
  ],
  directoryMembersResolved: true,
  directoryError: '',
};

test.beforeEach(async () => {
  await resetTestState();
  clearAssignedTeamMemoryCache();
  setActiveAccountId('account-one');
});

test.after(() => {
  clearAssignedTeamMemoryCache();
  clearActiveAccountId();
});

test('assigned teams persist per job after the screen memory is cleared', async () => {
  await writeCachedAssignedTeam({
    job,
    assignment,
    now: new Date('2026-08-13T02:00:00.000Z'),
  });
  clearAssignedTeamMemoryCache();

  const cached = await readCachedAssignedTeam({ job });
  assert.equal(cached.jobNumber, '205127');
  assert.deepEqual(cached.teamIds, ['team-a', 'team-b']);
  assert.deepEqual(cached.userIds, ['user-a', 'user-b']);
  assert.equal(cached.members[0].displayName, 'Patrick Carroll');
  assert.equal(cached.directoryMembersResolved, true);
});

test('assigned team caches are isolated between Microsoft accounts', async () => {
  await writeCachedAssignedTeam({ job, assignment });
  clearAssignedTeamMemoryCache();
  setActiveAccountId('account-two');

  assert.equal(await readCachedAssignedTeam({ job }), null);

  setActiveAccountId('account-one');
  const cached = await readCachedAssignedTeam({ job });
  assert.equal(cached.members.length, 2);
});

test('a changed Teams allocation identity does not reuse the previous job cache', async () => {
  await writeCachedAssignedTeam({ job, assignment });
  clearAssignedTeamMemoryCache();

  const changedJob = { ...job, microsoftTeamIds: ['team-c'] };
  assert.notEqual(assignedTeamJobSignature(changedJob), assignedTeamJobSignature(job));
  assert.equal(await readCachedAssignedTeam({ job: changedJob }), null);
});

test('assigned team cache freshness expires after six hours', async () => {
  const cachedAt = '2026-08-13T02:00:00.000Z';
  const cache = { cachedAt };
  const start = Date.parse(cachedAt);

  assert.equal(isAssignedTeamCacheFresh(cache, start + ASSIGNED_TEAM_CACHE_MAX_AGE_MS), true);
  assert.equal(isAssignedTeamCacheFresh(cache, start + ASSIGNED_TEAM_CACHE_MAX_AGE_MS + 1), false);
});

test('an empty but successfully resolved assignment is cached', async () => {
  await writeCachedAssignedTeam({
    job,
    assignment: {
      userIds: [],
      members: [],
      directoryMembersResolved: true,
      directoryError: '',
    },
  });
  clearAssignedTeamMemoryCache();

  const cached = await readCachedAssignedTeam({ job });
  assert.deepEqual(cached.userIds, []);
  assert.equal(cached.directoryMembersResolved, true);
});
