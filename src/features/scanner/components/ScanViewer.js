import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BLACK = '#07090C';
const PANEL = '#161A20';
const PANEL_LIGHT = '#252B33';
const WHITE = '#FFFFFF';
const MUTED = '#AEB7C2';
const GOLD = '#FFD400';
const BLUE = '#168CF0';
const MAX_SCALE = 4.5;
const MIN_SCALE = 0.72;

const clamp = (value, minimum, maximum) => (
  Math.min(maximum, Math.max(minimum, value))
);

const wrapIndex = (value, length) => {
  if (!length) return 0;
  return ((value % length) + length) % length;
};

const pointDistance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

const touchDistance = (touches) => {
  if (!touches || touches.length < 2) return 0;
  return Math.hypot(
    touches[1].pageX - touches[0].pageX,
    touches[1].pageY - touches[0].pageY,
  );
};

const touchAngle = (touches) => {
  if (!touches || touches.length < 2) return 0;
  return Math.atan2(
    touches[1].pageY - touches[0].pageY,
    touches[1].pageX - touches[0].pageX,
  );
};

const touchMidpoint = (touches) => {
  if (!touches || !touches.length) return { x: 0, y: 0 };
  if (touches.length === 1) {
    return { x: touches[0].pageX, y: touches[0].pageY };
  }
  return {
    x: (touches[0].pageX + touches[1].pageX) / 2,
    y: (touches[0].pageY + touches[1].pageY) / 2,
  };
};

const normaliseAngle = (angle) => {
  let next = angle;
  while (next > Math.PI) next -= Math.PI * 2;
  while (next < -Math.PI) next += Math.PI * 2;
  return next;
};

const formatMeasurement = (value) => {
  if (!Number.isFinite(value)) return '—';
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2);
};

const unitLabel = (unit) => ({
  mm: 'mm',
  cm: 'cm',
  m: 'm',
}[unit] || 'cm');

