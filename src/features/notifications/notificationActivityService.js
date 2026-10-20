import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountStorageKey } from '../../services/account/accountIdentity';
import {
  loadUnifiedTeamsFeed,
  TEAMS_CHANNELS,
} from '../chat/teamsChannelService';
import {
  loadJobChatMessages,
  readCachedJobChatRoom,
} from '../chat/jobChatService';
import { resolveJobFilesLocation } from '../jobFiles/jobFilesService';
import {
  describeProgressTaskChanges,
  loadSharedJobProgress,
  progressTasksMeaningfullyEqual,
} from '../jobs/jobProgressService';
import { publishProgressCompletions } from '../jobs/progressCompletionService';
import {
  graphErrorFromResponse,
  graphFetch,
} from '../../services/sync/graphClient';
import {
  addNotification,
  NOTIFICATION_TYPES,
} from './notificationService';
import {
  describePhotoUploadGroup,
  describeWorkspaceChange,
  isJobProgressWorkspaceItem,
  isOwnWorkspaceChange,
  photoZipUploadInfo,
  workspaceActivityTimestamp,
} from './notificationActivityRules';

const FEED_SNAPSHOT_KEY = 'northgroup_one_notification_feed_snapshot_v1';
const CHAT_SNAPSHOT_KEY = 'northgroup_one_notification_chat_snapshot_v1';
const WORKSPACE_SNAPSHOT_KEY = 'northgroup_one_notification_workspace_delta_v1';
const MAX_FEED_SNAPSHOT_MESSAGES = 100;
const MAX_CHAT_SNAPSHOT_MESSAGES = 100;
const MAX_WORKSPACE_NOTIFICATIONS_PER_SYNC = 24;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const preview = (value, fallback = 'Shared an update') => {
  const text = clean(value);
  if (!text) return fallback;
  return text.length > 120 ? `${text.slice(0, 117).trim()}…` : text;
};

const isOwnMessage = (message, accountId) => (
  Boolean(accountId)
  && String(message?.senderId || '').trim().toLowerCase()
    === String(accountId).trim().toLowerCase()
);

const feedMessageKey = (message) => (
  `${clean(message?.channelKey) || 'feed'}:${clean(message?.id)}`
);

const replyKey = (message, reply) => (
  `${feedMessageKey(message)}:reply:${clean(reply?.id)}`
);

const chatMessageKey = (message) => clean(message?.id);

