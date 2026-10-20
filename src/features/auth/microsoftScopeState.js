const normaliseScope = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/^https:\/\/graph\.microsoft\.com\//, '');

export const normaliseMicrosoftScopes = (value) => {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(/\s+/);
  return [...new Set(values.map(normaliseScope).filter(Boolean))];
};

export const grantedMicrosoftScopes = (token, requestedScopes = []) => {
  const explicit = token?.scope || token?.rawResponse?.scope || '';
  // OAuth token responses may omit scope when it is identical to the request.
  return normaliseMicrosoftScopes(explicit || requestedScopes);
};

export const missingMicrosoftScopes = (grantedScopes, requiredScopes) => {
  const granted = new Set(normaliseMicrosoftScopes(grantedScopes));
  return normaliseMicrosoftScopes(requiredScopes).filter((scope) => !granted.has(scope));
};

export const assertMicrosoftScopes = (grantedScopes, requiredScopes) => {
  const missing = missingMicrosoftScopes(grantedScopes, requiredScopes);
  if (!missing.length) return;
  const error = new Error(
    'Microsoft sign-in did not return the assigned-employee permission. Sign in again after the administrator grant has finished applying.',
  );
  error.code = 'MICROSOFT_SCOPE_MISSING';
  error.missingScopes = missing;
  throw error;
};
