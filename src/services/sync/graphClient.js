import {
  DEFAULT_SYNC_RETRY_COUNT,
  DEFAULT_SYNC_TIMEOUT_MS,
  GRAPH_ROOT,
  shouldRetrySyncRequest,
  syncErrorCode,
  syncErrorMessage,
  syncRetryDelayMs,
} from './syncRules';
import {
  beginSyncOperation,
  finishSyncOperation,
} from './syncState';
import { buildBearerRequestHeaders } from '../security/secureRequestHeaders';

export { GRAPH_ROOT } from './syncRules';

const wait = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const GRAPH_ORIGIN = new URL(GRAPH_ROOT).origin;

const absoluteGraphUrl = (value) => {
  const supplied = String(value || '');
  const absolute = /^https?:\/\//i.test(supplied)
    ? supplied
    : `${GRAPH_ROOT}${supplied.startsWith('/') ? supplied : `/${supplied}`}`;

  let parsed;
  try {
    parsed = new URL(absolute);
  } catch (_error) {
    const error = new Error('Microsoft Graph rejected an invalid request address.');
    error.code = 'SYNC_UNTRUSTED_URL';
    throw error;
  }
  if (parsed.protocol !== 'https:' || parsed.origin !== GRAPH_ORIGIN) {
    const error = new Error('Microsoft Graph blocked an untrusted request address.');
    error.code = 'SYNC_UNTRUSTED_URL';
    throw error;
  }
  return parsed.toString();
};

export const resolveTrustedGraphUrl = (value) => absoluteGraphUrl(value);

const responseHeader = (response, name) => {
  try {
    return response?.headers?.get?.(name) || '';
  } catch {
    return '';
  }
};

const graphBody = async (response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export const graphErrorFromResponse = async (response, {
  fallback = '',
  errorMessage,
} = {}) => {
  const body = await graphBody(response);
  const detail = typeof body === 'string' ? '' : body?.error?.message || '';
  const message = typeof errorMessage === 'function'
    ? errorMessage(response.status, body)
    : syncErrorMessage({ status: response.status, detail, fallback });
  const error = new Error(message || syncErrorMessage({ status: response.status, detail, fallback }));
  error.status = response.status;
  error.code = syncErrorCode(response.status);
  error.body = body;
  return error;
};

const timedFetch = async (url, options, timeoutMs) => {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  let timeoutId;
  if (controller) {
    timeoutId = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  }
  try {
    return await fetch(url, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
    });
  } catch (cause) {
    const timedOut = cause?.name === 'AbortError';
    const error = new Error(syncErrorMessage({ timedOut, networkError: !timedOut }));
    error.code = syncErrorCode(0, { timedOut, networkError: !timedOut });
    error.timedOut = timedOut;
    error.networkError = !timedOut;
    error.cause = cause;
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const syncFetch = async (url, options = {}, config = {}) => {
  const method = String(options.method || 'GET').toUpperCase();
  const retryMode = config.retryMode || 'safe';
  const maxRetries = Math.max(0, Number(config.maxRetries ?? DEFAULT_SYNC_RETRY_COUNT));
  const acceptedStatuses = new Set(config.acceptedStatuses || []);
  const operationId = beginSyncOperation({
    feature: config.feature || 'microsoft',
    operation: config.operation || `${method} Microsoft Graph`,
    jobNumber: config.jobNumber || '',
  });
  let retries = 0;

  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await timedFetch(
        url,
        options,
        Number(config.timeoutMs || DEFAULT_SYNC_TIMEOUT_MS),
      );
    } catch (error) {
      if (attempt < maxRetries && shouldRetrySyncRequest({
        method,
        networkError: true,
        retryMode,
      })) {
        retries += 1;
        await wait(syncRetryDelayMs({ attempt }));
        continue;
      }
      await finishSyncOperation(operationId, { error, retries, status: 0 });
      throw error;
    }

    const accepted = response.ok || acceptedStatuses.has(response.status);
    if (accepted) {
      await finishSyncOperation(operationId, {
        retries,
        status: response.status || 200,
        accepted: true,
      });
      return response;
    }

    if (attempt < maxRetries && shouldRetrySyncRequest({
      method,
      status: response.status,
      retryMode,
    })) {
      retries += 1;
      await wait(syncRetryDelayMs({
        attempt,
        retryAfter: responseHeader(response, 'Retry-After'),
      }));
      continue;
    }

    const trackedError = new Error(syncErrorMessage({ status: response.status }));
    trackedError.status = response.status;
    trackedError.code = syncErrorCode(response.status);
    await finishSyncOperation(operationId, {
      error: trackedError,
      retries,
      status: response.status,
    });
    return response;
  }
};

export const graphFetch = async (urlOrPath, accessToken, options = {}, config = {}) => {
  return syncFetch(
    absoluteGraphUrl(urlOrPath),
    {
      ...options,
      headers: buildBearerRequestHeaders({
        accessToken,
        defaults: {
          Accept: 'application/json',
          ...(options.body && !options.headers?.['Content-Type']
            ? { 'Content-Type': 'application/json' }
            : {}),
        },
        headers: options.headers,
      }),
    },
    config,
  );
};

export const graphRequest = async (urlOrPath, accessToken, options = {}, config = {}) => {
  const response = await graphFetch(urlOrPath, accessToken, options, config);
  if (!response.ok && !(config.acceptedStatuses || []).includes(response.status)) {
    throw await graphErrorFromResponse(response, config);
  }
  if (response.status === 204) return null;
  return graphBody(response);
};

export const graphCollection = async (urlOrPath, accessToken, config = {}) => {
  const values = [];
  let nextUrl = absoluteGraphUrl(urlOrPath);
  while (nextUrl) {
    const body = await graphRequest(nextUrl, accessToken, {}, {
      ...config,
      operation: config.operation || 'Load Microsoft collection',
    });
    values.push(...(Array.isArray(body?.value) ? body.value : []));
    nextUrl = body?.['@odata.nextLink'] || '';
  }
  return values;
};
