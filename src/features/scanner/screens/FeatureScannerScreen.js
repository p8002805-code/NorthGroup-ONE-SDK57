import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '../../../components/AppButton';
import AppCard from '../../../components/AppCard';
import AppHeader from '../../../components/AppHeader';
import AppSectionHeader from '../../../components/AppSectionHeader';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import GuidedPhotoScanCamera from '../components/GuidedPhotoScanCamera';
import PhotogrammetryBuildCard from '../components/PhotogrammetryBuildCard';
import PhotogrammetryModelViewer from '../components/PhotogrammetryModelViewer';
import ScanViewer from '../components/ScanViewer';
import {
  getFeatureScannerCapabilities,
  getScannerAvailabilityMessage,
  launchFeatureScanner,
  previewFeatureModel,
} from '../services/featureScannerService';
import {
  addPhotoScanImage,
  completePhotoScan,
  createPhotoScanDraft,
  discardEmptyPhotoScan,
  exportPhotoScanZip,
  loadFeatureScans,
  removeLastPhotoScanImage,
  saveFeatureScan,
} from '../services/featureScanStorage';
import {
  cancelPhotogrammetryScan,
  queuePhotogrammetryScan,
  readPhotogrammetryProcessingState,
} from '../services/photogrammetryProcessingService';

const bytesLabel = (scan) => {
  const bytes = Number(scan?.size || 0);
  const type = scan?.scanType === 'lidar'
    ? 'USDZ'
    : scan?.modelUri
      ? 'GLB MODEL'
      : 'AUTO CAPTURE';
  if (!Number.isFinite(bytes) || bytes <= 0) return type;
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB · ${type}`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB · ${type}`;
};

const enhancedAvailabilityLabel = (capabilities) => {
  if (capabilities?.available) return 'LIDAR READY';
  if (capabilities?.reason === 'checking') return 'CHECKING DEVICE';
  if (capabilities?.reason === 'development-build-required') return 'DEV BUILD REQUIRED';
  return 'LIDAR UNAVAILABLE';
};

