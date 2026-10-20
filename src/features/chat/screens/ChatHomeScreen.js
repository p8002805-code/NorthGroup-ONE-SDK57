import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import ImageViewing from 'react-native-image-viewing';

import ProfileAvatar from '../../../components/ProfileAvatar';
import { isTrustedTeamsWebUrl } from '../../../services/security/trustedExternalUrl';
import JobChatAttachmentPicker from '../components/JobChatAttachmentPicker';
import {
  loadUnifiedTeamsFeed,
  readCachedUnifiedTeamsFeed,
  removeFeedMediaFile,
  sendTeamsChannelMessage,
  sendTeamsChannelReply,
  TEAMS_CHANNELS,
} from '../teamsChannelService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const PAGE = '#F2F5F7';
const BORDER = '#DCE3E8';
const TEXT = '#243746';
const SUPPORTING = '#687784';
const GREEN = '#54D98C';
const REFRESH_INTERVAL_MS = 15000;
const RECENT_POST_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const FEED_VIEWS = [
  { key: 'recent', label: 'Recent', icon: 'time-outline' },
  { key: 'archived', label: 'Archived', icon: 'archive-outline' },
];
const FILTERS = [
  { key: 'all', label: 'All', icon: 'grid-outline' },
  { key: 'northgroup', label: 'NorthGroup', icon: 'business-outline' },
  { key: 'daily', label: 'Daily', icon: 'sunny-outline' },
];

const FEED_ATTACHMENT_ACTIONS = [
  {
    key: 'camera',
    label: 'Take a photo',
    detail: 'Open the iPhone camera now',
    icon: 'camera-outline',
  },
  {
    key: 'photos',
    label: 'Choose from Photos',
    detail: 'Select an image from the camera roll',
    icon: 'images-outline',
  },
];

const initialsFor = (name) => String(name || 'NorthGroup')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'NG';

const relativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'Just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  if (seconds < 172800) return 'Yesterday';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const isArchivedPost = (message, now = Date.now()) => {
  const createdAt = new Date(message?.createdAt).getTime();
  return Number.isFinite(createdAt) && now - createdAt > RECENT_POST_WINDOW_MS;
};

const channelLabel = (channelKey) => (
  TEAMS_CHANNELS[channelKey]?.title || 'NorthGroup'
);

function ChannelChip({ channelKey }) {
  const daily = channelKey === 'daily';
  return (
    <View style={[styles.channelChip, daily && styles.channelChipDaily]}>
      <Ionicons
        name={daily ? 'sunny-outline' : 'business-outline'}
        size={11}
        color={daily ? '#32627B' : '#7E5E19'}
      />
      <Text style={[styles.channelChipText, daily && styles.channelChipTextDaily]}>
        {channelLabel(channelKey)}
      </Text>
    </View>
  );
}

function Comment({
  comment,
  mine,
  profilePhotoUri,
  profilePhotoRevision,
}) {
  return (
    <View style={styles.commentRow}>
      <ProfileAvatar
        uri={mine ? profilePhotoUri : ''}
        revision={profilePhotoRevision}
        initials={initialsFor(comment.senderName)}
        size={30}
        backgroundColor={mine ? GOLD : '#DDE6EB'}
        textColor={NAVY}
      />
      <View style={styles.commentBubble}>
        <View style={styles.commentHeading}>
          <Text style={styles.commentName}>{mine ? 'You' : comment.senderName}</Text>
          <Text style={styles.commentTime}>{relativeTime(comment.createdAt)}</Text>
        </View>
        <Text style={styles.commentText}>{comment.text}</Text>
      </View>
    </View>
  );
}

