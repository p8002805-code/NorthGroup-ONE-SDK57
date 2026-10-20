import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';

import {
  formatJobChatFileSize,
  isImageJobChatAttachment,
  jobChatAttachmentCategory,
  jobChatAttachmentIcon,
  jobChatFileSharingOptions,
  resolveJobChatAttachment,
} from '../jobChatAttachmentService';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const MUTED = '#81919D';
const GREEN = '#54D98C';
const RED = '#E14D4D';
const MAX_REMEMBERED_ATTACHMENTS = 160;
const resolvedAttachmentCache = new Map();

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const attachmentCacheKey = (attachment, messageId = '') => [
  clean(attachment?.chatId),
  clean(messageId || attachment?.messageId),
  clean(attachment?.id || attachment?.name),
].join('::');

const rememberedAttachment = (attachment, messageId = '') => {
  const cached = resolvedAttachmentCache.get(attachmentCacheKey(attachment, messageId));
  return cached ? { ...(attachment || {}), ...cached } : (attachment || {});
};

const rememberAttachment = (attachment, messageId = '') => {
  if (!attachment?.localUri) return attachment;
  const key = attachmentCacheKey(attachment, messageId);
  if (!key) return attachment;
  resolvedAttachmentCache.delete(key);
  resolvedAttachmentCache.set(key, attachment);
  if (resolvedAttachmentCache.size > MAX_REMEMBERED_ATTACHMENTS) {
    resolvedAttachmentCache.delete(resolvedAttachmentCache.keys().next().value);
  }
  return attachment;
};

const forgetAttachment = (attachment, messageId = '') => {
  resolvedAttachmentCache.delete(attachmentCacheKey(attachment, messageId));
};

