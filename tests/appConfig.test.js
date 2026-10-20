const test = require('node:test');
const assert = require('node:assert/strict');

const staticConfig = require('../app.json');
const release = require('../release.json');
const configFactory = require('../app.config.js');

test('resolved Expo config preserves static config and applies secure native release settings', () => {
  assert.equal(typeof configFactory, 'function');
  const resolved = configFactory({ config: staticConfig });

  assert.equal(resolved.name, staticConfig.name);
  assert.deepEqual(resolved.plugins, staticConfig.plugins);
  assert.equal(resolved.version, release.version);
  assert.equal(resolved.ios.buildNumber, release.buildNumber);
  assert.equal(resolved.ios.infoPlist.UIFileSharingEnabled, false);
  assert.equal(resolved.ios.infoPlist.LSSupportsOpeningDocumentsInPlace, false);
  assert.equal(resolved.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoads, false);
  assert.equal(
    resolved.ios.infoPlist.NSAppTransportSecurity.NSAllowsArbitraryLoadsInWebContent,
    false,
  );
  assert.equal(
    resolved.ios.entitlements['com.apple.developer.default-data-protection'],
    'NSFileProtectionComplete',
  );
  assert.equal(resolved.android.allowBackup, false);
});
