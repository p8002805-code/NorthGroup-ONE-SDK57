require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractHostedContentIds,
  feedImageExtension,
  feedMediaFileName,
} = require('../src/features/chat/teamsChannelService');

test('Feed media extracts stable Microsoft hosted-content ids from message HTML', () => {
  assert.deepEqual(
    extractHostedContentIds([
      '<p>Site photo</p>',
      '<img src="../hostedContents/1/$value">',
      '<img src="https://graph.microsoft.com/v1.0/hostedContents/image%202/$value">',
      '<img src="../hostedContents/1/$value">',
    ].join('')),
    ['1', 'image 2'],
  );
});

test('Feed media creates stable per-account message filenames', () => {
  assert.equal(feedImageExtension('image/png'), 'png');
  assert.equal(feedImageExtension('image/heic'), 'heic');
  assert.equal(feedImageExtension(''), 'jpg');
  assert.equal(
    feedMediaFileName({
      accountId: 'user-123',
      channelKey: 'daily',
      messageId: '1740000000000',
      mimeType: 'image/png',
    }),
    'user-123-daily-1740000000000.png',
  );
});
