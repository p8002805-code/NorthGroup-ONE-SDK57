import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';

import { getSurveyorInitials } from '../services/surveyPhotoRules';
import {
  enqueueSurveyPhotoUpload,
  readSurveyPhotoUploadOutbox,
} from '../services/surveyPhotoUploadOutbox';
import { processSurveyPhotoUploadOutbox as runSurveyPhotoUploadOutbox } from '../services/surveyPhotoUploadProcessor';

export default function useSurveyPhotoUploadOutbox({
  activeJob,
  getAccessToken,
  project,
  userInitials = '',
}) {
  const processingRef = useRef(false);
  const autoProcessingPausedRef = useRef(false);
  const [items, setItems] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [autoProcessingPaused, setAutoProcessingPaused] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ phase: 'idle', progress: 0 });
  const [networkState, setNetworkState] = useState({
    isConnected: null,
    isInternetReachable: null,
  });

  const applyItems = useCallback((values) => {
    const next = Array.isArray(values) ? values : [];
    setItems(next);
    return next;
  }, []);

  const process = useCallback(async ({
    includeFailed = false,
    showCompletion = false,
    onStatus,
  } = {}) => {
    if (processingRef.current || !getAccessToken) {
      return { uploaded: 0, remaining: items.length };
    }
    processingRef.current = true;
    setProcessing(true);
    setSyncStatus({ phase: 'uploading', progress: 0 });

    try {
      const result = await runSurveyPhotoUploadOutbox({
        getAccessToken,
        includeFailed,
        initials: userInitials,
        onChange: applyItems,
        onProgress: (itemId, progress) => {
          setItems((current) => current.map((item) => (
            item.id === itemId
              ? { ...item, status: 'uploading', progress }
              : item
          )));
        },
        onStatus: (status) => {
          setSyncStatus(status);
          onStatus?.(status);
        },
      });
      const queue = await readSurveyPhotoUploadOutbox({ recoverInterrupted: false });
      applyItems(queue);

      if (result.uploaded) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      if (showCompletion && result.uploaded && queue.length === 0) {
        const summary = [
          result.uploadedPhotoCount
            ? `${result.uploadedPhotoCount} photo${result.uploadedPhotoCount === 1 ? '' : 's'} uploaded`
            : '',
          result.uploadedPackageCount
            ? `${result.uploadedPackageCount} ZIP file${result.uploadedPackageCount === 1 ? '' : 's'}`
            : '',
        ].filter(Boolean).join('\n');
        const destination = result.lastUploaded?.uploaded?.path || 'Job Files / Photos';
        Alert.alert(
          'SharePoint Sync Complete ✅',
          `${summary || `${result.uploaded} upload${result.uploaded === 1 ? '' : 's'} complete`}\n\nSaved in ${destination}.`,
        );
      } else if (showCompletion && queue.length) {
        Alert.alert(
          'Saved for upload',
          `${queue.length} upload${queue.length === 1 ? ' is' : 's are'} safely stored on this iPhone and will retry automatically when connected.`,
        );
      }
      return {
        uploaded: result.uploaded,
        uploadedPhotoCount: result.uploadedPhotoCount,
        uploadedPackageCount: result.uploadedPackageCount,
        remaining: queue.length,
      };
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  }, [applyItems, getAccessToken, items.length, userInitials]);

  const enqueue = async ({ asset, kind }) => {
    const job = activeJob || { number: project?.projectNumber };
    const initials = userInitials
      || project?.surveyorInitials
      || getSurveyorInitials(project?.surveyor)
      || 'NG';
    const queued = await enqueueSurveyPhotoUpload({ job, initials, asset, kind });
    applyItems(await readSurveyPhotoUploadOutbox({ recoverInterrupted: false }));
    return queued;
  };

  const enqueueZip = ({ kind, part }) => enqueue({
    kind,
    asset: {
      uri: part.uri,
      name: part.fileName,
      mimeType: 'application/zip',
      size: part.sizeBytes,
      partNumber: part.partNumber,
      partCount: part.partCount,
      photoCount: part.photoCount,
      totalPhotoCount: part.totalPhotoCount,
    },
  });

  const processNow = (onStatus) => process({
    includeFailed: true,
    showCompletion: true,
    onStatus,
  });

  useEffect(() => {
    let mounted = true;
    const applyNetworkState = (next) => {
      if (!mounted) return;
      setNetworkState({
        isConnected: next?.isConnected ?? null,
        isInternetReachable: next?.isInternetReachable ?? null,
      });
    };

    readSurveyPhotoUploadOutbox().then((queue) => {
      if (mounted) applyItems(queue);
    }).catch(() => undefined);
    Network.getNetworkStateAsync().then(applyNetworkState).catch(() => undefined);
    const subscription = Network.addNetworkStateListener(applyNetworkState);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [applyItems]);

  const offline = networkState.isConnected === false
    || networkState.isInternetReachable === false;

  const pauseAutoProcessing = useCallback(() => {
    autoProcessingPausedRef.current = true;
    setAutoProcessingPaused(true);
  }, []);

  const resumeAutoProcessing = useCallback(() => {
    autoProcessingPausedRef.current = false;
    setAutoProcessingPaused(false);
  }, []);

  useEffect(() => {
    if (autoProcessingPausedRef.current || autoProcessingPaused || offline || processing) return undefined;
    const retryableItems = items.filter((item) => item.status === 'queued');
    if (!retryableItems.length) return undefined;

    const nextRetryAt = Math.min(
      ...retryableItems.map((item) => Math.max(0, Number(item.nextRetryAt || 0))),
    );
    const waitMs = nextRetryAt ? Math.max(0, nextRetryAt - Date.now()) : 0;
    const timer = setTimeout(
      () => process().catch(() => undefined),
      Math.min(waitMs, 60 * 1000),
    );
    return () => clearTimeout(timer);
  }, [autoProcessingPaused, items, offline, process, processing]);

  const retry = () => {
    if (offline) {
      Alert.alert(
        'Still offline',
        'Pending photo uploads are safe on this iPhone and will retry automatically when reception returns.',
      );
      return;
    }
    process({ includeFailed: true, showCompletion: true }).catch((error) => {
      Alert.alert(
        'Upload retry unavailable',
        error?.message || 'Please try again shortly.',
      );
    });
  };

  return {
    enqueue,
    enqueueZip,
    items,
    offline,
    pauseAutoProcessing,
    process,
    processNow,
    processing,
    progress: processing ? Math.max(0, Math.min(1, Number(syncStatus?.progress) || 0)) : 0,
    resumeAutoProcessing,
    retry,
    syncStatus,
  };
}
