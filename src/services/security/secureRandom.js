import * as Crypto from 'expo-crypto';

const safePrefix = (value) => String(value || 'item')
  .replace(/[^A-Za-z0-9_-]/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 32) || 'item';

export const secureRandomId = (prefix = 'item') => (
  `${safePrefix(prefix)}-${Crypto.randomUUID()}`
);
