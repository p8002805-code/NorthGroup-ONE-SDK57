import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountStorageKey } from '../../services/account/accountIdentity';
import { loadJobShiftMembers } from '../jobs/teamsShiftsService';
import {
  assignedMemberProfilesResolved,
  mergeAssignedMemberProfiles,
} from './jobChatMembers';
import {
  jobChatAttachmentKind,
  mimeTypeForJobChatAttachment,
} from './jobChatAttachmentService';
import {
  GRAPH_ROOT,
  graphCollection as sharedGraphCollection,
  graphRequest as sharedGraphRequest,
} from '../../services/sync/graphClient';

const CACHE_PREFIX = 'northgroup_one_job_chat_cache_v3';
const ROOM_CACHE_PREFIX = 'northgroup_one_job_chat_room_v2';
const MEMBER_SYNC_INTERVAL_MS = 15 * 60 * 1000;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const unique = (values) => [...new Set(values.filter(Boolean))];
const encodePath = (value) => encodeURIComponent(String(value || ''));
const normalise = (value) => clean(value).toLowerCase().replace(/[–—]/g, '-');
const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const graphErrorMessage = (status, body) => {
  const message = body?.error?.message || '';
  if (status === 401) return 'Your Microsoft session needs to be refreshed.';
  if (status === 403) {
    return 'NorthGroup One does not yet have permission to use this Teams job chat.';
  }
  if (status === 404) return 'This Teams job chat could not be found.';
  if (status === 429) return 'Microsoft Teams is busy. Please wait a moment and try again.';
  return message || `Microsoft Teams request failed (${status}).`;
};

const chatSyncConfig = (operation) => ({
  feature: 'jobChat',
  operation,
  errorMessage: graphErrorMessage,
});

const graphRequest = (url, accessToken, options = {}) => sharedGraphRequest(
  url,
  accessToken,
  options,
  chatSyncConfig(`${String(options.method || 'GET').toUpperCase()} Job Chat`),
);

const graphCollection = (url, accessToken) => sharedGraphCollection(
  url,
  accessToken,
  chatSyncConfig('Load Job Chat'),
);

const decodeEntities = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

const htmlToText = (value) => decodeEntities(
  String(value || '')
    .replace(/<attachment\b[^>]*>[\s\S]*?<\/attachment>/gi, '')
    .replace(/<img\b[^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li|h[1-6])>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ''),
)
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
  .replace(/\r?\n/g, '<br>');

const fileNameFromUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    const segment = url.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(segment);
  } catch {
    const segment = String(value || '').split('?')[0].split('/').pop() || '';
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }
};

