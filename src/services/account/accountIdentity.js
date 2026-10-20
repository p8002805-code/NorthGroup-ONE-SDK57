let activeAccountId = '';

const cleanSegment = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, '_');

export const setActiveAccountId = (userId) => {
  activeAccountId = cleanSegment(userId);
  return activeAccountId;
};

export const clearActiveAccountId = () => {
  activeAccountId = '';
};

export const getActiveAccountId = () => activeAccountId;

export const accountStorageKey = (base) => {
  if (!activeAccountId) {
    throw new Error('Complete profile setup before accessing account data.');
  }
  return `${base}__account_${activeAccountId}`;
};

export const accountDirectoryName = () => {
  if (!activeAccountId) {
    throw new Error('Complete profile setup before accessing account files.');
  }
  return `Accounts/${activeAccountId}/`;
};