const readJson = async (key, fallback) => {
  try {
    const saved = await AsyncStorage.getItem(accountStorageKey(key));
    if (!saved) return fallback;
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = async (key, value) => {
  try {
    await AsyncStorage.setItem(accountStorageKey(key), JSON.stringify(value));
  } catch {
    // Activity snapshots are an optimisation. They must never block the app.
  }
};

const channelTitle = (channelKey) => (
  TEAMS_CHANNELS[channelKey]?.title || 'Feed'
);

const feedMessageText = (message) => {
  if (message?.text) return preview(message.text);
  if (message?.imageUri || Number(message?.attachmentCount || 0) > 0) {
    return 'Shared a photo';
  }
  return 'Shared an update';
};

const chatMessageText = (message) => {
  const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
  const attachmentNames = attachments
    .map((attachment) => clean(attachment?.name))
    .filter(Boolean)
    .slice(0, 2);
  const attachmentText = attachmentNames.length
    ? `Attached ${attachmentNames.join(', ')}`
    : Number(message?.attachmentCount || 0) > 0
      ? 'Sent an attachment'
      : '';
  const text = clean(message?.text);
  if (text && attachmentText) return preview(`${text} · ${attachmentText}`);
  return preview(text || attachmentText, 'Sent a new message');
};

const normaliseFeedSnapshot = (value) => ({
  initialized: Boolean(value?.initialized),
  messages: Array.isArray(value?.messages) ? value.messages : [],
});

const normaliseChatSnapshot = (value) => ({
  jobs: value?.jobs && typeof value.jobs === 'object' ? value.jobs : {},
});

const normaliseWorkspaceSnapshot = (value) => ({
  jobs: value?.jobs && typeof value.jobs === 'object' ? value.jobs : {},
});

const loadWorkspaceDelta = async ({
  accessToken,
  driveId,
  folderId,
  deltaLink = '',
}) => {
  const select = [
    'id',
    'name',
    'file',
    'folder',
    'deleted',
    'createdDateTime',
    'lastModifiedDateTime',
    'createdBy',
    'lastModifiedBy',
    'parentReference',
    'webUrl',
    'eTag',
  ].join(',');
  let nextUrl = deltaLink || (
    `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(folderId)}`
    + `/delta?$select=${encodeURIComponent(select)}`
  );
  const changes = [];
  let nextDeltaLink = '';
  let pageCount = 0;

  while (nextUrl && pageCount < 100) {
    pageCount += 1;
    const response = await graphFetch(nextUrl, accessToken, {}, {
      feature: 'notifications',
      operation: 'Check Job Workspace activity',
      acceptedStatuses: [410],
      retryMode: 'safe',
    });
    if (response.status === 410) {
      return { changes: [], deltaLink: '', expired: true };
    }
    if (!response.ok) {
      throw await graphErrorFromResponse(response, {
        fallback: `Job Workspace activity could not be checked (${response.status}).`,
      });
    }
    const body = await response.json();
    changes.push(...(Array.isArray(body?.value) ? body.value : []));
    nextDeltaLink = body?.['@odata.deltaLink'] || nextDeltaLink;
    nextUrl = body?.['@odata.nextLink'] || '';
  }

  if (nextUrl) throw new Error('Job Workspace activity returned too many pages.');
  return { changes, deltaLink: nextDeltaLink, expired: false };
};

const workspaceChangeKey = (item, jobNumber) => [
  'workspace',
  clean(jobNumber).toUpperCase(),
  clean(item?.id),
  clean(item?.eTag || item?.lastModifiedDateTime),
].join(':');

const notifyNewWorkspaceActivity = async ({
  changes,
  accountId,
  activeJob,
  driveId,
  skippedChangeKeys = new Set(),
  progressSummary = '',
}) => {
  let addedCount = 0;
  const jobNumber = clean(activeJob?.number);
  const notifyableChanges = changes
    .filter((item) => item?.file && !item?.deleted)
    .filter((item) => !skippedChangeKeys.has(workspaceChangeKey(item, jobNumber)))
    .filter((item) => !isOwnWorkspaceChange(item, accountId))
    .slice(-MAX_WORKSPACE_NOTIFICATIONS_PER_SYNC);

  const photoGroups = new Map();
  const regularChanges = [];

  notifyableChanges.forEach((item) => {
    const photoInfo = photoZipUploadInfo(item);
    if (!photoInfo) {
      regularChanges.push(item);
      return;
    }
    const current = photoGroups.get(photoInfo.groupId) || [];
    current.push(item);
    photoGroups.set(photoInfo.groupId, current);
  });

  const queuedActivities = [
    ...regularChanges.map((item) => ({
      kind: 'item',
      item,
      timestamp: workspaceActivityTimestamp(item),
    })),
    ...[...photoGroups.entries()].map(([groupId, items]) => ({
      kind: 'photos',
      groupId,
      items,
      timestamp: items
        .map(workspaceActivityTimestamp)
        .filter(Boolean)
        .sort((left, right) => Date.parse(right) - Date.parse(left))[0] || '',
    })),
  ].sort((left, right) => Date.parse(left.timestamp || 0) - Date.parse(right.timestamp || 0));

  for (const activity of queuedActivities) {
    if (activity.kind === 'photos') {
      const details = describePhotoUploadGroup(activity.items, activeJob);
      if (!details) continue;
      const sourceId = [
        'workspace-photo-upload',
        jobNumber.toUpperCase(),
        activity.groupId,
      ].join(':');
      const representative = activity.items
        .slice()
        .sort((left, right) => (
          Date.parse(workspaceActivityTimestamp(right) || 0)
          - Date.parse(workspaceActivityTimestamp(left) || 0)
        ))[0] || {};
      const result = await addNotification({
        type: NOTIFICATION_TYPES.WORKSPACE,
        title: details.title,
        message: details.message,
        sourceId,
        target: details.target,
        targetParams: {
          jobNumber,
          driveId,
          itemId: clean(representative.id),
          fileName: clean(representative.name),
          webUrl: clean(representative.webUrl),
          photoPackageCount: details.packageCount,
          photoPackageFiles: activity.items.map((item) => clean(item.name)).filter(Boolean),
        },
        jobNumber,
        icon: details.icon,
        dedupeKey: sourceId,
        createdAt: activity.timestamp,
      });
      if (result.added) addedCount += 1;
      continue;
    }

    const { item } = activity;
    const details = describeWorkspaceChange(item, activeJob, { progressSummary });
    if (!details) continue;
    const sourceId = workspaceChangeKey(item, jobNumber);
    const result = await addNotification({
      type: NOTIFICATION_TYPES.WORKSPACE,
      title: details.title,
      message: details.message,
      sourceId,
      target: details.target,
      targetParams: {
        jobNumber,
        driveId,
        itemId: clean(item.id),
        fileName: clean(item.name),
        webUrl: clean(item.webUrl),
        ...(details.targetParams || {}),
      },
      jobNumber,
      icon: details.icon,
      dedupeKey: sourceId,
      createdAt: workspaceActivityTimestamp(item),
    });
    if (result.added) addedCount += 1;
  }

  return addedCount;
};

const notifyNewFeedActivity = async ({ messages, previous, accountId }) => {
  const previousMessages = new Set(
    previous.messages.map((item) => clean(item?.key)).filter(Boolean),
  );
  const previousReplies = new Set(
    previous.messages.flatMap((item) => (
      Array.isArray(item?.replyKeys) ? item.replyKeys : []
    )).map(clean).filter(Boolean),
  );
  let addedCount = 0;

  const newMessages = messages
    .filter((message) => message?.id && !previousMessages.has(feedMessageKey(message)))
    .reverse();

  for (const message of newMessages) {
    if (isOwnMessage(message, accountId)) continue;
    const sender = clean(message.senderName) || 'A team member';
    const key = feedMessageKey(message);
    const result = await addNotification({
      type: NOTIFICATION_TYPES.FEED,
      title: `${channelTitle(message.channelKey)} update`,
      message: `${sender}: ${feedMessageText(message)}`,
      sourceId: `feed-post-${key}`,
      target: 'FeedHome',
      targetParams: {
        channelKey: message.channelKey,
        messageId: message.id,
      },
      icon: 'megaphone-outline',
      dedupeKey: `feed-post-${key}`,
      createdAt: message.createdAt,
    });
    if (result.added) addedCount += 1;
  }

  const newReplies = messages.flatMap((message) => (
    (Array.isArray(message?.replies) ? message.replies : [])
      .filter((reply) => reply?.id && !previousReplies.has(replyKey(message, reply)))
      .map((reply) => ({ message, reply }))
  )).reverse();

  for (const { message, reply } of newReplies) {
    if (isOwnMessage(reply, accountId)) continue;
    const sender = clean(reply.senderName) || 'A team member';
    const key = replyKey(message, reply);
    const result = await addNotification({
      type: NOTIFICATION_TYPES.FEED,
      title: `${channelTitle(message.channelKey)} comment`,
      message: `${sender}: ${preview(reply.text, 'Added a comment')}`,
      sourceId: `feed-reply-${key}`,
      target: 'FeedHome',
      targetParams: {
        channelKey: message.channelKey,
        messageId: message.id,
        replyId: reply.id,
      },
      icon: 'chatbubble-ellipses-outline',
      dedupeKey: `feed-reply-${key}`,
      createdAt: reply.createdAt,
    });
    if (result.added) addedCount += 1;
  }

  return addedCount;
};

const notifyNewChatActivity = async ({
  messages,
  previous,
  accountId,
  job,
}) => {
  const previousIds = new Set(
    (Array.isArray(previous?.messageIds) ? previous.messageIds : []).map(clean).filter(Boolean),
  );
  const newMessages = messages
    .filter((message) => message?.id && !previousIds.has(chatMessageKey(message)))
    .reverse();
  let addedCount = 0;
  const jobNumber = clean(job?.number);
  const jobName = clean(job?.name || job?.jobName);
  const jobLabel = [jobNumber, jobName].filter(Boolean).join(' · ') || 'Job';

  for (const message of newMessages) {
    if (isOwnMessage(message, accountId)) continue;
    const sender = clean(message.senderName) || 'A team member';
    const sourceId = `job-chat-${jobNumber}-${message.id}`;
    const result = await addNotification({
      type: NOTIFICATION_TYPES.CHAT,
      title: `${jobLabel} chat`,
      message: `${sender}: ${chatMessageText(message)}`,
      sourceId,
      target: 'JobChat',
      targetParams: { jobNumber },
      jobNumber,
      icon: Number(message?.attachmentCount || 0) > 0
        ? 'attach-outline'
        : 'chatbubbles-outline',
      dedupeKey: sourceId,
      createdAt: message.createdAt,
    });
    if (result.added) addedCount += 1;
  }

  return addedCount;
};

export const syncFeedActivityNotifications = async ({
  accessToken,
  accountId,
}) => {
  const messages = await loadUnifiedTeamsFeed({ accessToken, accountId });
  const previous = normaliseFeedSnapshot(
    await readJson(FEED_SNAPSHOT_KEY, { initialized: false, messages: [] }),
  );
  const addedCount = previous.initialized
    ? await notifyNewFeedActivity({ messages, previous, accountId })
    : 0;

  await writeJson(FEED_SNAPSHOT_KEY, {
    initialized: true,
    updatedAt: new Date().toISOString(),
    messages: messages.slice(0, MAX_FEED_SNAPSHOT_MESSAGES).map((message) => ({
      key: feedMessageKey(message),
      replyKeys: (Array.isArray(message?.replies) ? message.replies : [])
        .map((reply) => replyKey(message, reply)),
    })),
  });

  return { addedCount, messageCount: messages.length };
};

export const syncActiveJobChatNotifications = async ({
  accessToken,
  accountId,
  activeJob,
}) => {
  const jobNumber = clean(activeJob?.number);
  if (!jobNumber || !activeJob?.microsoftTeamIds?.length) {
    return { addedCount: 0, messageCount: 0, skipped: true };
  }

  // Only monitor chats that the user has already opened. This prevents a
  // background notification pass from unexpectedly creating Teams chats.
  const room = await readCachedJobChatRoom({ accountId, job: activeJob });
  if (!room?.id) return { addedCount: 0, messageCount: 0, skipped: true };

  const messages = await loadJobChatMessages({
    accessToken,
    accountId,
    job: activeJob,
    chatId: room.id,
  });
  const snapshot = normaliseChatSnapshot(
    await readJson(CHAT_SNAPSHOT_KEY, { jobs: {} }),
  );
  const jobKey = jobNumber.toUpperCase();
  const previous = snapshot.jobs[jobKey] || { initialized: false, messageIds: [] };
  const addedCount = previous.initialized
    ? await notifyNewChatActivity({ messages, previous, accountId, job: activeJob })
    : 0;

  const nextJobs = {
    ...snapshot.jobs,
    [jobKey]: {
      initialized: true,
      updatedAt: new Date().toISOString(),
      messageIds: messages
        .slice(-MAX_CHAT_SNAPSHOT_MESSAGES)
        .map(chatMessageKey)
        .filter(Boolean),
    },
  };
  await writeJson(CHAT_SNAPSHOT_KEY, { jobs: nextJobs });

  return { addedCount, messageCount: messages.length };
};

export const syncActiveJobWorkspaceNotifications = async ({
  accessToken,
  accountId,
  activeJob,
}) => {
  const jobNumber = clean(activeJob?.number);
  if (!jobNumber) return { addedCount: 0, changeCount: 0, skipped: true };

  const location = await resolveJobFilesLocation({ accessToken, job: activeJob });
  const snapshot = normaliseWorkspaceSnapshot(
    await readJson(WORKSPACE_SNAPSHOT_KEY, { jobs: {} }),
  );
  const jobKey = jobNumber.toUpperCase();
  const previous = snapshot.jobs[jobKey] || {};
  const sameLocation = previous.driveId === location.drive.id
    && previous.folderId === location.folder.id;
  let delta = await loadWorkspaceDelta({
    accessToken,
    driveId: location.drive.id,
    folderId: location.folder.id,
    deltaLink: sameLocation ? clean(previous.deltaLink) : '',
  });

  // A Graph delta token can expire after a long offline period. Rebuild the
  // baseline quietly so historic files are never presented as new activity.
  if (delta.expired) {
    delta = await loadWorkspaceDelta({
      accessToken,
      driveId: location.drive.id,
      folderId: location.folder.id,
    });
  }

  const initialized = Boolean(sameLocation && previous.initialized && previous.deltaLink);
  const progressChanges = delta.changes.filter((item) => (
    item?.file && !item?.deleted && isJobProgressWorkspaceItem(item)
  ));
  const needsProgressBaseline = !previous.progressInitialized;
  let latestProgress = null;
  let progressAddedCount = 0;
  const skippedChangeKeys = new Set();
  let progressNotificationChange = null;
  let progressSummary = '';
  let progressReadFailed = false;

  if (needsProgressBaseline || progressChanges.length) {
    try {
      latestProgress = await loadSharedJobProgress({ accessToken, job: activeJob });
      if (initialized && previous.progressInitialized && progressChanges.length) {
        const progressChanged = !progressTasksMeaningfullyEqual(
          previous.progressTasks,
          latestProgress.tasks,
        );
        const published = await publishProgressCompletions({
          previousTasks: previous.progressTasks,
          nextProgress: latestProgress,
          job: activeJob,
        });
        progressAddedCount = published.addedCount;
        if (published.events.length || !progressChanged) {
          // Completion notifications are more useful than a duplicate generic
          // file notification. Metadata-only/ordering-only rewrites are not
          // progress changes and must never notify other users.
          progressChanges.forEach((item) => skippedChangeKeys.add(workspaceChangeKey(item, jobNumber)));
        } else {
          progressNotificationChange = progressChanges
            .slice()
            .sort((left, right) => (
              Date.parse(workspaceActivityTimestamp(right) || 0)
              - Date.parse(workspaceActivityTimestamp(left) || 0)
            ))[0] || null;
          progressSummary = describeProgressTaskChanges(
            previous.progressTasks,
            latestProgress.tasks,
          );
          progressChanges
            .filter((item) => item !== progressNotificationChange)
            .forEach((item) => skippedChangeKeys.add(workspaceChangeKey(item, jobNumber)));
        }
      } else if (progressChanges.length) {
        // The first successful read establishes the baseline; it is not an
        // observable change we can safely attribute to another user.
        progressChanges.forEach((item) => skippedChangeKeys.add(workspaceChangeKey(item, jobNumber)));
      }
    } catch {
      // Do not emit an inaccurate progress notification when the file cannot
      // be downloaded or parsed. Keep the delta pending so a later successful
      // pass can verify the change instead of losing it permanently.
      progressReadFailed = true;
      progressChanges.forEach((item) => skippedChangeKeys.add(workspaceChangeKey(item, jobNumber)));
      latestProgress = null;
    }
  }

  const workspaceAddedCount = initialized
    ? await notifyNewWorkspaceActivity({
      changes: progressNotificationChange
        ? [...delta.changes.filter((item) => item !== progressNotificationChange), progressNotificationChange]
        : delta.changes,
      accountId,
      activeJob,
      driveId: location.drive.id,
      skippedChangeKeys,
      progressSummary,
    })
    : 0;
  const nextJobs = {
    ...snapshot.jobs,
    [jobKey]: {
      initialized: true,
      driveId: location.drive.id,
      folderId: location.folder.id,
      deltaLink: progressReadFailed ? previous.deltaLink : delta.deltaLink,
      updatedAt: new Date().toISOString(),
      progressInitialized: Boolean(latestProgress || previous.progressInitialized),
      progressTasks: latestProgress?.tasks || previous.progressTasks || [],
      progressETag: latestProgress?.eTag || previous.progressETag || '',
    },
  };
  await writeJson(WORKSPACE_SNAPSHOT_KEY, { jobs: nextJobs });

  return {
    addedCount: workspaceAddedCount + progressAddedCount,
    changeCount: delta.changes.length,
    progressCompletedCount: progressAddedCount,
  };
};

export const syncNotificationActivity = async ({
  accessToken,
  accountId,
  activeJob,
}) => {
  let addedCount = 0;
  const results = {};

  try {
    results.feed = await syncFeedActivityNotifications({ accessToken, accountId });
    addedCount += Number(results.feed?.addedCount || 0);
  } catch (error) {
    results.feedError = error;
  }

  try {
    results.chat = await syncActiveJobChatNotifications({
      accessToken,
      accountId,
      activeJob,
    });
    addedCount += Number(results.chat?.addedCount || 0);
  } catch (error) {
    results.chatError = error;
  }

  try {
    results.workspace = await syncActiveJobWorkspaceNotifications({
      accessToken,
      accountId,
      activeJob,
    });
    addedCount += Number(results.workspace?.addedCount || 0);
  } catch (error) {
    results.workspaceError = error;
  }

  return { addedCount, results };
};
