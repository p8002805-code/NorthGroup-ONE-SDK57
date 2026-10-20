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
  Image,
  ImageBackground,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const TARGET_FRAMES = 24;
const MINIMUM_FRAMES = 12;
const MAXIMUM_FRAMES = 60;
const AUTO_CAPTURE_INTERVAL_MS = 900;

const getCaptureGuide = (count, isCapturing, isPaused) => {
  if (!isCapturing && !isPaused && count === 0) {
    return {
      step: 'READY TO SCAN',
      title: 'Tap Start, then move around the feature',
      detail: 'NorthGroup One will capture useful frames automatically. There is no shutter to press.',
    };
  }

  if (isPaused) {
    return {
      step: 'PAUSED',
      title: 'Resume when you are ready',
      detail: 'Keep the feature in the same position before continuing so the next frames overlap well.',
    };
  }

  if (count < 6) {
    return {
      step: 'START LOW',
      title: 'Begin a slow clockwise pass',
      detail: 'Keep the complete feature inside the frame and move at a steady walking pace.',
    };
  }

  if (count < 16) {
    return {
      step: 'MIDDLE RING',
      title: 'Continue around the feature',
      detail: 'Maintain a similar distance and let the automatic capture collect overlapping views.',
    };
  }

  if (count < TARGET_FRAMES) {
    return {
      step: 'TOP + EDGES',
      title: 'Cover the top and hidden edges',
      detail: 'Raise the camera safely and move slowly across any areas not clearly seen yet.',
    };
  }

  return {
    step: 'GOOD COVERAGE',
    title: 'Recommended coverage reached',
    detail: 'Add detail views if needed, or finish the scan and review the captured frame set.',
  };
};

