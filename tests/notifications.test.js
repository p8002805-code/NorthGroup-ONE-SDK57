const { resetTestState } = require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  describePhotoUploadGroup,
  describeWorkspaceChange,
  isJobProgressWorkspaceItem,
  isOwnWorkspaceChange,
  photoZipUploadInfo,
} = require('../src/features/notifications/notificationActivityRules');
const {
  addNotification,
  loadNotifications,
} = require('../src/features/notifications/notificationService');
const {
  formatNotificationTime,
} = require('../src/features/notifications/notificationTime');
const { setActiveAccountId } = require('../src/services/account/accountIdentity');
const {
  publishProgressCompletions,
} = require('../src/features/jobs/progressCompletionService');

const job = { number: '205127', name: 'TMR' };

const changedFile = (name, overrides = {}) => ({
  id: `item-${name}`,
  name,
  file: { mimeType: 'application/octet-stream' },
  createdDateTime: '2026-08-12T10:00:00.000Z',
  lastModifiedDateTime: '2026-08-12T10:00:05.000Z',
  lastModifiedBy: {
    user: { id: 'team-user', displayName: 'Matthew Copley' },
  },
  ...overrides,
});

test('job brief changes become direct Workspace notifications', () => {
  const activity = describeWorkspaceChange(
    changedFile('NorthGroup ONE Job Details.json'),
    job,
  );
  assert.equal(activity.target, 'TodaysJob');
  assert.equal(activity.icon, 'create-outline');
  assert.match(activity.title, /205127 · TMR · Brief updated/);
  assert.match(activity.message, /Matthew Copley edited the shared job brief/);
  assert.deepEqual(activity.targetParams, { focus: 'jobDetails', jobDetailsSectionId: 'overview' });
});

test('new App Data JSON files retain their Workspace notification destinations', () => {
  const appDataPath = '/drives/drive/root:/205127 - TMR/NorthGroup ONE App Data';
  const sectionPath = `${appDataPath}/Sections`;
  const brief = describeWorkspaceChange(changedFile('Job Details.json', {
    parentReference: { path: appDataPath },
  }), job);
  const accommodation = describeWorkspaceChange(changedFile('Accommodation.json', {
    parentReference: { path: appDataPath },
  }), job);
  const progress = describeWorkspaceChange(changedFile('Job Progress.json', {
    parentReference: { path: appDataPath },
  }), job);
  const hub = describeWorkspaceChange(changedFile('Job Hub.json', {
    parentReference: { path: appDataPath },
  }), job);
  const workspace = describeWorkspaceChange(changedFile('Workspace Overview.json', {
    parentReference: { path: appDataPath },
  }), job);
  const section = describeWorkspaceChange(changedFile('overview.json', {
    parentReference: { path: sectionPath },
  }), job);

  assert.match(brief.title, /Brief updated/);
  assert.equal(accommodation.icon, 'bed-outline');
  assert.equal(progress.icon, 'checkmark-done-outline');
  assert.equal(hub.icon, 'grid-outline');
  assert.equal(workspace.icon, 'briefcase-outline');
  assert.match(workspace.title, /Workspace updated/);
  assert.deepEqual(hub.targetParams, { focus: 'jobDetails' });
  assert.equal(section.icon, 'document-text-outline');
  assert.deepEqual(section.targetParams, { focus: 'jobDetails', jobDetailsSectionId: 'overview' });
  assert.equal(isJobProgressWorkspaceItem(changedFile('Job Progress.json')), true);
  assert.equal(isJobProgressWorkspaceItem(changedFile('overview.json')), false);
});

test('KML changes open the editor and retain the shared file name', () => {
  const activity = describeWorkspaceChange(changedFile('Planning v4.kmz'), job);
  assert.equal(activity.target, 'KmlEditor');
  assert.equal(activity.icon, 'map-outline');
  assert.match(activity.title, /KML updated/);
  assert.match(activity.message, /Planning v4\.kmz/);
});

test('forms and normal uploads open Job Files with useful labels', () => {
  const form = describeWorkspaceChange(changedFile('205127 S-500 PC.pdf'), job);
  const file = describeWorkspaceChange(changedFile('Control sketch.jpg'), job);
  assert.equal(form.target, 'JobFiles');
  assert.match(form.title, /Form uploaded/);
  assert.equal(file.target, 'JobFiles');
  assert.match(file.title, /File uploaded/);
});

