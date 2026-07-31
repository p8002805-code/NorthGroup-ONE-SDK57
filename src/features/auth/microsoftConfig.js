export const MICROSOFT_CLIENT_ID = 'd35b703e-63b6-4fdb-8018-031a571e1573';
export const MICROSOFT_TENANT_ID = 'e3c61ea6-0590-4aa5-8cc9-15324de5c3fa';
export const MICROSOFT_REDIRECT_URI = 'msauth.com.northgroup.northgroupone://auth';

export const MICROSOFT_BASE_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  'Team.ReadBasic.All',
  'Channel.ReadBasic.All',
  'ChannelMessage.Read.All',
  'ChannelMessage.Send',
  'Schedule.Read.All',
  'Files.ReadWrite',
  'Files.Read.All',
  'Files.ReadWrite.All',
  'Sites.Read.All',
];

export const MICROSOFT_CHAT_SCOPES = [
  'Chat.Create',
  'Chat.Read',
  'ChatMessage.Send',
  'ChatMember.ReadWrite',
];

export const MICROSOFT_SCOPES = [
  ...MICROSOFT_BASE_SCOPES,
  ...MICROSOFT_CHAT_SCOPES,
];

// Kept as an alias for compatibility. Job Chat now uses the same Microsoft
// session as the rest of NorthGroup One, so users sign in only once.
export const MICROSOFT_JOB_CHAT_SCOPES = MICROSOFT_SCOPES;

const authority = `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/oauth2/v2.0`;

export const MICROSOFT_DISCOVERY = {
  authorizationEndpoint: `${authority}/authorize`,
  tokenEndpoint: `${authority}/token`,
};

export const MICROSOFT_GRAPH_ME = 'https://graph.microsoft.com/v1.0/me';