export default function GuidedPhotoScanCamera({
  scan,
  visible,
  onCapture,
  onRemoveLast,
  onClose,
  onFinish,
}) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef(null);
  const captureLock = useRef(false);
  const captureTimer = useRef(null);
  const onCaptureRef = useRef(onCapture);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState('off');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [framePulse, setFramePulse] = useState(false);
  const [captureError, setCaptureError] = useState('');

  const frameCount = scan?.photos?.length || 0;
  const guide = useMemo(
    () => getCaptureGuide(frameCount, isCapturing, isPaused),
    [frameCount, isCapturing, isPaused],
  );
  const progress = Math.min(100, (frameCount / TARGET_FRAMES) * 100);
  const lastFrame = scan?.photos?.[frameCount - 1];

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    if (visible) return undefined;

    setCameraReady(false);
    setIsCapturing(false);
    setIsPaused(false);
    setSaving(false);
    setCaptureError('');
    if (captureTimer.current) {
      clearTimeout(captureTimer.current);
      captureTimer.current = null;
    }
    return undefined;
  }, [visible]);

  useEffect(() => {
    if (frameCount < MAXIMUM_FRAMES) return;
    setIsCapturing(false);
    setIsPaused(true);
  }, [frameCount]);

  const captureFrame = useCallback(async () => {
    if (
      !cameraReady
      || !cameraRef.current
      || captureLock.current
      || frameCount >= MAXIMUM_FRAMES
    ) {
      return;
    }

    captureLock.current = true;
    setSaving(true);
    setCaptureError('');

    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.72,
        exif: false,
        skipProcessing: false,
        shutterSound: false,
      });

      if (!result?.uri) throw new Error('The camera did not return an image.');

      await onCaptureRef.current(result.uri);
      setFramePulse(true);
      setTimeout(() => setFramePulse(false), 150);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      setCaptureError(error?.message || 'A frame was missed. Keep moving slowly.');
    } finally {
      captureLock.current = false;
      setSaving(false);
    }
  }, [cameraReady, frameCount]);

  useEffect(() => {
    if (
      !visible
      || !permission?.granted
      || !cameraReady
      || !isCapturing
      || isPaused
      || frameCount >= MAXIMUM_FRAMES
    ) {
      if (captureTimer.current) {
        clearTimeout(captureTimer.current);
        captureTimer.current = null;
      }
      return undefined;
    }

    let cancelled = false;

    const scheduleNextFrame = () => {
      if (cancelled) return;
      captureTimer.current = setTimeout(async () => {
        if (cancelled) return;
        await captureFrame();
        if (cancelled) return;
        scheduleNextFrame();
      }, AUTO_CAPTURE_INTERVAL_MS);
    };

    scheduleNextFrame();

    return () => {
      cancelled = true;
      if (captureTimer.current) {
        clearTimeout(captureTimer.current);
        captureTimer.current = null;
      }
    };
  }, [
    cameraReady,
    captureFrame,
    frameCount,
    isCapturing,
    isPaused,
    permission?.granted,
    visible,
  ]);

  const startCapture = useCallback(async () => {
    if (!cameraReady || frameCount >= MAXIMUM_FRAMES) return;
    setCaptureError('');
    setIsPaused(false);
    setIsCapturing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [cameraReady, frameCount]);

  const pauseCapture = useCallback(async () => {
    setIsPaused((value) => !value);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const finish = useCallback(() => {
    if (frameCount < MINIMUM_FRAMES) {
      Alert.alert(
        'More coverage needed',
        `Let automatic capture collect at least ${MINIMUM_FRAMES} overlapping frames before finishing. ${TARGET_FRAMES} frames is recommended for stronger reconstruction coverage.`,
      );
      return;
    }

    setIsCapturing(false);
    setIsPaused(false);
    onFinish();
  }, [frameCount, onFinish]);

  const close = useCallback(() => {
    setIsCapturing(false);
    setIsPaused(false);
    onClose();
  }, [onClose]);

  const removeLast = useCallback(async () => {
    if (!lastFrame || saving || isCapturing) return;
    setCaptureError('');
    await onRemoveLast();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [isCapturing, lastFrame, onRemoveLast, saving]);

  if (!visible) return null;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      <View style={styles.page}>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />

        {!permission?.granted ? (
          <View style={styles.permissionPage}>
            <ImageBackground
              source={require('../../../../assets/topo-bg.png')}
              style={[styles.header, { paddingTop: insets.top + 8 }]}
              imageStyle={styles.headerImage}
            >
              <Pressable
                onPress={close}
                style={styles.headerButton}
                accessibilityRole="button"
                accessibilityLabel="Close automatic scan"
              >
                <Ionicons name="chevron-back" size={27} color={GOLD} />
              </Pressable>
              <View style={styles.headerCopy}>
                <Text style={styles.headerEyebrow}>CONTINUOUS AUTO SCAN</Text>
                <Text style={styles.headerTitle}>{scan?.featureId}</Text>
              </View>
              <View style={styles.headerButton} />
            </ImageBackground>

            <View style={styles.permissionCard}>
              <View style={styles.permissionIcon}>
                <Ionicons name="scan-outline" size={34} color={GOLD} />
              </View>
              <Text style={styles.permissionTitle}>Camera access required</Text>
              <Text style={styles.permissionText}>
                Allow camera access so NorthGroup One can collect frames automatically while you move around the feature.
              </Text>
              <Pressable
                onPress={requestPermission}
                style={styles.permissionButton}
              >
                <Text style={styles.permissionButtonText}>ALLOW CAMERA</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flash}
              onCameraReady={() => setCameraReady(true)}
            />

            <View style={styles.cameraShadeTop} pointerEvents="none" />
            <View style={styles.cameraShadeBottom} pointerEvents="none" />

            <View style={styles.reticle} pointerEvents="none">
              <View style={styles.reticleBox}>
                <View style={[styles.reticleCorner, styles.reticleTopLeft]} />
                <View style={[styles.reticleCorner, styles.reticleTopRight]} />
                <View style={[styles.reticleCorner, styles.reticleBottomLeft]} />
                <View style={[styles.reticleCorner, styles.reticleBottomRight]} />
              </View>
              <Text style={styles.reticleText}>
                {isCapturing ? 'KEEP FEATURE IN FRAME' : 'POSITION FEATURE IN FRAME'}
              </Text>
            </View>

            {framePulse ? <View style={styles.framePulse} pointerEvents="none" /> : null}

            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <Pressable
                onPress={close}
                style={styles.roundButton}
                accessibilityRole="button"
                accessibilityLabel="Close automatic scan"
              >
                <Ionicons name="chevron-back" size={28} color={WHITE} />
              </Pressable>

              <View style={styles.topCopy}>
                <Text style={styles.topEyebrow}>CONTINUOUS AUTO SCAN</Text>
                <Text style={styles.topTitle} numberOfLines={1}>
                  {scan?.featureId}
                </Text>
              </View>

              <Pressable
                onPress={() => setFlash((value) => value === 'off' ? 'on' : 'off')}
                style={[styles.roundButton, flash === 'on' && styles.roundButtonActive]}
                accessibilityRole="button"
                accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'}
              >
                <Ionicons
                  name={flash === 'on' ? 'flash' : 'flash-off'}
                  size={21}
                  color={flash === 'on' ? NAVY : WHITE}
                />
              </Pressable>
            </View>

            <View style={styles.captureStatusPill}>
              <View style={[styles.statusDot, isCapturing && !isPaused && styles.statusDotActive]} />
              <Text style={styles.captureStatusText}>
                {isCapturing ? (isPaused ? 'PAUSED' : 'AUTO CAPTURING') : 'READY'}
              </Text>
              <Text style={styles.frameCounter}>{frameCount} FRAMES</Text>
            </View>

            <View style={styles.guideCard}>
              <View style={styles.guideTopRow}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepText}>{guide.step}</Text>
                </View>
                <Text style={styles.counter}>
                  {frameCount}/{TARGET_FRAMES}
                </Text>
              </View>
              <Text style={styles.guideTitle}>{guide.title}</Text>
              <Text style={styles.guideText}>{guide.detail}</Text>
              {captureError ? (
                <Text style={styles.captureError}>{captureError}</Text>
              ) : null}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress}%` }]} />
              </View>
              <Text style={styles.progressHint}>
                {MINIMUM_FRAMES} minimum · {TARGET_FRAMES} recommended
              </Text>
            </View>

            <View style={[styles.bottomControls, { paddingBottom: insets.bottom + 14 }]}>
              <View style={styles.sideControl}>
                {lastFrame ? (
                  <Pressable
                    onPress={removeLast}
                    disabled={saving || isCapturing}
                    style={[styles.thumbnailButton, (saving || isCapturing) && styles.controlDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove last automatic frame"
                  >
                    <Image source={{ uri: lastFrame.uri }} style={styles.thumbnail} />
                    <View style={styles.undoBadge}>
                      <Ionicons name="arrow-undo" size={13} color={WHITE} />
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.sidePlaceholder}>
                    <Ionicons name="images-outline" size={22} color={WHITE} />
                  </View>
                )}
                <Text style={styles.sideLabel}>
                  {lastFrame ? 'LAST FRAME' : 'AUTO FRAMES'}
                </Text>
              </View>

              <View style={styles.captureControlGroup}>
                <Pressable
                  onPress={isCapturing ? pauseCapture : startCapture}
                  disabled={!cameraReady || saving}
                  style={({ pressed }) => [
                    styles.captureOuter,
                    pressed && styles.capturePressed,
                    (!cameraReady || saving) && styles.captureDisabled,
                    isPaused && styles.captureOuterPaused,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={isCapturing ? (isPaused ? 'Resume automatic capture' : 'Pause automatic capture') : 'Start automatic capture'}
                >
                  {saving ? (
                    <ActivityIndicator color={NAVY} />
                  ) : (
                    <Ionicons
                      name={isCapturing && !isPaused ? 'pause' : 'play'}
                      size={isCapturing && !isPaused ? 28 : 30}
                      color={NAVY}
                    />
                  )}
                </Pressable>
                <Text style={styles.captureControlLabel}>
                  {isCapturing ? (isPaused ? 'RESUME' : 'PAUSE') : 'START SCAN'}
                </Text>
              </View>

              <View style={styles.sideControl}>
                <Pressable
                  onPress={finish}
                  disabled={saving || frameCount === 0}
                  style={[
                    styles.finishButton,
                    frameCount < MINIMUM_FRAMES && styles.finishButtonPending,
                    (saving || frameCount === 0) && styles.controlDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Finish automatic feature scan"
                >
                  <Ionicons name="checkmark" size={24} color={NAVY} />
                </Pressable>
                <Text style={styles.sideLabel}>FINISH</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionPage: {
    flex: 1,
    backgroundColor: '#F2F5F7',
  },
  header: {
    minHeight: 112,
    paddingHorizontal: 16,
    paddingBottom: 15,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: NAVY,
    overflow: 'hidden',
  },
  headerImage: {
    opacity: 0.28,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: 3,
  },
  headerEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  permissionCard: {
    margin: 22,
    padding: 24,
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: WHITE,
  },
  permissionIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVY,
  },
  permissionTitle: {
    color: NAVY,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 16,
  },
  permissionText: {
    color: '#51606F',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 7,
  },
  permissionButton: {
    minHeight: 50,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    backgroundColor: GOLD,
    marginTop: 20,
  },
  permissionButtonText: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cameraWrap: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraShadeTop: {
    ...StyleSheet.absoluteFillObject,
    bottom: '57%',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  cameraShadeBottom: {
    ...StyleSheet.absoluteFillObject,
    top: '62%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  framePulse: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 4,
    borderColor: GOLD,
    opacity: 0.75,
  },
  reticle: {
    position: 'absolute',
    top: '36%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  reticleBox: {
    width: 178,
    height: 178,
    position: 'relative',
  },
  reticleCorner: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  reticleTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 14,
  },
  reticleTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 14,
  },
  reticleBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 14,
  },
  reticleBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 14,
  },
  reticleText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginTop: 11,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: 96,
    paddingHorizontal: 15,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6,26,45,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  roundButtonActive: {
    backgroundColor: GOLD,
    borderColor: GOLD,
  },
  topCopy: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  topEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  topTitle: {
    color: WHITE,
    fontSize: 17,
    fontWeight: '900',
    marginTop: 2,
  },
  captureStatusPill: {
    position: 'absolute',
    top: 104,
    left: 16,
    right: 16,
    minHeight: 36,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(6,26,45,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  statusDotActive: {
    backgroundColor: '#E84A4A',
  },
  captureStatusText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  frameCounter: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    marginLeft: 'auto',
  },
  guideCard: {
    position: 'absolute',
    top: 151,
    left: 16,
    right: 16,
    padding: 15,
    borderRadius: 16,
    backgroundColor: 'rgba(6,26,45,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.48)',
  },
  guideTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  stepText: {
    color: NAVY,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  counter: {
    color: GOLD,
    fontSize: 16,
    fontWeight: '900',
  },
  guideTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 11,
  },
  guideText: {
    color: '#D9E2EA',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  captureError: {
    color: '#FFC6BF',
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  progressHint: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 6,
  },
  bottomControls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 166,
    paddingHorizontal: 28,
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sideControl: {
    width: 82,
    alignItems: 'center',
  },
  thumbnailButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: WHITE,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 9,
  },
  undoBadge: {
    position: 'absolute',
    right: -7,
    bottom: -7,
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NAVY_2,
    borderWidth: 1,
    borderColor: WHITE,
  },
  sidePlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  sideLabel: {
    color: WHITE,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginTop: 8,
  },
  captureControlGroup: {
    alignItems: 'center',
  },
  captureOuter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: WHITE,
    backgroundColor: GOLD,
  },
  captureOuterPaused: {
    backgroundColor: '#F1C873',
  },
  capturePressed: {
    transform: [{ scale: 0.94 }],
  },
  captureDisabled: {
    opacity: 0.6,
  },
  captureControlLabel: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 8,
  },
  finishButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
  },
  finishButtonPending: {
    opacity: 0.62,
  },
  controlDisabled: {
    opacity: 0.45,
  },
});