export default function ChatHomeScreen({
  profile,
  account,
  profilePhotoUri,
  profilePhotoRevision,
  getAccessToken,
  initialFilter = 'all',
  goBack,
  openProfile,
}) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [feedView, setFeedView] = useState('recent');
  const [filter, setFilter] = useState(initialFilter || 'all');
  const [destination, setDestination] = useState('northgroup');
  const [draft, setDraft] = useState('');
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [replyingId, setReplyingId] = useState('');
  const [failedImageKeys, setFailedImageKeys] = useState({});
  const activeRef = useRef(true);
  const requestRef = useRef(false);
  const composerInputRef = useRef(null);

  const currentUserId = account?.id || profile?.microsoftAccountId || '';
  const displayName = account?.displayName
    || profile?.fullName
    || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
    || 'NorthGroup employee';
  const userInitials = useMemo(() => initialsFor(displayName), [displayName]);
  const visibleMessages = useMemo(() => {
    const now = Date.now();
    return messages.filter((message) => {
      const channelMatches = filter === 'all' || message.channelKey === filter;
      const archived = isArchivedPost(message, now);
      const viewMatches = feedView === 'archived' ? archived : !archived;
      return channelMatches && viewMatches;
    });
  }, [feedView, filter, messages]);

  useEffect(() => {
    setFilter(initialFilter || 'all');
  }, [initialFilter]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (requestRef.current) return;
    requestRef.current = true;
    if (!silent) setRefreshing(true);

    try {
      const accessToken = await getAccessToken();
      const live = await loadUnifiedTeamsFeed({
        accessToken,
        accountId: currentUserId,
      });
      if (!activeRef.current) return;
      setMessages(live);
      setFailedImageKeys({});
      setError('');
      setOffline(false);
    } catch (requestError) {
      const cached = await readCachedUnifiedTeamsFeed({
        accountId: currentUserId,
      });
      if (!activeRef.current) return;
      if (cached.length) {
        setMessages(cached);
        setOffline(true);
      }
      setError(requestError?.message || 'The Feed could not be refreshed.');
    } finally {
      requestRef.current = false;
      if (activeRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUserId, getAccessToken]);

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

  const setComposerForAttachment = () => {
    Keyboard.dismiss();
    setComposerExpanded(true);
  };

  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photo access needed',
        'Allow photo access to share a photo in the NorthGroup Feed.',
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.82,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setSelectedPhoto({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || 'NorthGroup-photo.jpg',
      width: asset.width,
      height: asset.height,
    });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'Allow camera access to take a photo for the NorthGroup Feed.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.78,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const asset = result.assets[0];
    setSelectedPhoto({
      uri: asset.uri,
      mimeType: asset.mimeType || 'image/jpeg',
      fileName: asset.fileName || `NorthGroup-camera-${Date.now()}.jpg`,
      width: asset.width,
      height: asset.height,
    });
  };

  const openAttachmentPicker = () => {
    setComposerForAttachment();
    setPickerVisible(true);
  };

  const openQuickCamera = async () => {
    setComposerForAttachment();
    await takePhoto();
  };

  const openQuickPhotos = async () => {
    setComposerForAttachment();
    await choosePhoto();
  };

  const openComposer = () => {
    setComposerExpanded(true);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  };

  const closeComposer = () => {
    if (posting) return;

    const finishClosing = () => {
      Keyboard.dismiss();
      setDraft('');
      setSelectedPhoto(null);
      setComposerExpanded(false);
      setPickerVisible(false);
    };

    if (draft.trim() || selectedPhoto) {
      Alert.alert(
        'Discard update?',
        'Your text and selected photo will be cleared.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: finishClosing },
        ],
      );
      return;
    }

    finishClosing();
  };

  const post = async () => {
    const text = draft.trim();
    if ((!text && !selectedPhoto) || posting) return;

    setPosting(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      const image = selectedPhoto
        ? {
          ...selectedPhoto,
          base64: await FileSystem.readAsStringAsync(selectedPhoto.uri, {
            encoding: FileSystem.EncodingType.Base64,
          }),
        }
        : null;
      const posted = await sendTeamsChannelMessage({
        accessToken,
        accountId: currentUserId,
        channelKey: destination,
        text,
        image,
      });
      setMessages((current) => [
        posted,
        ...current.filter((message) => (
          !(message.id === posted.id && message.channelKey === posted.channelKey)
        )),
      ]);
      setDraft('');
      setSelectedPhoto(null);
      setComposerExpanded(false);
      Keyboard.dismiss();
      setOffline(false);
      setFeedView('recent');
      if (filter !== 'all' && filter !== destination) setFilter('all');
    } catch (postError) {
      Alert.alert(
        'Could not share update',
        postError?.message || 'NorthGroup One could not publish this update.',
      );
    } finally {
      setPosting(false);
    }
  };

  const toggleComments = (messageId) => {
    setExpandedComments((current) => ({
      ...current,
      [messageId]: !current[messageId],
    }));
  };

  const sendReply = async (message) => {
    const text = String(replyDrafts[message.id] || '').trim();
    if (!text || replyingId) return;

    setReplyingId(message.id);
    try {
      const accessToken = await getAccessToken();
      const reply = await sendTeamsChannelReply({
        accessToken,
        accountId: currentUserId,
        channelKey: message.channelKey,
        messageId: message.id,
        text,
      });
      setMessages((current) => current.map((item) => {
        if (item.id !== message.id || item.channelKey !== message.channelKey) return item;
        const replies = [
          ...(item.replies || []).filter((existing) => existing.id !== reply.id),
          reply,
        ];
        return { ...item, replies, replyCount: replies.length };
      }));
      setReplyDrafts((current) => ({ ...current, [message.id]: '' }));
      setExpandedComments((current) => ({ ...current, [message.id]: true }));
    } catch (replyError) {
      Alert.alert(
        'Comment not sent',
        replyError?.message || 'NorthGroup One could not publish this comment.',
      );
    } finally {
      setReplyingId('');
    }
  };

  const showPostMenu = (message) => {
    const options = [];
    if (message.webUrl) {
      options.push({
        text: 'Open in Teams',
        onPress: () => {
          if (!isTrustedTeamsWebUrl(message.webUrl)) {
            Alert.alert('Untrusted link blocked', 'This post did not contain a secure Microsoft Teams link.');
            return;
          }
          Linking.openURL(message.webUrl).catch(() => {
            Alert.alert('Unable to open', 'This post could not be opened in Teams.');
          });
        },
      });
    }
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(channelLabel(message.channelKey), 'Post options', options);
  };

  const openPostPhoto = (message) => {
    if (!message?.imageUri) return;
    setViewer({
      uri: message.imageUri,
      title: `${message.senderName || 'NorthGroup'} · ${channelLabel(message.channelKey)}`,
    });
  };

  const restorePostPhoto = async (message) => {
    const key = `${message?.channelKey || ''}:${message?.id || ''}`;
    if (message?.imageUri) await removeFeedMediaFile(message.imageUri);
    setFailedImageKeys((current) => ({ ...current, [key]: true }));
    await refresh({ silent: true });
  };

  return (
    <View style={[styles.page, keyboardOpen && styles.pageKeyboard]}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ImageBackground
        source={require('../../../../assets/topo-bg.png')}
        resizeMode="cover"
        style={[styles.header, { paddingTop: insets.top }]}
        imageStyle={styles.headerImage}
      >
        <View pointerEvents="none" style={styles.headerShade} />
        <View style={styles.headerNavigation}>
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Return to Dashboard"
          >
            <Ionicons name="chevron-back" size={17} color={GOLD} />
            <Text style={styles.headerBackText}>Dashboard</Text>
          </Pressable>

          <View pointerEvents="none" style={styles.headerTitleWrap}>
            <Text style={styles.headerEyebrow}>NORTHGROUP ONE</Text>
            <Text style={styles.headerTitle}>Feed</Text>
            <View style={styles.headerAccent} />
          </View>

          <Pressable
            onPress={openProfile}
            style={({ pressed }) => [styles.headerProfile, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open profile settings"
          >
            <ProfileAvatar
              uri={profilePhotoUri}
              revision={profilePhotoRevision}
              initials={userInitials}
              size={36}
              borderColor="rgba(255,255,255,0.78)"
              borderWidth={2}
            />
          </Pressable>
        </View>

        <View style={styles.headerContextRow}>
          <View style={styles.headerContextCopy}>
            <Text style={styles.headerContextTitle}>Updates, reminders and moments</Text>
            <Text style={styles.headerContextDetail}>NORTHGROUP TEAM FEED</Text>
          </View>
          <View style={styles.headerLive}>
            <View style={styles.headerLiveRow}>
              <View style={styles.headerLiveDot} />
              <Text style={styles.headerLiveText}>LIVE</Text>
            </View>
            <Text style={styles.headerLiveDetail}>AUTO-REFRESH · 15s</Text>
          </View>
        </View>
      </ImageBackground>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.feedViewBar}>
          <View style={styles.feedViews}>
            {FEED_VIEWS.map((item) => {
              const selected = feedView === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.feedView, selected && styles.feedViewSelected]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setFeedView(item.key);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${item.label} Feed posts`}
                >
                  <Ionicons
                    name={item.icon}
                    size={15}
                    color={selected ? NAVY : '#75848E'}
                  />
                  <Text style={[styles.feedViewText, selected && styles.feedViewTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.filterBar}>
          <View style={styles.filters}>
            {FILTERS.map((item) => {
              const selected = filter === item.key;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.filter, selected && styles.filterSelected]}
                  onPress={() => {
                    Keyboard.dismiss();
                    setFilter(item.key);
                  }}
                  >
                  <Ionicons
                    name={item.icon}
                    size={14}
                    color={selected ? GOLD : '#6F7E89'}
                    style={styles.filterIcon}
                  />
                  <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.feedStatusBar}>
          <View style={styles.feedStatusLeft}>
            <View style={[styles.liveDot, { backgroundColor: offline ? '#E3A72F' : GREEN }]} />
            <Text style={styles.feedStatusText}>{offline ? 'SAVED UPDATES' : 'LIVE FEED'}</Text>
            <Text style={styles.feedStatusDivider}>·</Text>
            <Text style={styles.feedStatusHint}>Pull to refresh</Text>
          </View>
          <Pressable
            onPress={() => refresh()}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Refresh Feed"
          >
            <Ionicons name="refresh-outline" size={15} color={NAVY_2} />
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.feed}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={Keyboard.dismiss}
          showsVerticalScrollIndicator={false}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => refresh()}
              tintColor={GOLD}
              colors={[GOLD]}
            />
          )}
        >
          {error ? (
            <Pressable style={styles.errorCard} onPress={() => refresh()}>
              <Text style={styles.errorTitle}>
                {offline ? 'You are viewing saved updates' : 'Feed needs attention'}
              </Text>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.retryText}>Tap to retry</Text>
            </Pressable>
          ) : null}

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={GOLD} />
              <Text style={styles.loadingText}>Loading the latest updates…</Text>
            </View>
          ) : null}

          {!loading && visibleMessages.length ? (
            <View style={styles.postsSectionHeader}>
              <View style={styles.postsSectionCopy}>
                <Text style={styles.postsSectionEyebrow}>NORTHGROUP FEED</Text>
                <Text style={styles.postsSectionTitle}>
                  {feedView === 'archived' ? 'Archived posts' : 'Recent posts'}
                </Text>
              </View>
              <View style={styles.postsCount}>
                <Text style={styles.postsCountText}>{visibleMessages.length}</Text>
              </View>
            </View>
          ) : null}

          {!loading && !visibleMessages.length ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="megaphone-outline" size={23} color={GOLD} />
              </View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyText}>
                {feedView === 'archived'
                  ? `Posts older than 3 days${filter === 'all' ? '' : ` in ${channelLabel(filter)}`} will appear here.`
                  : `Share the first ${filter === 'all' ? 'NorthGroup update' : `${channelLabel(filter)} update`}.`}
              </Text>
            </View>
          ) : null}

          {visibleMessages.map((message) => {
            const mine = String(message.senderId || '').toLowerCase()
              === String(currentUserId || '').toLowerCase();
            const commentsOpen = Boolean(expandedComments[message.id]);
            const replies = message.replies || [];
            const imageKey = `${message.channelKey}:${message.id}`;
            const imageFailed = Boolean(failedImageKeys[imageKey]);
            const showImage = Boolean(message.imageUri) && !imageFailed;
            return (
              <View key={`${message.channelKey}:${message.id}`} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <ProfileAvatar
                    uri={mine ? profilePhotoUri : ''}
                    revision={profilePhotoRevision}
                    initials={initialsFor(message.senderName)}
                    size={42}
                    backgroundColor={mine ? GOLD : '#DDE6EB'}
                    textColor={NAVY}
                  />
                  <View style={styles.postHeading}>
                    <View style={styles.nameRow}>
                      <Text style={styles.sender}>{mine ? 'You' : message.senderName}</Text>
                      <Text style={styles.separator}>·</Text>
                      <Text style={styles.postTime}>{relativeTime(message.createdAt)}</Text>
                    </View>
                    <ChannelChip channelKey={message.channelKey} />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
                    onPress={() => showPostMenu(message)}
                    accessibilityRole="button"
                    accessibilityLabel="Post options"
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#73828D" />
                  </Pressable>
                </View>

                {message.subject ? <Text style={styles.subject}>{message.subject}</Text> : null}
                {message.text ? <Text style={styles.messageText}>{message.text}</Text> : null}
                {showImage ? (
                  <Pressable
                    onPress={() => openPostPhoto(message)}
                    style={({ pressed }) => [styles.postImageWrap, pressed && styles.postImagePressed]}
                    accessibilityRole="button"
                    accessibilityLabel="Open Feed photo"
                  >
                    <Image
                      source={{ uri: message.imageUri }}
                      style={styles.postImage}
                      resizeMode="cover"
                      onError={() => restorePostPhoto(message)}
                    />
                    <View style={styles.postImageBadge}>
                      <Ionicons name="expand-outline" size={13} color={WHITE} />
                      <Text style={styles.postImageBadgeText}>VIEW</Text>
                    </View>
                  </Pressable>
                ) : message.imageExpected ? (
                  <Pressable
                    onPress={() => restorePostPhoto(message)}
                    style={({ pressed }) => [
                      styles.postImageRestore,
                      pressed && styles.postImagePressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Restore this Feed photo from Microsoft Teams"
                  >
                    <View style={styles.postImageRestoreIcon}>
                      {refreshing ? (
                        <ActivityIndicator size="small" color={GOLD} />
                      ) : (
                        <Ionicons name="cloud-download-outline" size={22} color={GOLD} />
                      )}
                    </View>
                    <View style={styles.postImageRestoreCopy}>
                      <Text style={styles.postImageRestoreTitle}>Restore photo</Text>
                      <Text style={styles.postImageRestoreText}>
                        The original is safe in Microsoft Teams. Tap to download it again.
                      </Text>
                    </View>
                    <Ionicons name="refresh" size={18} color={NAVY} />
                  </Pressable>
                ) : null}

                <View style={styles.postActions}>
                  <Pressable
                    style={styles.commentAction}
                    onPress={() => toggleComments(message.id)}
                  >
                    <Ionicons name="chatbubble-outline" size={15} color={GOLD} />
                    <Text style={styles.commentActionText}>
                      {message.replyCount
                        ? `${message.replyCount} ${message.replyCount === 1 ? 'comment' : 'comments'}`
                        : 'Comment'}
                    </Text>
                  </Pressable>
                  {message.editedAt ? <Text style={styles.edited}>Edited</Text> : null}
                </View>

                {commentsOpen ? (
                  <View style={styles.comments}>
                    {replies.map((comment) => {
                      const commentMine = String(comment.senderId || '').toLowerCase()
                        === String(currentUserId || '').toLowerCase();
                      return (
                        <Comment
                          key={comment.id}
                          comment={comment}
                          mine={commentMine}
                          profilePhotoUri={profilePhotoUri}
                          profilePhotoRevision={profilePhotoRevision}
                        />
                      );
                    })}
                    <View style={styles.replyComposer}>
                      <ProfileAvatar
                        uri={profilePhotoUri}
                        revision={profilePhotoRevision}
                        initials={userInitials}
                        size={30}
                        backgroundColor={NAVY_2}
                        textColor={WHITE}
                      />
                      <TextInput
                        value={replyDrafts[message.id] || ''}
                        onChangeText={(value) => setReplyDrafts((current) => ({
                          ...current,
                          [message.id]: value,
                        }))}
                        placeholder="Write a comment…"
                        placeholderTextColor="#83909A"
                        multiline
                        maxLength={2000}
                        style={styles.replyInput}
                      />
                      <Pressable
                        style={[
                          styles.replySend,
                          !String(replyDrafts[message.id] || '').trim()
                            && styles.replySendDisabled,
                        ]}
                        onPress={() => sendReply(message)}
                        disabled={
                          replyingId === message.id
                          || !String(replyDrafts[message.id] || '').trim()
                        }
                      >
                        {replyingId === message.id
                          ? <ActivityIndicator size="small" color={NAVY} />
                          : <Ionicons name="arrow-up" size={17} color={NAVY} />}
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>

        {!composerExpanded ? (
          <ImageBackground
            source={require('../../../../assets/topo-bg.png')}
            resizeMode="cover"
            style={[styles.composerDock, { paddingBottom: keyboardOpen ? 10 : Math.max(insets.bottom, 10) }]}
            imageStyle={styles.composerDockImage}
          >
            <View pointerEvents="none" style={styles.composerDockShade} />
            <View style={styles.composerMetaRow}>
              <View style={styles.composerMetaLeft}>
                <View style={styles.composerStatusDot} />
                <Text style={styles.composerMetaLabel}>POST AN UPDATE</Text>
              </View>
              <Text style={styles.composerMetaState}>{channelLabel(destination).toUpperCase()}</Text>
            </View>
            <View style={styles.composerCollapsedRow}>
              <ProfileAvatar
                uri={profilePhotoUri}
                revision={profilePhotoRevision}
                initials={userInitials}
                size={36}
                backgroundColor={GOLD}
                textColor={NAVY}
              />
              <Pressable
                style={({ pressed }) => [styles.composerPrompt, pressed && styles.composerPromptPressed]}
                onPress={openComposer}
                accessibilityRole="button"
                accessibilityLabel="Write a Feed update"
              >
                <Text style={styles.composerPromptText}>Share an update…</Text>
                <Text style={styles.composerPromptDetail}>Keep the team in the loop</Text>
              </Pressable>
              <View style={styles.composerQuickActions}>
                <Pressable
                  onPress={openQuickCamera}
                  style={({ pressed }) => [styles.composerIconButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Take a photo for the Feed"
                >
                  <Ionicons name="camera-outline" size={19} color={GOLD} />
                </Pressable>
                <Pressable
                  onPress={openQuickPhotos}
                  style={({ pressed }) => [styles.composerIconButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a photo for the Feed"
                >
                  <Ionicons name="images-outline" size={19} color={GOLD} />
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        ) : (
          <ImageBackground
            source={require('../../../../assets/topo-bg.png')}
            resizeMode="cover"
            style={[
              styles.composerDock,
              styles.composerDockExpanded,
              { paddingBottom: keyboardOpen ? 10 : Math.max(insets.bottom, 10) },
            ]}
            imageStyle={styles.composerDockImage}
          >
            <View pointerEvents="none" style={styles.composerDockShade} />
            <View style={styles.composerMetaRow}>
              <View style={styles.composerMetaLeft}>
                <View style={styles.composerStatusDot} />
                <Text style={styles.composerMetaLabel}>POST AN UPDATE</Text>
              </View>
              <Pressable
                onPress={closeComposer}
                style={({ pressed }) => [styles.composerClose, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Close update composer"
              >
                <Ionicons name="close" size={18} color={WHITE} />
              </Pressable>
            </View>

            <View style={styles.composerHeading}>
              <ProfileAvatar
                uri={profilePhotoUri}
                revision={profilePhotoRevision}
                initials={userInitials}
                size={34}
                backgroundColor={GOLD}
                textColor={NAVY}
              />
              <Text style={styles.composerHeadingTitle}>Share with the team</Text>
            </View>

            <TextInput
              ref={composerInputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Write an update for the team…"
              placeholderTextColor="rgba(255,255,255,0.48)"
              multiline
              maxLength={2000}
              returnKeyType="default"
              style={styles.composerInput}
            />

            {selectedPhoto ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: selectedPhoto.uri }} style={styles.photoPreviewImage} />
                <View style={styles.photoPreviewLabel}>
                  <Ionicons name="image-outline" size={12} color={WHITE} />
                  <Text style={styles.photoPreviewLabelText}>PHOTO READY TO SHARE</Text>
                </View>
                <Pressable
                  style={styles.removePhoto}
                  onPress={() => setSelectedPhoto(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove selected photo"
                >
                  <Ionicons name="close" size={16} color={WHITE} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.composerFooter}>
              <Pressable
                style={({ pressed }) => [styles.addPhotoButton, pressed && styles.pressed]}
                onPress={openAttachmentPicker}
                accessibilityRole="button"
                accessibilityLabel="Add a photo to the update"
              >
                <Ionicons name="add-circle-outline" size={18} color={GOLD} />
                <Text style={styles.addPhotoText}>Photo</Text>
              </Pressable>

              <View style={styles.destination}>
                {Object.values(TEAMS_CHANNELS).map((channel) => {
                  const selected = destination === channel.key;
                  return (
                    <Pressable
                      key={channel.key}
                      style={[styles.destinationOption, selected && styles.destinationOptionSelected]}
                      onPress={() => setDestination(channel.key)}
                    >
                      <Text style={[styles.destinationText, selected && styles.destinationTextSelected]}>
                        {channel.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[
                  styles.postButton,
                  (!draft.trim() && !selectedPhoto) && styles.postButtonDisabled,
                ]}
                onPress={post}
                disabled={posting || (!draft.trim() && !selectedPhoto)}
                accessibilityRole="button"
                accessibilityLabel="Post update"
              >
                {posting ? (
                  <ActivityIndicator size="small" color={NAVY} />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={14} color={NAVY} />
                    <Text style={styles.postButtonText}>Post</Text>
                  </>
                )}
              </Pressable>
            </View>
          </ImageBackground>
        )}
      </KeyboardAvoidingView>

      <JobChatAttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onTakePhoto={takePhoto}
        onChoosePhotos={choosePhoto}
        actions={FEED_ATTACHMENT_ACTIONS}
        eyebrow="NORTHGROUP FEED"
        title="Add a photo"
        footer="PHOTOS ARE SHARED WITH THE SELECTED NORTHGROUP CHANNEL"
      />

      <ImageViewing
        images={viewer?.uri ? [{ uri: viewer.uri }] : []}
        imageIndex={0}
        visible={Boolean(viewer?.uri)}
        onRequestClose={() => setViewer(null)}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        backgroundColor={NAVY}
        HeaderComponent={() => (
          <View style={styles.viewerHeader}>
            <Pressable
              onPress={() => setViewer(null)}
              style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Close photo viewer"
            >
              <Ionicons name="close" size={22} color={WHITE} />
            </Pressable>
            <View style={styles.viewerTitleWrap}>
              <Text style={styles.viewerEyebrow}>FEED PHOTO</Text>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewer?.title || 'Photo'}
              </Text>
            </View>
            <View style={styles.viewerClose} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE },
  pageKeyboard: { backgroundColor: NAVY },
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  header: {
    backgroundColor: NAVY,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(214,168,79,0.42)',
    paddingBottom: 12,
    overflow: 'hidden',
  },
  headerImage: { opacity: 0.52 },
  headerShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,18,33,0.7)',
  },
  headerNavigation: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  headerBack: {
    width: 92,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackText: { color: GOLD, fontSize: 11, fontWeight: '900' },
  headerTitleWrap: {
    position: 'absolute',
    left: 84,
    right: 84,
    top: 8,
    alignItems: 'center',
  },
  headerEyebrow: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1.3 },
  headerTitle: { color: WHITE, fontSize: 21, lineHeight: 24, fontWeight: '900', marginTop: 1 },
  headerAccent: { width: 44, height: 3, borderRadius: 2, backgroundColor: GOLD, marginTop: 5 },
  headerProfile: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContextRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    marginTop: 9,
  },
  headerContextCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  headerContextTitle: { color: WHITE, fontSize: 12, fontWeight: '800' },
  headerContextDetail: { color: 'rgba(255,255,255,0.52)', fontSize: 7, fontWeight: '900', letterSpacing: 1, marginTop: 4 },
  headerLive: { alignItems: 'flex-end', minWidth: 92 },
  headerLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  headerLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN },
  headerLiveText: { color: GREEN, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  headerLiveDetail: { color: 'rgba(255,255,255,0.48)', fontSize: 7, fontWeight: '800', letterSpacing: 0.55, marginTop: 3 },
  feedViewBar: {
    minHeight: 48,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  feedViews: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    borderRadius: 17,
    padding: 3,
    backgroundColor: '#E8EDF0',
  },
  feedView: {
    flex: 1,
    minHeight: 30,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedViewSelected: {
    backgroundColor: WHITE,
    shadowColor: NAVY,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  feedViewText: { color: '#75848E', fontSize: 11, fontWeight: '800', marginLeft: 6 },
  feedViewTextSelected: { color: NAVY },
  filterBar: {
    minHeight: 54,
    backgroundColor: PAGE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filters: {
    width: '100%',
    maxWidth: 430,
    flexDirection: 'row',
    gap: 7,
  },
  filter: {
    flex: 1,
    minHeight: 36,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: '#EDF1F3',
  },
  filterSelected: { backgroundColor: NAVY_2 },
  filterIcon: { marginRight: 5 },
  filterText: { color: '#667681', fontSize: 11, fontWeight: '800' },
  filterTextSelected: { color: WHITE },
  feedStatusBar: {
    minHeight: 34,
    backgroundColor: '#EAF0F3',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D8E1E6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
  },
  feedStatusLeft: { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  liveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  feedStatusText: { color: NAVY_2, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  feedStatusDivider: { color: '#9AA7AF', fontSize: 11, marginHorizontal: 6 },
  feedStatusHint: { color: '#7D8B96', fontSize: 9 },
  refreshButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6 },
  refreshText: { color: NAVY_2, fontSize: 9, fontWeight: '900', marginLeft: 4 },
  composerDock: {
    backgroundColor: NAVY,
    borderTopWidth: 1,
    borderTopColor: 'rgba(214,168,79,0.58)',
    paddingHorizontal: 14,
    paddingTop: 9,
    overflow: 'hidden',
  },
  composerDockExpanded: { paddingTop: 10 },
  composerDockImage: { opacity: 0.35 },
  composerDockShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,18,33,0.78)',
  },
  composerMetaRow: {
    minHeight: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  composerMetaLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  composerStatusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: GOLD, marginRight: 6 },
  composerMetaLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.85 },
  composerMetaState: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.75, marginLeft: 8 },
  composerCollapsedRow: { flexDirection: 'row', alignItems: 'center' },
  composerPromptPressed: { backgroundColor: 'rgba(255,255,255,0.16)' },
  composerQuickActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 6 },
  composerIconButton: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.34)',
  },
  composerClose: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  composerPrompt: {
    flex: 1,
    minHeight: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    justifyContent: 'center',
    marginLeft: 10,
    paddingHorizontal: 14,
  },
  composerPromptText: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700' },
  composerPromptDetail: { color: 'rgba(255,255,255,0.48)', fontSize: 8.5, marginTop: 3 },
  composerHeading: { flexDirection: 'row', alignItems: 'center' },
  composerHeadingTitle: { color: WHITE, fontSize: 13, fontWeight: '900', marginLeft: 9 },
  composerInput: {
    minHeight: 76,
    maxHeight: 100,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingTop: 12,
    paddingBottom: 10,
    marginTop: 11,
    color: WHITE,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  photoPreview: {
    marginTop: 10,
    height: 142,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#E6ECEF',
  },
  photoPreviewImage: { width: '100%', height: '100%' },
  photoPreviewLabel: {
    position: 'absolute',
    left: 10,
    bottom: 9,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(6,26,45,0.78)',
  },
  photoPreviewLabelText: { color: WHITE, fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginLeft: 4 },
  removePhoto: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(6,26,45,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 9,
  },
  addPhotoButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingRight: 5 },
  addPhotoText: { color: WHITE, fontSize: 11, fontWeight: '900', marginLeft: 5 },
  destination: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  destinationOption: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  destinationOptionSelected: { backgroundColor: '#F3E9CE' },
  destinationText: { color: '#7B8993', fontSize: 9, fontWeight: '800' },
  destinationTextSelected: { color: '#7E5E19' },
  postButton: {
    minWidth: 66,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  postButtonDisabled: { backgroundColor: '#D8DEE3' },
  postButtonText: { color: NAVY, fontSize: 11, fontWeight: '900' },
  feed: { padding: 12, paddingBottom: 42 },
  loading: { alignItems: 'center', paddingVertical: 34 },
  loadingText: { color: SUPPORTING, fontSize: 12, marginTop: 10 },
  postsSectionHeader: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    marginBottom: 9,
  },
  postsSectionCopy: { flex: 1, minWidth: 0 },
  postsSectionEyebrow: { color: '#7B8993', fontSize: 8, fontWeight: '900', letterSpacing: 1.05 },
  postsSectionTitle: { color: NAVY, fontSize: 20, fontWeight: '900', marginTop: 2 },
  postsCount: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4EBEF',
  },
  postsCountText: { color: NAVY_2, fontSize: 11, fontWeight: '900' },
  errorCard: {
    backgroundColor: '#FFF3E6',
    borderWidth: 1,
    borderColor: '#EBC38D',
    borderRadius: 13,
    padding: 13,
    marginBottom: 10,
  },
  errorTitle: { color: NAVY, fontSize: 12, fontWeight: '900' },
  errorText: { color: '#6E5738', fontSize: 11, lineHeight: 16, marginTop: 4 },
  retryText: { color: '#986A22', fontSize: 10, fontWeight: '900', marginTop: 7 },
  emptyCard: { alignItems: 'center', paddingVertical: 38, paddingHorizontal: 22 },
  emptyTitle: { color: NAVY, fontSize: 17, fontWeight: '900', marginTop: 13 },
  emptyText: { color: SUPPORTING, fontSize: 12, textAlign: 'center', marginTop: 6 },
  postCard: {
    backgroundColor: WHITE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 15,
    marginBottom: 12,
    shadowColor: NAVY,
    shadowOpacity: 0.025,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  postHeading: { flex: 1, paddingHorizontal: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  sender: { color: NAVY, fontSize: 13, fontWeight: '900' },
  separator: { color: '#9AA5AC', fontSize: 11, marginHorizontal: 5 },
  postTime: { color: '#83919B', fontSize: 10 },
  channelChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E9CE',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginTop: 4,
  },
  channelChipDaily: { backgroundColor: '#E2EEF4' },
  channelChipText: { color: '#7E5E19', fontSize: 8, fontWeight: '900', marginLeft: 4 },
  channelChipTextDaily: { color: '#32627B' },
  moreButton: { minWidth: 32, minHeight: 32, alignItems: 'center', justifyContent: 'center' },
  subject: { color: NAVY, fontSize: 16, fontWeight: '900', marginTop: 13 },
  messageText: { color: TEXT, fontSize: 14, lineHeight: 21, marginTop: 12 },
  postImageWrap: {
    width: '100%',
    height: 225,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#E5EBEE',
    marginTop: 12,
  },
  postImagePressed: { opacity: 0.88 },
  postImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5EBEE',
  },
  postImageRestore: {
    width: '100%',
    minHeight: 92,
    marginTop: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E3C57E',
    backgroundColor: '#FFF9EC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  postImageRestoreIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4E7C5',
  },
  postImageRestoreCopy: { flex: 1, minWidth: 0 },
  postImageRestoreTitle: { color: NAVY, fontSize: 12, fontWeight: '900' },
  postImageRestoreText: {
    color: SUPPORTING,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
  postImageBadge: {
    position: 'absolute',
    right: 9,
    bottom: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: 'rgba(6,26,45,0.78)',
  },
  postImageBadgeText: { color: WHITE, fontSize: 8, fontWeight: '900', letterSpacing: 0.7, marginLeft: 4 },
  viewerHeader: {
    paddingTop: 52,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewerClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  viewerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: 12 },
  viewerEyebrow: { color: GOLD, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  viewerTitle: { color: WHITE, fontSize: 13, fontWeight: '800', marginTop: 3 },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: NAVY_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postActions: {
    minHeight: 34,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E9EC',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 9,
  },
  commentAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 2 },
  commentActionText: { color: '#657580', fontSize: 10, fontWeight: '800', marginLeft: 5 },
  edited: { color: '#8C989F', fontSize: 9 },
  comments: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E9EC',
    marginTop: 8,
    paddingTop: 10,
  },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 9 },
  commentBubble: {
    flex: 1,
    backgroundColor: '#F0F3F5',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginLeft: 8,
  },
  commentHeading: { flexDirection: 'row', alignItems: 'center' },
  commentName: { flex: 1, color: NAVY, fontSize: 10, fontWeight: '900' },
  commentTime: { color: '#89969E', fontSize: 8 },
  commentText: { color: TEXT, fontSize: 12, lineHeight: 17, marginTop: 3 },
  replyComposer: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  replyInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 86,
    backgroundColor: '#F0F3F5',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 8,
    color: NAVY,
    fontSize: 12,
    marginLeft: 8,
  },
  replySend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    marginLeft: 6,
  },
  replySendDisabled: { backgroundColor: '#D7DEE2' },
});
