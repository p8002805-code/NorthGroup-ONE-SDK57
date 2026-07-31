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
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import ImageViewing from 'react-native-image-viewing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProfileAvatar from '../../../components/ProfileAvatar';
import JobChatAttachmentCard from '../components/JobChatAttachmentCard';
import JobChatAttachmentPicker from '../components/JobChatAttachmentPicker';
import {
  cancelJobChatUploadsForQueue,
  deleteLocalJobChatAttachment,
  deleteUploadedJobChatAttachment,
  formatJobChatFileSize,
  isMapJobChatAttachment,
  isPhotoJobChatAttachment,
  JOB_CHAT_ATTACHMENT_LIMIT,
  jobChatFileExtension,
  prepareJobChatAttachment,
  saveJobChatPhotoToLibrary,
  shareJobChatAttachment,
  validateJobChatAttachmentSelection,
  downloadJobChatAttachment,
  uploadJobChatAttachment,
} from '../jobChatAttachmentService';
import {
  createJobChatOutboxItem,
  enqueueJobChatOutboxItem,
  jobChatOutboxItemToMessage,
  readJobChatOutbox,
  removeJobChatOutboxItem,
  updateJobChatOutboxItem,
} from '../jobChatOutbox';
import {
  ensureJobChat,
  loadJobChatMessages,
  readCachedJobChatMessages,
  readCachedJobChatRoom,
  sendJobChatAttachmentMessage,
  sendJobChatMessage,
} from '../jobChatService';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const MUTED = '#B8C4D0';
const PAGE = '#F2F5F7';
const GREEN = '#54D98C';
const AMBER = '#E3A72F';
const RED = '#E14D4D';
const REFRESH_INTERVAL_MS = 4000;
const MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const sortMessages = (values) => [...values].sort((left, right) => (
  new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime()
));

const initialsFor = (name) => String(name || 'NorthGroup')
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map((part) => part[0])
  .join('')
  .toUpperCase() || 'NG';

const dateKeyFor = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toDateString();
};

const formatDateDivider = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'TODAY';
  if (date.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).toUpperCase();
};

const formatMessageTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
  });
};

const attachmentErrorIsRetryable = (error) => {
  if (error?.cancelled) return false;
  const status = Number(error?.status || 0);
  if (status) {
    return status === 401
      || status === 408
      || status === 429
      || status >= 500;
  }
  const message = String(error?.message || '').toLowerCase();
  return !message
    || message.includes('network')
    || message.includes('fetch')
    || message.includes('offline')
    || message.includes('internet')
    || message.includes('connection')
    || message.includes('timed out')
    || message.includes('timeout');
};

const attachmentRetryDelay = (attempts) => {
  const base = 4000 * (2 ** Math.min(Math.max(0, attempts - 1), 4));
  const jitter = Math.floor(Math.random() * 900);
  return Math.min(60000, base + jitter);
};

