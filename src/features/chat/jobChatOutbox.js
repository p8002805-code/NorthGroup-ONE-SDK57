import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { accountStorageKey } from '../../services/account/accountIdentity';

const OUTBOX_PREFIX = 'northgroup_one_job_chat_outbox_v1';

const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const safeSegment = (value, fallback = 'item') => (
  clean(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 100) || fallback
);

const outboxKey = ({ accountId, job }) => accountStorageKey(
  `${OUTBOX_PREFIX}:${safeSegment(accountId, 'employee')}:${safeSegment(job?.number, 'job')}`,
);

const sortItems = (items) => [...items].sort((left, right) => (
  new Date(left?.createdAt || 0).getTime() - new Date(right?.createdAt || 0).getTime()
));

const normaliseSavedItem = (item, { recoverInterrupted = false } = {}) => {
  const interrupted = recoverInterrupted && ['uploading', 'sending'].includes(item?.status);
  return {
    ...item,
    status: interrupted ? 'queued' : item?.status || 'queued',
    progress: interrupted ? 0 : Number(item?.progress || 0),
    attempts: Math.max(0, Number(item?.attempts || 0)),
    nextRetryAt: interrupted ? 0 : Math.max(0, Number(item?.nextRetryAt || 0)),
    attachments: Array.isArray(item?.attachments) ? item.attachments : [],
    remoteAttachments: Array.isArray(item?.remoteAttachments) ? item.remoteAttachments : [],
  };
};

export const readJobChatOutbox = async ({ accountId, job, recoverInterrupted = true }) => {
  try {
    const saved = await AsyncStorage.getItem(outboxKey({ accountId, job }));
    const parsed = saved ? JSON.parse(saved) : [];
    return sortItems(Array.isArray(parsed) ? parsed.map((item) => normaliseSavedItem(item, { recoverInterrupted })) : []);
  } catch {
    return [];
  }
};

export const writeJobChatOutbox = async ({ accountId, job, items }) => {
  const values = sortItems(Array.isArray(items) ? items.map((item) => normaliseSavedItem(item)) : []);
  await AsyncStorage.setItem(outboxKey({ accountId, job }), JSON.stringify(values));
  return values;
};

export const createJobChatOutboxItem = ({
  chatId,
  senderId,
  senderName,
  text,
  attachments,
}) => {
  const now = new Date().toISOString();
  const id = Crypto.randomUUID();
  return {
    id,
    localMessageId: `outbox-${id}`,
    chatId: String(chatId || ''),
    senderId: String(senderId || ''),
    senderName: clean(senderName) || 'NorthGroup employee',
    text: String(text || '').trim(),
    createdAt: now,
    updatedAt: now,
    status: 'queued',
    progress: 0,
    attempts: 0,
    nextRetryAt: 0,
    error: '',
    attachments: Array.isArray(attachments) ? attachments : [],
    remoteAttachments: [],
  };
};

export const enqueueJobChatOutboxItem = async ({ accountId, job, item }) => {
  const current = await readJobChatOutbox({ accountId, job, recoverInterrupted: false });
  const next = sortItems([
    ...current.filter((existing) => existing.id !== item.id),
    normaliseSavedItem(item),
  ]);
  await writeJobChatOutbox({ accountId, job, items: next });
  return next;
};

export const updateJobChatOutboxItem = async ({
  accountId,
  job,
  itemId,
  changes,
}) => {
  const current = await readJobChatOutbox({ accountId, job, recoverInterrupted: false });
  const next = current.map((item) => (
    item.id === itemId
      ? normaliseSavedItem({
        ...item,
        ...changes,
        updatedAt: new Date().toISOString(),
      })
      : item
  ));
  await writeJobChatOutbox({ accountId, job, items: next });
  return next;
};

export const removeJobChatOutboxItem = async ({ accountId, job, itemId }) => {
  const current = await readJobChatOutbox({ accountId, job, recoverInterrupted: false });
  const removed = current.find((item) => item.id === itemId) || null;
  const next = current.filter((item) => item.id !== itemId);
  await writeJobChatOutbox({ accountId, job, items: next });
  return { items: next, removed };
};

const visibleAttachments = (item) => {
  const local = Array.isArray(item?.attachments) ? item.attachments : [];
  const remote = Array.isArray(item?.remoteAttachments) ? item.remoteAttachments : [];
  const matchedRemoteIds = new Set();

  const merged = local.map((attachment) => {
    const match = remote.find((remoteAttachment) => (
      remoteAttachment?.localAttachmentId === attachment?.id
      || remoteAttachment?.id === attachment?.id
    ));
    if (!match) return attachment;
    matchedRemoteIds.add(match.id);
    return {
      ...attachment,
      ...match,
      localUri: attachment?.localUri || match?.localUri || '',
      managedLocal: attachment?.managedLocal || match?.managedLocal || false,
    };
  });

  remote.forEach((attachment) => {
    if (!matchedRemoteIds.has(attachment?.id)) merged.push(attachment);
  });
  return merged;
};

export const jobChatOutboxItemToMessage = (item) => {
  const attachments = visibleAttachments(item).map((attachment) => ({
    ...attachment,
    uploadProgress: Number(item.progress || 0),
    localState: item.status,
  }));

  return {
    id: item.localMessageId,
    outboxId: item.id,
    senderId: item.senderId,
    senderName: item.senderName,
    text: item.text,
    createdAt: item.createdAt,
    editedAt: '',
    localState: item.status,
    uploadProgress: Number(item.progress || 0),
    localError: item.error || '',
    attachments,
    attachmentCount: attachments.length,
  };
};
