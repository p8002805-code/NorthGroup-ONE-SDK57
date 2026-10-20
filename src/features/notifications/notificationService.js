import AsyncStorage from '@react-native-async-storage/async-storage';

import { accountStorageKey } from '../../services/account/accountIdentity';
import { secureRandomId } from '../../services/security/secureRandom';

export const NOTIFICATIONS_KEY = 'northgroup_one_notifications_v1';
export const MAX_NOTIFICATIONS = 60;

export const NOTIFICATION_TYPES = {
  ACTIVITY: 'activity',
  JOB: 'job',
  WORKSPACE: 'workspace',
  FEED: 'feed',
  CHAT: 'chat',
  FILE: 'file',
};

const clean = (value) => String(value || '').trim();

const normaliseCreatedAt = (value, fallback = new Date().toISOString()) => {
  const parsed = Date.parse(value || '');
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
};

const parseNotifications = (value) => {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.map(normaliseNotification) : [];
  } catch (_error) {
    return [];
  }
};

const normaliseNotification = (item = {}) => ({
  ...item,
  id: clean(item.id),
  type: clean(item.type) || NOTIFICATION_TYPES.ACTIVITY,
  title: clean(item.title),
  message: clean(item.message),
  sourceId: clean(item.sourceId),
  target: clean(item.target) || 'Notifications',
  targetParams: item.targetParams && typeof item.targetParams === 'object'
    ? item.targetParams
    : {},
  jobNumber: clean(item.jobNumber),
  icon: clean(item.icon) || 'notifications-outline',
  dedupeKey: clean(item.dedupeKey),
  createdAt: normaliseCreatedAt(item.createdAt, new Date(0).toISOString()),
  read: Boolean(item.read),
});

const notificationsStorageKey = () => accountStorageKey(NOTIFICATIONS_KEY);

const notificationId = () => (
  secureRandomId('notification')
);

export const loadNotifications = async () => {
  const saved = await AsyncStorage.getItem(notificationsStorageKey());
  return parseNotifications(saved)
    .filter((item) => item && item.id)
    .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''));
};

export const getUnreadNotificationCount = async () => {
  const notifications = await loadNotifications();
  return notifications.filter((item) => !item.read).length;
};

export const addNotification = async ({
  type = NOTIFICATION_TYPES.ACTIVITY,
  title,
  message,
  sourceId = '',
  target = 'Notifications',
  targetParams = {},
  jobNumber = '',
  icon = 'notifications-outline',
  dedupeKey = '',
  createdAt = '',
}) => {
  const cleanTitle = clean(title);
  const cleanMessage = clean(message);
  if (!cleanTitle || !cleanMessage) {
    return { added: false, notifications: await loadNotifications() };
  }

  const current = await loadNotifications();
  const stableDedupeKey = clean(dedupeKey || sourceId);
  if (stableDedupeKey && current.some((item) => item.dedupeKey === stableDedupeKey)) {
    return { added: false, notifications: current };
  }

  const item = {
    id: notificationId(),
    type: clean(type) || NOTIFICATION_TYPES.ACTIVITY,
    title: cleanTitle,
    message: cleanMessage,
    sourceId: clean(sourceId),
    target: clean(target) || 'Notifications',
    targetParams: targetParams && typeof targetParams === 'object' ? targetParams : {},
    jobNumber: clean(jobNumber),
    icon: clean(icon) || 'notifications-outline',
    dedupeKey: stableDedupeKey,
    createdAt: normaliseCreatedAt(createdAt),
    read: false,
  };

  const next = [item, ...current].slice(0, MAX_NOTIFICATIONS);
  await AsyncStorage.setItem(notificationsStorageKey(), JSON.stringify(next));
  return { added: true, item, notifications: next };
};

export const clearReadNotifications = async () => {
  const current = await loadNotifications();
  const next = current.filter((item) => !item.read);
  await AsyncStorage.setItem(notificationsStorageKey(), JSON.stringify(next));
  return next;
};

export const getNotificationTypeLabel = (type) => {
  switch (type) {
    case NOTIFICATION_TYPES.JOB:
      return 'Jobs';
    case NOTIFICATION_TYPES.WORKSPACE:
      return 'Workspace';
    case NOTIFICATION_TYPES.FEED:
      return 'Feed';
    case NOTIFICATION_TYPES.CHAT:
      return 'Chats';
    case NOTIFICATION_TYPES.FILE:
      return 'Files';
    default:
      return 'Updates';
  }
};

export const markNotificationRead = async (id) => {
  const current = await loadNotifications();
  const next = current.map((item) => (
    item.id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item
  ));
  await AsyncStorage.setItem(notificationsStorageKey(), JSON.stringify(next));
  return next;
};

export const markAllNotificationsRead = async () => {
  const current = await loadNotifications();
  const readAt = new Date().toISOString();
  const next = current.map((item) => (
    item.read ? item : { ...item, read: true, readAt }
  ));
  await AsyncStorage.setItem(notificationsStorageKey(), JSON.stringify(next));
  return next;
};
