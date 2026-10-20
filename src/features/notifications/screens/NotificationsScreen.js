import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  clearReadNotifications,
  getNotificationTypeLabel,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../notificationService';
import { useTheme } from '../../../theme/ThemeContext';
import { formatNotificationTime } from '../notificationTime';

const unreadCount = (items) => items.filter((item) => !item.read).length;

const FILTERS = [
  { key: 'all', label: 'All', icon: 'layers-outline' },
  { key: 'unread', label: 'Unread', icon: 'ellipse' },
  { key: 'workspace', label: 'Workspace', icon: 'briefcase-outline' },
  { key: 'chat', label: 'Chats', icon: 'chatbubbles-outline' },
  { key: 'feed', label: 'Feed', icon: 'megaphone-outline' },
];

const isWorkspaceType = (type) => ['workspace', 'job', 'file'].includes(type);

const matchesFilter = (item, filter) => {
  if (filter === 'all') return true;
  if (filter === 'unread') return !item.read;
  if (filter === 'workspace') return isWorkspaceType(item.type);
  return item.type === filter;
};

const groupLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return 'Earlier';
};

const appearanceFor = (type, colors) => {
  if (isWorkspaceType(type)) {
    return {
      accent: colors.accentDark,
      background: colors.accentSoft,
      label: type === 'job' ? 'Jobs' : 'Workspace',
    };
  }
  if (type === 'chat') {
    return {
      accent: colors.info,
      background: colors.infoBackground,
      label: 'Chats',
    };
  }
  if (type === 'feed') {
    return {
      accent: colors.success,
      background: colors.successBackground,
      label: 'Feed',
    };
  }
  return {
    accent: colors.supportingText,
    background: colors.inputBackground,
    label: getNotificationTypeLabel(type),
  };
};

