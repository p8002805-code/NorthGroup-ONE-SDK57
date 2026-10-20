const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const KNOWN_USER_INITIALS = Object.freeze({
  'liam b': 'LTB',
  'louis b': 'LB',
});

const namePartsFrom = ({ firstName = '', lastName = '', fullName = '' } = {}) => {
  const combined = clean(fullName || `${clean(firstName)} ${clean(lastName)}`);
  return combined.split(/\s+/).filter(Boolean);
};

export const suggestedUserInitials = ({
  firstName = '',
  lastName = '',
  fullName = '',
} = {}) => {
  const parts = namePartsFrom({ firstName, lastName, fullName });
  const nameKey = parts.join(' ').toLocaleLowerCase('en-AU');
  if (KNOWN_USER_INITIALS[nameKey]) return KNOWN_USER_INITIALS[nameKey];

  return parts
    .map((part) => part[0]?.toUpperCase())
    .filter(Boolean)
    .join('')
    .slice(0, 4);
};

export const resolveUserInitials = ({
  firstName = '',
  lastName = '',
  fullName = '',
  initials = '',
  fallback = 'NG',
} = {}) => {
  // Profile Settings is the source of truth. Automatic/known mappings are
  // only fallbacks for profiles that do not yet have initials saved.
  const supplied = clean(initials).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (supplied) return supplied;

  const suggested = suggestedUserInitials({ firstName, lastName, fullName });
  return suggested || fallback;
};
