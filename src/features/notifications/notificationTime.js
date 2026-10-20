const validDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const clockTime = (date) => date.toLocaleTimeString('en-AU', {
  hour: 'numeric',
  minute: '2-digit',
});

export const formatNotificationTime = (value, nowValue = Date.now()) => {
  const date = validDate(value);
  const now = validDate(nowValue);
  if (!date || !now) return '';

  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 3600) return clockTime(date);
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return `Yesterday · ${clockTime(date)}`;
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};
