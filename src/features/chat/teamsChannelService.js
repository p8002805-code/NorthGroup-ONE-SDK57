import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';
const TEAM_NAME = 'NorthGroup Schedule';
const CACHE_PREFIX = 'northgroup_one_teams_channel_cache_v2';
const MEDIA_CACHE_DIRECTORY = `${FileSystem.cacheDirectory}northgroup-feed-media/`;

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

const graphErrorMessage = (status, body) => {
  const message = body?.error?.message || '';
  if (status === 401) return 'Your Microsoft session needs to be refreshed.';
  if (status === 403) {
    return 'NorthGroup One does not yet have permission to read or post in this channel.';
  }
  if (status === 404) return 'The requested Team, channel or post could not be found.';
  return message || `Microsoft request failed (${status}).`;
};

const graphRequest = async (url, accessToken, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const error = new Error(graphErrorMessage(response.status, body));
    error.status = response.status;
    throw error;
  }

  return body;
};

const graphCollection = async (url, accessToken) => {
  const values = [];
  let nextUrl = url;

  while (nextUrl) {
    const body = await graphRequest(nextUrl, accessToken);
    values.push(...(Array.isArray(body?.value) ? body.value : []));
    nextUrl = body?.['@odata.nextLink'] || '';
  }

  return values;
};

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

const normaliseMessage = (message, channelKey, imageUri = '') => {
  const sender = messageSender(message);
  const text = htmlToText(message?.body?.content);
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
    text: text || (imageUri ? '' : 'Shared an update'),
    subject: htmlToText(message?.subject),
    createdAt: message?.createdDateTime || message?.lastModifiedDateTime || '',
    editedAt: message?.lastEditedDateTime || '',
    webUrl: message?.webUrl || '',
    replies,
    replyCount: replies.length,
    attachmentCount: Array.isArray(message?.attachments) ? message.attachments.length : 0,
    imageUri,
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

const ensureMediaCache = async () => {
  const info = await FileSystem.getInfoAsync(MEDIA_CACHE_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_CACHE_DIRECTORY, { intermediates: true });
  }
};

const messageContainsImage = (message) => (
  /<img\b/i.test(String(message?.body?.content || ''))
);

const loadHostedImage = async ({
  accessToken,
  accountId,
  channel,
  message,
}) => {
  if (!messageContainsImage(message)) return '';

  try {
    const hostedContents = await graphCollection(
      `${GRAPH_ROOT}/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages/${encodePath(message.id)}/hostedContents`,
      accessToken,
    );
    // Microsoft intentionally returns contentType as null when hosted content
    // is listed. The body image reference tells us that the first hosted item
    // is the inline image we need to download.
    const image = hostedContents[0];
    if (!image?.id) return '';

    await ensureMediaCache();
    const extension = 'jpg';
    const destination = [
      MEDIA_CACHE_DIRECTORY,
      safePathPart(accountId),
      '-',
      safePathPart(channel.key),
      '-',
      safePathPart(message.id),
      '-',
      safePathPart(image.id),
      '.',
      extension,
    ].join('');
    const cached = await FileSystem.getInfoAsync(destination);
    if (cached.exists && Number(cached.size || 0) > 0) return destination;

    const result = await FileSystem.downloadAsync(
      `${GRAPH_ROOT}/teams/${encodePath(channel.teamId)}/channels/${encodePath(channel.id)}/messages/${encodePath(message.id)}/hostedContents/${encodePath(image.id)}/$value`,
      destination,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: image.contentType || 'image/*',
        },
      },
    );
    if (result.status < 200 || result.status >= 300) {
      await FileSystem.deleteAsync(destination, { idempotent: true });
      return '';
    }
    return destination;
  } catch {
    return '';
  }
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
  const liveMessages = messages
    .filter((message) => message?.messageType === 'message' && !message?.deletedDateTime);
  const hydrated = await Promise.all(liveMessages.map(async (message) => {
    const imageUri = await loadHostedImage({
      accessToken,
      accountId,
      channel,
      message,
    });
    return normaliseMessage(message, channelKey, imageUri);
  }));
  const normalised = hydrated
    .filter((message) => message.id && (message.text || message.subject || message.imageUri))
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

  const posted = normaliseMessage(message, channelKey, image?.uri || '');
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
