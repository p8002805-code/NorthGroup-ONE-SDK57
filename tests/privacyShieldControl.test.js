require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isPrivacyShieldSuspended,
  subscribeToPrivacyShieldSuspension,
  suspendPrivacyShield,
} = require('../src/services/security/privacyShieldControl');

test('Microsoft authentication can temporarily suspend the privacy shield', () => {
  const states = [];
  const unsubscribe = subscribeToPrivacyShieldSuspension((value) => states.push(value));
  const restoreFirst = suspendPrivacyShield();
  const restoreSecond = suspendPrivacyShield();

  assert.equal(isPrivacyShieldSuspended(), true);
  restoreFirst();
  assert.equal(isPrivacyShieldSuspended(), true);
  restoreSecond();
  restoreSecond();
  assert.equal(isPrivacyShieldSuspended(), false);
  assert.deepEqual(states, [false, true, true, true, false]);
  unsubscribe();
});