export default function JobChatAttachmentCard({
  attachment,
  mine = false,
  messageId = '',
  messageWebUrl = '',
  getAccessToken,
  localState = '',
  progress = 0,
  onOpenPhoto,
  onOpenTeams,
  onRetry,
  onCancel,
}) {
  const [resolved, setResolved] = useState(() => rememberedAttachment(attachment, messageId));
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const isPhoto = isImageJobChatAttachment(resolved);
  const remote = !resolved?.localUri && Boolean(
    resolved?.contentUrl || resolved?.hostedContentId,
  );

  useEffect(() => {
    setResolved((current) => {
      const incomingKey = attachmentCacheKey(attachment, messageId);
      const currentKey = attachmentCacheKey(current, messageId);
      if (current?.localUri && incomingKey === currentKey) {
        // The four-second Teams refresh returns new attachment objects. Preserve
        // the resolved local photo URI so visible images do not flash back to a
        // loading card every time the message list updates.
        return rememberAttachment({ ...(attachment || {}), ...current }, messageId);
      }
      return rememberedAttachment(attachment, messageId);
    });
    setLoadError('');
  }, [attachment, messageId]);

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (resolved?.localUri) return resolved;
    if (!remote) return resolved;
    if (!silent) setBusy(true);
    try {
      const accessToken = await getAccessToken();
      const next = await resolveJobChatAttachment({
        attachment: resolved,
        accessToken,
        messageId,
      });
      rememberAttachment(next, messageId);
      setResolved(next);
      setLoadError('');
      return next;
    } catch (error) {
      setLoadError(error?.message || 'Attachment unavailable.');
      if (!silent) throw error;
      return null;
    } finally {
      if (!silent) setBusy(false);
    }
  }, [getAccessToken, messageId, remote, resolved]);

  useEffect(() => {
    if (!isPhoto || !remote || resolved?.localUri) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      hydrate({ silent: true }).then((value) => {
        if (cancelled || !value) return;
        setResolved(value);
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [hydrate, isPhoto, remote, resolved?.localUri]);

  const handlePhotoLoadError = useCallback(() => {
    forgetAttachment(resolved, messageId);
    setResolved((current) => ({ ...current, localUri: '' }));
    setLoadError('Refreshing photo…');
  }, [messageId, resolved]);

  const openOrShare = useCallback(async () => {
    try {
      setBusy(true);
      const file = resolved?.localUri ? resolved : await hydrate();
      if (!file?.localUri) throw new Error('The attachment could not be downloaded.');
      if (isImageJobChatAttachment(file)) {
        onOpenPhoto?.(file);
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (!available) throw new Error('The iPhone share sheet is unavailable.');
      await Sharing.shareAsync(file.localUri, jobChatFileSharingOptions(file));
    } catch (error) {
      Alert.alert(
        'Attachment unavailable',
        error?.message || 'NorthGroup One could not open this attachment.',
        messageWebUrl || resolved?.webUrl || resolved?.contentUrl
          ? [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open in Teams',
              onPress: () => onOpenTeams?.(messageWebUrl || resolved?.webUrl || resolved?.contentUrl),
            },
          ]
          : undefined,
      );
    } finally {
      setBusy(false);
    }
  }, [hydrate, messageWebUrl, onOpenPhoto, onOpenTeams, resolved]);

  const savePhoto = useCallback(async () => {
    try {
      setBusy(true);
      const file = resolved?.localUri ? resolved : await hydrate();
      if (!file?.localUri) throw new Error('The photo could not be downloaded.');
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Allow Photos access in iPhone Settings to save this image.');
      }
      await MediaLibrary.createAssetAsync(file.localUri);
      Alert.alert('Photo saved', 'The Job Chat photo was saved to your Photos library.');
    } catch (error) {
      Alert.alert('Photo not saved', error?.message || 'NorthGroup One could not save this photo.');
    } finally {
      setBusy(false);
    }
  }, [hydrate, resolved]);

  const showActions = useCallback(() => {
    const buttons = [];
    if (isPhoto) {
      buttons.push({ text: 'Save to Photos', onPress: savePhoto });
      buttons.push({ text: 'Open / Share', onPress: openOrShare });
    } else {
      buttons.push({ text: 'Open / Share', onPress: openOrShare });
    }
    if (messageWebUrl || resolved?.webUrl || resolved?.contentUrl) {
      buttons.push({
        text: 'Open in Microsoft Teams',
        onPress: () => onOpenTeams?.(messageWebUrl || resolved?.webUrl || resolved?.contentUrl),
      });
    }
    if (localState === 'failed' && onRetry) {
      buttons.push({ text: 'Retry upload', onPress: onRetry });
    }
    if ((localState === 'uploading' || localState === 'queued') && onCancel) {
      buttons.push({ text: 'Cancel upload', style: 'destructive', onPress: onCancel });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(clean(resolved?.name) || 'Attachment', undefined, buttons);
  }, [
    isPhoto,
    localState,
    messageWebUrl,
    onCancel,
    onOpenTeams,
    onRetry,
    openOrShare,
    resolved?.contentUrl,
    resolved?.name,
    resolved?.webUrl,
    savePhoto,
  ]);

  const percentage = Math.max(0, Math.min(100, Math.round(
    Number(resolved?.progress ?? progress ?? 0) * 100,
  )));
  const state = resolved?.status || localState;
  const status = useMemo(() => {
    if (state === 'failed') return { text: 'NOT SENT · TAP TO RETRY', colour: RED };
    if (state === 'queued') return { text: 'QUEUED FOR TEAMS', colour: GOLD };
    if (state === 'uploading') return { text: `UPLOADING ${percentage}%`, colour: GOLD };
    if (state === 'sending') return { text: 'SENDING TO TEAMS', colour: GOLD };
    if (loadError) return { text: 'TAP TO DOWNLOAD', colour: RED };
    return null;
  }, [loadError, percentage, state]);

  if (isPhoto) {
    return (
      <View style={[styles.photoWrap, mine && styles.photoWrapMine]}>
        <Pressable
          style={({ pressed }) => [
            styles.photoPressable,
            mine && styles.photoPressableMine,
            pressed && styles.pressed,
          ]}
          onPress={state === 'failed' ? onRetry : openOrShare}
          onLongPress={showActions}
          accessibilityRole="button"
          accessibilityLabel={`Open ${resolved?.name || 'Job Chat photo'}`}
        >
          {resolved?.localUri ? (
            <Image
              source={{ uri: resolved.localUri }}
              style={styles.photo}
              resizeMode="cover"
              onError={handlePhotoLoadError}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              {busy ? (
                <ActivityIndicator color={GOLD} />
              ) : (
                <Ionicons name="image-outline" size={29} color={MUTED} />
              )}
              <Text style={styles.photoPlaceholderText} numberOfLines={2}>
                {loadError ? 'Tap to download photo' : 'Loading Teams photo…'}
              </Text>
            </View>
          )}

          {(state === 'uploading' || state === 'sending') ? (
            <View style={styles.photoProgressShade}>
              <View style={styles.photoProgressRing}>
                <Text style={styles.photoProgressText}>{percentage}%</Text>
              </View>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}
            onPress={showActions}
            hitSlop={8}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={WHITE} />
          </Pressable>
        </Pressable>

        <View style={styles.attachmentMetaRow}>
          <Text style={[styles.attachmentName, mine && styles.attachmentNameMine]} numberOfLines={1}>
            {resolved?.name || 'Job Chat photo'}
          </Text>
          {resolved?.size ? (
            <Text style={[styles.attachmentSize, mine && styles.attachmentSizeMine]}>
              {formatJobChatFileSize(resolved.size)}
            </Text>
          ) : null}
        </View>
        {status ? <Text style={[styles.statusText, { color: status.colour }]}>{status.text}</Text> : null}
      </View>
    );
  }

  const category = jobChatAttachmentCategory(resolved);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.fileCard,
        mine && styles.fileCardMine,
        state === 'failed' && styles.fileCardFailed,
        pressed && styles.pressed,
      ]}
      onPress={state === 'failed' ? onRetry : openOrShare}
      onLongPress={showActions}
      accessibilityRole="button"
      accessibilityLabel={`Open ${resolved?.name || 'Job Chat attachment'}`}
    >
      <View style={[styles.fileIcon, mine && styles.fileIconMine]}>
        {busy ? (
          <ActivityIndicator color={mine ? GOLD : NAVY} size="small" />
        ) : (
          <Ionicons
            name={jobChatAttachmentIcon(resolved)}
            size={23}
            color={mine ? GOLD : NAVY}
          />
        )}
      </View>

      <View style={styles.fileCopy}>
        <Text style={[styles.fileType, mine && styles.fileTypeMine]}>{category}</Text>
        <Text style={[styles.fileName, mine && styles.fileNameMine]} numberOfLines={2}>
          {resolved?.name || 'Attachment'}
        </Text>
        <View style={styles.fileMetaRow}>
          <Text style={[styles.fileSize, mine && styles.fileSizeMine]}>
            {formatJobChatFileSize(resolved?.size) || 'Microsoft Teams file'}
          </Text>
          {status ? (
            <Text style={[styles.fileStatus, { color: status.colour }]} numberOfLines={1}>
              {status.text}
            </Text>
          ) : (
            <Text style={[styles.fileOpen, mine && styles.fileOpenMine]}>OPEN / SHARE</Text>
          )}
        </View>
        {(state === 'uploading' || state === 'sending') ? (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${percentage}%` }]} />
          </View>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.fileMore, pressed && styles.pressed]}
        onPress={showActions}
        hitSlop={8}
      >
        <Ionicons name="ellipsis-vertical" size={17} color={mine ? 'rgba(255,255,255,0.72)' : MUTED} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  photoWrap: { width: 236, maxWidth: '100%', marginTop: 4 },
  photoWrapMine: {
    backgroundColor: NAVY_2,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.38)',
    borderRadius: 18,
    padding: 6,
  },
  photoPressable: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D5E0E7',
    backgroundColor: '#E7EDF1',
  },
  photoPressableMine: { borderColor: 'rgba(214,168,79,0.42)' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 18 },
  photoPlaceholderText: {
    color: MUTED,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 7,
  },
  photoProgressShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,18,30,0.44)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoProgressRing: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(3,18,30,0.86)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoProgressText: { color: WHITE, fontSize: 11, fontWeight: '900' },
  moreButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(3,18,30,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  attachmentName: { flex: 1, color: NAVY, fontSize: 9, fontWeight: '800' },
  attachmentNameMine: { color: 'rgba(255,255,255,0.86)' },
  attachmentSize: { color: MUTED, fontSize: 8, fontWeight: '700' },
  attachmentSizeMine: { color: 'rgba(255,255,255,0.52)' },
  statusText: { fontSize: 7, fontWeight: '900', letterSpacing: 0.55, marginTop: 3, marginLeft: 2 },

  fileCard: {
    width: 260,
    maxWidth: '100%',
    minHeight: 78,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D4DFE6',
    backgroundColor: '#F7F9FA',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginTop: 4,
  },
  fileCardMine: {
    backgroundColor: NAVY_2,
    borderColor: 'rgba(214,168,79,0.42)',
  },
  fileCardFailed: { borderColor: RED },
  fileIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#E7EDF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconMine: { backgroundColor: 'rgba(3,18,30,0.42)' },
  fileCopy: { flex: 1, minWidth: 0, marginLeft: 10 },
  fileType: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.85 },
  fileTypeMine: { color: GOLD },
  fileName: { color: NAVY, fontSize: 11, lineHeight: 14, fontWeight: '900', marginTop: 2 },
  fileNameMine: { color: WHITE },
  fileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  fileSize: { color: MUTED, fontSize: 8, fontWeight: '700' },
  fileSizeMine: { color: 'rgba(255,255,255,0.52)' },
  fileOpen: { color: NAVY, fontSize: 7, fontWeight: '900', letterSpacing: 0.55 },
  fileOpenMine: { color: GOLD },
  fileStatus: { flex: 1, fontSize: 7, fontWeight: '900', letterSpacing: 0.4 },
  fileMore: { width: 28, alignItems: 'flex-end', justifyContent: 'center', alignSelf: 'stretch' },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(143,160,175,0.25)',
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: { height: '100%', borderRadius: 2, backgroundColor: GREEN },
});
