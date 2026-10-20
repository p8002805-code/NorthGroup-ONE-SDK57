import AsyncStorage from '@react-native-async-storage/async-storage';

// Small helpers that stop two kinds of silent data loss:
//   1. One corrupted saved value crashing a whole workspace load (safeParse).
//   2. Yesterday's forms being deleted outright (archiveStaleForm).
//
// Archived copies live next to the original key as `<key>__archive`, so they
// stay scoped to the same account and job automatically.

export const ARCHIVE_SUFFIX = '__archive';
export const ARCHIVE_LIMIT = 28;

export const archiveKeyFor = (key) => `${key}${ARCHIVE_SUFFIX}`;

// Never throws. Returns `fallback` for empty or unreadable text.
export const safeParse = (raw, fallback = null) => {
  if (typeof raw !== 'string' || raw === '') return fallback;
  try {
    const value = JSON.parse(raw);
    return value === undefined || value === null ? fallback : value;
  } catch (_error) {
    return fallback;
  }
};

// Copies `raw` into the key's archive (newest first, capped at `limit`
// entries), then - only if that succeeded - removes the original key.
// If the archive write fails this throws BEFORE anything is removed, so the
// caller can retry later without losing the form.
export const archiveStaleForm = async (
  key,
  raw,
  { reason = 'stale', remove = true, limit = ARCHIVE_LIMIT, now = new Date() } = {},
) => {
  if (!key) return false;

  const hasContent = typeof raw === 'string' && raw.length > 0;
  if (hasContent) {
    const archiveKey = archiveKeyFor(key);
    // getItem is allowed to throw here: better to stop than to overwrite an
    // archive we could not read.
    const existing = safeParse(await AsyncStorage.getItem(archiveKey), []);
    const list = Array.isArray(existing) ? existing : [];

    if (!list.some((entry) => entry?.raw === raw)) {
      const next = [
        { archivedAt: now.toISOString(), reason, raw },
        ...list,
      ].slice(0, limit);
      await AsyncStorage.setItem(archiveKey, JSON.stringify(next));
    }
  }

  if (remove) await AsyncStorage.removeItem(key);
  return hasContent;
};

// Parses stored JSON. If it is corrupt, keeps a copy of the raw text in the
// archive (so a bad value is never silently overwritten) and returns fallback.
export const parseStoredJson = async (key, raw, fallback = null) => {
  if (typeof raw !== 'string' || raw === '') return fallback;
  try {
    const value = JSON.parse(raw);
    return value === undefined || value === null ? fallback : value;
  } catch (_error) {
    try {
      await archiveStaleForm(key, raw, { reason: 'corrupt', remove: false });
    } catch (_archiveError) {
      // Could not keep a copy; still return the fallback so the app loads.
    }
    return fallback;
  }
};

// For a future "Previous days" screen.
export const loadArchivedForms = async (key) => {
  const list = safeParse(await AsyncStorage.getItem(archiveKeyFor(key)), []);
  return (Array.isArray(list) ? list : []).map((entry) => ({
    archivedAt: entry?.archivedAt || '',
    reason: entry?.reason || '',
    raw: entry?.raw || '',
    form: safeParse(entry?.raw, null),
  }));
};
