import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AppBackButton from '../../../components/AppBackButton';
import {
  loadTeamsChannelMessages,
  readCachedChannelMessages,
  sendTeamsChannelMessage,
  TEAMS_CHANNELS,
} from '../teamsChannelService';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const MUTED = '#B8C4D0';
const PAGE = '#F2F5F7';
const REFRESH_INTERVAL_MS = 15000;

const initialsFor = (name) => String(name || 'NorthGroup')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'NG';

const formatPostDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function TeamsChannelScreen({
  channelKey,
  profile,
  account,
  getAccessToken,
  goBack,
}) {
  const definition = TEAMS_CHANNELS[channelKey] || TEAMS_CHANNELS.northgroup;
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const activeRef = useRef(true);
  const requestRef = useRef(false);

  const currentUserId = account?.id || profile?.microsoftAccountId || '';
  const displayName = account?.displayName
    || profile?.fullName
    || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
    || 'NorthGroup employee';
  const userInitials = useMemo(() => initialsFor(displayName), [displayName]);

  const refresh = useCallback(async ({ silent = false, force = false } = {}) => {
    if (requestRef.current && !force) return;
    requestRef.current = true;
    if (!silent) setRefreshing(true);

    try {
      const accessToken = await getAccessToken();
      const result = await loadTeamsChannelMessages({
        accessToken,
        accountId: currentUserId,
        channelKey: definition.key,
      });
      if (!activeRef.current) return;
      setMessages(result.messages);
      setError('');
      setOffline(false);
    } catch (requestError) {
      const cached = await readCachedChannelMessages({
        accountId: currentUserId,
        channelKey: definition.key,
      });
      if (!activeRef.current) return;
      if (cached.length) {
        setMessages(cached);
        setOffline(true);
      }
      setError(requestError?.message || 'The Teams channel could not be refreshed.');
    } finally {
      requestRef.current = false;
      if (activeRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUserId, definition.key, getAccessToken]);

  useEffect(() => {
    activeRef.current = true;
    setLoading(true);
    refresh();

    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh({ silent: true });
    }, REFRESH_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh({ silent: true });
    });

    return () => {
      activeRef.current = false;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [refresh]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      const posted = await sendTeamsChannelMessage({
        accessToken,
        accountId: currentUserId,
        channelKey: definition.key,
        text,
      });
      setDraft('');
      setOffline(false);
      setMessages((current) => [
        posted,
        ...current.filter((message) => message.id !== posted.id),
      ]);
    } catch (sendError) {
      Alert.alert(
        'Could not post',
        sendError?.message || 'NorthGroup One could not send this post to Microsoft Teams.',
      );
    } finally {
      setSending(false);
    }
  };

  const openInTeams = async (url) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Microsoft Teams', 'This post could not be opened in Teams on this device.');
    }
  };

  return (
    <SafeAreaView style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.header}>
        <AppBackButton label="Feed" onPress={goBack} style={styles.back} />
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>MICROSOFT TEAMS</Text>
          <Text style={styles.headerTitle}>{definition.title}</Text>
        </View>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{userInitials}</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={8}
      >
        <View style={styles.channelStrip}>
          <View style={[styles.liveDot, offline && styles.offlineDot]} />
          <Text style={styles.channelStripText}>
            {offline ? 'Showing saved posts — pull down to reconnect' : `Live with Teams · ${definition.name}`}
          </Text>
        </View>

        <View style={styles.composer}>
          <View style={styles.composerTop}>
            <View style={styles.composerAvatar}>
              <Text style={styles.composerAvatarText}>{userInitials}</Text>
            </View>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={definition.key === 'northgroup' ? 'Share an update…' : 'Add a daily update…'}
              placeholderTextColor="#7D8B96"
              multiline
              maxLength={2000}
              style={styles.input}
            />
          </View>
          <View style={styles.composerActions}>
            <Text style={styles.teamsNote}>Also appears in Microsoft Teams</Text>
            <Pressable
              style={({ pressed }) => [
                styles.postButton,
                (!draft.trim() || sending) && styles.postButtonDisabled,
                pressed && draft.trim() && !sending && styles.pressed,
              ]}
              onPress={send}
              disabled={!draft.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={NAVY} />
                : <Text style={styles.postButtonText}>Post</Text>}
            </Pressable>
          </View>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.feed}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refresh({ force: true })}
              tintColor={GOLD}
              colors={[GOLD]}
            />
          )}
        >
          {error ? (
            <Pressable style={styles.errorCard} onPress={() => refresh({ force: true })}>
              <Text style={styles.errorTitle}>{offline ? 'Connection interrupted' : 'Teams connection needs attention'}</Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={GOLD} />
              <Text style={styles.loadingText}>Loading from Microsoft Teams…</Text>
            </View>
          ) : null}

          {!loading && !messages.length ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>{definition.key === 'northgroup' ? 'N' : '☀'}</Text>
              <Text style={styles.emptyTitle}>Start the {definition.name} channel</Text>
              <Text style={styles.emptyText}>The first post made here will appear in Microsoft Teams as well.</Text>
            </View>
          ) : null}

          {messages.map((message) => {
            const mine = currentUserId && message.senderId === currentUserId;
            return (
              <View key={message.id} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={[styles.postAvatar, mine && styles.postAvatarMine]}>
                    <Text style={[styles.postAvatarText, mine && styles.postAvatarTextMine]}>
                      {initialsFor(message.senderName)}
                    </Text>
                  </View>
                  <View style={styles.postHeaderCopy}>
                    <Text style={styles.sender}>{mine ? 'You' : message.senderName}</Text>
                    <Text style={styles.postDate}>
                      {formatPostDate(message.createdAt)}{message.editedAt ? ' · Edited' : ''}
                    </Text>
                  </View>
                  <View style={styles.teamsBadge}>
                    <Text style={styles.teamsBadgeText}>TEAMS</Text>
                  </View>
                </View>

                {message.subject ? <Text style={styles.subject}>{message.subject}</Text> : null}
                <Text style={styles.messageText}>{message.text}</Text>

                <View style={styles.postFooter}>
                  <View style={styles.postMeta}>
                    {message.replyCount ? (
                      <Text style={styles.metaText}>
                        {message.replyCount} {message.replyCount === 1 ? 'reply' : 'replies'}
                      </Text>
                    ) : null}
                    {message.attachmentCount ? (
                      <Text style={styles.metaText}>
                        {message.attachmentCount} {message.attachmentCount === 1 ? 'attachment' : 'attachments'}
                      </Text>
                    ) : null}
                  </View>
                  {message.webUrl ? (
                    <Pressable onPress={() => openInTeams(message.webUrl)} hitSlop={8}>
                      <Text style={styles.openTeams}>Open in Teams ›</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE },
  flex: { flex: 1 },
  header: {
    minHeight: 66,
    backgroundColor: NAVY,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  back: { width: 104, height: 40 },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerEyebrow: { color: GOLD, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  headerTitle: { color: WHITE, fontSize: 16, fontWeight: '900', marginTop: 3 },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 70,
  },
  headerAvatarText: { color: NAVY, fontSize: 11, fontWeight: '900' },
  channelStrip: {
    minHeight: 34,
    backgroundColor: NAVY_2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2B4155',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#43C779', marginRight: 7 },
  offlineDot: { backgroundColor: '#E19A38' },
  channelStripText: { color: MUTED, fontSize: 10, fontWeight: '700' },
  composer: {
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: '#DCE3E8',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  composerTop: { flexDirection: 'row', alignItems: 'flex-start' },
  composerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: NAVY_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 3,
  },
  composerAvatarText: { color: WHITE, fontSize: 10, fontWeight: '900' },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 110,
    backgroundColor: '#F0F3F5',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingTop: 13,
    paddingBottom: 10,
    color: NAVY,
    fontSize: 14,
  },
  composerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 44,
    marginTop: 8,
  },
  teamsNote: { color: '#82909B', fontSize: 9, fontWeight: '600' },
  postButton: {
    minWidth: 70,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  postButtonDisabled: { backgroundColor: '#D8DEE3' },
  postButtonText: { color: NAVY, fontSize: 12, fontWeight: '900' },
  pressed: { opacity: 0.72 },
  feed: { padding: 14, paddingBottom: 40 },
  loading: { alignItems: 'center', paddingVertical: 34 },
  loadingText: { color: '#687784', fontSize: 12, marginTop: 10 },
  errorCard: {
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: '#EBC38D',
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
  },
  errorTitle: { color: NAVY, fontSize: 12, fontWeight: '900' },
  errorText: { color: '#6E5738', fontSize: 11, lineHeight: 16, marginTop: 4 },
  retryText: { color: '#986A22', fontSize: 10, fontWeight: '900', marginTop: 7 },
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    alignItems: 'center',
    padding: 26,
  },
  emptyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: NAVY_2,
    color: GOLD,
    textAlign: 'center',
    lineHeight: 46,
    fontSize: 18,
    fontWeight: '900',
  },
  emptyTitle: { color: NAVY, fontSize: 16, fontWeight: '900', marginTop: 14 },
  emptyText: { color: '#687784', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  postCard: {
    backgroundColor: WHITE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#061A2D',
    shadowOpacity: 0.04,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: NAVY_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postAvatarMine: { backgroundColor: GOLD },
  postAvatarText: { color: WHITE, fontSize: 10, fontWeight: '900' },
  postAvatarTextMine: { color: NAVY },
  postHeaderCopy: { flex: 1, paddingHorizontal: 10 },
  sender: { color: NAVY, fontSize: 13, fontWeight: '900' },
  postDate: { color: '#85929C', fontSize: 9, marginTop: 2 },
  teamsBadge: { backgroundColor: '#ECE9FA', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  teamsBadgeText: { color: '#514395', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  subject: { color: NAVY, fontSize: 16, fontWeight: '900', marginTop: 13, marginBottom: -4 },
  messageText: { color: '#243746', fontSize: 14, lineHeight: 21, marginTop: 12 },
  postFooter: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E1E6EA',
  },
  postMeta: { flex: 1, flexDirection: 'row' },
  metaText: { color: '#778691', fontSize: 9, fontWeight: '700', marginRight: 12 },
  openTeams: { color: '#6754A5', fontSize: 10, fontWeight: '900' },
});
