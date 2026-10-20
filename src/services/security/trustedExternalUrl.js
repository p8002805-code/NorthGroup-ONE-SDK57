const hasTrustedHost = (hostname, trustedHosts) => trustedHosts.some((host) => (
  hostname === host || hostname.endsWith(`.${host}`)
));

const isTrustedHttpsUrl = (value, trustedHosts) => {
  try {
    const parsed = new URL(String(value || ''));
    return parsed.protocol === 'https:'
      && !parsed.username
      && !parsed.password
      && hasTrustedHost(parsed.hostname.toLowerCase(), trustedHosts);
  } catch {
    return false;
  }
};

export const isSecureMicrosoftTransferUrl = (value) => {
  try {
    const parsed = new URL(String(value || ''));
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    const blockedHostname = (
      hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname.endsWith('.local')
      || hostname.includes(':')
    );
    const blockedIpv4 = ipv4 && (() => {
      const [a, b] = ipv4.slice(1).map(Number);
      return a === 0
        || a === 10
        || (a === 100 && b >= 64 && b <= 127)
        || a === 127
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && b === 0)
        || (a === 192 && b === 168)
        || (a === 198 && (b === 18 || b === 19 || b === 51))
        || (a === 203 && b === 0)
        || a >= 224;
    })();
    // Microsoft Graph can return short-lived, preauthenticated file URLs from
    // several SharePoint/OneDrive delivery hosts. Keep this list aligned with
    // Microsoft's published Microsoft 365 and OneDrive endpoints. Callers
    // must still fall back to the authenticated Graph /content route when a
    // future Microsoft delivery host is not yet represented here.
    const trustedMicrosoftHost = [
      '1drv.com',
      'livefilestore.com',
      'onedrive.live.com',
      'sharepoint.com',
      'sharepointonline.com',
      'spoprod-a.akamaihd.net',
      'storage.live.com',
      'svc.ms',
    ].some((host) => hostname === host || hostname.endsWith(`.${host}`));

    return parsed.protocol === 'https:'
      && (!parsed.port || parsed.port === '443')
      && !parsed.username
      && !parsed.password
      && !blockedHostname
      && !blockedIpv4
      && trustedMicrosoftHost;
  } catch {
    return false;
  }
};

const TRUSTED_TEAMS_HOSTS = [
  'teams.microsoft.com',
  'teams.cloud.microsoft',
];

export const isTrustedTeamsWebUrl = (value) => (
  isTrustedHttpsUrl(value, TRUSTED_TEAMS_HOSTS)
);

export const isTrustedBomWebUrl = (value) => (
  isTrustedHttpsUrl(value, ['bom.gov.au'])
);