export default function JobChatScreen({
  activeJob,
  profile,
  account,
  getAccessToken,
  goBack,
}) {
  const insets = useSafeAreaInsets();
  const [room, setRoom] = useState(null);
  const [liveMessages, setLiveMessages] = useState([]);
  const [localTextMessages, setLocalTextMessages] = useState([]);
  const [outboxItems, setOutboxItems] = useState([]);
  const [draft, setDraft] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [preparingAttachments, setPreparingAttachments] = useState(false);
  const [viewer, setViewer] = useState(null);
  const [viewerBusy, setViewerBusy] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const scrollRef = useRef(null);
  const activeRef = useRef(true);
  const requestRef = useRef(false);
  const roomRef = useRef(null);
  const outboxRef = useRef([]);
  const processorRef = useRef(false);
  const selectedRef = useRef([]);
  const cancelledOutboxRef = useRef(new Set());

  const accountId = account?.id || profile?.microsoftAccountId || '';
  const displayName = account?.displayName
    || profile?.fullName
    || `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim()
    || 'NorthGroup employee';
  const jobNumber = clean(activeJob?.number);
  const storedName = clean(activeJob?.jobName || activeJob?.name);
  const storedLocation = clean(activeJob?.location);
  const jobName = clean(activeJob?.jobName)
    || (storedLocation && storedName.toLowerCase() !== storedLocation.toLowerCase()
      ? storedName
      : '');
  const jobLocation = storedLocation || (!jobName ? storedName : '');
  const teamsJob = Boolean(jobNumber && activeJob?.microsoftTeamIds?.length);
  const currentUserId = String(accountId).toLowerCase();
  const jobDisplay = [jobNumber, jobName].filter(Boolean).join(' · ') || 'No active job';
  const composerReady = Boolean(room?.id);

  const messages = useMemo(() => sortMessages([
    ...liveMessages,
    ...localTextMessages,
    ...outboxItems.map(jobChatOutboxItemToMessage),
  ]), [liveMessages, localTextMessages, outboxItems]);

  const activeTransfer = outboxItems.find((item) => (
    item.status === 'uploading' || item.status === 'sending'
  ));
  const queuedTransfers = outboxItems.filter((item) => item.status === 'queued').length;
  const failedTransfers = outboxItems.filter((item) => item.status === 'failed').length;

  const connectionState = useMemo(() => {
    if (!teamsJob) {
      return { label: 'JOB REQUIRED', colour: GOLD, icon: 'briefcase-outline', spinning: false };
    }
    if (activeTransfer) {
      return {
        label: activeTransfer.status === 'sending' ? 'SENDING' : 'UPLOADING',
        colour: GOLD,
        icon: '',
        spinning: true,
      };
    }
    if (queuedTransfers) {
      return { label: `${queuedTransfers} QUEUED`, colour: AMBER, icon: 'cloud-upload-outline', spinning: false };
    }
    if (failedTransfers) {
      return { label: 'ATTACHMENT ISSUE', colour: RED, icon: 'alert-circle-outline', spinning: false };
    }
    if (offline) {
      return { label: 'SAVED COPY', colour: AMBER, icon: 'cloud-offline-outline', spinning: false };
    }
    if (error && !composerReady) {
      return { label: 'NEEDS ATTENTION', colour: RED, icon: 'alert-circle-outline', spinning: false };
    }
    if (!composerReady) {
      return { label: 'CONNECTING', colour: GOLD, icon: '', spinning: true };
    }
    if (refreshing) {
      return { label: 'UPDATING', colour: GOLD, icon: '', spinning: true };
    }
    if (error) {
      return { label: 'CONNECTION ISSUE', colour: AMBER, icon: 'alert-circle-outline', spinning: false };
    }
    if (room?.syncWarning) {
      return { label: 'MEMBERSHIP', colour: AMBER, icon: 'people-outline', spinning: false };
    }
    return { label: 'LIVE', colour: GREEN, icon: 'checkmark-circle', spinning: false };
  }, [
    activeTransfer,
    composerReady,
    error,
    failedTransfers,
    offline,
    queuedTransfers,
    refreshing,
    room?.syncWarning,
    teamsJob,
  ]);

  const assignedLabel = room
    ? `${Number.isFinite(Number(room.assignedCount)) ? Number(room.assignedCount) : 0} ASSIGNED`
    : 'TEAMS SHIFTS';

  const applyOutbox = useCallback((items) => {
    const values = Array.isArray(items) ? items : [];
    outboxRef.current = values;
    if (activeRef.current) setOutboxItems(values);
  }, []);

  const updateOutboxLocal = useCallback((itemId, changes) => {
    const next = outboxRef.current.map((item) => (
      item.id === itemId ? { ...item, ...changes } : item
    ));
    applyOutbox(next);
    return next;
  }, [applyOutbox]);

  const upsertLiveMessage = useCallback((message) => {
    if (!message?.id) return;
    setLiveMessages((current) => sortMessages([
      ...current.filter((item) => item.id !== message.id),
      message,
    ]));
  }, []);

  const processOutbox = useCallback(async ({ includeFailed = false } = {}) => {
    const currentRoom = roomRef.current;
    if (processorRef.current || !currentRoom?.id || !teamsJob) return;
    processorRef.current = true;

    try {
      let queue = await readJobChatOutbox({ accountId, job: activeJob });
      applyOutbox(queue);

      for (const savedItem of queue) {
        const eligible = savedItem.status === 'queued'
          || (includeFailed && savedItem.status === 'failed');
        if (!eligible || cancelledOutboxRef.current.has(savedItem.id)) continue;

        const retryAt = Number(savedItem.nextRetryAt || 0);
        if (!includeFailed && retryAt > Date.now()) continue;

        const attachmentCount = Math.max(1, Number(savedItem.attachments?.length || 0));
        let remoteAttachments = [...(savedItem.remoteAttachments || [])];
        let item = {
          ...savedItem,
          chatId: savedItem.chatId || currentRoom.id,
          status: 'uploading',
          progress: Math.min(1, remoteAttachments.length / attachmentCount),
          error: '',
          nextRetryAt: 0,
        };

        queue = await updateJobChatOutboxItem({
          accountId,
          job: activeJob,
          itemId: item.id,
          changes: {
            chatId: item.chatId,
            status: 'uploading',
            progress: item.progress,
            error: '',
            nextRetryAt: 0,
          },
        });
        applyOutbox(queue);

        let accessToken = '';
        try {
          const assertQueueActive = () => {
            if (cancelledOutboxRef.current.has(item.id)) {
              const cancelled = new Error('Attachment upload cancelled.');
              cancelled.cancelled = true;
              throw cancelled;
            }
          };

          assertQueueActive();
          accessToken = await getAccessToken();

          for (let index = 0; index < item.attachments.length; index += 1) {
            assertQueueActive();
            const localAttachment = item.attachments[index];
            const alreadyUploaded = remoteAttachments.some((remote) => (
              remote.id === localAttachment.id
              || remote.localAttachmentId === localAttachment.id
            ));
            if (alreadyUploaded) continue;

            const uploaded = await uploadJobChatAttachment({
              accessToken,
              accountId,
              job: activeJob,
              queueId: item.id,
              attachment: localAttachment,
              onProgress: (value) => {
                if (cancelledOutboxRef.current.has(item.id)) return;
                const progress = Math.max(0, Math.min(1, (index + value) / attachmentCount));
                updateOutboxLocal(item.id, { status: 'uploading', progress });
              },
            });
            assertQueueActive();
            remoteAttachments.push(uploaded);
            item = { ...item, remoteAttachments };
            queue = await updateJobChatOutboxItem({
              accountId,
              job: activeJob,
              itemId: item.id,
              changes: {
                status: 'uploading',
                progress: (index + 1) / attachmentCount,
                remoteAttachments,
                error: '',
                nextRetryAt: 0,
              },
            });
            applyOutbox(queue);
          }

          assertQueueActive();
          queue = await updateJobChatOutboxItem({
            accountId,
            job: activeJob,
            itemId: item.id,
            changes: {
              status: 'sending',
              progress: 1,
              remoteAttachments,
              error: '',
              nextRetryAt: 0,
            },
          });
          applyOutbox(queue);

          const posted = await sendJobChatAttachmentMessage({
            accessToken,
            accountId,
            job: activeJob,
            chatId: item.chatId,
            text: item.text,
            attachments: remoteAttachments,
          });
          upsertLiveMessage(posted);

          const removed = await removeJobChatOutboxItem({
            accountId,
            job: activeJob,
            itemId: item.id,
          });
          applyOutbox(removed.items);
          await Promise.all(
            item.attachments.map((attachment) => deleteLocalJobChatAttachment(attachment)),
          );
          cancelledOutboxRef.current.delete(item.id);
          setError('');
          setOffline(false);
        } catch (uploadError) {
          const wasCancelled = Boolean(uploadError?.cancelled)
            || cancelledOutboxRef.current.has(item.id);
          if (wasCancelled) {
            const removed = await removeJobChatOutboxItem({
              accountId,
              job: activeJob,
              itemId: item.id,
            });
            applyOutbox(removed.items);
            await Promise.all(
              (removed.removed?.attachments || item.attachments || [])
                .map((attachment) => deleteLocalJobChatAttachment(attachment)),
            );
            if (accessToken && remoteAttachments.length) {
              await Promise.all(
                remoteAttachments.map((attachment) => deleteUploadedJobChatAttachment({
                  accessToken,
                  attachment,
                })),
              );
            }
            cancelledOutboxRef.current.delete(item.id);
            continue;
          }

          const retryable = attachmentErrorIsRetryable(uploadError);
          const attempts = Number(item.attempts || 0) + 1;
          const nextRetryAt = retryable
            ? Date.now() + attachmentRetryDelay(attempts)
            : 0;
          const completedProgress = Math.min(1, remoteAttachments.length / attachmentCount);
          queue = await updateJobChatOutboxItem({
            accountId,
            job: activeJob,
            itemId: item.id,
            changes: {
              status: retryable ? 'queued' : 'failed',
              progress: completedProgress,
              remoteAttachments,
              attempts,
              nextRetryAt,
              error: uploadError?.message || 'The attachment could not be sent.',
            },
          });
          applyOutbox(queue);
          if (retryable) {
            if (!Number(uploadError?.status || 0)) setOffline(true);
            break;
          }
        }
      }
    } finally {
      processorRef.current = false;
    }
  }, [
    accountId,
    activeJob,
    applyOutbox,
    getAccessToken,
    teamsJob,
    updateOutboxLocal,
    upsertLiveMessage,
  ]);

  const refresh = useCallback(async ({
    silent = false,
    syncMembers = false,
  } = {}) => {
    if (requestRef.current || !teamsJob) return;
    requestRef.current = true;
    if (!silent) setRefreshing(true);

    try {
      const accessToken = await getAccessToken();
      let currentRoom = roomRef.current;

      if (!currentRoom) {
        const resolved = await ensureJobChat({
          accessToken,
          accountId,
          job: activeJob,
          syncMembers: true,
        });
        currentRoom = {
          ...resolved.chat,
          assignedCount: resolved.assignedCount,
          syncWarning: resolved.syncWarning,
          createdNow: resolved.created,
        };
        roomRef.current = currentRoom;
        if (activeRef.current) setRoom(currentRoom);
      }

      const values = await loadJobChatMessages({
        accessToken,
        accountId,
        job: activeJob,
        chatId: currentRoom.id,
      });
      if (!activeRef.current) return;
      setLiveMessages(values);
      setError('');
      setOffline(false);
      setLoading(false);
      setRefreshing(false);

      if (syncMembers) {
        ensureJobChat({
          accessToken,
          accountId,
          job: activeJob,
          syncMembers: true,
        }).then((resolved) => {
          if (!activeRef.current) return;
          const updatedRoom = {
            ...resolved.chat,
            assignedCount: resolved.assignedCount,
            syncWarning: resolved.syncWarning,
            createdNow: currentRoom.createdNow,
          };
          roomRef.current = updatedRoom;
          setRoom(updatedRoom);
        }).catch((syncError) => {
          if (!activeRef.current) return;
          setRoom((existing) => existing ? {
            ...existing,
            syncWarning: syncError?.message || 'Membership could not be refreshed.',
          } : existing);
        });
      }

      setTimeout(() => processOutbox(), 0);
    } catch (refreshError) {
      const cached = await readCachedJobChatMessages({
        accountId,
        job: activeJob,
      });
      if (!activeRef.current) return;
      if (cached.length) {
        setLiveMessages(cached);
        setOffline(true);
      }
      setError(refreshError?.message || 'The Teams job chat could not be refreshed.');
    } finally {
      requestRef.current = false;
      if (activeRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [
    accountId,
    activeJob,
    getAccessToken,
    processOutbox,
    teamsJob,
  ]);

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

  useEffect(() => {
    selectedRef.current = selectedAttachments;
  }, [selectedAttachments]);

  useEffect(() => () => {
    selectedRef.current.forEach((attachment) => {
      deleteLocalJobChatAttachment(attachment).catch(() => {});
    });
  }, []);

  useEffect(() => {
    const staleSelections = selectedRef.current;
    selectedRef.current = [];
    staleSelections.forEach((attachment) => {
      deleteLocalJobChatAttachment(attachment).catch(() => {});
    });

    activeRef.current = true;
    roomRef.current = null;
    outboxRef.current = [];
    setRoom(null);
    setLiveMessages([]);
    setLocalTextMessages([]);
    setOutboxItems([]);
    setSelectedAttachments([]);
    setError('');
    setOffline(false);
    setLoading(true);

    if (!teamsJob) {
      setLoading(false);
      return () => {
        activeRef.current = false;
      };
    }

    let cancelled = false;
    const openChat = async () => {
      const [cachedRoom, cachedMessages, queuedItems] = await Promise.all([
        readCachedJobChatRoom({ accountId, job: activeJob }),
        readCachedJobChatMessages({ accountId, job: activeJob }),
        readJobChatOutbox({ accountId, job: activeJob }),
      ]);
      if (cancelled || !activeRef.current) return;

      if (cachedRoom?.id) {
        roomRef.current = cachedRoom;
        setRoom(cachedRoom);
        setLoading(false);
      }
      if (cachedMessages.length) setLiveMessages(cachedMessages);
      applyOutbox(queuedItems);
      refresh({ silent: Boolean(cachedRoom), syncMembers: true });
    };

    openChat();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') refresh({ silent: true });
    }, REFRESH_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refresh({ silent: true, syncMembers: true });
        processOutbox();
      }
    });

    return () => {
      cancelled = true;
      activeRef.current = false;
      clearInterval(timer);
      appStateSubscription.remove();
    };
  }, [
    accountId,
    activeJob,
    applyOutbox,
    jobNumber,
    processOutbox,
    refresh,
    teamsJob,
  ]);

  useEffect(() => {
    if (!room?.id) return undefined;
    const queued = outboxItems.filter((item) => item.status === 'queued');
    if (!queued.length) return undefined;

    const now = Date.now();
    const earliestRetry = Math.min(...queued.map((item) => (
      Math.max(now, Number(item.nextRetryAt || 0))
    )));
    const delay = Math.max(120, Math.min(60000, earliestRetry - now));
    const timer = setTimeout(() => processOutbox(), delay);
    return () => clearTimeout(timer);
  }, [outboxItems, processOutbox, room?.id]);

  useEffect(() => {
    if (!messages.length) return undefined;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 90);
    return () => clearTimeout(timer);
  }, [messages.length]);

  const sendText = async (text, replacingId = '') => {
    const value = text.trim();
    const currentRoom = roomRef.current;
    if (!value || !currentRoom?.id) return;

    const temporaryId = replacingId || `local-${Date.now()}`;
    const optimistic = {
      id: temporaryId,
      senderId: accountId,
      senderName: displayName,
      text: value,
      createdAt: new Date().toISOString(),
      localState: 'sending',
      attachments: [],
      attachmentCount: 0,
    };
    setLocalTextMessages((current) => [
      ...current.filter((message) => message.id !== temporaryId),
      optimistic,
    ]);
    setDraft('');

    try {
      const accessToken = await getAccessToken();
      const posted = await sendJobChatMessage({
        accessToken,
        accountId,
        job: activeJob,
        chatId: currentRoom.id,
        text: value,
      });
      setLocalTextMessages((current) => current.filter((message) => message.id !== temporaryId));
      upsertLiveMessage(posted);
      setError('');
      setOffline(false);
    } catch (sendError) {
      setLocalTextMessages((current) => current.map((message) => (
        message.id === temporaryId
          ? { ...message, localState: 'failed', localError: sendError?.message || '' }
          : message
      )));
      Alert.alert(
        'Message not sent',
        sendError?.message || 'NorthGroup One could not send this message to Microsoft Teams.',
      );
    }
  };

  const retryTextMessage = (message) => {
    if (message?.localState !== 'failed') return;
    sendText(message.text, message.id);
  };

  const stagePickedAttachments = async (picked) => {
    const values = Array.isArray(picked) ? picked.filter((item) => item?.uri) : [];
    if (!values.length) return;
    const remaining = JOB_CHAT_ATTACHMENT_LIMIT - selectedRef.current.length;
    if (remaining <= 0) {
      Alert.alert('Attachment limit', `Choose up to ${JOB_CHAT_ATTACHMENT_LIMIT} attachments per message.`);
      return;
    }

    setPreparingAttachments(true);
    const prepared = [];
    try {
      for (let index = 0; index < values.slice(0, remaining).length; index += 1) {
        const item = values[index];
        const attachment = await prepareJobChatAttachment({
          uri: item.uri,
          name: item.name || `Photo-${Date.now()}-${index + 1}.jpg`,
          mimeType: item.mimeType,
          size: item.size,
          kind: item.kind,
          width: item.width,
          height: item.height,
        });
        prepared.push(attachment);
      }
      const next = [...selectedRef.current, ...prepared];
      validateJobChatAttachmentSelection(next);
      selectedRef.current = next;
      setSelectedAttachments(next);
      Haptics.selectionAsync().catch(() => {});
    } catch (selectionError) {
      await Promise.all(prepared.map((attachment) => deleteLocalJobChatAttachment(attachment)));
      Alert.alert('Attachment not added', selectionError?.message || 'The selected item could not be prepared.');
    } finally {
      setPreparingAttachments(false);
    }
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera access needed', 'Allow camera access to take a photo for Job Chat.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.76,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    await stagePickedAttachments([{
      uri: asset.uri,
      name: asset.fileName || `Job-${jobNumber || 'Chat'}-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
      width: asset.width,
      height: asset.height,
      kind: 'photo',
    }]);
  };

  const choosePhotos = async () => {
    const remaining = JOB_CHAT_ATTACHMENT_LIMIT - selectedRef.current.length;
    if (remaining <= 0) {
      Alert.alert('Attachment limit', `Choose up to ${JOB_CHAT_ATTACHMENT_LIMIT} attachments per message.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo access to choose images for Job Chat.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      quality: 0.76,
      exif: false,
    });
    if (result.canceled || !result.assets?.length) return;
    await stagePickedAttachments(result.assets.map((asset, index) => ({
      uri: asset.uri,
      name: asset.fileName || `Job-${jobNumber || 'Chat'}-Photo-${Date.now()}-${index + 1}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
      size: asset.fileSize,
      width: asset.width,
      height: asset.height,
      kind: 'photo',
    })));
  };

  const chooseFile = async () => {
    if (selectedRef.current.length >= JOB_CHAT_ATTACHMENT_LIMIT) {
      Alert.alert('Attachment limit', `Choose up to ${JOB_CHAT_ATTACHMENT_LIMIT} attachments per message.`);
      return;
    }
    try {
      const picked = await File.pickFileAsync(undefined, '*/*');
      const file = Array.isArray(picked) ? picked[0] : picked;
      if (!file?.uri) return;
      await stagePickedAttachments([{
        uri: file.uri,
        name: file.name || 'NorthGroup-file',
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        kind: 'file',
      }]);
    } catch (pickError) {
      const message = String(pickError?.message || '').toLowerCase();
      if (message.includes('cancel')) return;
      Alert.alert('File not selected', pickError?.message || 'The Files picker could not be opened.');
    }
  };

  const removeSelectedAttachment = async (attachmentId) => {
    const attachment = selectedRef.current.find((item) => item.id === attachmentId);
    const next = selectedRef.current.filter((item) => item.id !== attachmentId);
    selectedRef.current = next;
    setSelectedAttachments(next);
    if (attachment) await deleteLocalJobChatAttachment(attachment);
  };

  const clearSelectedAttachments = async () => {
    const current = selectedRef.current;
    selectedRef.current = [];
    setSelectedAttachments([]);
    await Promise.all(current.map((attachment) => deleteLocalJobChatAttachment(attachment)));
  };

  const send = async () => {
    const value = draft.trim();
    const currentRoom = roomRef.current;
    if (!currentRoom?.id || (!value && !selectedRef.current.length)) return;

    if (!selectedRef.current.length) {
      sendText(value);
      return;
    }

    try {
      validateJobChatAttachmentSelection(selectedRef.current);
      const item = createJobChatOutboxItem({
        chatId: currentRoom.id,
        senderId: accountId,
        senderName: displayName,
        text: value,
        attachments: selectedRef.current,
      });
      const next = await enqueueJobChatOutboxItem({
        accountId,
        job: activeJob,
        item,
      });
      applyOutbox(next);
      selectedRef.current = [];
      setSelectedAttachments([]);
      setDraft('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => processOutbox(), 0);
    } catch (queueError) {
      Alert.alert('Attachment not queued', queueError?.message || 'NorthGroup One could not queue this message.');
    }
  };

  const retryOutboxMessage = async (outboxId) => {
    if (!outboxId) return;
    cancelledOutboxRef.current.delete(outboxId);
    const next = await updateJobChatOutboxItem({
      accountId,
      job: activeJob,
      itemId: outboxId,
      changes: {
        status: 'queued',
        error: '',
        progress: 0,
        attempts: 0,
        nextRetryAt: 0,
      },
    });
    applyOutbox(next);
    setOffline(false);
    setTimeout(() => processOutbox(), 0);
  };

  const removeOutboxMessage = (outboxId) => {
    const item = outboxRef.current.find((entry) => entry.id === outboxId);
    if (!item) return;
    if (item.status === 'sending') {
      Alert.alert(
        'Sending to Teams',
        'This message has finished uploading and is already being posted to Microsoft Teams.',
      );
      return;
    }

    const transferring = item.status === 'uploading';
    Alert.alert(
      transferring ? 'Cancel attachment upload?' : 'Remove queued message?',
      transferring
        ? 'The current upload will stop and the local message will be removed.'
        : 'The message and its local attachments will be removed from this iPhone.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: transferring ? 'Cancel Upload' : 'Remove',
          style: 'destructive',
          onPress: async () => {
            cancelledOutboxRef.current.add(outboxId);
            await cancelJobChatUploadsForQueue(outboxId);
            const removed = await removeJobChatOutboxItem({
              accountId,
              job: activeJob,
              itemId: outboxId,
            });
            applyOutbox(removed.items);
            await Promise.all(
              (removed.removed?.attachments || item.attachments || [])
                .map(deleteLocalJobChatAttachment),
            );
            const uploadedFiles = removed.removed?.remoteAttachments
              || item.remoteAttachments
              || [];
            if (uploadedFiles.length) {
              try {
                const accessToken = await getAccessToken();
                await Promise.all(uploadedFiles.map((attachment) => (
                  deleteUploadedJobChatAttachment({ accessToken, attachment })
                )));
              } catch {
                // The local queue is still removed if Microsoft cleanup is unavailable.
              }
            }
          },
        },
      ],
    );
  };

  const openInTeams = async (url = '') => {
    const target = url || roomRef.current?.webUrl;
    if (!target) return;
    try {
      await Linking.openURL(target);
    } catch {
      Alert.alert('Microsoft Teams', 'This job chat could not be opened in Teams on this device.');
    }
  };

  const openPhotoAttachment = async (attachment, knownUri = '') => {
    try {
      let uri = knownUri;
      if (!uri) {
        const accessToken = await getAccessToken();
        uri = await downloadJobChatAttachment({ accessToken, attachment });
      }
      setViewer({ attachment: { ...attachment, localUri: uri }, uri });
    } catch (photoError) {
      Alert.alert(
        'Photo unavailable',
        photoError?.message || 'The photo could not be downloaded.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open in Teams',
            onPress: () => openInTeams(attachment?.messageWebUrl),
          },
        ],
      );
    }
  };

  const shareAttachment = async (attachment, onProgress) => {
    try {
      const accessToken = await getAccessToken();
      await shareJobChatAttachment({ accessToken, attachment, onProgress });
    } catch (shareError) {
      Alert.alert(
        isMapJobChatAttachment(attachment) ? 'Map file unavailable' : 'File unavailable',
        shareError?.message || 'The attachment could not be opened.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open in Teams',
            onPress: () => openInTeams(attachment?.messageWebUrl),
          },
        ],
      );
    }
  };

  const savePhoto = async (attachment) => {
    setViewerBusy('saving');
    try {
      const accessToken = await getAccessToken();
      await saveJobChatPhotoToLibrary({ accessToken, attachment });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Saved to Photos', 'The Job Chat photo is now in your iPhone Photos library.');
    } catch (saveError) {
      Alert.alert('Photo not saved', saveError?.message || 'The photo could not be saved.');
    } finally {
      setViewerBusy('');
    }
  };

  const shareViewerPhoto = async () => {
    if (!viewer?.attachment) return;
    setViewerBusy('sharing');
    try {
      const accessToken = await getAccessToken();
      await shareJobChatAttachment({ accessToken, attachment: viewer.attachment });
    } catch (shareError) {
      Alert.alert('Photo unavailable', shareError?.message || 'The photo could not be shared.');
    } finally {
      setViewerBusy('');
    }
  };

  const showAttachmentActions = (message, attachment) => {
    const localMessage = Boolean(message?.outboxId);
    if (localMessage && ['failed', 'queued'].includes(message.localState)) {
      Alert.alert(
        attachment?.name || 'Queued attachment',
        message.localError || 'This attachment is waiting to be sent.',
        [
          {
            text: 'Retry Send',
            onPress: () => retryOutboxMessage(message.outboxId),
          },
          {
            text: 'Remove Message',
            style: 'destructive',
            onPress: () => removeOutboxMessage(message.outboxId),
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    const teamsUrl = attachment?.messageWebUrl || message?.webUrl || roomRef.current?.webUrl;
    if (isPhotoJobChatAttachment(attachment)) {
      Alert.alert(
        attachment?.name || 'Job Chat photo',
        formatJobChatFileSize(attachment?.size) || 'Microsoft Teams photo',
        [
          { text: 'View Photo', onPress: () => openPhotoAttachment(attachment) },
          { text: 'Save to Photos', onPress: () => savePhoto(attachment) },
          { text: 'Share / Open', onPress: () => shareAttachment(attachment) },
          { text: 'Open in Teams', onPress: () => openInTeams(teamsUrl) },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
      return;
    }

    Alert.alert(
      attachment?.name || 'Job Chat file',
      [
        formatJobChatFileSize(attachment?.size),
        isMapJobChatAttachment(attachment) ? 'KML/KMZ mapping file' : 'Microsoft 365 attachment',
      ].filter(Boolean).join(' · '),
      [
        {
          text: isMapJobChatAttachment(attachment)
            ? 'Open in Google Earth / App'
            : 'Open / Share',
          onPress: () => shareAttachment(attachment),
        },
        { text: 'Open in Teams', onPress: () => openInTeams(teamsUrl) },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const canSend = composerReady
    && !preparingAttachments
    && Boolean(draft.trim() || selectedAttachments.length);

  return (
    <View style={styles.page}>
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
            style={({ pressed }) => [styles.headerBack, pressed && styles.pressed]}
            onPress={goBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back to Dashboard"
          >
            <Ionicons name="chevron-back" size={27} color={GOLD} />
          </Pressable>

          <View pointerEvents="none" style={styles.headerTitleWrap}>
            <Text style={styles.headerEyebrow}>JOB WORKSPACE</Text>
            <Text style={styles.headerTitle}>Chat</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.headerTeamsButton,
              !room?.webUrl && styles.headerTeamsButtonDisabled,
              pressed && room?.webUrl && styles.pressed,
            ]}
            onPress={() => openInTeams()}
            disabled={!room?.webUrl}
            accessibilityRole="button"
            accessibilityLabel="Open this job chat in Microsoft Teams"
          >
            <Ionicons name="open-outline" size={15} color={room?.webUrl ? WHITE : MUTED} />
            <Text style={[styles.headerTeamsText, !room?.webUrl && styles.headerTeamsTextDisabled]}>
              TEAMS
            </Text>
          </Pressable>
        </View>

        <View style={styles.headerContextRow}>
          <View style={styles.headerJobCopy}>
            <Text style={styles.headerJobTitle} numberOfLines={1}>{jobDisplay}</Text>
            <View style={styles.headerLocationRow}>
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.62)" />
              <Text style={styles.headerLocation} numberOfLines={1}>
                {jobLocation || 'Location not added'}
              </Text>
            </View>
          </View>

          <View style={styles.headerConnection}>
            <View style={styles.connectionTopRow}>
              {connectionState.spinning ? (
                <ActivityIndicator size="small" color={connectionState.colour} />
              ) : (
                <Ionicons name={connectionState.icon} size={13} color={connectionState.colour} />
              )}
              <Text style={[styles.connectionLabel, { color: connectionState.colour }]}>
                {connectionState.label}
              </Text>
            </View>
            <Text style={styles.assignedLabel}>{assignedLabel}</Text>
          </View>
        </View>
      </ImageBackground>

      {!teamsJob ? (
        <View style={styles.lockedWrap}>
          <View style={styles.lockedIcon}>
            <Ionicons name="people-outline" size={30} color={NAVY} />
          </View>
          <Text style={styles.lockedTitle}>Choose a Teams Shifts job</Text>
          <Text style={styles.lockedText}>
            Job Chat is created from published Shifts assignments. Select an imported Teams job
            from the Jobs page to open its conversation.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.returnButton, pressed && styles.pressed]}
            onPress={goBack}
          >
            <Text style={styles.returnButtonText}>RETURN TO DASHBOARD</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={styles.messageContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            showsVerticalScrollIndicator={false}
            refreshControl={(
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => refresh({ syncMembers: true })}
                tintColor={GOLD}
                colors={[GOLD]}
              />
            )}
          >
            {room?.createdNow ? (
              <View style={styles.systemEvent}>
                <Ionicons name="checkmark-circle" size={14} color="#2E8A53" />
                <Text style={styles.systemEventText}>
                  Job chat created · {room.assignedCount} employees added from Teams Shifts
                </Text>
              </View>
            ) : null}

            {room?.syncWarning ? (
              <View style={[styles.noticeCard, styles.warningCard]}>
                <View style={[styles.noticeIcon, styles.warningIcon]}>
                  <Ionicons name="people-outline" size={17} color="#70561A" />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={[styles.noticeTitle, styles.warningTitle]}>Membership needs attention</Text>
                  <Text style={[styles.noticeText, styles.warningText]}>{room.syncWarning}</Text>
                </View>
              </View>
            ) : null}

            {error ? (
              <Pressable
                style={({ pressed }) => [
                  styles.noticeCard,
                  offline ? styles.offlineCard : styles.errorCard,
                  pressed && styles.pressed,
                ]}
                onPress={() => refresh({ syncMembers: true })}
              >
                <View style={[styles.noticeIcon, offline ? styles.offlineIcon : styles.errorIcon]}>
                  <Ionicons
                    name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'}
                    size={17}
                    color={offline ? '#70561A' : '#842D2D'}
                  />
                </View>
                <View style={styles.noticeCopy}>
                  <Text style={[
                    styles.noticeTitle,
                    offline ? styles.offlineTitle : styles.errorTitle,
                  ]}>
                    {offline ? 'Showing saved messages' : 'Job Chat needs attention'}
                  </Text>
                  <Text style={[
                    styles.noticeText,
                    offline ? styles.offlineText : styles.errorText,
                  ]}>
                    {error}
                  </Text>
                  <Text style={[
                    styles.noticeAction,
                    offline ? styles.offlineAction : styles.errorAction,
                  ]}>
                    TAP TO RETRY
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {loading && !messages.length ? (
              <View style={styles.loadingWrap}>
                <View style={styles.loadingBadge}>
                  <ActivityIndicator color={GOLD} />
                  <Text style={styles.loadingTitle}>Connecting to Microsoft Teams</Text>
                  <Text style={styles.loadingText}>
                    Preparing the conversation and checking assigned employees…
                  </Text>
                </View>
              </View>
            ) : null}

            {!loading && room && !messages.length && !error ? (
              <View style={styles.emptyWrap}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubbles-outline" size={30} color={GOLD} />
                </View>
                <Text style={styles.emptyTitle}>Start the job conversation</Text>
                <Text style={styles.emptyText}>
                  Send messages, field photos, project files and KMLs to the {jobNumber} team.
                </Text>
              </View>
            ) : null}

            {messages.map((message, index) => {
              const mine = String(message.senderId || '').toLowerCase() === currentUserId;
              const previous = messages[index - 1];
              const previousMine = previous
                ? String(previous.senderId || '').toLowerCase() === currentUserId
                : false;
              const sameSender = previous
                && previousMine === mine
                && String(previous.senderId || '') === String(message.senderId || '');
              const closeInTime = previous
                && Math.abs(
                  new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime(),
                ) <= MESSAGE_GROUP_WINDOW_MS;
              const grouped = Boolean(sameSender && closeInTime);
              const showDateDivider = !previous
                || dateKeyFor(previous.createdAt) !== dateKeyFor(message.createdAt);
              const attachments = Array.isArray(message.attachments) ? message.attachments : [];
              const failedText = message.localState === 'failed' && !message.outboxId;

              return (
                <React.Fragment key={message.id}>
                  {showDateDivider ? (
                    <View style={styles.dateDivider}>
                      <View style={styles.dateDividerLine} />
                      <View style={styles.dateDividerPill}>
                        <Text style={styles.dateDividerText}>{formatDateDivider(message.createdAt)}</Text>
                      </View>
                      <View style={styles.dateDividerLine} />
                    </View>
                  ) : null}

                  <View style={[
                    styles.messageRow,
                    mine && styles.messageRowMine,
                    grouped && styles.messageRowGrouped,
                  ]}>
                    {!mine ? (
                      <View style={styles.avatarSlot}>
                        {!grouped ? (
                          <ProfileAvatar
                            uri=""
                            initials={initialsFor(message.senderName)}
                            size={28}
                            backgroundColor={NAVY_2}
                            textColor={WHITE}
                          />
                        ) : null}
                      </View>
                    ) : null}

                    <View style={[styles.messageBlock, mine && styles.messageBlockMine]}>
                      {!mine && !grouped ? (
                        <Text style={styles.sender} numberOfLines={1}>{message.senderName}</Text>
                      ) : null}

                      {message.text ? (
                        <Pressable
                          style={({ pressed }) => [
                            styles.bubble,
                            mine && styles.bubbleMine,
                            grouped && styles.bubbleGrouped,
                            mine && grouped && styles.bubbleMineGrouped,
                            message.localState === 'sending' && styles.bubbleSending,
                            failedText && styles.bubbleFailed,
                            pressed && failedText && styles.bubblePressed,
                          ]}
                          onPress={() => failedText && retryTextMessage(message)}
                          disabled={!failedText}
                          accessibilityRole={failedText ? 'button' : undefined}
                          accessibilityLabel={failedText ? 'Retry sending this message' : undefined}
                        >
                          <Text style={[styles.messageText, mine && styles.messageTextMine]}>
                            {message.text}
                          </Text>
                        </Pressable>
                      ) : null}

                      {attachments.map((attachment) => (
                        <JobChatAttachmentCard
                          key={attachment.id}
                          attachment={attachment}
                          mine={mine}
                          messageId={message.id}
                          messageWebUrl={attachment.messageWebUrl || message.webUrl || roomRef.current?.webUrl || ''}
                          localState={message.localState}
                          progress={message.uploadProgress}
                          getAccessToken={getAccessToken}
                          onOpenPhoto={(item) => openPhotoAttachment(item, item?.localUri || '')}
                          onOpenTeams={openInTeams}
                          onRetry={() => (
                            message.outboxId
                              ? retryOutboxMessage(message.outboxId)
                              : retryTextMessage(message)
                          )}
                          onCancel={message.outboxId
                            && ['queued', 'uploading'].includes(message.localState)
                            ? () => removeOutboxMessage(message.outboxId)
                            : undefined}
                        />
                      ))}

                      <Text style={[styles.time, mine && styles.timeMine]}>
                        {formatMessageTime(message.createdAt)}
                        {message.editedAt ? ' · Edited' : ''}
                        {message.localState === 'sending' ? ' · Sending…' : ''}
                        {message.localState === 'uploading'
                          ? ` · Uploading ${Math.round(Number(message.uploadProgress || 0) * 100)}%`
                          : ''}
                        {message.localState === 'queued' ? ' · Waiting for connection' : ''}
                        {message.localState === 'failed' ? ' · Not sent · Tap attachment to retry' : ''}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </ScrollView>

          <ImageBackground
            source={require('../../../../assets/topo-bg.png')}
            resizeMode="cover"
            style={[
              styles.composerBar,
              { paddingBottom: keyboardOpen ? 9 : Math.max(insets.bottom, 9) },
            ]}
            imageStyle={styles.composerImage}
          >
            <View pointerEvents="none" style={styles.composerShade} />

            <View style={styles.composerMetaRow}>
              <View style={styles.composerMetaLeft}>
                <View style={[styles.composerStatusDot, { backgroundColor: connectionState.colour }]} />
                <Text style={styles.composerMetaLabel}>MICROSOFT TEAMS · SECURE FILE SHARING</Text>
              </View>
              <Text style={[styles.composerMetaState, { color: connectionState.colour }]}>
                {connectionState.label}
              </Text>
            </View>

            {selectedAttachments.length || preparingAttachments ? (
              <View style={styles.selectionTray}>
                <View style={styles.selectionHeading}>
                  <Text style={styles.selectionTitle}>
                    {preparingAttachments
                      ? 'PREPARING ATTACHMENTS…'
                      : `${selectedAttachments.length} READY TO SEND`}
                  </Text>
                  {selectedAttachments.length ? (
                    <Pressable
                      onPress={clearSelectedAttachments}
                      hitSlop={7}
                      style={({ pressed }) => pressed && styles.pressed}
                    >
                      <Text style={styles.selectionClear}>CLEAR</Text>
                    </Pressable>
                  ) : null}
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectionScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {selectedAttachments.map((attachment) => {
                    const photo = isPhotoJobChatAttachment(attachment);
                    return (
                      <View key={attachment.id} style={styles.selectionItem}>
                        {photo ? (
                          <Image source={{ uri: attachment.localUri }} style={styles.selectionPhoto} />
                        ) : (
                          <View style={styles.selectionFileIcon}>
                            <Ionicons
                              name={isMapJobChatAttachment(attachment) ? 'map-outline' : 'document-outline'}
                              size={19}
                              color={GOLD}
                            />
                            <Text style={styles.selectionExtension}>
                              {jobChatFileExtension(attachment)}
                            </Text>
                          </View>
                        )}
                        <View style={styles.selectionCopy}>
                          <Text style={styles.selectionName} numberOfLines={1}>{attachment.name}</Text>
                          <Text style={styles.selectionSize} numberOfLines={1}>
                            {formatJobChatFileSize(attachment.size) || (photo ? 'PHOTO' : 'FILE')}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => removeSelectedAttachment(attachment.id)}
                          style={({ pressed }) => [styles.selectionRemove, pressed && styles.pressed]}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${attachment.name}`}
                        >
                          <Ionicons name="close" size={13} color={WHITE} />
                        </Pressable>
                      </View>
                    );
                  })}
                  {preparingAttachments ? (
                    <View style={[styles.selectionItem, styles.selectionPreparing]}>
                      <ActivityIndicator color={GOLD} />
                      <Text style={styles.selectionPreparingText}>PREPARING</Text>
                    </View>
                  ) : null}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.composerRow}>
              <Pressable
                onPress={() => setPickerVisible(true)}
                disabled={!composerReady || preparingAttachments}
                style={({ pressed }) => [
                  styles.attachButton,
                  (!composerReady || preparingAttachments) && styles.attachButtonDisabled,
                  pressed && composerReady && styles.sendPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add photo or file"
              >
                {preparingAttachments ? (
                  <ActivityIndicator size="small" color={GOLD} />
                ) : (
                  <Ionicons
                    name="add"
                    size={26}
                    color={composerReady ? GOLD : 'rgba(255,255,255,0.34)'}
                  />
                )}
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={setDraft}
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 120);
                }}
                placeholder={composerReady
                  ? (selectedAttachments.length ? 'Add a message…' : `Message ${jobNumber || 'the job'} team…`)
                  : 'Connecting to Teams…'}
                placeholderTextColor="rgba(255,255,255,0.48)"
                multiline
                maxLength={2000}
                editable={composerReady}
                style={styles.input}
                selectionColor={GOLD}
                accessibilityLabel="Job chat message"
              />

              <Pressable
                style={({ pressed }) => [
                  styles.sendOuter,
                  !canSend && styles.sendOuterDisabled,
                  pressed && canSend && styles.sendPressed,
                ]}
                onPress={send}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Send job chat message"
              >
                <View style={[styles.sendInner, !canSend && styles.sendInnerDisabled]}>
                  <Ionicons
                    name="arrow-up"
                    size={24}
                    color={canSend ? NAVY : 'rgba(255,255,255,0.4)'}
                  />
                </View>
              </Pressable>
            </View>
          </ImageBackground>
        </KeyboardAvoidingView>
      )}

      <JobChatAttachmentPicker
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onTakePhoto={takePhoto}
        onChoosePhotos={choosePhotos}
        onChooseFile={chooseFile}
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
          <View style={[styles.viewerHeader, { paddingTop: Math.max(insets.top, 12) }]}>
            <Pressable
              onPress={() => setViewer(null)}
              style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={24} color={WHITE} />
            </Pressable>
            <View style={styles.viewerTitleWrap}>
              <Text style={styles.viewerEyebrow}>JOB CHAT PHOTO</Text>
              <Text style={styles.viewerTitle} numberOfLines={1}>
                {viewer?.attachment?.name || 'Photo'}
              </Text>
            </View>
            <View style={styles.viewerClose} />
          </View>
        )}
        FooterComponent={() => (
          <View style={[styles.viewerFooter, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Pressable
              onPress={() => savePhoto(viewer?.attachment)}
              disabled={Boolean(viewerBusy)}
              style={({ pressed }) => [styles.viewerAction, pressed && styles.pressed]}
            >
              {viewerBusy === 'saving' ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Ionicons name="download-outline" size={20} color={GOLD} />
              )}
              <Text style={styles.viewerActionText}>SAVE TO PHOTOS</Text>
            </Pressable>
            <Pressable
              onPress={shareViewerPhoto}
              disabled={Boolean(viewerBusy)}
              style={({ pressed }) => [styles.viewerAction, pressed && styles.pressed]}
            >
              {viewerBusy === 'sharing' ? (
                <ActivityIndicator size="small" color={GOLD} />
              ) : (
                <Ionicons name="share-outline" size={20} color={GOLD} />
              )}
              <Text style={styles.viewerActionText}>SHARE / OPEN</Text>
            </Pressable>
            <Pressable
              onPress={() => openInTeams(viewer?.attachment?.messageWebUrl)}
              style={({ pressed }) => [styles.viewerAction, pressed && styles.pressed]}
            >
              <Ionicons name="open-outline" size={20} color={GOLD} />
              <Text style={styles.viewerActionText}>TEAMS</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: PAGE },
  flex: { flex: 1 },
  pressed: { opacity: 0.68 },

  header: {
    backgroundColor: NAVY,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(214,168,79,0.78)',
    overflow: 'hidden',
  },
  headerImage: { opacity: 0.58 },
  headerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,18,33,0.72)' },
  headerNavigation: {
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  headerBack: { width: 52, height: 44, alignItems: 'flex-start', justifyContent: 'center', zIndex: 2 },
  headerTitleWrap: { position: 'absolute', left: 78, right: 78, top: 9, alignItems: 'center' },
  headerEyebrow: { color: GOLD, fontSize: 7, fontWeight: '800', letterSpacing: 1.25 },
  headerTitle: { color: WHITE, fontSize: 19, lineHeight: 22, fontWeight: '800', marginTop: 1 },
  headerTeamsButton: {
    width: 52,
    minHeight: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(3,18,30,0.78)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(143,146,255,0.6)',
    zIndex: 2,
  },
  headerTeamsButtonDisabled: { borderColor: 'rgba(184,196,208,0.2)' },
  headerTeamsText: { color: WHITE, fontSize: 6, fontWeight: '900', letterSpacing: 0.9, marginTop: 2 },
  headerTeamsTextDisabled: { color: MUTED },
  headerContextRow: {
    minHeight: 53,
    paddingHorizontal: 17,
    paddingBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  headerJobCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  headerJobTitle: { color: WHITE, fontSize: 15, fontWeight: '900' },
  headerLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  headerLocation: { flex: 1, color: 'rgba(255,255,255,0.66)', fontSize: 9, fontWeight: '600' },
  headerConnection: { alignItems: 'flex-end', minWidth: 94 },
  connectionTopRow: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 18 },
  connectionLabel: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  assignedLabel: { color: 'rgba(255,255,255,0.48)', fontSize: 7, fontWeight: '800', letterSpacing: 0.55, marginTop: 2 },

  messageContent: { flexGrow: 1, paddingHorizontal: 13, paddingTop: 12, paddingBottom: 22 },
  systemEvent: {
    alignSelf: 'center',
    minHeight: 28,
    borderRadius: 14,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E3F4E9',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#B8DFC5',
    marginBottom: 12,
  },
  systemEventText: { color: '#2E7046', fontSize: 8, fontWeight: '800' },
  noticeCard: {
    borderRadius: 15,
    borderWidth: 1,
    padding: 11,
    marginBottom: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noticeIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  noticeCopy: { flex: 1, minWidth: 0 },
  noticeTitle: { fontSize: 11, fontWeight: '900' },
  noticeText: { fontSize: 10, lineHeight: 14, marginTop: 2 },
  noticeAction: { fontSize: 8, fontWeight: '900', letterSpacing: 0.75, marginTop: 7 },
  warningCard: { backgroundColor: '#FFF7E5', borderColor: '#E7CD89' },
  warningIcon: { backgroundColor: '#F8E9C2' },
  warningTitle: { color: '#70561A' },
  warningText: { color: '#806B36' },
  offlineCard: { backgroundColor: '#FFF7E5', borderColor: '#E7CD89' },
  offlineIcon: { backgroundColor: '#F8E9C2' },
  offlineTitle: { color: '#70561A' },
  offlineText: { color: '#806B36' },
  offlineAction: { color: '#70561A' },
  errorCard: { backgroundColor: '#FFF1F1', borderColor: '#E8BBBB' },
  errorIcon: { backgroundColor: '#F8DCDC' },
  errorTitle: { color: '#842D2D' },
  errorText: { color: '#8F5353' },
  errorAction: { color: '#842D2D' },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 70 },
  loadingBadge: {
    width: '88%',
    maxWidth: 330,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 24,
    alignItems: 'center',
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: '#D9E3E9',
  },
  loadingTitle: { color: NAVY, fontSize: 14, fontWeight: '900', marginTop: 11 },
  loadingText: { color: '#70808C', fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: 5 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 70, paddingHorizontal: 28 },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8EEF2',
    borderWidth: 1,
    borderColor: '#D9E2E8',
  },
  emptyTitle: { color: NAVY, fontSize: 17, fontWeight: '900', marginTop: 14 },
  emptyText: { color: '#6B7B87', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },

  dateDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  dateDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#D3DEE5' },
  dateDividerPill: {
    minHeight: 22,
    borderRadius: 11,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 9,
    backgroundColor: '#E8EEF2',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D6E0E7',
  },
  dateDividerText: { color: '#74838E', fontSize: 7, fontWeight: '900', letterSpacing: 0.95 },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    alignSelf: 'flex-start',
    maxWidth: '96%',
    marginBottom: 10,
  },
  messageRowMine: { alignSelf: 'flex-end', justifyContent: 'flex-end', maxWidth: '88%' },
  messageRowGrouped: { marginTop: -5 },
  avatarSlot: { width: 36, minWidth: 36, alignItems: 'flex-start', justifyContent: 'flex-end', paddingBottom: 16 },
  messageBlock: { maxWidth: 280, alignItems: 'flex-start' },
  messageBlockMine: { maxWidth: 280, alignItems: 'flex-end' },
  sender: { maxWidth: 230, color: '#60717D', fontSize: 9, fontWeight: '900', marginBottom: 4, marginLeft: 3 },
  bubble: {
    backgroundColor: WHITE,
    borderRadius: 17,
    borderBottomLeftRadius: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#D7E1E8',
  },
  bubbleMine: {
    backgroundColor: NAVY_2,
    borderColor: 'rgba(214,168,79,0.28)',
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 5,
  },
  bubbleGrouped: { borderTopLeftRadius: 9 },
  bubbleMineGrouped: { borderTopLeftRadius: 17, borderTopRightRadius: 9 },
  bubbleSending: { opacity: 0.7 },
  bubbleFailed: { borderColor: '#C84C4C', borderWidth: 1.5 },
  bubblePressed: { opacity: 0.76 },
  messageText: { color: NAVY, fontSize: 15, lineHeight: 21 },
  messageTextMine: { color: WHITE },
  time: { color: '#87959F', fontSize: 8, fontWeight: '600', marginTop: 4, marginLeft: 3 },
  timeMine: { textAlign: 'right', marginLeft: 0, marginRight: 3 },

  composerBar: {
    minHeight: 94,
    backgroundColor: NAVY,
    borderTopWidth: 1,
    borderTopColor: 'rgba(214,168,79,0.78)',
    paddingTop: 7,
    paddingHorizontal: 11,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 16,
  },
  composerImage: { opacity: 0.34 },
  composerShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(3,18,33,0.76)' },
  composerMetaRow: {
    height: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  composerMetaLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 },
  composerStatusDot: { width: 6, height: 6, borderRadius: 3 },
  composerMetaLabel: { color: 'rgba(255,255,255,0.58)', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.75 },
  composerMetaState: { fontSize: 7, fontWeight: '900', letterSpacing: 0.8, marginLeft: 8 },
  selectionTray: {
    marginTop: 4,
    borderRadius: 15,
    paddingVertical: 8,
    backgroundColor: 'rgba(5,25,42,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.28)',
  },
  selectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 7 },
  selectionTitle: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  selectionClear: { color: 'rgba(255,255,255,0.58)', fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  selectionScroll: { paddingHorizontal: 8, gap: 7 },
  selectionItem: {
    width: 182,
    height: 58,
    borderRadius: 13,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,40,55,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(184,196,208,0.25)',
  },
  selectionPhoto: { width: 46, height: 46, borderRadius: 9, backgroundColor: '#DDE5EA' },
  selectionFileIcon: {
    width: 46,
    height: 46,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,168,79,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.28)',
  },
  selectionExtension: { color: WHITE, fontSize: 6, fontWeight: '900', marginTop: 2 },
  selectionCopy: { flex: 1, minWidth: 0, marginLeft: 8, paddingRight: 15 },
  selectionName: { color: WHITE, fontSize: 9, fontWeight: '800' },
  selectionSize: { color: 'rgba(255,255,255,0.46)', fontSize: 7, fontWeight: '800', marginTop: 4 },
  selectionRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  selectionPreparing: { width: 108, justifyContent: 'center', gap: 8 },
  selectionPreparingText: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 6 },
  attachButton: {
    width: 48,
    height: 50,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,40,55,0.9)',
    borderWidth: 1.25,
    borderColor: 'rgba(214,168,79,0.45)',
  },
  attachButtonDisabled: { borderColor: 'rgba(143,160,175,0.22)' },
  input: {
    flex: 1,
    maxHeight: 94,
    minHeight: 50,
    backgroundColor: 'rgba(22,40,55,0.9)',
    borderRadius: 18,
    borderWidth: 1.25,
    borderColor: 'rgba(143,160,175,0.42)',
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
    color: WHITE,
    fontSize: 14,
    lineHeight: 20,
  },
  sendOuter: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(3,18,30,0.88)',
  },
  sendOuterDisabled: { borderColor: 'rgba(143,160,175,0.32)' },
  sendInner: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: GOLD },
  sendInnerDisabled: { backgroundColor: 'rgba(143,160,175,0.18)' },
  sendPressed: { transform: [{ scale: 0.96 }], opacity: 0.78 },

  viewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    minHeight: 78,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(3,18,33,0.86)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(214,168,79,0.45)',
  },
  viewerClose: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  viewerTitleWrap: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: 8 },
  viewerEyebrow: { color: GOLD, fontSize: 7, fontWeight: '900', letterSpacing: 1.1 },
  viewerTitle: { color: WHITE, fontSize: 13, fontWeight: '900', marginTop: 3 },
  viewerFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 88,
    paddingTop: 11,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(3,18,33,0.9)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(214,168,79,0.45)',
  },
  viewerAction: { minWidth: 90, alignItems: 'center', justifyContent: 'center', gap: 5 },
  viewerActionText: { color: WHITE, fontSize: 7, fontWeight: '900', letterSpacing: 0.55 },

  lockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 34, paddingBottom: 40 },
  lockedIcon: {
    width: 64,
    height: 64,
    borderRadius: 21,
    backgroundColor: '#E7DDBF',
    borderWidth: 1,
    borderColor: '#DFC36E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { color: NAVY, fontSize: 20, fontWeight: '900', marginTop: 18 },
  lockedText: { color: '#687784', fontSize: 12, lineHeight: 19, textAlign: 'center', marginTop: 8 },
  returnButton: { backgroundColor: NAVY, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 13, marginTop: 22, borderWidth: 1, borderColor: GOLD },
  returnButtonText: { color: WHITE, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
});