export default function FeatureScannerScreen({
  activeJob,
  accountProfile,
  getAccessToken,
  goBack,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [capabilities, setCapabilities] = useState({
    available: false,
    reason: 'checking',
    minimumIOS: '18.0',
    mode: 'area',
    format: 'usdz',
  });
  const [enhancedMode, setEnhancedMode] = useState(false);
  const [featureId, setFeatureId] = useState('');
  const [notes, setNotes] = useState('');
  const [scans, setScans] = useState([]);
  const [starting, setStarting] = useState(false);
  const [sharingId, setSharingId] = useState(null);
  const [activePhotoScan, setActivePhotoScan] = useState(null);
  const [reviewScan, setReviewScan] = useState(null);
  const [modelScan, setModelScan] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  const refreshScans = useCallback(async () => {
    try {
      setScans(await loadFeatureScans(activeJob));
    } catch {
      setScans([]);
    }
  }, [activeJob]);

  useEffect(() => {
    refreshScans();
  }, [refreshScans]);

  useEffect(() => {
    if (!getAccessToken || !activeJob?.number) return undefined;

    let cancelled = false;
    let syncing = false;

    const syncProcessing = async () => {
      if (cancelled || syncing) return;
      syncing = true;
      try {
        const current = await loadFeatureScans(activeJob);
        const candidates = current.filter((scan) => (
          scan.scanType === 'photo'
          && (
            ['uploading', 'queued', 'processing'].includes(scan.processingStatus)
            || (scan.processingStatus === 'complete' && !scan.modelUri)
          )
        ));
        if (!candidates.length) return;

        const accessToken = await getAccessToken();
        let changed = false;
        for (const scan of candidates) {
          try {
            const state = await readPhotogrammetryProcessingState({
              accessToken,
              job: activeJob,
              scan,
            });
            const next = { ...scan, ...state };
            if (
              next.processingStatus !== scan.processingStatus
              || next.processingProgress !== scan.processingProgress
              || next.processingQueueState !== scan.processingQueueState
              || next.modelUri !== scan.modelUri
              || next.processingMessage !== scan.processingMessage
              || next.processingError !== scan.processingError
              || next.processingErrorCode !== scan.processingErrorCode
              || next.processingStage !== scan.processingStage
              || next.processingUpdatedAt !== scan.processingUpdatedAt
              || next.processingQueuedAt !== scan.processingQueuedAt
              || next.processingStartedAt !== scan.processingStartedAt
              || next.processingEstimatedSeconds !== scan.processingEstimatedSeconds
              || next.processingElapsedSeconds !== scan.processingElapsedSeconds
              || next.processingWorkerSeenAt !== scan.processingWorkerSeenAt
              || next.processingWorkerId !== scan.processingWorkerId
              || next.processingWorkerOnline !== scan.processingWorkerOnline
              || next.processingWorkerHeartbeatAt !== scan.processingWorkerHeartbeatAt
              || next.processingWorkerError !== scan.processingWorkerError
              || next.processingWaitingForWorker !== scan.processingWaitingForWorker
              || next.processingCancelledAt !== scan.processingCancelledAt
            ) {
              await saveFeatureScan(activeJob, next);
              changed = true;
            }
          } catch {
            // A temporary network or SharePoint delay should not erase the local state.
          }
        }

        if (changed && !cancelled) await refreshScans();
      } finally {
        syncing = false;
      }
    };

    syncProcessing();
    const timer = setInterval(syncProcessing, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeJob, getAccessToken, refreshScans]);

  useEffect(() => {
    let active = true;
    getFeatureScannerCapabilities().then((result) => {
      if (active) setCapabilities(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const validateNewScan = useCallback(() => {
    const cleanFeatureId = featureId.trim().toUpperCase();
    if (!activeJob?.number) {
      Alert.alert('Choose a job', 'Select an active job before starting a feature scan.');
      return null;
    }
    if (!cleanFeatureId) {
      Alert.alert('Feature ID required', 'Enter a short feature or scan ID.');
      return null;
    }
    return cleanFeatureId;
  }, [activeJob, featureId]);

  const startStandardScan = useCallback(async () => {
    const cleanFeatureId = validateNewScan();
    if (!cleanFeatureId) return;

    setStarting(true);
    try {
      const draft = await createPhotoScanDraft({
        job: activeJob,
        featureId: cleanFeatureId,
        notes,
        operator: accountProfile?.name || accountProfile?.displayName || '',
      });
      setActivePhotoScan(draft);
    } catch (error) {
      Alert.alert(
        'Automatic scan could not start',
        error?.message || 'NorthGroup One could not prepare the scan folder.',
      );
    } finally {
      setStarting(false);
    }
  }, [accountProfile, activeJob, notes, validateNewScan]);

  const startEnhancedScan = useCallback(async () => {
    const cleanFeatureId = validateNewScan();
    if (!cleanFeatureId) return;
    if (!capabilities?.available) {
      Alert.alert(
        'Enhanced mode unavailable',
        getScannerAvailabilityMessage(capabilities),
      );
      return;
    }

    setStarting(true);
    try {
      const result = await launchFeatureScanner({
        jobNumber: activeJob.number,
        featureId: cleanFeatureId,
        notes,
      });
      if (!result || result.cancelled) return;

      await saveFeatureScan(activeJob, {
        id: `${activeJob.number}-${cleanFeatureId}-${Date.now()}`,
        jobNumber: activeJob.number,
        featureId: cleanFeatureId,
        notes,
        operator: accountProfile?.name || accountProfile?.displayName || '',
        scanType: 'lidar',
        status: 'complete',
        modelUri: result.modelUri,
        scanDirectoryUri: result.scanDirectoryUri,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      });
      setFeatureId('');
      setNotes('');
      await refreshScans();
      Alert.alert(
        'Enhanced 3D scan saved',
        `${cleanFeatureId} has been saved against Job ${activeJob.number}.`,
      );
    } catch (error) {
      Alert.alert(
        '3D scan could not be completed',
        error?.message || 'NorthGroup One could not complete this scan.',
      );
    } finally {
      setStarting(false);
    }
  }, [
    accountProfile,
    activeJob,
    capabilities,
    notes,
    refreshScans,
    validateNewScan,
  ]);

  const captureFrame = useCallback(async (sourceUri) => {
    const updated = await addPhotoScanImage(activePhotoScan, sourceUri);
    await saveFeatureScan(activeJob, updated);
    setActivePhotoScan(updated);
  }, [activeJob, activePhotoScan]);

  const removeLastPhoto = useCallback(async () => {
    if (!activePhotoScan?.photos?.length) return;
    try {
      const updated = await removeLastPhotoScanImage(activePhotoScan);
      await saveFeatureScan(activeJob, updated);
      setActivePhotoScan(updated);
    } catch (error) {
      Alert.alert('Frame could not be removed', error?.message || 'Please try again.');
    }
  }, [activeJob, activePhotoScan]);

  const finishPhotoScan = useCallback(async () => {
    try {
      const completed = completePhotoScan(activePhotoScan);
      await saveFeatureScan(activeJob, completed);
      setActivePhotoScan(null);
      setFeatureId('');
      setNotes('');
      await refreshScans();
      setReviewScan(completed);
    } catch (error) {
      Alert.alert(
        'Automatic scan could not be completed',
        error?.message || 'Please try again.',
      );
    }
  }, [activeJob, activePhotoScan, refreshScans]);

  const closePhotoScan = useCallback(() => {
    const count = activePhotoScan?.photos?.length || 0;
    if (!count) {
      discardEmptyPhotoScan(activePhotoScan).catch(() => {});
      setActivePhotoScan(null);
      return;
    }

    Alert.alert(
      'Leave automatic scan?',
      `The ${count} captured frame${count === 1 ? '' : 's'} will remain saved as a draft.`,
      [
        { text: 'Keep Scanning', style: 'cancel' },
        {
          text: 'Save Draft',
          onPress: async () => {
            setActivePhotoScan(null);
            await refreshScans();
          },
        },
      ],
    );
  }, [activePhotoScan, refreshScans]);

  const resumePhotoScan = useCallback((scan) => {
    setActivePhotoScan(scan);
  }, []);

  const processPhotoScan = useCallback(async (scan) => {
    if (!scan?.id || !activeJob?.number) return;
    if (!getAccessToken) {
      Alert.alert(
        'Processing is not connected',
        'Microsoft sign-in is required before a scan can be sent to the processing queue.',
      );
      return;
    }
    if (scan.status === 'draft') {
      Alert.alert('Finish the scan first', 'Capture the required coverage and finish the scan before processing it.');
      return;
    }
    if (['uploading', 'queued', 'processing'].includes(scan.processingStatus)) return;

    setProcessingId(scan.id);
    const uploadingScan = {
      ...scan,
      processingStatus: 'uploading',
      processingProgress: 1,
      processingStage: 'UPLOADING',
      processingQueueState: 'uploading',
      processingMessage: 'Preparing the captured frames for the NorthGroup processing computer.',
      processingError: '',
      processingErrorCode: '',
      processingUpdatedAt: new Date().toISOString(),
      processingQueuedAt: null,
      processingStartedAt: null,
      processingEstimatedSeconds: null,
      processingElapsedSeconds: null,
      processingWorkerOnline: false,
      processingWorkerHeartbeatAt: null,
      processingWorkerError: '',
      processingWaitingForWorker: false,
    };
    try {
      await saveFeatureScan(activeJob, uploadingScan);
      await refreshScans();

      const accessToken = await getAccessToken();
      const queued = await queuePhotogrammetryScan({
        accessToken,
        job: activeJob,
        scan: uploadingScan,
        onProgress: (value) => {
          const progress = Math.min(94, Math.max(1, Math.round(Number(value || 0) * 94)));
          setScans((current) => current.map((item) => (
            item.id === scan.id
              ? {
                ...item,
                processingStatus: 'uploading',
                processingProgress: progress,
                processingStage: 'UPLOADING',
                processingMessage: `Uploading the scan pack to the active job (${progress}%).`,
                processingUpdatedAt: new Date().toISOString(),
              }
              : item
          )));
        },
      });
      const next = { ...uploadingScan, ...queued };
      await saveFeatureScan(activeJob, next);
      await refreshScans();
      Alert.alert(
        '3D processing queued',
        `${scan.featureId} has been uploaded. The build card will show whether the processor is online, the current stage, percentage and estimated time remaining.`,
      );
    } catch (error) {
      await saveFeatureScan(activeJob, {
        ...uploadingScan,
        processingStatus: 'failed',
        processingStage: 'FAILED',
        processingQueueState: 'failed',
        processingMessage: 'The scan could not be uploaded to the processing queue.',
        processingError: error?.message || 'The scan could not be sent for processing.',
        processingErrorCode: 'MOBILE_UPLOAD_FAILED',
        processingWaitingForWorker: false,
      }).catch(() => {});
      await refreshScans();
      Alert.alert(
        '3D processing could not start',
        error?.message || 'The scan could not be sent to the processing queue.',
      );
    } finally {
      setProcessingId(null);
    }
  }, [activeJob, getAccessToken, refreshScans]);

  const cancelPhotoScan = useCallback((scan) => {
    if (!scan?.id || !activeJob?.number) return;

    Alert.alert(
      'Cancel 3D build?',
      `Stop processing ${scan.featureId || 'this scan'}? The captured frames will remain saved, but the model build will not continue.`,
      [
        { text: 'Keep Building', style: 'cancel' },
        {
          text: 'Cancel Build',
          style: 'destructive',
          onPress: async () => {
            setProcessingId(scan.id);
            const cancellingScan = {
              ...scan,
              processingStatus: 'cancelled',
              processingProgress: 0,
              processingStage: 'CANCELLED',
              processingMessage: 'Sending the cancellation request to the processing computer.',
              processingError: '',
              processingWaitingForWorker: false,
              processingUpdatedAt: new Date().toISOString(),
            };
            try {
              await saveFeatureScan(activeJob, cancellingScan);
              await refreshScans();
              const accessToken = await getAccessToken?.();
              const cancelled = await cancelPhotogrammetryScan({
                accessToken,
                job: activeJob,
                scan,
              });
              await saveFeatureScan(activeJob, { ...cancellingScan, ...cancelled });
              await refreshScans();
            } catch (error) {
              await saveFeatureScan(activeJob, {
                ...cancellingScan,
                processingMessage: 'Cancellation was recorded on this iPhone, but SharePoint could not be updated.',
                processingError: error?.message || 'The cancellation request could not be sent.',
              }).catch(() => {});
              await refreshScans();
              Alert.alert(
                'Cancellation could not be sent',
                error?.message || 'The build is marked cancelled locally. Check Microsoft sign-in and try again.',
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ],
    );
  }, [activeJob, getAccessToken, refreshScans]);

  const previewScan = useCallback(async (scan) => {
    if (scan.scanType === 'photo') {
      if (scan.modelUri && scan.modelFormat === 'glb') {
        setModelScan(scan);
      } else {
        setReviewScan(scan);
      }
      return;
    }

    try {
      await previewFeatureModel(scan.modelUri);
    } catch (error) {
      Alert.alert('Preview unavailable', error?.message || 'The model could not be opened.');
    }
  }, []);

  const saveMeasurement = useCallback(async (measurement) => {
    if (!reviewScan || !activeJob?.number) return;
    const next = {
      ...reviewScan,
      measurements: [
        ...(reviewScan.measurements || []),
        measurement,
      ],
    };
    setReviewScan(next);
    try {
      await saveFeatureScan(activeJob, next);
      await refreshScans();
    } catch {
      Alert.alert(
        'Measurement not saved',
        'The measurement is visible in this viewer, but NorthGroup One could not save it to the scan record.',
      );
    }
  }, [activeJob, refreshScans, reviewScan]);

  const saveModelMeasurement = useCallback(async (measurement) => {
    if (!modelScan || !activeJob?.number) return;
    const next = {
      ...modelScan,
      measurements: [
        ...(modelScan.measurements || []),
        measurement,
      ],
    };
    setModelScan(next);
    try {
      await saveFeatureScan(activeJob, next);
      await refreshScans();
    } catch {
      Alert.alert(
        'Measurement not saved',
        'The measurement is visible in the model viewer, but NorthGroup One could not save it to the scan record.',
      );
    }
  }, [activeJob, modelScan, refreshScans]);

  const shareScan = useCallback(async (scan) => {
    setSharingId(scan.id);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'This iPhone cannot share the saved scan.');
        return;
      }

      if (scan.scanType === 'photo' && scan.modelUri && scan.modelFormat === 'glb') {
        await Sharing.shareAsync(scan.modelUri, {
          dialogTitle: `Share ${scan.featureId} 3D model`,
          mimeType: 'model/gltf-binary',
          UTI: 'public.data',
        });
      } else if (scan.scanType === 'photo') {
        const zipUri = await exportPhotoScanZip(scan);
        await Sharing.shareAsync(zipUri, {
          dialogTitle: `Share ${scan.featureId} auto scan`,
          mimeType: 'application/zip',
          UTI: 'public.zip-archive',
        });
      } else {
        await Sharing.shareAsync(scan.modelUri, {
          dialogTitle: `Share ${scan.featureId} 3D scan`,
          mimeType: 'model/vnd.usdz+zip',
          UTI: 'com.pixar.universal-scene-description-mobile',
        });
      }
    } catch (error) {
      Alert.alert('Share failed', error?.message || 'The scan could not be shared.');
    } finally {
      setSharingId(null);
    }
  }, []);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="FIELD CAPTURE"
        title="Feature Scanner"
        subtitle="Continuous auto-capture for every iPhone, with LiDAR model building where available."
        onBack={goBack}
        backLabel="Field Tools"
        showTopo
        compact
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxxl },
        ]}
      >
        <AppCard style={styles.jobCard} padding="compact">
          <View style={styles.jobIcon}>
            <Text style={styles.jobIconText}>3D</Text>
          </View>
          <View style={styles.jobCopy}>
            <Text style={styles.eyebrow}>ACTIVE JOB</Text>
            <Text style={styles.jobNumber}>
              {activeJob?.number || 'No active job'}
            </Text>
            <Text style={styles.jobLocation} numberOfLines={2}>
              {activeJob?.location || 'Choose a job before scanning.'}
            </Text>
          </View>
          <View style={[styles.statusPill, styles.statusPillReady]}>
            <Text style={[styles.statusText, styles.statusTextReady]}>
              STANDARD READY
            </Text>
          </View>
        </AppCard>

        <AppCard style={styles.modeCard} padding="compact">
          <View style={styles.modeTopRow}>
            <View style={styles.modeIcon}>
              <Ionicons
                name={enhancedMode ? 'scan-outline' : 'camera-outline'}
                size={23}
                color={colors.accent}
              />
            </View>
            <View style={styles.modeCopy}>
              <Text style={styles.modeEyebrow}>
                {enhancedMode ? 'ENHANCED MODE' : 'DEFAULT MODE'}
              </Text>
              <Text style={styles.modeTitle}>
                {enhancedMode ? 'LiDAR 3D Scan' : 'Continuous Auto Scan'}
              </Text>
            <Text style={styles.modeText}>
              {enhancedMode
                ? 'Creates a finished USDZ model directly on supported Pro devices.'
                : 'Tap Start, move around the feature, then send the captured frames to the NorthGroup processing queue to create a finished model.'}
              </Text>
            </View>
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchCopy}>
              <Text style={styles.switchTitle}>Enhanced LiDAR mode</Text>
              <Text style={styles.switchSubtitle}>
                {enhancedAvailabilityLabel(capabilities)}
              </Text>
            </View>
            <Switch
              value={enhancedMode}
              onValueChange={setEnhancedMode}
              trackColor={{
                false: colors.borderStrong,
                true: colors.accentSoft,
              }}
              thumbColor={enhancedMode ? colors.accent : colors.white}
              ios_backgroundColor={colors.borderStrong}
              accessibilityLabel="Enhanced LiDAR mode"
            />
          </View>
        </AppCard>

        {enhancedMode && !capabilities?.available ? (
          <AppCard style={styles.availabilityCard} padding="compact">
            <View style={styles.availabilityRow}>
              <Ionicons
                name="information-circle-outline"
                size={22}
                color={colors.statusWarningText}
              />
              <View style={styles.availabilityCopy}>
                <Text style={styles.availabilityTitle}>
                  LiDAR unavailable on this device
                </Text>
                <Text style={styles.availabilityText}>
                  {getScannerAvailabilityMessage(capabilities)}
                </Text>
                <Text style={styles.availabilityFootnote}>
                  Switch Enhanced Mode off to use the standard scanner.
                </Text>
              </View>
            </View>
          </AppCard>
        ) : null}

        <AppSectionHeader
          title="New scan"
          subtitle={
            enhancedMode
              ? 'Use LiDAR to produce a finished model on the iPhone.'
              : 'Start once, move around the feature and finish when coverage is complete.'
          }
        />

        <AppCard style={styles.formCard}>
          <Text style={styles.label}>FEATURE / SCAN ID</Text>
          <TextInput
            value={featureId}
            onChangeText={(value) => setFeatureId(value.toUpperCase())}
            placeholder="E.g. PIT-04 or CULVERT-A"
            placeholderTextColor={colors.placeholderText}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
            style={styles.input}
          />

          <Text style={[styles.label, styles.notesLabel]}>NOTES (OPTIONAL)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Condition, purpose or area being captured"
            placeholderTextColor={colors.placeholderText}
            multiline
            maxLength={240}
            style={[styles.input, styles.notesInput]}
          />

          <View style={styles.guidance}>
            <Text style={styles.guidanceTitle}>
              {enhancedMode ? 'Enhanced capture' : 'Continuous auto-capture'}
            </Text>
            <Text style={styles.guidanceText}>
              {enhancedMode
                ? 'Move slowly in overlapping rows and keep the feature clear of moving people or vehicles.'
                : 'Tap Start Scan and move slowly around the feature. NorthGroup One captures spaced frames automatically; no shutter presses are needed. At least 12 frames are required and 24 is recommended. After finishing, tap PROCESS 3D.'}
            </Text>
          </View>

          <AppButton
            title={
                enhancedMode
                  ? capabilities?.available
                    ? 'START ENHANCED LIDAR SCAN'
                    : 'ENHANCED MODE UNAVAILABLE'
                : 'START CONTINUOUS AUTO SCAN'
            }
            icon={enhancedMode ? '◈' : '◉'}
            onPress={enhancedMode ? startEnhancedScan : startStandardScan}
            loading={starting}
            disabled={!activeJob?.number || (enhancedMode && !capabilities?.available)}
          />
        </AppCard>

        <AppSectionHeader
          title="Saved scans"
          subtitle={
            scans.length
              ? `${scans.length} capture${scans.length === 1 ? '' : 's'} for this job.`
              : 'Completed scans and photo sets will appear here.'
          }
        />

        {scans.length ? scans.map((scan) => {
          const isPhotoScan = scan.scanType === 'photo';
          const isDraft = scan.status === 'draft';
          const isSharing = sharingId === scan.id;
          const isModelReady = isPhotoScan
            ? Boolean(scan.modelUri && scan.modelFormat === 'glb')
            : true;
          const isProcessing = isPhotoScan && [
            'uploading',
            'queued',
            'processing',
          ].includes(scan.processingStatus);
          const processingFailed = isPhotoScan && scan.processingStatus === 'failed';
          const processingCancelled = isPhotoScan && scan.processingStatus === 'cancelled';
          const processingFinalising = isPhotoScan
            && scan.processingStatus === 'complete'
            && !isModelReady;
          const showBuildCard = isPhotoScan
            && !isDraft
            && (isProcessing || processingFailed || processingCancelled || processingFinalising);
          const processingLabel = isProcessing
            ? `${scan.processingStage || 'PROCESSING'} ${Math.round(Number(scan.processingProgress || 0))}%`
            : scan.processingStatus === 'complete'
              ? processingFinalising ? 'FINALISING MODEL' : 'MODEL READY'
              : processingFailed
                ? 'BUILD FAILED'
                : processingCancelled
                  ? 'BUILD CANCELLED'
                  : 'NOT PROCESSED';

          return (
            <AppCard key={scan.id} style={styles.scanCard} padding="compact">
              <View style={styles.scanTopRow}>
                <View style={styles.scanBadge}>
                  <Text style={styles.scanBadgeText}>
                    {isPhotoScan ? 'AUTO' : '3D'}
                  </Text>
                </View>
                <View style={styles.scanCopy}>
                  <View style={styles.scanTitleRow}>
                    <Text style={styles.scanTitle}>{scan.featureId}</Text>
                    {isDraft ? (
                      <View style={styles.draftPill}>
                        <Text style={styles.draftText}>DRAFT</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.scanMeta}>
                    {new Date(scan.createdAt).toLocaleString('en-AU')}
                    {isPhotoScan ? ` · ${scan.photos.length} FRAMES` : ''}
                    {scan.measurements?.length ? ` · ${scan.measurements.length} MEASURED` : ''}
                  </Text>
                  <Text style={styles.scanFormat}>{bytesLabel(scan)}</Text>
                  {isPhotoScan && !isDraft && !showBuildCard ? (
                    <Text style={[styles.scanProcessing, processingFailed && styles.scanProcessingFailed]}>
                      {processingLabel}
                    </Text>
                  ) : null}
                  {isProcessing && !showBuildCard ? (
                    <View style={styles.processingTrack}>
                      <View
                        style={[
                          styles.processingFill,
                          { width: `${Math.min(100, Math.max(2, Number(scan.processingProgress || 0)))}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                  {processingFailed && scan.processingError ? (
                    !showBuildCard ? (
                    <Text style={styles.scanProcessingError} numberOfLines={2}>
                      {scan.processingError}
                    </Text>
                    ) : null
                  ) : null}
                  {scan.notes ? (
                    <Text style={styles.scanNotes} numberOfLines={2}>
                      {scan.notes}
                    </Text>
                  ) : null}
                </View>
              </View>

              {showBuildCard ? (
                <PhotogrammetryBuildCard
                  scan={scan}
                  colors={colors}
                  busy={processingId === scan.id}
                  onCancel={() => cancelPhotoScan(scan)}
                  onRetry={() => processPhotoScan(scan)}
                  onViewCapture={() => previewScan(scan)}
                  onViewModel={() => previewScan(scan)}
                />
              ) : null}

              <View style={styles.scanActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => (
                    isPhotoScan && isDraft
                      ? resumePhotoScan(scan)
                      : previewScan(scan)
                  )}
                  style={({ pressed }) => [
                    styles.scanAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.scanActionText}>
                    {isPhotoScan && isDraft
                      ? 'RESUME'
                      : isPhotoScan
                        ? isModelReady ? 'VIEW MODEL' : 'VIEW FRAMES'
                        : 'VIEW 3D'}
                  </Text>
                </Pressable>
                {isPhotoScan ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => processPhotoScan(scan)}
                    disabled={isDraft || isProcessing || processingFinalising || processingId === scan.id}
                    style={({ pressed }) => [
                      styles.scanAction,
                      styles.processAction,
                      pressed && styles.pressed,
                      (isDraft || isProcessing || processingFinalising || processingId === scan.id) && styles.actionDisabled,
                    ]}
                  >
                    {processingId === scan.id ? (
                      <ActivityIndicator size="small" color={colors.navy} />
                    ) : (
                      <Text style={styles.scanActionText}>
                        {isModelReady
                          ? 'REPROCESS'
                          : isProcessing
                            ? 'PROCESSING'
                            : processingFinalising
                              ? 'FINALISING'
                              : processingFailed || processingCancelled
                                ? 'RETRY 3D'
                                : 'PROCESS 3D'}
                      </Text>
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => shareScan(scan)}
                  disabled={isSharing || (isPhotoScan && !scan.photos.length)}
                  style={({ pressed }) => [
                    styles.scanAction,
                    pressed && styles.pressed,
                    isSharing && styles.actionDisabled,
                  ]}
                >
                  {isSharing ? (
                    <ActivityIndicator size="small" color={colors.navy} />
                  ) : (
                    <Text style={styles.scanActionText}>SHARE</Text>
                  )}
                </Pressable>
              </View>
            </AppCard>
          );
        }) : (
          <AppCard style={styles.emptyCard} padding="compact">
            <Text style={styles.emptyIcon}>◇</Text>
            <Text style={styles.emptyTitle}>No feature scans saved yet</Text>
            <Text style={styles.emptyText}>
              Start the continuous auto scanner on any iPhone, then process the finished frame set into a model.
            </Text>
          </AppCard>
        )}

        <Text style={styles.disclaimer}>
          Standard mode automatically collects overlapping camera frames and
          sends them to a NorthGroup processing computer for a textured GLB
          model. The model can be inspected, rotated and measured after it
          returns to the app. All scan measurements are for field documentation
          and context—not certified or survey-grade observations.
        </Text>
      </ScrollView>

      <GuidedPhotoScanCamera
        visible={Boolean(activePhotoScan)}
        scan={activePhotoScan}
        onCapture={captureFrame}
        onRemoveLast={removeLastPhoto}
        onClose={closePhotoScan}
        onFinish={finishPhotoScan}
      />

      <ScanViewer
        visible={Boolean(reviewScan)}
        scan={reviewScan}
        onClose={() => setReviewScan(null)}
        onShare={() => shareScan(reviewScan)}
        onProcess={() => {
          const scan = reviewScan;
          setReviewScan(null);
          processPhotoScan(scan);
        }}
        onSaveMeasurement={saveMeasurement}
      />

      <PhotogrammetryModelViewer
        visible={Boolean(modelScan)}
        scan={modelScan}
        onClose={() => setModelScan(null)}
        onShare={() => shareScan(modelScan)}
        onSaveMeasurement={saveModelMeasurement}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderColor: colors.divider,
  },
  jobIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  jobIconText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  jobCopy: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  jobNumber: {
    color: colors.bodyText,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  jobLocation: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  statusPill: {
    maxWidth: 92,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillReady: {
    backgroundColor: colors.successBackground,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  statusTextReady: {
    color: colors.statusSuccessText,
  },
  modeCard: {
    marginBottom: SPACING.md,
    borderColor: colors.divider,
  },
  modeTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  modeIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
    marginRight: SPACING.md,
  },
  modeCopy: {
    flex: 1,
  },
  modeEyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modeTitle: {
    color: colors.bodyText,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  modeText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchCopy: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  switchTitle: {
    color: colors.bodyText,
    fontSize: 13,
    fontWeight: '800',
  },
  switchSubtitle: {
    color: colors.supportingText,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 3,
  },
  availabilityCard: {
    marginBottom: SPACING.lg,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  availabilityCopy: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  availabilityTitle: {
    color: colors.bodyText,
    fontSize: 13,
    fontWeight: '900',
  },
  availabilityText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  availabilityFootnote: {
    color: colors.statusWarningText,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  formCard: {
    marginBottom: SPACING.xl,
  },
  label: {
    color: colors.supportingText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 7,
  },
  notesLabel: {
    marginTop: SPACING.lg,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 15,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  guidance: {
    marginVertical: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.infoBackground,
  },
  guidanceTitle: {
    color: colors.statusInfoText,
    fontSize: 12,
    fontWeight: '900',
  },
  guidanceText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  scanCard: {
    marginBottom: SPACING.md,
  },
  scanTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  scanBadge: {
    width: 48,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  scanBadgeText: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
  },
  scanCopy: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  scanTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanTitle: {
    flexShrink: 1,
    color: colors.bodyText,
    fontSize: 15,
    fontWeight: '900',
  },
  draftPill: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.warningBackground,
    marginLeft: 8,
  },
  draftText: {
    color: colors.statusWarningText,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  scanMeta: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  scanFormat: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  scanProcessing: {
    color: colors.statusInfoText,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.55,
    marginTop: 4,
  },
  scanProcessingFailed: {
    color: colors.statusWarningText,
  },
  scanProcessingError: {
    color: colors.statusWarningText,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
  },
  processingTrack: {
    height: 4,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: colors.border,
    marginTop: 6,
  },
  processingFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  scanNotes: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  scanActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  scanAction: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: RADIUS.md,
    backgroundColor: colors.warningBackground,
  },
  processAction: {
    backgroundColor: colors.accentSoft,
  },
  scanActionText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  actionDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.76,
  },
  emptyCard: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyIcon: {
    color: colors.accent,
    fontSize: 29,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.bodyText,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  emptyText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
  },
  disclaimer: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
  reviewPage: {
    flex: 1,
    backgroundColor: '#000000',
  },
  reviewHeader: {
    minHeight: 98,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  reviewHeaderButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewHeaderCopy: {
    flex: 1,
    alignItems: 'center',
  },
  reviewEyebrow: {
    color: '#D6A84F',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  reviewTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  reviewImageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewFooter: {
    minHeight: 118,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  reviewCounter: {
    color: '#D6A84F',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  reviewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  reviewNavButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#09233C',
  },
  reviewNavDisabled: {
    opacity: 0.3,
  },
  reviewSequence: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  reviewSequenceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