function CompactNotificationsHeader({ insets, unread, goBack, markAllRead, colors, styles }) {
  return (
    <ImageBackground
      source={require('../../../../assets/topo-bg.png')}
      resizeMode="cover"
      style={styles.header}
      imageStyle={styles.headerImage}
    >
      <View style={styles.headerShade} />
      <View style={[styles.headerContent, { paddingTop: insets.top + 5 }]}>
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Return to dashboard"
            style={({ pressed }) => [styles.headerControl, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={23} color={colors.white} />
          </Pressable>

          <View style={styles.headerIdentity}>
            <Image
              source={require('../../../../assets/logo-transparent.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.headerCopy}>
              <Text style={styles.headerEyebrow}>NORTHGROUP ONE · ACTIVITY</Text>
              <Text style={styles.headerTitle}>Notifications</Text>
            </View>
          </View>

          <Pressable
            onPress={markAllRead}
            disabled={!unread}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={unread ? 'Mark all notifications read' : 'No unread notifications'}
            style={({ pressed }) => [
              styles.headerControl,
              unread && styles.headerControlActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={unread ? 'checkmark-done-outline' : 'notifications-outline'}
              size={20}
              color={unread ? colors.navy : colors.white}
            />
            {unread ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unread > 99 ? '99+' : unread}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        <View style={styles.headerStatusRow}>
          <View style={styles.liveDot} />
          <Text style={styles.headerStatus}>
            {unread
              ? `${unread} unread team ${unread === 1 ? 'update' : 'updates'}`
              : 'All team activity is up to date'}
          </Text>
          <View style={styles.headerStatusDivider} />
          <Ionicons name="sync-outline" size={12} color={colors.accent} />
          <Text style={styles.headerSync}>LIVE WORKSPACE SYNC</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

export default function NotificationsScreen({
  goBack,
  onUnreadCountChange,
  onOpenNotification,
  onRefreshActivity,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const sync = useCallback(async ({ quiet = false, remote = false } = {}) => {
    if (!quiet) setRefreshing(true);
    try {
      if (remote) await onRefreshActivity?.();
      const next = await loadNotifications();
      setNotifications(next);
      onUnreadCountChange?.(unreadCount(next));
    } finally {
      setLoading(false);
      if (!quiet) setRefreshing(false);
    }
  }, [onRefreshActivity, onUnreadCountChange]);

  useFocusEffect(
    useCallback(() => {
      sync({ quiet: true });
    }, [sync]),
  );

  const openNotification = async (item) => {
    if (!item?.read) {
      const next = await markNotificationRead(item.id);
      setNotifications(next);
      onUnreadCountChange?.(unreadCount(next));
    }
    onOpenNotification?.(item);
  };

  const markAllRead = async () => {
    const next = await markAllNotificationsRead();
    setNotifications(next);
    onUnreadCountChange?.(0);
  };

  const clearRead = () => {
    if (!notifications.some((item) => item.read)) return;
    Alert.alert(
      'Clear read notifications?',
      'Unread notifications will stay here.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear read',
          style: 'destructive',
          onPress: async () => {
            const next = await clearReadNotifications();
            setNotifications(next);
            onUnreadCountChange?.(unreadCount(next));
          },
        },
      ],
    );
  };

  const unread = unreadCount(notifications);
  const workspaceCount = notifications.filter((item) => isWorkspaceType(item.type)).length;
  const visibleNotifications = useMemo(
    () => notifications.filter((item) => matchesFilter(item, filter)),
    [filter, notifications],
  );
  const sections = useMemo(() => {
    const grouped = [];
    visibleNotifications.forEach((item) => {
      const title = groupLabel(item.createdAt);
      const existing = grouped.find((section) => section.title === title);
      if (existing) existing.items.push(item);
      else grouped.push({ title, items: [item] });
    });
    return grouped;
  }, [visibleNotifications]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <CompactNotificationsHeader
        insets={insets}
        unread={unread}
        goBack={goBack}
        markAllRead={markAllRead}
        colors={colors}
        styles={styles}
      />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={(
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => sync({ remote: true })}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        )}
      >
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <Text style={styles.sectionEyebrow}>TEAM TIMELINE</Text>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            <Text style={styles.sectionSub}>
              {workspaceCount
                ? `${workspaceCount} workspace ${workspaceCount === 1 ? 'event' : 'events'} in your history`
                : 'Chats, files, forms and shared edits in one place'}
            </Text>
          </View>
          <View style={styles.summaryIcon}>
            <Ionicons name="pulse-outline" size={21} color={colors.accentDark} />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const selected = filter === item.key;
            const count = item.key === 'unread'
              ? unread
              : item.key === 'all'
                ? notifications.length
                : item.key === 'workspace'
                  ? workspaceCount
                  : notifications.filter((notification) => notification.type === item.key).length;
            return (
              <Pressable
                key={item.key}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
                onPress={() => setFilter(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Show ${item.label.toLowerCase()} notifications`}
              >
                <Ionicons
                  name={item.icon}
                  size={13}
                  color={selected ? colors.white : colors.supportingText}
                />
                <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>
                  {item.label}
                </Text>
                {count > 0 ? (
                  <View style={[styles.filterCount, selected && styles.filterCountSelected]}>
                    <Text style={[styles.filterCountText, selected && styles.filterCountTextSelected]}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {notifications.some((item) => item.read) ? (
          <Pressable onPress={clearRead} hitSlop={8} style={styles.clearReadLink}>
            <Ionicons name="trash-outline" size={12} color={colors.textMuted} />
            <Text style={styles.clearReadText}>CLEAR READ HISTORY</Text>
          </Pressable>
        ) : null}

        {loading ? (
          <View style={styles.emptyCard}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.emptyTitle}>Loading activity…</Text>
          </View>
        ) : null}

        {!loading && !visibleNotifications.length ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done-outline" size={28} color={colors.accentDark} />
            </View>
            <Text style={styles.emptyTitle}>
              {notifications.length ? 'Nothing in this filter' : "You're all caught up"}
            </Text>
            <Text style={styles.emptyText}>
              {notifications.length
                ? 'Try another filter to see your recent activity.'
                : 'New chats, forms, files, briefs, shared text and KML edits will appear here.'}
            </Text>
          </View>
        ) : null}

        {!loading ? sections.map((section) => (
          <View key={section.title}>
            <View style={styles.groupHeading}>
              <Text style={styles.groupTitle}>{section.title}</Text>
              <View style={styles.groupLine} />
            </View>
            {section.items.map((item) => {
              const appearance = appearanceFor(item.type, colors);
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.notificationCard,
                    !item.read && styles.notificationCardUnread,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => openNotification(item)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.message}`}
                >
                  <View style={[styles.activityRail, { backgroundColor: appearance.accent }]} />
                  <View style={[styles.iconWrap, { backgroundColor: appearance.background }]}>
                    <Ionicons
                      name={item.icon || 'notifications-outline'}
                      size={19}
                      color={appearance.accent}
                    />
                  </View>
                  <View style={styles.notificationCopy}>
                    <View style={styles.notificationHeading}>
                      <Text
                        numberOfLines={1}
                        style={[styles.notificationTitle, !item.read && styles.notificationTitleUnread]}
                      >
                        {item.title}
                      </Text>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <Text numberOfLines={2} style={styles.notificationMessage}>{item.message}</Text>
                    <View style={styles.notificationMeta}>
                      <Text style={styles.notificationTime}>{formatNotificationTime(item.createdAt)}</Text>
                      <View style={[styles.typePill, { backgroundColor: appearance.background }]}>
                        <Text style={[styles.notificationType, { color: appearance.accent }]}>
                          {appearance.label}
                        </Text>
                      </View>
                      {item.jobNumber ? (
                        <Text style={styles.notificationJob}>{item.jobNumber}</Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.openIcon}>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.pageBackground },
  header: { width: '100%', borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerImage: { opacity: 0.58 },
  headerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,20,35,0.48)' },
  headerContent: { paddingHorizontal: 16, paddingBottom: 10 },
  headerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center' },
  headerControl: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerControlActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  headerBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.navy,
    backgroundColor: colors.danger,
  },
  headerBadgeText: { color: colors.white, fontSize: 8, fontWeight: '900' },
  headerIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
  },
  headerLogo: { width: 38, height: 38, marginRight: 9 },
  headerCopy: { flex: 1, minWidth: 0 },
  headerEyebrow: {
    color: colors.accent,
    fontSize: 7.5,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 22,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  headerStatusRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    marginTop: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(2,15,28,0.42)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 7, backgroundColor: colors.success },
  headerStatus: { flexShrink: 1, color: colors.white, fontSize: 9, fontWeight: '700' },
  headerStatusDivider: {
    width: 1,
    height: 11,
    marginHorizontal: 7,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  headerSync: {
    marginLeft: 4,
    color: colors.accent,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryCopy: { flex: 1, minWidth: 0 },
  sectionEyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.15,
    marginBottom: 2,
  },
  sectionTitle: {
    color: colors.bodyText,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.25,
  },
  sectionSub: { color: colors.supportingText, fontSize: 11, lineHeight: 15, marginTop: 3 },
  summaryIcon: {
    width: 42,
    height: 42,
    marginLeft: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  filterRow: { gap: 7, paddingBottom: 10 },
  filterChip: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  filterChipSelected: { borderColor: colors.navy, backgroundColor: colors.navy },
  filterChipText: { color: colors.supportingText, fontSize: 10, fontWeight: '800' },
  filterChipTextSelected: { color: colors.white },
  filterCount: {
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  filterCountSelected: { backgroundColor: colors.accent },
  filterCountText: { color: colors.accentDark, fontSize: 8, fontWeight: '900' },
  filterCountTextSelected: { color: colors.navy },
  clearReadLink: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: -1,
    marginBottom: 9,
  },
  clearReadText: { color: colors.textMuted, fontSize: 8, fontWeight: '900', letterSpacing: 0.7 },
  groupHeading: { flexDirection: 'row', alignItems: 'center', marginTop: 5, marginBottom: 7 },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  groupLine: { flex: 1, height: 1, marginLeft: 9, backgroundColor: colors.border },
  emptyCard: {
    minHeight: 210,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginBottom: 2,
  },
  emptyTitle: {
    color: colors.bodyText,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 12,
  },
  emptyText: {
    maxWidth: 285,
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 7,
  },
  notificationCard: {
    position: 'relative',
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingLeft: 13,
    paddingRight: 10,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    overflow: 'hidden',
  },
  notificationCardUnread: { borderColor: colors.borderStrong },
  activityRail: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  notificationHeading: { flexDirection: 'row', alignItems: 'center' },
  notificationTitle: {
    flex: 1,
    color: colors.bodyText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  notificationTitleUnread: { fontWeight: '900' },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
    marginLeft: 7,
  },
  notificationMessage: { color: colors.supportingText, fontSize: 11, lineHeight: 15, marginTop: 2 },
  notificationMeta: {
    minHeight: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 5,
  },
  notificationTime: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7 },
  notificationType: { fontSize: 8, fontWeight: '900' },
  notificationJob: { color: colors.accentDark, fontSize: 9, fontWeight: '900' },
  openIcon: {
    width: 24,
    height: 34,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 4,
  },
  pressed: { opacity: 0.76 },
});
