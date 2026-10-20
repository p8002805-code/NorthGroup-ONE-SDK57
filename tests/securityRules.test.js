require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isTrustedBomWebUrl,
  isSecureMicrosoftTransferUrl,
  isTrustedTeamsWebUrl,
} = require('../src/services/security/trustedExternalUrl');

test('Teams browser links accept only secure Microsoft Teams hosts', () => {
  assert.equal(isTrustedTeamsWebUrl('https://teams.microsoft.com/l/message/19:abc'), true);
  assert.equal(isTrustedTeamsWebUrl('https://au.teams.cloud.microsoft/chat/abc'), true);
  assert.equal(isTrustedTeamsWebUrl('http://teams.microsoft.com/l/message/19:abc'), false);
  assert.equal(isTrustedTeamsWebUrl('https://teams.microsoft.com.evil.test/phish'), false);
  assert.equal(isTrustedTeamsWebUrl('https://user:secret@teams.microsoft.com/chat'), false);
});

test('BOM radar navigation cannot leave official secure BOM hosts', () => {
  assert.equal(isTrustedBomWebUrl('https://www.bom.gov.au/weather-and-climate/rain-radar'), true);
  assert.equal(isTrustedBomWebUrl('https://reg.bom.gov.au/products/IDR663.loop.shtml'), true);
  assert.equal(isTrustedBomWebUrl('http://www.bom.gov.au/weather'), false);
  assert.equal(isTrustedBomWebUrl('https://bom.gov.au.evil.test/weather'), false);
});

test('preauthenticated transfers cannot target the device, local network or insecure ports', () => {
  assert.equal(isSecureMicrosoftTransferUrl('https://northsurveys.sharepoint.com/download?id=1'), true);
  assert.equal(isSecureMicrosoftTransferUrl('https://sn3302.up.1drv.com/up/session'), true);
  assert.equal(isSecureMicrosoftTransferUrl('https://b0mpua-by3301.files.1drv.com/file'), true);
  assert.equal(isSecureMicrosoftTransferUrl('https://download.spo.svc.ms/file'), true);
  assert.equal(isSecureMicrosoftTransferUrl('https://spoprod-a.akamaihd.net/file'), true);
  assert.equal(isSecureMicrosoftTransferUrl('https://storage.live.com/file'), true);
  assert.equal(isSecureMicrosoftTransferUrl('https://storage.example.test:443/object'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://download.spo.svc.ms.evil.test/file'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://northsurveys.sharepoint.com.evil.test/file'), false);
  assert.equal(isSecureMicrosoftTransferUrl('http://northsurveys.sharepoint.com/download'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://user:secret@example.test/download'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://127.0.0.1/private'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://192.168.1.20/file'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://[::1]/private'), false);
  assert.equal(isSecureMicrosoftTransferUrl('https://example.test:8443/file'), false);
});
