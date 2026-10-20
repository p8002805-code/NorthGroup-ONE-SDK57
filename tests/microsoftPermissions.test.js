require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertMicrosoftScopes,
  grantedMicrosoftScopes,
  missingMicrosoftScopes,
  normaliseMicrosoftScopes,
} = require('../src/features/auth/microsoftScopeState');
const {
  assignedMemberProfilesResolved,
  mergeAssignedMemberProfiles,
} = require('../src/features/chat/jobChatMembers');
const {
  MICROSOFT_SCOPES,
} = require('../src/features/auth/microsoftConfig');

test('Microsoft consent omits scopes already superseded by stronger requested permissions', () => {
  assert.equal(MICROSOFT_SCOPES.includes('Files.ReadWrite.All'), true);
  assert.equal(MICROSOFT_SCOPES.includes('Files.ReadWrite'), false);
  assert.equal(MICROSOFT_SCOPES.includes('Files.Read.All'), false);
  assert.equal(MICROSOFT_SCOPES.includes('Chat.Read'), false);
});

test('Microsoft scope checks use the scopes actually returned by the token', () => {
  const granted = grantedMicrosoftScopes(
    { scope: 'User.Read User.ReadBasic.All Chat.ReadWrite' },
    ['User.Read'],
  );
  assert.deepEqual(granted, ['user.read', 'user.readbasic.all', 'chat.readwrite']);
  assert.deepEqual(missingMicrosoftScopes(granted, ['User.ReadBasic.All']), []);
  assert.doesNotThrow(() => assertMicrosoftScopes(granted, ['User.ReadBasic.All']));
});

test('Microsoft scope checks reject a refreshed token that omitted directory access', () => {
  const granted = normaliseMicrosoftScopes('User.Read Chat.ReadWrite');
  assert.deepEqual(missingMicrosoftScopes(granted, ['User.ReadBasic.All']), ['user.readbasic.all']);
  assert.throws(
    () => assertMicrosoftScopes(granted, ['User.ReadBasic.All']),
    /assigned-employee permission/i,
  );
});

test('Teams chat members fill assigned names when directory consent is still propagating', () => {
  const merged = mergeAssignedMemberProfiles(
    [
      { id: 'user-a', displayName: 'Assigned employee 1', email: '', directoryResolved: false },
      { id: 'user-b', displayName: 'Bailey Brown', email: 'bailey@example.com', directoryResolved: true },
    ],
    [
      { userId: 'user-a', displayName: 'Alex Avery', email: 'alex@example.com' },
      { userId: 'user-b', displayName: 'Bailey Brown', email: 'bailey@example.com' },
    ],
  );

  assert.equal(merged[0].displayName, 'Alex Avery');
  assert.equal(merged[0].identitySource, 'teams-chat');
  assert.equal(assignedMemberProfilesResolved(merged, 2), true);
});