const hostedContentIds = (bodyContent) => {
  const values = [];
  const pattern = /hostedContents\/([^/"'?#]+)\/\$value/gi;
  let match = pattern.exec(String(bodyContent || ''));
  while (match) {
    if (match[1]) values.push(decodeURIComponent(match[1]));
    match = pattern.exec(String(bodyContent || ''));
  }
  return unique(values);
};

const hostedContentIdFromUrl = (value) => {
  const match = String(value || '').match(/hostedContents\/([^/"'?#]+)\/\$value/i);
  if (!match?.[1]) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const normaliseAttachments = (message, chatId) => {
  const messageId = String(message?.id || '');
  const resolvedChatId = String(chatId || message?.chatId || '');
  const webUrl = message?.webUrl || '';
  const discoveredHostedIds = new Set(hostedContentIds(message?.body?.content));

  const attachments = (Array.isArray(message?.attachments) ? message.attachments : [])
    .map((attachment, index) => {
      const contentType = clean(attachment?.contentType);
      const contentUrl = attachment?.contentUrl || '';
      const hostedContentId = hostedContentIdFromUrl(contentUrl);
      const suppliedName = clean(attachment?.name);
      const name = suppliedName
        || (hostedContentId ? `Teams photo ${index + 1}.jpg` : fileNameFromUrl(contentUrl))
        || `Teams attachment ${index + 1}`;
      const hosted = Boolean(hostedContentId);
      const reference = !hosted && (
        contentType.toLowerCase() === 'reference'
        || (!contentType && /^https?:\/\//i.test(contentUrl))
      );
      if (!hosted && !reference) return null;

      const mimeType = hosted
        ? mimeTypeForJobChatAttachment(name, contentType || 'image/jpeg')
        : reference
          ? mimeTypeForJobChatAttachment(name)
          : mimeTypeForJobChatAttachment(name, contentType);

      if (hostedContentId) discoveredHostedIds.delete(hostedContentId);

      return {
        id: String(attachment?.id || `${messageId}-attachment-${index}`),
        source: hosted ? 'hosted' : (reference ? 'reference' : 'teams'),
        kind: hosted ? 'photo' : jobChatAttachmentKind(name, mimeType),
        name,
        mimeType,
        size: Number(attachment?.size || 0),
        contentUrl: hosted ? '' : contentUrl,
        hostedContentId,
        thumbnailUrl: attachment?.thumbnailUrl || '',
        contentType,
        chatId: resolvedChatId,
        messageId,
        messageWebUrl: webUrl,
      };
    })
    .filter(Boolean);

  const hosted = [...discoveredHostedIds].map((id, index) => ({
    id: `${messageId}-hosted-${id}`,
    source: 'hosted',
    kind: 'photo',
    name: `Teams photo ${attachments.length + index + 1}.jpg`,
    mimeType: 'image/jpeg',
    size: 0,
    hostedContentId: id,
    chatId: resolvedChatId,
    messageId,
    messageWebUrl: webUrl,
  }));

  return [...attachments, ...hosted];
};

const normaliseReactions = (message) => (
  (Array.isArray(message?.reactions) ? message.reactions : []).map((reaction, index) => {
    const identity = reaction?.user?.user || reaction?.user || {};
    return {
      id: `${clean(reaction?.reactionType) || 'reaction'}-${clean(identity?.id) || index}`,
      reactionType: clean(reaction?.reactionType),
      userId: clean(identity?.id),
      userName: clean(identity?.displayName),
      createdAt: reaction?.createdDateTime || '',
    };
  }).filter((reaction) => reaction.reactionType)
);

const normaliseMessage = (message, chatId = '') => {
  const user = message?.from?.user;
  const application = message?.from?.application;
  const attachments = normaliseAttachments(message, chatId);
  const reactions = normaliseReactions(message);
  return {
    id: String(message?.id || ''),
    senderId: user?.id || application?.id || 'system',
    senderName: user?.displayName || application?.displayName || 'Microsoft Teams',
    text: htmlToText(message?.body?.content),
    createdAt: message?.createdDateTime || message?.lastModifiedDateTime || '',
    editedAt: message?.lastEditedDateTime || '',
    webUrl: message?.webUrl || '',
    attachments,
    attachmentCount: attachments.length,
    reactions,
  };
};

const safeJobNumber = (job) => clean(job?.number).toUpperCase();

export const jobChatTopic = (job) => {
  const number = safeJobNumber(job);
  const location = clean(job?.location || job?.name || 'Job');
  return `${number} — ${location}`.slice(0, 180);
};

const topicMatchesJob = (topic, job) => {
  const number = safeJobNumber(job);
  if (!number) return false;
  const value = normalise(topic);
  return value === normalise(jobChatTopic(job))
    || value.startsWith(normalise(`${number} — `));
};

const scopedCacheKey = (prefix, accountId, job) => {
  const account = String(accountId || 'employee').replace(/[^A-Za-z0-9_-]/g, '');
  const number = safeJobNumber(job).replace(/[^A-Z0-9_-]/g, '');
  return accountStorageKey(`${prefix}:${account}:${number}`);
};

const cacheKey = (accountId, job) => scopedCacheKey(CACHE_PREFIX, accountId, job);
const roomCacheKey = (accountId, job) => scopedCacheKey(ROOM_CACHE_PREFIX, accountId, job);

export const readCachedJobChatMessages = async ({ accountId, job }) => {
  try {
    const saved = await AsyncStorage.getItem(cacheKey(accountId, job));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const readCachedJobChatRoom = async ({ accountId, job }) => {
  try {
    const saved = await AsyncStorage.getItem(roomCacheKey(accountId, job));
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
};

const writeCachedJobChatRoom = async ({ accountId, job, room }) => {
  if (!room?.id) return;
  try {
    await AsyncStorage.setItem(roomCacheKey(accountId, job), JSON.stringify(room));
  } catch {
    // Room caching is a speed improvement only; live Teams access must continue.
  }
};

const clearCachedJobChatRoom = async ({ accountId, job }) => {
  try {
    await AsyncStorage.removeItem(roomCacheKey(accountId, job));
  } catch {
    // Ignore cache cleanup failures.
  }
};

const writeCachedJobChatMessages = async ({ accountId, job, messages }) => {
  try {
    await AsyncStorage.setItem(cacheKey(accountId, job), JSON.stringify(messages));
  } catch {
    // A full device cache must never stop the live Teams chat.
  }
};

const upsertCachedMessage = async ({ accountId, job, message }) => {
  const cached = await readCachedJobChatMessages({ accountId, job });
  const messages = [...cached.filter((item) => item.id !== message.id), message]
    .sort((left, right) => (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    ));
  await writeCachedJobChatMessages({ accountId, job, messages });
  return message;
};

const chatMemberBody = (userId, visibleHistoryStartDateTime) => ({
  '@odata.type': '#microsoft.graph.aadUserConversationMember',
  roles: ['owner'],
  'user@odata.bind': `${GRAPH_ROOT}/users('${userId}')`,
  ...(visibleHistoryStartDateTime ? { visibleHistoryStartDateTime } : {}),
});

const listCurrentUserChats = (accessToken) => graphCollection(
  `${GRAPH_ROOT}/me/chats?$filter=chatType%20eq%20'group'&$top=50`,
  accessToken,
);

const findExistingJobChat = async (accessToken, job) => {
  const chats = await listCurrentUserChats(accessToken);
  return chats
    .filter((chat) => chat?.chatType === 'group' && topicMatchesJob(chat?.topic, job))
    .sort((left, right) => (
      new Date(right?.lastUpdatedDateTime || right?.createdDateTime || 0).getTime()
      - new Date(left?.lastUpdatedDateTime || left?.createdDateTime || 0).getTime()
    ))[0] || null;
};

const createJobChat = async ({ accessToken, job, userIds }) => graphRequest(
  `${GRAPH_ROOT}/chats`,
  accessToken,
  {
    method: 'POST',
    body: JSON.stringify({
      chatType: 'group',
      topic: jobChatTopic(job),
      members: userIds.map((userId) => chatMemberBody(userId)),
    }),
  },
);

const listJobChatMembers = ({ accessToken, chatId }) => graphCollection(
  `${GRAPH_ROOT}/chats/${encodePath(chatId)}/members`,
  accessToken,
);

const syncJobChatMembers = async ({ accessToken, chat, assignedUserIds }) => {
  const members = await listJobChatMembers({
    accessToken,
    chatId: chat.id,
  });
  const existing = new Map(
    members
      .filter((member) => member?.userId)
      .map((member) => [String(member.userId).toLowerCase(), member]),
  );
  const failures = [];

  for (const userId of assignedUserIds) {
    if (existing.has(String(userId).toLowerCase())) continue;
    try {
      await graphRequest(
        `${GRAPH_ROOT}/chats/${encodePath(chat.id)}/members`,
        accessToken,
        {
          method: 'POST',
          body: JSON.stringify(chatMemberBody(userId, chat.createdDateTime)),
        },
      );
    } catch (error) {
      failures.push(error);
    }
  }

  // Shifts controls who is added to a job chat, but it must not remove people
  // who already belong to the conversation. Jobs can continue beyond the
  // 28-day Shifts import window, and the Teams history must remain available
  // to everyone who previously worked on the job.

  return {
    members,
    warning: failures.length
      ? 'The conversation is available, but one or more Shifts members could not be synchronised.'
      : '',
  };
};

export const ensureJobChat = async ({
  accessToken,
  accountId,
  job,
  syncMembers = true,
}) => {
  const cachedRoom = await readCachedJobChatRoom({ accountId, job });
  const lastSyncedAt = new Date(cachedRoom?.membersSyncedAt || 0).getTime();
  const syncIsFresh = lastSyncedAt > 0
    && (Date.now() - lastSyncedAt) < MEMBER_SYNC_INTERVAL_MS;

  // Rooms cached before the directory permission was enabled contain numbered
  // placeholder members. Only treat the cache as ready after a real directory
  // lookup has completed, otherwise that placeholder state can survive the
  // permission rollout for another sync interval.
  const cachedMembersReady = Boolean(
    cachedRoom?.assignedMembersResolved || cachedRoom?.directoryMembersResolved,
  );
  if (cachedRoom && cachedMembersReady && (!syncMembers || syncIsFresh)) {
    return {
      chat: cachedRoom,
      created: false,
      syncWarning: cachedRoom.syncWarning || '',
      assignedCount: cachedRoom.assignedCount || 0,
      assignedUserIds: [],
      fromCache: true,
    };
  }

  const assignment = await loadJobShiftMembers({ accessToken, job });
  const assignedUserIds = unique(assignment.userIds);
  const currentUserAssigned = assignedUserIds
    .some((id) => String(id).toLowerCase() === String(accountId || '').toLowerCase());

  if (!currentUserAssigned) {
    throw new Error(`You are not allocated to job ${assignment.jobNumber} in published Teams Shifts.`);
  }
  if (assignedUserIds.length < 2) {
    throw new Error('Job Chat will be created when at least two employees are allocated to this job in Teams Shifts.');
  }

  let chat = cachedRoom;
  let created = false;
  if (!chat) {
    chat = await findExistingJobChat(accessToken, job);
    if (!chat) {
      await wait(450 + Math.floor(Math.random() * 350));
      chat = await findExistingJobChat(accessToken, job);
      if (!chat) {
        chat = await createJobChat({ accessToken, job, userIds: assignedUserIds });
        created = true;
      }
    }
  }

  let syncWarning = '';
  let chatMembers = [];
  if (syncMembers) {
    if (created) {
      try {
        chatMembers = await listJobChatMembers({ accessToken, chatId: chat.id });
      } catch {
        // A newly created chat can take a moment to expose its member list.
      }
    } else {
      const synced = await syncJobChatMembers({
        accessToken,
        chat,
        assignedUserIds,
      });
      syncWarning = synced.warning;
      chatMembers = synced.members;
    }
  }

  const assignedMembers = mergeAssignedMemberProfiles(assignment.members, chatMembers);
  const assignedMembersResolved = assignedMemberProfilesResolved(
    assignedMembers,
    assignedUserIds.length,
  );
  if (!assignedMembersResolved && !syncWarning) {
    syncWarning = assignment.directoryError || '';
  }

  const room = {
    ...chat,
    assignedCount: assignedUserIds.length,
    assignedMembers,
    assignedMembersResolved,
    directoryMembersResolved: assignedMembersResolved,
    syncWarning,
    membersSyncedAt: syncMembers ? new Date().toISOString() : cachedRoom?.membersSyncedAt || '',
  };
  await writeCachedJobChatRoom({ accountId, job, room });

  return {
    chat: room,
    created,
    syncWarning,
    assignedCount: assignedUserIds.length,
    assignedUserIds,
    fromCache: Boolean(cachedRoom),
  };
};

export const loadJobChatMessages = async ({
  accessToken,
  accountId,
  job,
  chatId,
}) => {
  let values;
  try {
    values = await graphCollection(
      `${GRAPH_ROOT}/chats/${encodePath(chatId)}/messages?$top=50&$orderby=createdDateTime%20desc`,
      accessToken,
    );
  } catch (error) {
    if (error?.status === 404) {
      await clearCachedJobChatRoom({ accountId, job });
    }
    throw error;
  }
  const messages = values
    .filter((message) => message?.messageType === 'message' && !message?.deletedDateTime)
    .map((message) => normaliseMessage(message, chatId))
    .filter((message) => message.id && (message.text || message.attachments.length))
    .sort((left, right) => (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    ));

  await writeCachedJobChatMessages({ accountId, job, messages });
  return messages;
};

export const sendJobChatMessage = async ({
  accessToken,
  accountId,
  job,
  chatId,
  text,
}) => {
  const message = await graphRequest(
    `${GRAPH_ROOT}/chats/${encodePath(chatId)}/messages`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        body: {
          contentType: 'text',
          content: clean(text),
        },
      }),
    },
  );
  const posted = normaliseMessage(message, chatId);
  return upsertCachedMessage({ accountId, job, message: posted });
};

export const sendJobChatAttachmentMessage = async ({
  accessToken,
  accountId,
  job,
  chatId,
  text,
  attachments,
}) => {
  const values = (Array.isArray(attachments) ? attachments : [])
    .filter((attachment) => attachment?.id && attachment?.contentUrl);
  if (!values.length) throw new Error('No uploaded attachments are ready to send.');

  const bodyHtml = [
    clean(text) ? `<p>${escapeHtml(String(text).trim())}</p>` : '',
    ...values.map((attachment) => (
      `<attachment id="${escapeHtml(attachment.id)}"></attachment>`
    )),
  ].join('');

  const message = await graphRequest(
    `${GRAPH_ROOT}/chats/${encodePath(chatId)}/messages`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        body: {
          contentType: 'html',
          content: bodyHtml,
        },
        attachments: values.map((attachment) => ({
          id: attachment.id,
          contentType: 'reference',
          contentUrl: attachment.contentUrl,
          name: attachment.name,
        })),
      }),
    },
  );

  const posted = normaliseMessage(message, chatId);
  posted.attachments = posted.attachments.map((normalisedAttachment) => {
    const local = values.find((attachment) => (
      attachment.id === normalisedAttachment.id
      || attachment.contentUrl === normalisedAttachment.contentUrl
    ));
    if (!local) return normalisedAttachment;
    const {
      localUri: _localUri,
      managedLocal: _managedLocal,
      localAttachmentId: _localAttachmentId,
      ...remoteMetadata
    } = local;
    return {
      ...normalisedAttachment,
      ...remoteMetadata,
      localUri: '',
      source: 'reference',
      chatId,
      messageId: posted.id,
      messageWebUrl: posted.webUrl,
    };
  });
  posted.attachmentCount = posted.attachments.length;
  return upsertCachedMessage({ accountId, job, message: posted });
};

export const setJobChatReaction = async ({
  accessToken,
  chatId,
  messageId,
  reactionType,
}) => graphRequest(
  `${GRAPH_ROOT}/chats/${encodePath(chatId)}/messages/${encodePath(messageId)}/setReaction`,
  accessToken,
  {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  },
);

export const unsetJobChatReaction = async ({
  accessToken,
  chatId,
  messageId,
  reactionType,
}) => graphRequest(
  `${GRAPH_ROOT}/chats/${encodePath(chatId)}/messages/${encodePath(messageId)}/unsetReaction`,
  accessToken,
  {
    method: 'POST',
    body: JSON.stringify({ reactionType }),
  },
);

export const softDeleteJobChatMessage = async ({
  accessToken,
  accountId,
  job,
  chatId,
  messageId,
}) => {
  await graphRequest(
    `${GRAPH_ROOT}/users/${encodePath(accountId)}/chats/${encodePath(chatId)}/messages/${encodePath(messageId)}/softDelete`,
    accessToken,
    { method: 'POST' },
  );
  const cached = await readCachedJobChatMessages({ accountId, job });
  await writeCachedJobChatMessages({
    accountId,
    job,
    messages: cached.filter((message) => message.id !== messageId),
  });
};