test('folder, deleted and current-user changes do not notify', () => {
  assert.equal(describeWorkspaceChange({ name: 'Forms', folder: {} }, job), null);
  assert.equal(describeWorkspaceChange(changedFile('old.pdf', { deleted: {} }), job), null);
  assert.equal(isOwnWorkspaceChange(changedFile('new.pdf'), 'TEAM-USER'), true);
  assert.equal(isOwnWorkspaceChange(changedFile('new.pdf'), 'someone-else'), false);
});


test('normal files are described as uploaded even when SharePoint reports a later modification', () => {
  const activity = describeWorkspaceChange(changedFile('Control sketch.jpg', {
    lastModifiedDateTime: '2026-08-12T11:45:00.000Z',
  }), job);
  assert.match(activity.title, /File uploaded/);
  assert.match(activity.message, /uploaded Control sketch\.jpg/);
});

test('multipart survey-photo ZIPs collapse to one logical Photos uploaded activity', () => {
  const oldPart1 = changedFile('205127_Photos_20260821_JH_Part01-of-05.zip');
  const oldPart5 = changedFile('205127_Photos_20260821_JH_Part05-of-05.zip', {
    lastModifiedDateTime: '2026-08-12T10:02:00.000Z',
  });
  const oldInfo1 = photoZipUploadInfo(oldPart1);
  const oldInfo5 = photoZipUploadInfo(oldPart5);
  assert.equal(oldInfo1.groupId, oldInfo5.groupId);
  assert.equal(oldInfo1.partCount, 5);

  const activity = describePhotoUploadGroup([oldPart1, oldPart5], job);
  assert.match(activity.title, /205127 · TMR · Photos uploaded/);
  assert.match(activity.message, /Matthew Copley uploaded 5 photo packages/);
  assert.equal(activity.packageCount, 5);

  const newInfo1 = photoZipUploadInfo(changedFile('205127_Photos_Part01-of-02_260823PC.zip'));
  const newInfo2 = photoZipUploadInfo(changedFile('205127_Photos_Part02-of-02_260823PC.zip'));
  assert.equal(newInfo1.groupId, newInfo2.groupId);
  assert.equal(newInfo1.partCount, 2);
});

test('notification time shows the real event clock time for the first hour, then relative hours', () => {
  const event = new Date('2026-08-23T09:12:00+10:00');
  const twentyMinutesLater = new Date(event.getTime() + 20 * 60 * 1000);
  assert.equal(
    formatNotificationTime(event, twentyMinutesLater),
    event.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }),
  );

  const ninetyMinutesLater = new Date(event.getTime() + 90 * 60 * 1000);
  assert.equal(formatNotificationTime(event, ninetyMinutesLater), '1h ago');
});

test('notifications preserve the source activity timestamp instead of discovery time', async () => {
  await resetTestState();
  setActiveAccountId('notifications-test-user');
  const sourceTime = '2026-08-23T08:42:00.000Z';
  await addNotification({
    type: 'workspace',
    title: '205127 · TMR · File uploaded',
    message: 'Jai Hicks uploaded a file',
    sourceId: 'timestamp-test',
    dedupeKey: 'timestamp-test',
    createdAt: sourceTime,
  });
  const notifications = await loadNotifications();
  assert.equal(notifications[0].createdAt, sourceTime);
});


test('completed progress sections still use the Progress updated activity label', async () => {
  await resetTestState();
  setActiveAccountId('notifications-progress-user');
  await publishProgressCompletions({
    previousTasks: [{ id: 'sx12', name: 'SX12', completed: 0, target: 1 }],
    nextProgress: {
      tasks: [{ id: 'sx12', name: 'SX12', completed: 1, target: 1 }],
      updatedBy: 'Liam Biddulph',
      updatedAt: '2026-08-23T09:15:00.000Z',
      eTag: 'etag-progress-1',
    },
    job: { number: '205127', name: 'TMR' },
  });
  const notifications = await loadNotifications();
  assert.equal(notifications[0].title, '205127 · TMR · Progress updated');
  assert.match(notifications[0].message, /Liam Biddulph completed SX12/);
  assert.equal(notifications[0].createdAt, '2026-08-23T09:15:00.000Z');
});
