export const GRAPH_ROOT = 'https://graph.microsoft.com/v1.0';

export const DEFAULT_SYNC_TIMEOUT_MS = 20000;
export const DEFAULT_SYNC_RETRY_COUNT = 2;

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const IDEMPOTENT_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

const clean = (value) => String(value || '').trim();

export const syncErrorCode = (status, { timedOut = false, networkError = false } = {}) => {
  if (timedOut) return 'SYNC_TIMEOUT';
  if (networkError || !status) return 'SYNC_OFFLINE';
  if (status === 401) return 'SYNC_AUTH';
  if (status === 403) return 'SYNC_PERMISSION';
  if (status === 404) return 'SYNC_NOT_FOUND';
  if (status === 409 || status === 412) return 'SYNC_CONFLICT';
  if (status === 408 || status === 425 || status === 429) return 'SYNC_THROTTLED';
  if (status >= 500) return 'SYNC_SERVER';
  return 'SYNC_REQUEST';
};

export const syncErrorMessage = ({
  status = 0,
  detail = '',
  fallback = '',
  timedOut = false,
  networkError = false,
} = {}) => {
  const supplied = clean(detail);
  if (supplied) return supplied;
  const code = syncErrorCode(status, { timedOut, networkError });
  if (code === 'SYNC_TIMEOUT') return 'The connection timed out. Check coverage and try again.';
  if (code === 'SYNC_OFFLINE') return 'NorthGroup ONE could not reach Microsoft. Check your connection and try again.';
  if (code === 'SYNC_AUTH') return 'Your Microsoft session needs to be refreshed.';
  if (code === 'SYNC_PERMISSION') return 'Your Microsoft account does not have permission for this action.';
  if (code === 'SYNC_NOT_FOUND') return clean(fallback) || 'The requested Microsoft item could not be found.';
  if (code === 'SYNC_CONFLICT') return 'A newer shared version exists. Reload it before saving your changes.';
  if (code === 'SYNC_THROTTLED') return 'Microsoft is busy. NorthGroup ONE will pause briefly before trying again.';
  if (code === 'SYNC_SERVER') return 'Microsoft is temporarily unavailable. Please try again shortly.';
  return clean(fallback) || `Microsoft request failed${status ? ` (${status})` : ''}.`;
};

export const shouldRetrySyncRequest = ({
  method = 'GET',
  status = 0,
  networkError = false,
  retryMode = 'safe',
} = {}) => {
  if (retryMode === 'never') return false;
  const normalisedMethod = clean(method).toUpperCase() || 'GET';
  const allowedMethods = retryMode === 'idempotent'
    ? IDEMPOTENT_RETRY_METHODS
    : SAFE_RETRY_METHODS;
  if (!allowedMethods.has(normalisedMethod)) return false;
  return networkError || RETRYABLE_STATUSES.has(Number(status || 0));
};

export const retryAfterMilliseconds = (value, now = Date.now()) => {
  const cleanValue = clean(value);
  if (!cleanValue) return 0;
  const seconds = Number(cleanValue);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = new Date(cleanValue).getTime();
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
};

export const syncRetryDelayMs = ({ attempt = 0, retryAfter = '', random = Math.random } = {}) => {
  const supplied = retryAfterMilliseconds(retryAfter);
  if (supplied) return Math.min(8000, Math.max(250, supplied));
  const exponent = Math.max(0, Number(attempt || 0));
  const jitter = Math.round(Math.max(0, Math.min(1, Number(random?.() ?? 0.5))) * 250);
  return Math.min(8000, 500 * (2 ** exponent) + jitter);
};

export const normaliseSyncFeature = (value) => clean(value)
  .replace(/[^A-Za-z0-9_-]/g, '')
  .slice(0, 48) || 'microsoft';