export default function ScanViewer({
  visible,
  scan,
  onClose,
  onShare,
  onProcess,
  onSaveMeasurement,
}) {
  const insets = useSafeAreaInsets();
  const photos = useMemo(
    () => (Array.isArray(scan?.photos) ? scan.photos.filter((photo) => photo?.uri) : []),
    [scan],
  );
  const frameCount = photos.length;
  const [frameIndex, setFrameIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [autoSpin, setAutoSpin] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [measurementPoints, setMeasurementPoints] = useState([]);
  const [calibration, setCalibration] = useState(null);
  const [referenceLength, setReferenceLength] = useState('');
  const [referenceUnit, setReferenceUnit] = useState('cm');
  const [infoMessage, setInfoMessage] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const frameIndexRef = useRef(0);
  const scaleRef = useRef(1);
  const rotationRef = useRef(0);
  const panRef = useRef({ x: 0, y: 0 });
  const gestureRef = useRef(null);

  const currentFrame = photos[frameIndex];
  const pixelDistance = measurementPoints.length === 2
    ? pointDistance(measurementPoints[0], measurementPoints[1])
    : 0;
  const hasMatchingCalibration = Boolean(
    calibration && calibration.frameIndex === frameIndex,
  );
  const measuredValue = hasMatchingCalibration && calibration.pixelsPerUnit
    ? pixelDistance / calibration.pixelsPerUnit
    : pixelDistance;
  const measuredUnit = hasMatchingCalibration ? calibration.unit : 'px';

  // Keep the frame ref separate from the state update so automatic spinning and
  // gesture events never wait for a React render before advancing the frame.
  const advanceFrame = useCallback((delta) => {
    if (!frameCount) return;
    const next = wrapIndex(frameIndexRef.current + delta, frameCount);
    frameIndexRef.current = next;
    setFrameIndex(next);
    setMeasurementPoints([]);
  }, [frameCount]);

  useEffect(() => {
    if (!visible) return undefined;
    frameIndexRef.current = 0;
    setFrameIndex(0);
    scaleRef.current = 1;
    setScale(1);
    rotationRef.current = 0;
    setRotation(0);
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    setAutoSpin(false);
    setShowMore(false);
    setMeasurementMode(false);
    setCalibrating(false);
    setMeasurementPoints([]);
    setCalibration(null);
    setReferenceLength('');
    setInfoMessage('');
    return undefined;
  }, [scan?.id, visible]);

  useEffect(() => {
    if (!visible || !autoSpin || measurementMode || frameCount < 2) {
      return undefined;
    }
    const timer = setInterval(() => advanceFrame(1), 220);
    return () => clearInterval(timer);
  }, [advanceFrame, autoSpin, frameCount, measurementMode, visible]);

  useEffect(() => {
    if (!infoMessage) return undefined;
    const timer = setTimeout(() => setInfoMessage(''), 3400);
    return () => clearTimeout(timer);
  }, [infoMessage]);

  const updateScale = useCallback((value) => {
    const next = clamp(value, MIN_SCALE, MAX_SCALE);
    scaleRef.current = next;
    setScale(next);
  }, []);

  const updatePan = useCallback((value) => {
    const next = {
      x: clamp(value.x, -260, 260),
      y: clamp(value.y, -260, 260),
    };
    panRef.current = next;
    setPan(next);
  }, []);

  const resetView = useCallback(() => {
    setAutoSpin(false);
    frameIndexRef.current = 0;
    setFrameIndex(0);
    updateScale(1);
    rotationRef.current = 0;
    setRotation(0);
    updatePan({ x: 0, y: 0 });
    setMeasurementPoints([]);
    setInfoMessage('View reset');
  }, [updatePan, updateScale]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !measurementMode,
    onMoveShouldSetPanResponder: () => !measurementMode,
    onPanResponderGrant: (event) => {
      const touches = event.nativeEvent.touches || [];
      const midpoint = touchMidpoint(touches);
      gestureRef.current = {
        initialFrame: frameIndexRef.current,
        initialScale: scaleRef.current,
        initialRotation: rotationRef.current,
        initialPan: { ...panRef.current },
        initialDistance: touchDistance(touches),
        initialAngle: touchAngle(touches),
        initialMidpoint: midpoint,
      };
    },
    onPanResponderMove: (event, gestureState) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const touches = event.nativeEvent.touches || [];

      if (touches.length >= 2 && gesture.initialDistance > 0) {
        const nextScale = gesture.initialScale * (
          touchDistance(touches) / gesture.initialDistance
        );
        updateScale(nextScale);

        const angleDelta = normaliseAngle(
          touchAngle(touches) - gesture.initialAngle,
        );
        const nextRotation = gesture.initialRotation + (angleDelta * 180) / Math.PI;
        rotationRef.current = nextRotation;
        setRotation(nextRotation);

        const midpoint = touchMidpoint(touches);
        updatePan({
          x: gesture.initialPan.x + midpoint.x - gesture.initialMidpoint.x,
          y: gesture.initialPan.y + midpoint.y - gesture.initialMidpoint.y,
        });
        return;
      }

      if (touches.length <= 1) {
        const horizontalTravel = Math.abs(gestureState.dx);
        if (horizontalTravel > 16 && frameCount > 1) {
          const frameDelta = Math.round(gestureState.dx / 26);
          const next = wrapIndex(gesture.initialFrame - frameDelta, frameCount);
          frameIndexRef.current = next;
          setFrameIndex(next);
          setMeasurementPoints([]);
        }

        if (Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 0.7) {
          updatePan({
            x: gesture.initialPan.x,
            y: gesture.initialPan.y + gestureState.dy,
          });
        }
      }
    },
    onPanResponderRelease: () => {
      gestureRef.current = null;
    },
    onPanResponderTerminate: () => {
      gestureRef.current = null;
    },
  }), [frameCount, measurementMode, updatePan, updateScale]);

  const handleCanvasTap = useCallback((event) => {
    const { locationX, locationY } = event.nativeEvent;
    const point = {
      x: clamp(locationX, 0, canvasSize.width),
      y: clamp(locationY, 0, canvasSize.height),
    };
    setMeasurementPoints((previous) => (
      previous.length >= 2 ? [point] : [...previous, point]
    ));
  }, [canvasSize]);

  const beginMeasurement = useCallback(() => {
    setShowMore(false);
    setAutoSpin(false);
    scaleRef.current = 1;
    setScale(1);
    rotationRef.current = 0;
    setRotation(0);
    panRef.current = { x: 0, y: 0 };
    setPan({ x: 0, y: 0 });
    setMeasurementMode(true);
    setCalibrating(false);
    setMeasurementPoints([]);
    setInfoMessage('Tap two points on the frame. Calibrate first for real-world units.');
  }, []);

  const finishMeasurement = useCallback(() => {
    setMeasurementMode(false);
    setCalibrating(false);
    setMeasurementPoints([]);
    setInfoMessage('Measurement mode closed');
  }, []);

  const applyCalibration = useCallback(() => {
    const reference = Number.parseFloat(referenceLength.replace(',', '.'));
    if (!Number.isFinite(reference) || reference <= 0) {
      Alert.alert('Reference length required', 'Enter a known distance greater than zero.');
      return;
    }
    if (measurementPoints.length !== 2 || pixelDistance <= 0) {
      Alert.alert('Select the reference points', 'Tap the two ends of a known length in the frame first.');
      return;
    }

    setCalibration({
      frameIndex,
      pixelsPerUnit: pixelDistance / reference,
      referenceLength: reference,
      unit: unitLabel(referenceUnit),
    });
    setMeasurementPoints([]);
    setCalibrating(false);
    setReferenceLength('');
    setInfoMessage(`Scale set: ${reference} ${unitLabel(referenceUnit)} reference`);
  }, [frameIndex, measurementPoints.length, pixelDistance, referenceLength, referenceUnit]);

  const saveMeasurement = useCallback(() => {
    if (measurementPoints.length !== 2 || pixelDistance <= 0) {
      Alert.alert('Select two points', 'Tap the two points you want to measure on the frame.');
      return;
    }

    const measurement = {
      id: `${scan?.id || 'scan'}-measurement-${Date.now()}`,
      frameIndex,
      frameName: currentFrame?.fileName || '',
      distancePx: Number(pixelDistance.toFixed(2)),
      value: hasMatchingCalibration ? Number(measuredValue.toFixed(3)) : null,
      unit: hasMatchingCalibration ? measuredUnit : 'px',
      calibrated: hasMatchingCalibration,
      createdAt: new Date().toISOString(),
    };

    onSaveMeasurement?.(measurement);
    setInfoMessage(
      hasMatchingCalibration
        ? `Measurement saved: ${formatMeasurement(measuredValue)} ${measuredUnit}`
        : 'Relative pixel measurement saved — set a scale for field units.',
    );
    setMeasurementPoints([]);
  }, [
    currentFrame,
    frameIndex,
    hasMatchingCalibration,
    measuredUnit,
    measuredValue,
    onSaveMeasurement,
    pixelDistance,
    scan?.id,
  ]);

  const processNotice = useCallback(() => {
    setShowMore(false);
    if (onProcess) {
      Alert.alert(
        'Process this scan?',
        'NorthGroup One will upload the captured frames to the processing queue and create a textured 3D model when the processing computer is available.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Process 3D', onPress: onProcess },
        ],
      );
      return;
    }
    Alert.alert(
      '3D model processing',
      'This standard scan stores reconstruction-ready frames. A true 3D mesh still needs a photogrammetry processor; the interactive viewer currently lets you inspect the captured viewpoints and make calibrated frame measurements.',
    );
  }, [onProcess]);

  if (!visible) return null;

  const lineAngle = measurementPoints.length === 2
    ? Math.atan2(
      measurementPoints[1].y - measurementPoints[0].y,
      measurementPoints[1].x - measurementPoints[0].x,
    )
    : 0;
  const lineLength = measurementPoints.length === 2
    ? pointDistance(measurementPoints[0], measurementPoints[1])
    : 0;
  const lineMidpoint = measurementPoints.length === 2
    ? {
      x: (measurementPoints[0].x + measurementPoints[1].x) / 2,
      y: (measurementPoints[0].y + measurementPoints[1].y) / 2,
    }
    : null;

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.page}>
        <StatusBar barStyle="light-content" backgroundColor={BLACK} />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={onClose}
            style={styles.headerButton}
            accessibilityRole="button"
            accessibilityLabel="Close scan viewer"
          >
            <Ionicons name="chevron-back" size={29} color={WHITE} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>SCAN VIEWER</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{scan?.featureId || 'Feature scan'}</Text>
          </View>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close scan viewer"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </Pressable>
        </View>

        <View
          style={styles.canvas}
          onLayout={(event) => setCanvasSize(event.nativeEvent.layout)}
          {...panResponder.panHandlers}
        >
          {currentFrame ? (
            <Image
              key={currentFrame.uri}
              source={{ uri: currentFrame.uri }}
              style={[
                styles.frameImage,
                {
                  transform: [
                    { translateX: pan.x },
                    { translateY: pan.y },
                    { scale },
                    { rotate: `${rotation}deg` },
                  ],
                },
              ]}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.emptyCanvas}>
              <Ionicons name="images-outline" size={42} color={MUTED} />
              <Text style={styles.emptyCanvasText}>No captured frames</Text>
            </View>
          )}

          <View style={styles.viewerMeta} pointerEvents="none">
            <Text style={styles.vertexText}>
              {frameCount ? `${frameIndex + 1} / ${frameCount} VIEWPOINTS` : 'NO VIEWPOINTS'}
            </Text>
            <Text style={styles.viewerHint}>
              {measurementMode
                ? calibrating
                  ? 'Tap the two ends of a known length'
                  : 'Tap two points to measure'
                : frameCount > 1
                  ? 'Drag to spin · pinch to zoom · two fingers to rotate'
                  : 'Pinch to zoom · drag to inspect'}
            </Text>
          </View>

          {!measurementMode ? (
            <View style={styles.zoomControls}>
              <Pressable
                onPress={() => updateScale(scaleRef.current + 0.25)}
                style={styles.zoomButton}
                accessibilityRole="button"
                accessibilityLabel="Zoom in"
              >
                <Ionicons name="add" size={22} color={WHITE} />
              </Pressable>
              <Pressable
                onPress={() => updateScale(scaleRef.current - 0.25)}
                style={styles.zoomButton}
                accessibilityRole="button"
                accessibilityLabel="Zoom out"
              >
                <Ionicons name="remove" size={22} color={WHITE} />
              </Pressable>
            </View>
          ) : null}

          {measurementMode ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleCanvasTap}
              accessibilityRole="button"
              accessibilityLabel="Select measurement point"
            >
              {measurementPoints.map((point, index) => (
                <View
                  key={`${point.x}-${point.y}-${index}`}
                  style={[styles.measurePoint, { left: point.x - 11, top: point.y - 11 }]}
                >
                  <Text style={styles.measurePointText}>{index === 0 ? 'A' : 'B'}</Text>
                </View>
              ))}
              {lineMidpoint ? (
                <View
                  pointerEvents="none"
                  style={[
                    styles.measureLine,
                    {
                      left: lineMidpoint.x - lineLength / 2,
                      top: lineMidpoint.y - 1,
                      width: lineLength,
                      transform: [{ rotate: `${lineAngle}rad` }],
                    },
                  ]}
                />
              ) : null}
              {lineMidpoint && pixelDistance > 0 ? (
                <View
                  pointerEvents="none"
                  style={[styles.measureLabel, { left: lineMidpoint.x - 54, top: lineMidpoint.y - 36 }]}
                >
                  <Text style={styles.measureLabelText}>
                    {formatMeasurement(measuredValue)} {measuredUnit}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>

        {infoMessage ? (
          <View style={styles.infoToast} pointerEvents="none">
            <Ionicons name="information-circle-outline" size={17} color={WHITE} />
            <Text style={styles.infoToastText}>{infoMessage}</Text>
          </View>
        ) : null}

        {measurementMode ? (
          <View style={[styles.measurePanel, { paddingBottom: insets.bottom + 14 }]}>
            <View style={styles.measurePanelHeader}>
              <View>
                <Text style={styles.measureEyebrow}>FIELD MEASUREMENT</Text>
                <Text style={styles.measureTitle}>
                  {calibrating ? 'Set a reference scale' : 'Measure between two points'}
                </Text>
              </View>
              <Pressable onPress={finishMeasurement} style={styles.panelCloseButton}>
                <Ionicons name="close" size={22} color={WHITE} />
              </Pressable>
            </View>

            {calibrating ? (
              <View style={styles.calibrationRow}>
                <TextInput
                  value={referenceLength}
                  onChangeText={setReferenceLength}
                  placeholder="Known length"
                  placeholderTextColor="#7E8995"
                  keyboardType="decimal-pad"
                  style={styles.referenceInput}
                  accessibilityLabel="Known reference length"
                />
                <View style={styles.unitChoices}>
                  {['mm', 'cm', 'm'].map((unit) => (
                    <Pressable
                      key={unit}
                      onPress={() => setReferenceUnit(unit)}
                      style={[styles.unitButton, referenceUnit === unit && styles.unitButtonActive]}
                    >
                      <Text style={[styles.unitButtonText, referenceUnit === unit && styles.unitButtonTextActive]}>
                        {unit}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable onPress={applyCalibration} style={styles.applyButton}>
                  <Text style={styles.applyButtonText}>SET</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.measureActionRow}>
                <Text style={styles.measureStatus}>
                  {measurementPoints.length < 2
                    ? 'Select point A and point B'
                    : hasMatchingCalibration
                      ? `${formatMeasurement(measuredValue)} ${measuredUnit}`
                      : `${formatMeasurement(pixelDistance)} px · no scale`}
                </Text>
                <Pressable
                  onPress={() => {
                    setCalibrating(true);
                    setMeasurementPoints([]);
                    setInfoMessage('Select two points on a known reference length.');
                  }}
                  style={styles.secondaryMeasureButton}
                >
                  <Ionicons name="resize-outline" size={17} color={GOLD} />
                  <Text style={styles.secondaryMeasureText}>CALIBRATE</Text>
                </Pressable>
                <Pressable
                  onPress={saveMeasurement}
                  style={[styles.saveMeasureButton, measurementPoints.length !== 2 && styles.disabledButton]}
                  disabled={measurementPoints.length !== 2}
                >
                  <Text style={styles.saveMeasureText}>SAVE</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.measureFootnote}>
              {hasMatchingCalibration
                ? `Calibrated on viewpoint ${frameIndex + 1}; use this frame for the saved distance.`
                : 'For real-world units, calibrate against a known reference visible in this frame.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable onPress={() => setShowMore((value) => !value)} style={styles.bottomButton}>
              <Ionicons name="ellipsis-horizontal" size={19} color={WHITE} />
              <Text style={styles.bottomButtonText}>More</Text>
            </Pressable>
            <Pressable onPress={processNotice} style={styles.bottomButton}>
              <Ionicons name="layers-outline" size={18} color={WHITE} />
              <Text style={styles.bottomButtonText}>Process</Text>
            </Pressable>
            <Pressable onPress={beginMeasurement} style={[styles.bottomButton, styles.measureButton]}>
              <Ionicons name="resize-outline" size={19} color="#101010" />
              <Text style={styles.measureButtonText}>Measure</Text>
            </Pressable>
            <Pressable onPress={onShare} style={[styles.bottomButton, styles.shareButton]}>
              <Ionicons name="share-outline" size={19} color={WHITE} />
              <Text style={styles.bottomButtonText}>Share</Text>
            </Pressable>
          </View>
        )}

        {showMore && !measurementMode ? (
          <View style={[styles.moreSheet, { paddingBottom: insets.bottom + 18 }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Viewer controls</Text>
            <View style={styles.sheetActions}>
              <Pressable onPress={resetView} style={styles.sheetAction}>
                <Ionicons name="refresh" size={20} color={WHITE} />
                <Text style={styles.sheetActionText}>Reset view</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setAutoSpin((value) => !value);
                  setShowMore(false);
                }}
                style={styles.sheetAction}
              >
                <Ionicons name="sync-outline" size={20} color={WHITE} />
                <Text style={styles.sheetActionText}>{autoSpin ? 'Stop spin' : 'Auto-spin'}</Text>
              </Pressable>
              <Pressable onPress={() => setShowMore(false)} style={styles.sheetAction}>
                <Ionicons name="images-outline" size={20} color={WHITE} />
                <Text style={styles.sheetActionText}>Frame set</Text>
              </Pressable>
            </View>
            <Text style={styles.sheetFootnote}>
              Drag horizontally to move through the automatically captured viewpoints. Two fingers zoom, rotate and pan the selected frame.
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: BLACK,
  },
  header: {
    minHeight: 96,
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 23, 28, 0.98)',
  },
  headerButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#22262D',
  },
  headerCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  headerTitle: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    minWidth: 76,
    height: 44,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#22262D',
  },
  closeButtonText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
  },
  canvas: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#282B2F',
  },
  frameImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  emptyCanvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCanvasText: {
    color: MUTED,
    fontSize: 14,
    marginTop: 10,
  },
  viewerMeta: {
    position: 'absolute',
    top: 18,
    left: 18,
    right: 18,
    alignItems: 'center',
  },
  vertexText: {
    color: '#D4D8DC',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  viewerHint: {
    color: '#AEB5BD',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 6,
    textAlign: 'center',
  },
  zoomControls: {
    position: 'absolute',
    top: 82,
    right: 16,
    gap: 8,
  },
  zoomButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(17, 20, 24, 0.88)',
  },
  measurePoint: {
    position: 'absolute',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#111111',
    backgroundColor: GOLD,
  },
  measurePointText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '900',
  },
  measureLine: {
    position: 'absolute',
    height: 3,
    backgroundColor: GOLD,
  },
  measureLabel: {
    position: 'absolute',
    minWidth: 108,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: 'center',
    borderRadius: 7,
    backgroundColor: '#111111',
  },
  measureLabelText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
  },
  infoToast: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 128,
    minHeight: 38,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(21, 25, 30, 0.94)',
  },
  infoToastText: {
    flex: 1,
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 7,
  },
  bottomBar: {
    minHeight: 88,
    paddingHorizontal: 13,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(20, 23, 28, 0.98)',
  },
  bottomButton: {
    flex: 1,
    minHeight: 54,
    paddingHorizontal: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 28,
    backgroundColor: '#111316',
  },
  bottomButtonText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '900',
  },
  measureButton: {
    backgroundColor: GOLD,
  },
  measureButtonText: {
    color: '#111111',
    fontSize: 13,
    fontWeight: '900',
  },
  shareButton: {
    backgroundColor: BLUE,
  },
  measurePanel: {
    minHeight: 164,
    paddingHorizontal: 15,
    paddingTop: 12,
    backgroundColor: PANEL,
  },
  measurePanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  measureEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  measureTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 3,
  },
  panelCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: PANEL_LIGHT,
  },
  measureActionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  measureStatus: {
    flex: 1,
    color: WHITE,
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryMeasureButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#5C4E14',
    borderRadius: 9,
    backgroundColor: '#25261F',
  },
  secondaryMeasureText: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
  },
  saveMeasureButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: GOLD,
  },
  saveMeasureText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '900',
  },
  disabledButton: {
    opacity: 0.42,
  },
  measureFootnote: {
    color: MUTED,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 4,
  },
  calibrationRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 7,
  },
  referenceInput: {
    flex: 1,
    minHeight: 40,
    paddingHorizontal: 10,
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: '#49515A',
    borderRadius: 9,
    backgroundColor: '#0E1115',
  },
  unitChoices: {
    flexDirection: 'row',
    gap: 4,
  },
  unitButton: {
    width: 34,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: PANEL_LIGHT,
  },
  unitButtonActive: {
    backgroundColor: GOLD,
  },
  unitButtonText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '900',
  },
  unitButtonTextActive: {
    color: '#111111',
  },
  applyButton: {
    minWidth: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: GOLD,
  },
  applyButtonText: {
    color: '#111111',
    fontSize: 10,
    fontWeight: '900',
  },
  moreSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    backgroundColor: '#1B2026',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64707C',
  },
  sheetTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  sheetAction: {
    flex: 1,
    minHeight: 66,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: PANEL_LIGHT,
  },
  sheetActionText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
  },
  sheetFootnote: {
    color: MUTED,
    fontSize: 10,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 12,
  },
});
