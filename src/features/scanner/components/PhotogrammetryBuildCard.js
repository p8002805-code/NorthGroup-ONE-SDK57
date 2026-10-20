import React, {
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const STAGES = [
  { key: 'UPLOADING', label: 'Upload capture', icon: 'cloud-upload-outline' },
  { key: 'QUEUED', label: 'Processing queue', icon: 'time-outline' },
  { key: 'ALIGNING', label: 'Align camera frames', icon: 'scan-outline' },
  { key: 'BUILDING MESH', label: 'Build 3D surface', icon: 'cube-outline' },
  { key: 'OPTIMISING MESH', label: 'Optimise mesh', icon: 'construct-outline' },
  { key: 'TEXTURING', label: 'Texture the model', icon: 'color-palette-outline' },
  { key: 'EXPORTING MODEL', label: 'Export mobile model', icon: 'download-outline' },
  { key: 'SAVING PROJECT', label: 'Save reconstruction', icon: 'save-outline' },
  { key: 'FINALISING', label: 'Download mobile model', icon: 'cloud-download-outline' },
  { key: 'COMPLETE', label: 'Model ready', icon: 'checkmark-circle-outline' },
];

const normaliseStage = (value) => String(value || '')
  .toUpperCase()
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const stageIndexFor = (scan) => {
  const status = String(scan?.processingStatus || '').toLowerCase();
  if (status === 'complete' && scan?.modelUri) return STAGES.length - 1;
  const stage = normaliseStage(scan?.processingStage);
  const index = STAGES.findIndex((item) => item.key === stage);
  if (index >= 0) return index;
  if (status === 'processing') return 2;
  if (status === 'queued') return 1;
  if (status === 'uploading') return 0;
  return 0;
};

const progressFor = (scan) => {
  const raw = Number(scan?.processingProgress);
  if (Number.isFinite(raw)) return Math.min(100, Math.max(0, Math.round(raw)));
  if (scan?.processingStatus === 'queued') return 2;
  return 0;
};

const formatDuration = (seconds) => {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return '';
  const rounded = Math.round(value);
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return remainingSeconds ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
};

const isActiveStatus = (status) => [
  'uploading',
  'queued',
  'processing',
].includes(String(status || '').toLowerCase());

export default function PhotogrammetryBuildCard({
  scan,
  colors,
  onCancel,
  onRetry,
  onViewModel,
  onViewCapture,
  busy = false,
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const spinValue = useRef(new Animated.Value(0)).current;
  const status = String(scan?.processingStatus || '').toLowerCase();
  const failed = status === 'failed';
  const cancelled = status === 'cancelled';
  const complete = status === 'complete' && Boolean(scan?.modelUri);
  const modelPending = status === 'complete' && !complete;
  const active = isActiveStatus(status) || modelPending;
  const workerOffline = status === 'queued' && (
    scan?.processingQueueState === 'processor-offline'
    || scan?.processingWorkerOnline === false
    || (scan?.processingWorkerOnline !== true && !scan?.processingWorkerSeenAt)
  );
  const waitingForWorker = status === 'queued' && !workerOffline;
  const progress = progressFor(scan);
  const currentStageIndex = stageIndexFor(scan);
  const eta = formatDuration(scan?.processingEstimatedSeconds);
  const elapsed = formatDuration(
    scan?.processingElapsedSeconds
    || (scan?.processingStartedAt
      ? Math.max(0, (Date.now() - Date.parse(scan.processingStartedAt)) / 1000)
      : 0),
  );

  useEffect(() => {
    if (!active) {
      spinValue.stopAnimation();
      spinValue.setValue(0);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => {
      animation.stop();
      spinValue.stopAnimation();
    };
  }, [active, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const statusTitle = complete
    ? 'MODEL READY'
    : failed
      ? 'BUILD FAILED'
      : cancelled
        ? 'BUILD CANCELLED'
        : modelPending
          ? 'DOWNLOADING MODEL'
        : workerOffline
          ? 'PROCESSOR OFFLINE'
          : waitingForWorker
            ? 'WAITING FOR PROCESSOR'
          : 'BUILDING 3D MODEL';

  const statusMessage = complete
    ? 'The textured model is ready to inspect, measure and share.'
    : failed
    ? scan?.processingError || 'The processing computer could not complete this scan.'
      : cancelled
        ? scan?.processingMessage || 'This build will not continue.'
        : modelPending
          ? scan?.processingMessage || 'The model is built. NorthGroup ONE is downloading the mobile model.'
        : scan?.processingMessage
          || 'NorthGroup One is preparing the captured frames.';

  return (
    <View style={styles.card}>
      <View style={styles.heroRow}>
        <View style={[styles.orbit, complete && styles.orbitComplete, (failed || cancelled) && styles.orbitError]}>
          {active ? (
            <Animated.View style={[styles.orbitRing, { transform: [{ rotate: spin }] }]} />
          ) : null}
          <View style={[styles.orbitCore, complete && styles.orbitCoreComplete, (failed || cancelled) && styles.orbitCoreError]}>
            <Ionicons
              name={complete ? 'cube' : failed || cancelled ? 'alert-circle' : 'cube-outline'}
              size={25}
              color={complete ? colors.navy : failed || cancelled ? colors.statusWarningText : colors.accent}
            />
          </View>
        </View>

        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>PHOTOGRAMMETRY BUILD</Text>
          <Text style={styles.title} numberOfLines={1}>{scan?.featureId || 'Feature scan'}</Text>
          <Text style={[styles.statusTitle, complete && styles.statusTitleComplete, (failed || cancelled) && styles.statusTitleError]}>
            {statusTitle}
          </Text>
        </View>

        <View style={styles.percentWrap}>
          <Text style={styles.percent}>{complete ? 100 : progress}</Text>
          <Text style={styles.percentUnit}>%</Text>
        </View>
      </View>

      <View style={styles.messageRow}>
        <Ionicons
          name={waitingForWorker ? 'desktop-outline' : complete ? 'checkmark-circle-outline' : failed || cancelled ? 'information-circle-outline' : modelPending ? 'cloud-download-outline' : 'sparkles-outline'}
          size={16}
          color={complete ? colors.statusSuccessText : failed || cancelled ? colors.statusWarningText : colors.accentDark}
        />
        <Text style={styles.message} numberOfLines={3}>{statusMessage}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, complete && styles.progressFillComplete, (failed || cancelled) && styles.progressFillError, { width: `${complete ? 100 : Math.max(active ? 2 : 0, progress)}%` }]} />
      </View>

      <View style={styles.stageList}>
        {STAGES.slice(0, -1).map((stage, index) => {
          const done = complete || index < currentStageIndex;
          const current = !complete && index === currentStageIndex;
          return (
            <View key={stage.key} style={styles.stageRow}>
              <View style={[styles.stageDot, done && styles.stageDotDone, current && styles.stageDotCurrent, (failed || cancelled) && current && styles.stageDotError]}>
                <Ionicons
                  name={done ? 'checkmark' : stage.icon}
                  size={12}
                  color={done ? colors.navy : current ? colors.navy : colors.supportingText}
                />
              </View>
              <Text style={[styles.stageLabel, done && styles.stageLabelDone, current && styles.stageLabelCurrent]}>
                {stage.label}
              </Text>
              <Text style={[styles.stageState, done && styles.stageStateDone, current && styles.stageStateCurrent]}>
                {done ? 'DONE' : current ? (waitingForWorker ? 'WAITING' : 'ACTIVE') : 'NEXT'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{scan?.photos?.length || 0} frames</Text>
        <Text style={styles.metaDivider}>•</Text>
        <Text style={styles.metaText}>{scan?.processingWorkerOnline ? 'Processor connected' : 'Processor not connected'}</Text>
        {eta ? (
          <>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>About {eta} left</Text>
          </>
        ) : null}
        {elapsed ? (
          <>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>Elapsed {elapsed}</Text>
          </>
        ) : null}
        {scan?.processingUpdatedAt ? (
          <>
            <Text style={styles.metaDivider}>•</Text>
            <Text style={styles.metaText}>Updated {new Date(scan.processingUpdatedAt).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.actions}>
        {active ? (
          <>
            <Pressable
              onPress={onViewCapture}
              style={({ pressed }) => [styles.actionButton, styles.captureButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`View captured frames for ${scan?.featureId || 'scan'}`}
            >
              <Ionicons name="images-outline" size={16} color={colors.white} />
              <Text style={[styles.actionText, styles.captureText]}>VIEW CAPTURE</Text>
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={busy}
              style={({ pressed }) => [styles.actionButton, styles.cancelButton, pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={`Cancel 3D build for ${scan?.featureId || 'scan'}`}
            >
              <Ionicons name="stop-circle-outline" size={16} color={colors.statusWarningText} />
              <Text style={[styles.actionText, styles.cancelText]}>{busy ? 'CANCELLING…' : 'CANCEL BUILD'}</Text>
            </Pressable>
          </>
        ) : failed || cancelled ? (
          <>
            <Pressable
              onPress={onViewCapture}
              style={({ pressed }) => [styles.actionButton, styles.captureButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`View captured frames for ${scan?.featureId || 'scan'}`}
            >
              <Ionicons name="images-outline" size={16} color={colors.white} />
              <Text style={[styles.actionText, styles.captureText]}>VIEW CAPTURE</Text>
            </Pressable>
            <Pressable
              onPress={onRetry}
              disabled={busy}
              style={({ pressed }) => [styles.actionButton, styles.retryButton, pressed && styles.pressed, busy && styles.disabled]}
              accessibilityRole="button"
              accessibilityLabel={`Retry 3D build for ${scan?.featureId || 'scan'}`}
            >
              <Ionicons name="refresh" size={16} color={colors.navy} />
              <Text style={styles.actionText}>{busy ? 'RETRYING…' : 'RETRY BUILD'}</Text>
            </Pressable>
          </>
        ) : complete ? (
          <Pressable
            onPress={onViewModel}
            style={({ pressed }) => [styles.actionButton, styles.viewButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`View 3D model for ${scan?.featureId || 'scan'}`}
          >
            <Ionicons name="cube-outline" size={16} color={colors.navy} />
            <Text style={styles.actionText}>OPEN MODEL</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    marginTop: 13,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orbit: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,168,79,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.42)',
  },
  orbitComplete: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  orbitError: {
    backgroundColor: colors.warningBackground,
    borderColor: colors.statusWarningText,
  },
  orbitRing: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'transparent',
    borderTopColor: colors.accent,
    borderRightColor: 'rgba(214,168,79,0.18)',
  },
  orbitCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,26,45,0.96)',
  },
  orbitCoreComplete: {
    backgroundColor: colors.accent,
  },
  orbitCoreError: {
    backgroundColor: colors.warningBackground,
  },
  heroCopy: {
    flex: 1,
    marginLeft: 11,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  statusTitle: {
    color: '#DDE7EF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: 4,
  },
  statusTitleComplete: {
    color: colors.accent,
  },
  statusTitleError: {
    color: '#FFD0C9',
  },
  percentWrap: {
    minWidth: 54,
    alignItems: 'flex-end',
  },
  percent: {
    color: colors.accent,
    fontSize: 27,
    lineHeight: 30,
    fontWeight: '900',
  },
  percentUnit: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginTop: -1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 13,
    padding: 10,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.075)',
  },
  message: {
    flex: 1,
    color: '#D8E2EA',
    fontSize: 10,
    lineHeight: 15,
    marginLeft: 8,
  },
  progressTrack: {
    height: 7,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.16)',
    marginTop: 13,
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: colors.accent,
  },
  progressFillComplete: {
    backgroundColor: '#65D59B',
  },
  progressFillError: {
    backgroundColor: '#F07C6A',
  },
  stageList: {
    marginTop: 13,
  },
  stageRow: {
    minHeight: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stageDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  stageDotDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  stageDotCurrent: {
    backgroundColor: '#EBC773',
    borderColor: '#EBC773',
  },
  stageDotError: {
    backgroundColor: '#F07C6A',
    borderColor: '#F07C6A',
  },
  stageLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 9,
  },
  stageLabelDone: {
    color: '#E3EDF4',
  },
  stageLabelCurrent: {
    color: colors.white,
    fontWeight: '900',
  },
  stageState: {
    color: 'rgba(255,255,255,0.34)',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  stageStateDone: {
    color: '#65D59B',
  },
  stageStateCurrent: {
    color: colors.accent,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 11,
  },
  metaText: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 8,
    fontWeight: '700',
  },
  metaDivider: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 9,
    marginHorizontal: 6,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 13,
  },
  actionButton: {
    minHeight: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  cancelButton: {
    backgroundColor: 'rgba(240,124,106,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(240,124,106,0.6)',
  },
  captureButton: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    marginRight: 8,
  },
  retryButton: {
    backgroundColor: colors.accent,
  },
  viewButton: {
    backgroundColor: colors.accent,
  },
  actionText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginLeft: 7,
  },
  cancelText: {
    color: '#FFD0C9',
  },
  captureText: {
    color: colors.white,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.55,
  },
});
