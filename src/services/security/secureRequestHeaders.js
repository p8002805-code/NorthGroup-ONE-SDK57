const FORBIDDEN_CALLER_HEADERS = new Set([
  'authorization',
  'cookie',
  'host',
  'proxy-authorization',
]);

const hasControlCharacters = (value) => /[\u0000-\u001F\u007F]/.test(String(value || ''));

const headerEntries = (headers) => {
  if (!headers) return [];
  if (typeof headers.entries === 'function') return [...headers.entries()];
  return Object.entries(headers);
};

export const sanitiseCallerHeaders = (headers = {}) => {
  const safe = {};
  headerEntries(headers).forEach(([rawName, rawValue]) => {
    const name = String(rawName || '').trim();
    const value = String(rawValue ?? '');
    if (!name || hasControlCharacters(name) || hasControlCharacters(value)) return;
    if (FORBIDDEN_CALLER_HEADERS.has(name.toLowerCase())) return;
    safe[name] = value;
  });
  return safe;
};

export const buildBearerRequestHeaders = ({
  accessToken,
  defaults = {},
  headers = {},
}) => {
  const token = String(accessToken || '').trim();
  if (!token || hasControlCharacters(token)) {
    const error = new Error('Sign in with Microsoft before transferring protected information.');
    error.code = 'SYNC_AUTH';
    error.status = 401;
    throw error;
  }

  return {
    ...sanitiseCallerHeaders(defaults),
    ...sanitiseCallerHeaders(headers),
    Authorization: `Bearer ${token}`,
  };
};
