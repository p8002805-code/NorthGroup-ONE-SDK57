import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import {
  GRAPH_ROOT,
  graphCollection as sharedGraphCollection,
  graphRequest as sharedGraphRequest,
} from '../../services/sync/graphClient';
import { downloadAuthenticatedGraphFile } from '../../services/sync/graphFileTransfer';

const TEAM_NAME = 'NorthGroup Schedule';
const CACHE_PREFIX = 'northgroup_one_teams_channel_cache_v2';
const MEDIA_DIRECTORY = `${FileSystem.documentDirectory || FileSystem.cacheDirectory}northgroup-feed-media/`;
const LEGACY_MEDIA_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-feed-media/`;

export const TEAMS_CHANNELS = {
  northgroup: {
    key: 'northgroup',
    name: 'NorthGroup',
    title: 'NorthGroup',
    description: 'Company updates, reminders and shared moments',
  },
  daily: {
    key: 'daily',
    name: 'Daily',
    title: 'Daily',
    description: 'Daily operations, priorities and field coordination',
  },
};

let resolvedChannels = null;

const normaliseName = (value) => String(value || '').trim().toLowerCase();
const encodePath = (value) => encodeURIComponent(String(value || ''));
const safePathPart = (value) => (
  String(value || '').replace(/[^A-Za-z0-9_-]/g, '')
);

export const extractHostedContentIds = (html = '') => {
  const ids = [];
  const pattern = /hostedContents\/([^/?"'<>\s]+)\/\$value/gi;
  let match = pattern.exec(String(html || ''));
  while (match) {
    let id = match[1];
    try {
      id = decodeURIComponent(id);
    } catch {
      // Microsoft normally supplies a plain hosted-content id.
    }
    if (id && !ids.includes(id)) ids.push(id);
    match = pattern.exec(String(html || ''));
  }
  return ids;
};

export const feedImageExtension = (mimeType = '') => {
  const value = String(mimeType || '').toLowerCase();
  if (value.includes('png')) return 'png';
  if (value.includes('gif')) return 'gif';
  if (value.includes('webp')) return 'webp';
  if (value.includes('heic')) return 'heic';
  if (value.includes('heif')) return 'heif';
  return 'jpg';
};

export const feedMediaFileName = ({
  accountId,
  channelKey,
  messageId,
  mimeType,
}) => [
  safePathPart(accountId || 'employee'),
  '-',
  safePathPart(channelKey || 'channel'),
  '-',
  safePathPart(messageId || 'message'),
  '.',
  feedImageExtension(mimeType),
].join('');

const graphErrorMessage = (status, body) => {
  const message = body?.error?.message || '';
  if (status === 401) return 'Your Microsoft session needs to be refreshed.';
  if (status === 403) {
    return 'NorthGroup One does not yet have permission to read or post in this channel.';
  }
  if (status === 404) return 'The requested Team, channel or post could not be found.';
  return message || `Microsoft request failed (${status}).`;
};

const channelSyncConfig = (operation) => ({
  feature: 'teamsChannels',
  operation,
  errorMessage: graphErrorMessage,
});

const graphRequest = (url, accessToken, options = {}) => sharedGraphRequest(
  url,
  accessToken,
  options,
  channelSyncConfig(`${String(options.method || 'GET').toUpperCase()} Teams channel`),
);

const graphCollection = (url, accessToken) => sharedGraphCollection(
  url,
  accessToken,
  channelSyncConfig('Load Teams channel'),
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

const messageSender = (message) => {
  const user = message?.from?.user;
  const application = message?.from?.application;
  return {
    id: user?.id || application?.id || 'system',
    name: user?.displayName || application?.displayName || 'NorthGroup',
  };
};

const normaliseReply = (message) => {
  const sender = messageSender(message);
  return {
    id: String(message?.id || ''),
    senderId: sender.id,
    senderName: sender.name,
    text: htmlToText(message?.body?.content),
    createdAt: message?.createdDateTime || message?.lastModifiedDateTime || '',
    editedAt: message?.lastEditedDateTime || '',
  };
};

const normaliseMessage = (message, channelKey, image = {}) => {
  const sender = messageSender(message);
  const text = htmlToText(message?.body?.content);
  const media = typeof image === 'string' ? { uri: image } : (image || {});
  const imageExpected = media.expected ?? (
    messageContainsImage(message) || Boolean(media.uri)
  );
  const replies = (Array.isArray(message?.replies) ? message.replies : [])
    .filter((reply) => !reply?.deletedDateTime)
    .map(normaliseReply)
    .filter((reply) => reply.id && reply.text)
    .sort((left, right) => (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    ));

  return {
    id: String(message?.id || ''),
    channelKey,
    senderId: sender.id,
    senderName: sender.name,
    text: text || (imageExpected ? '' : 'Shared an update'),
    subject: htmlToText(message?.subject),
    createdAt: message?.createdDateTime || message?.lastModifiedDateTime || '',
    editedAt: message?.lastEditedDateTime || '',
    webUrl: message?.webUrl || '',
    replies,
    replyCount: replies.length,
    attachmentCount: Array.isArray(message?.attachments) ? message.attachments.length : 0,
    imageExpected,
    imageUri: media.uri || '',
    imageMimeType: media.mimeType || '',
    hostedContentId: media.hostedContentId || '',
  };
};

const cacheKey = (accountId, channelKey) => {
  const safeAccount = safePathPart(accountId || 'employee');
  const safeChannel = safePathPart(channelKey);
  return `${CACHE_PREFIX}:${safeAccount}:${safeChannel}`;
};

export const readCachedChannelMessages = async ({ accountId, channelKey }) => {
  try {
    const saved = await AsyncStorage.getItem(cacheKey(accountId, channelKey));
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeCachedChannelMessages = async ({ accountId, channelKey, messages }) => {
  try {
    await AsyncStorage.setItem(cacheKey(accountId, channelKey), JSON.stringify(messages));
  } catch {
    // A full cache should never prevent the live Feed from working.
  }
};

const ensureMediaDirectory = async () => {
  const info = await FileSystem.getInfoAsync(MEDIA_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIRECTORY, { intermediates: true });
  }
};

const messageContainsImage = (message) => (
  /<img\b/i.test(String(message?.body?.content || ''))
);

const existingMediaUri = async (uri) => {
  const value = String(uri || '');
  if (!value) return '';
  try {
    const info = await FileSystem.getInfoAsync(value);
    return info.exists && Number(info.size || 0) > 0 ? value : '';
  } catch {
    return '';
  }
};

const mediaDestination = ({
  accountId,
  channelKey,
  messageId,
  mimeType,
}) => `${MEDIA_DIRECTORY}${feedMediaFileName({
  accountId,
  channelKey,
  messageId,
  mimeType,
})}`;

const persistFeedImage = async ({
  sourceUri,
  accountId,
  channelKey,
  messageId,
  mimeType,
}) => {
  const availableSource = await existingMediaUri(sourceUri);
  if (!availableSource) return '';

  await ensureMediaDirectory();
  const destination = mediaDestination({
    accountId,
    channelKey,
    messageId,
    mimeType,
  });
  if (availableSource === destination) return destination;

  const existingDestination = await existingMediaUri(destination);
  if (existingDestination) return existingDestination;

  await FileSystem.copyAsync({ from: availableSource, to: destination });
  return destination;
};

const loadHostedImage = async ({
  accessToken,
  accountId,
  channel,
  message,
  existingMessage,
}) => {
  const expected = messageContainsImage(message) || Boolean(existingMessage?.imageExpected);
  if (!expected) return { expected: false, uri: '' };

  const fallbackUri = await existingMediaUri(existingMessage?.imageUri);
  const fallbackMimeType = existingMessage?.imageMimeType || 'image/jpeg';

  if (fallbackUri) {
    try {
      const durableUri = await persistFeedImage({
        sourceUri: fallbackUri,
        accountId,
        channelKey: channel.key,
        messageId: message.id,
        mimeType: fallbackMimeType,
      });
      if (durableUri) {
        return {
          expected: true,
          uri: durableUri,
          mimeType: fallbackMimeType,
          hostedContentId: existingMessage?.hostedContentId || '',
        };
      }
    } catch {
      // Continue to Microsoft so a failed local migration can repair itself.
    }
  }

  try {
    let hostedContents = [];
    try {
      hostedContents = await graphCollection(
        `${GRAPH_ROOT}/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages/${encodePath(message.id)}/hostedContents`,
        accessToken,
      );
    } catch {
      // The id embedded in the message body can still restore the photo when
      // listing hosted content is temporarily unavailable.
    }
    const bodyIds = extractHostedContentIds(message?.body?.content);
    const hostedById = new Map(
      hostedContents.filter((item) => item?.id).map((item) => [item.id, item]),
    );
    const candidates = [
      ...bodyIds.map((id) => hostedById.get(id) || ({ id })),
      ...(existingMessage?.hostedContentId
        ? [hostedById.get(existingMessage.hostedContentId)
          || { id: existingMessage.hostedContentId }]
        : []),
      ...hostedContents.filter((item) => item?.id),
    ].filter((item, index, values) => (
      values.findIndex((candidate) => candidate.id === item.id) === index
    ));
    const image = candidates[0];
    if (!image?.id) {
      return { expected: true, uri: fallbackUri, mimeType: fallbackMimeType };
    }

    const mimeType = image.contentType || fallbackMimeType || 'image/jpeg';
    await ensureMediaDirectory();
    const destination = mediaDestination({
      accountId,
      channelKey: channel.key,
      messageId: message.id,
      mimeType,
    });
    const cached = await FileSystem.getInfoAsync(destination);
    if (cached.exists && Number(cached.size || 0) > 0) {
      return {
        expected: true,
        uri: destination,
        mimeType,
        hostedContentId: image.id,
      };
    }

    const result = await downloadAuthenticatedGraphFile({
      accessToken,
      urlOrPath: `/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages/${encodePath(message.id)}/hostedContents/${encodePath(image.id)}/$value`,
      destination,
      options: {
        headers: {
          Accept: image.contentType || 'image/*',
        },
      },
    });
    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      return { expected: true, uri: fallbackUri, mimeType: fallbackMimeType };
    }
    return {
      expected: true,
      uri: destination,
      mimeType,
      hostedContentId: image.id,
    };
  } catch {
    return { expected: true, uri: fallbackUri, mimeType: fallbackMimeType };
  }
};

export const removeFeedMediaFile = async (uri) => {
  const value = String(uri || '');
  const appManaged = value.startsWith(MEDIA_DIRECTORY)
    || value.startsWith(LEGACY_MEDIA_CACHE_DIRECTORY);
  if (!appManaged) return false;
  await FileSystem.deleteAsync(value, { idempotent: true }).catch(() => {});
  return true;
};

export const resolveNorthGroupChannels = async (accessToken, { force = false } = {}) => {
  if (resolvedChannels && !force) return resolvedChannels;

  const teams = await graphCollection(
    `${GRAPH_ROOT}/me/joinedTeams?$select=id,displayName`,
    accessToken,
  );
  const team = teams.find((item) => normaliseName(item.displayName) === normaliseName(TEAM_NAME));
  if (!team) {
    throw new Error(`You are not currently a member of the "${TEAM_NAME}" Team.`);
  }

  const channels = await graphCollection(
    `${GRAPH_ROOT}/teams/${encodePath(team.id)}/channels?$select=id,displayName,description,membershipType,webUrl`,
    accessToken,
  );

  const mapped = Object.fromEntries(
    Object.values(TEAMS_CHANNELS).map((definition) => {
      const channel = channels.find(
        (item) => normaliseName(item.displayName) === normaliseName(definition.name),
      );
      return [definition.key, channel ? { ...definition, ...channel, teamId: team.id } : null];
    }),
  );

  const missing = Object.values(TEAMS_CHANNELS)
    .filter((definition) => !mapped[definition.key])
    .map((definition) => definition.name);
  if (missing.length) {
    throw new Error(`The ${missing.join(' and ')} channel${missing.length > 1 ? 's were' : ' was'} not found in ${TEAM_NAME}.`);
  }

  resolvedChannels = mapped;
  return mapped;
};

export const loadTeamsChannelMessages = async ({
  accessToken,
  accountId,
  channelKey,
}) => {
  const channels = await resolveNorthGroupChannels(accessToken);
  const channel = channels[channelKey];
  if (!channel) throw new Error('This NorthGroup channel is not configured.');

  const messages = await graphCollection(
    `${GRAPH_ROOT}/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages?$top=50&$expand=replies`,
    accessToken,
  );
  const cachedMessages = await readCachedChannelMessages({ accountId, channelKey });
  const cachedById = new Map(
    cachedMessages.map((message) => [String(message?.id || ''), message]),
  );
  const liveMessages = messages
    .filter((message) => message?.messageType === 'message' && !message?.deletedDateTime);
  const hydrated = await Promise.all(liveMessages.map(async (message) => {
    const image = await loadHostedImage({
      accessToken,
      accountId,
      channel,
      message,
      existingMessage: cachedById.get(String(message?.id || '')),
    });
    return normaliseMessage(message, channelKey, image);
  }));
  const normalised = hydrated
    .filter((message) => (
      message.id
      && (message.text || message.subject || message.imageUri || message.imageExpected)
    ))
    .sort((left, right) => (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ));

  await writeCachedChannelMessages({ accountId, channelKey, messages: normalised });
  return { channel, messages: normalised };
};

export const loadUnifiedTeamsFeed = async ({
  accessToken,
  accountId,
}) => {
  const results = await Promise.all(
    Object.keys(TEAMS_CHANNELS).map((channelKey) => loadTeamsChannelMessages({
      accessToken,
      accountId,
      channelKey,
    })),
  );
  return results
    .flatMap((result) => result.messages)
    .sort((left, right) => (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ));
};

export const readCachedUnifiedTeamsFeed = async ({ accountId }) => {
  const cached = await Promise.all(
    Object.keys(TEAMS_CHANNELS).map((channelKey) => (
      readCachedChannelMessages({ accountId, channelKey })
    )),
  );
  return cached
    .flat()
    .sort((left, right) => (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    ));
};

export const sendTeamsChannelMessage = async ({
  accessToken,
  accountId,
  channelKey,
  text,
  image,
}) => {
  const channels = await resolveNorthGroupChannels(accessToken);
  const channel = channels[channelKey];
  if (!channel) throw new Error('This NorthGroup channel is not configured.');

  const cleanText = String(text || '').trim();
  const body = image?.base64
    ? {
      body: {
        contentType: 'html',
        content: `${cleanText ? `<p>${escapeHtml(cleanText)}</p>` : ''}<img src="../hostedContents/1/$value">`,
      },
      hostedContents: [
        {
          '@microsoft.graph.temporaryId': '1',
          contentBytes: image.base64,
          contentType: image.mimeType || 'image/jpeg',
        },
      ],
    }
    : {
      body: {
        contentType: 'text',
        content: cleanText,
      },
    };

  const message = await graphRequest(
    `${GRAPH_ROOT}/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );

  let imageUri = '';
  if (image?.uri) {
    imageUri = await persistFeedImage({
      sourceUri: image.uri,
      accountId,
      channelKey,
      messageId: message?.id,
      mimeType: image.mimeType || 'image/jpeg',
    }).catch(() => image.uri);
  }
  const posted = normaliseMessage(message, channelKey, {
    expected: Boolean(image),
    uri: imageUri,
    mimeType: image?.mimeType || '',
  });
  const cached = await readCachedChannelMessages({ accountId, channelKey });
  const messages = [posted, ...cached.filter((item) => item.id !== posted.id)];
  await writeCachedChannelMessages({ accountId, channelKey, messages });
  return posted;
};

export const sendTeamsChannelReply = async ({
  accessToken,
  accountId,
  channelKey,
  messageId,
  text,
}) => {
  const channels = await resolveNorthGroupChannels(accessToken);
  const channel = channels[channelKey];
  if (!channel) throw new Error('This NorthGroup channel is not configured.');

  const reply = await graphRequest(
    `${GRAPH_ROOT}/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages/${encodePath(messageId)}/replies`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        body: {
          contentType: 'text',
          content: String(text || '').trim(),
        },
      }),
    },
  );
  const normalised = normaliseReply(reply);

  const cached = await readCachedChannelMessages({ accountId, channelKey });
  const messages = cached.map((message) => {
    if (message.id !== messageId) return message;
    const replies = [
      ...(message.replies || []).filter((item) => item.id !== normalised.id),
      normalised,
    ];
    return {
      ...message,
      replies,
      replyCount: replies.length,
    };
  });
  await writeCachedChannelMessages({ accountId, channelKey, messages });
  return normalised;
};
