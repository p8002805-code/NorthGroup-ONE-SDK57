import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
} from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NorthGroupBrandButton from '../../../components/NorthGroupBrandButton';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  createKmlLine,
  createKmlPin,
  createKmlPolygon,
  kmlFeaturesEqual,
} from '../kmlDocument';
import {
  distanceMetres,
  formatArea,
  formatCoordinateDetails,
  formatDistance,
  pathDistanceMetres,
  polygonAreaSquareMetres,
} from '../kmlGeometry';
import {
  measurementSnapRadiusMetres,
  snapKmlMeasurementCoordinate,
} from '../kmlMeasurement';
import {
  KML_POST_DRAG_GESTURE_GUARD_MS,
  shouldSuppressKmlMapGesture,
} from '../kmlMarkerPosition';
import {
  applyKmlDisplayCalibration,
  clearKmlDisplayCalibration,
  createKmlDisplayCalibration,
  emptyKmlDisplayCalibration,
  formatKmlCalibrationOffset,
  kmlCalibrationDifferenceMetres,
  kmlCalibrationOffsetMetres,
  loadKmlDisplayCalibration,
  removeKmlDisplayCalibration,
  saveKmlDisplayCalibration,
} from '../kmlDisplayCalibration';
import { buildKmlPinMapLinks } from '../kmlDirections';
import { loadSharedKml, saveSharedKml } from '../kmlService';
import { loadKmlUserViewSettings } from '../kmlUserViewSettings';
import useKmlUserViewSettings from '../hooks/useKmlUserViewSettings';
import {
  DEFAULT_KML_REGION as DEFAULT_REGION,
  KML_EDIT_UNLOCK_SPAN_METRES,
  activeKmlFeatures as activeFeatures,
  kmlDocumentCoordinates as documentCoordinates,
  kmlEditingIsUnlocked,
  kmlClosedPolygonBoundary,
  kmlFeatureBelongsToLayer as featureBelongsToLayer,
  kmlLayerIsHidden as layerIsHidden,
  kmlMarkerScaleForLongitudeDelta as markerScaleForLongitudeDelta,
  kmlRegionFor as regionFor,
  kmlRegionSpanMetres,
  preferredKmlLayer as preferredLayer,
} from '../kmlMapState';
import {
  loadSharedJobProgress,
} from '../../jobs/jobProgressService';
import {
  progressHiddenFeatureIds,
  progressHiddenLayerIds,
} from '../progressKmlVisibility';
import {
  CoordinateSheet,
  FeatureBrowserSheet,
  GeometryEditorSheet,
  LayerStyleSheet,
  LayersSheet,
  PinEditorSheet,
} from '../components/KmlEditorSheets';
import KmlPinMarker from '../components/KmlPinMarker';
import { EditZoomLockBadge, SurveyToolDock } from '../components/KmlSurveyToolDock';

const withOpacity = (colour, opacity = 1) => {
  const value = String(colour || '#D6A84F').replace('#', '');
  const alpha = Math.max(0, Math.min(255, Math.round(Number(opacity) * 255))).toString(16).padStart(2, '0');
  return `#${value}${alpha}`;
};

const applyPinLayerStyle = (feature, style) => ({
  ...feature,
  style: {
    ...(feature.style || {}),
    icon: style?.icon,
    iconHref: style?.iconHref || '',
    color: style?.color,
    scale: style?.scale,
  },
  styleEdited: true,
});

const formatUpdated = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return 'Update time unavailable';
  return `Updated ${date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`;
};

function EditorHeader({ fileName, dirty, saving, onBack, onSave }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ImageBackground
      source={require('../../../../assets/topo-bg.png')}
      resizeMode="cover"
      style={styles.header}
      imageStyle={styles.headerImage}
    >
      <View style={[styles.headerShade, { paddingTop: insets.top + SPACING.xs }]}>
        <View style={styles.headerRow}>
          <NorthGroupBrandButton
            onPress={onBack}
            accessibilityLabel="NorthGroup One, return to job workspace"
            accessibilityHint="Returns to the active job workspace"
          />
          <View style={styles.headerCopy}>
            <Text style={styles.headerEyebrow}>KML · SURVEY</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{fileName || 'Shared map'}</Text>
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.saveButton,
              (!dirty || saving) && styles.saveButtonDisabled,
              pressed && dirty && !saving && styles.pressed,
            ]}
            onPress={onSave}
            disabled={!dirty || saving}
            accessibilityRole="button"
            accessibilityLabel="Save shared KML and close"
          >
            {saving ? <ActivityIndicator size="small" color={colors.navy} /> : <Text style={styles.saveButtonText}>SAVE</Text>}
          </Pressable>
        </View>
      </View>
    </ImageBackground>
  );
}

function MapControl({ icon, label, onPress, active = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      style={({ pressed }) => [styles.mapControl, active && styles.mapControlActive, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={21} color={active ? colors.navy : colors.bodyText} />
    </Pressable>
  );
}

function MapControls({ onLayers, onLocation, onNorth, onFit }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.mapControls}>
      <MapControl icon="layers-outline" label="Map layers" onPress={onLayers} />
      <View style={styles.controlDivider} />
      <MapControl icon="locate-outline" label="Go to my location" onPress={onLocation} />
      <View style={styles.controlDivider} />
      <MapControl icon="compass-outline" label="Reset map north" onPress={onNorth} />
      <View style={styles.controlDivider} />
      <MapControl icon="scan-outline" label="Fit visible KML features" onPress={onFit} />
    </View>
  );
}

function DrawingHud({ tool, coordinates, editingUnlocked = true, onUndo, onCancel, onComplete }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isMeasure = tool === 'measure';
  const isPolygon = tool === 'polygon';
  const minimum = isPolygon ? 3 : 2;
  const metric = isPolygon
    ? formatArea(polygonAreaSquareMetres(coordinates))
    : formatDistance(pathDistanceMetres(coordinates));
  const title = tool === 'pin'
    ? 'Tap the map to place a pin'
    : isMeasure
      ? `Measure · ${metric}`
      : isPolygon
        ? `Draw area · ${metric}`
        : `Draw line · ${metric}`;
  const detail = !editingUnlocked && !isMeasure
    ? 'Editing paused · Double-tap to zoom to 500 m or closer.'
    : tool === 'pin'
      ? 'Choose the exact position; name and notes come next.'
      : isMeasure
        ? `${coordinates.length} ${coordinates.length === 1 ? 'point' : 'points'} · Tap map, pin, line or area. Features locked.`
        : `${coordinates.length} ${coordinates.length === 1 ? 'vertex' : 'vertices'} · Tap the map to add more.`;

  return (
    <View style={styles.drawingHud}>
      <View style={styles.drawingCopy}>
        <Text style={styles.drawingTitle}>{title}</Text>
        <Text style={styles.drawingDetail}>{detail}</Text>
      </View>
      {tool !== 'pin' ? (
        <Pressable style={styles.hudIconButton} onPress={onUndo} disabled={!coordinates.length} accessibilityLabel="Undo last vertex">
          <Ionicons name="arrow-undo" size={20} color={coordinates.length ? colors.bodyText : colors.placeholderText} />
        </Pressable>
      ) : null}
      <Pressable style={styles.hudIconButton} onPress={onCancel} accessibilityLabel="Cancel tool">
        <Ionicons name="close" size={21} color={colors.bodyText} />
      </Pressable>
      {!isMeasure && tool !== 'pin' ? (
        <Pressable
          style={[styles.hudDoneButton, (coordinates.length < minimum || !editingUnlocked) && styles.hudDoneDisabled]}
          onPress={onComplete}
          disabled={coordinates.length < minimum || !editingUnlocked}
        >
          <Text style={styles.hudDoneText}>DONE</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function VertexEditHud({ feature, editingUnlocked, onCancel, onComplete }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isPolygon = feature?.type === 'polygon';
  const metric = isPolygon
    ? formatArea(polygonAreaSquareMetres(feature?.coordinates || []))
    : formatDistance(pathDistanceMetres(feature?.coordinates || []));
  return (
    <View style={styles.drawingHud}>
      <View style={styles.drawingCopy}>
        <Text style={styles.drawingTitle}>{isPolygon ? 'Edit area vertices' : 'Edit line vertices'} · {metric}</Text>
        <Text style={styles.drawingDetail}>
          {editingUnlocked ? 'Drag a numbered point to update the shape.' : 'Editing locked · Double-tap to zoom to 500 m or closer.'}
        </Text>
      </View>
      <Pressable style={styles.hudIconButton} onPress={onCancel} accessibilityLabel="Cancel vertex changes">
        <Ionicons name="close" size={21} color={colors.bodyText} />
      </Pressable>
      <Pressable style={styles.hudDoneButton} onPress={onComplete} accessibilityLabel="Finish editing vertices">
        <Text style={styles.hudDoneText}>DONE</Text>
      </Pressable>
    </View>
  );
}

function CalibrationHud({ pin, verifying, onCancel }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.drawingHud}>
      <View style={styles.drawingCopy}>
        <Text style={styles.drawingTitle}>{verifying ? 'Check' : 'Align'} {pin?.name || 'control pin'} in Apple imagery</Text>
        <Text style={styles.drawingDetail}>Tap the same physical object visible in the imagery. The KML coordinate will not be changed.</Text>
      </View>
      <Pressable style={styles.hudIconButton} onPress={onCancel} accessibilityLabel="Cancel Apple imagery calibration">
        <Ionicons name="close" size={21} color={colors.bodyText} />
      </Pressable>
    </View>
  );
}

function CalibrationBadge({ calibration, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={styles.calibrationBadge} onPress={onPress} accessibilityLabel="Open active Apple imagery calibration">
      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
      <View style={styles.calibrationBadgeCopy}>
        <Text style={styles.calibrationBadgeTitle}>APPLE CALIBRATED · DISPLAY ONLY</Text>
        <Text style={styles.calibrationBadgeValue}>{formatKmlCalibrationOffset(calibration)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={15} color={colors.supportingText} />
    </Pressable>
  );
}

function CoordinateCard({ coordinate, onPress, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!coordinate) return null;
  const details = formatCoordinateDetails(coordinate);
  return (
    <Pressable style={styles.coordinateCard} onPress={onPress}>
      <View style={styles.coordinateCardIcon}><Ionicons name="location-outline" size={18} color={colors.accentDark} /></View>
      <View style={styles.coordinateCardCopy}>
        <Text style={styles.coordinateCardLabel}>MAP COORDINATE</Text>
        <Text style={styles.coordinateCardValue}>{details.decimal}</Text>
      </View>
      <Ionicons name="chevron-up" size={18} color={colors.supportingText} />
      <Pressable
        style={styles.coordinateClose}
        onPress={(event) => { event.stopPropagation?.(); onClose(); }}
        hitSlop={8}
      >
        <Ionicons name="close" size={18} color={colors.supportingText} />
      </Pressable>
    </Pressable>
  );
}


export default function KmlEditorScreen({ job, getAccessToken, goBack }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mapRef = useRef(null);
  const draggingPinIdRef = useRef(null);
  const suppressMapGestureUntilRef = useRef(0);
  const pendingMapLongPressRef = useRef(null);
  const measureTouchRef = useRef(null);
  const measureSessionRef = useRef(0);
  const measureFeaturePressRef = useRef(0);
  const mapLayoutRef = useRef({ width: 1, height: 1 });
  const [document, setDocument] = useState(null);
  const [pins, setPins] = useState([]);
  const [lines, setLines] = useState([]);
  const [polygons, setPolygons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pinDraft, setPinDraft] = useState(null);
  const [draggingPinId, setDraggingPinId] = useState(null);
  const [movedPinIds, setMovedPinIds] = useState({});
  const [locallyEditedFeatureIds, setLocallyEditedFeatureIds] = useState({});
  const [geometryDraft, setGeometryDraft] = useState(null);
  const [geometryVertexDraft, setGeometryVertexDraft] = useState(null);
  const [geometryVertexOriginal, setGeometryVertexOriginal] = useState(null);
  const [activeTool, setActiveTool] = useState(null);
  const [draftCoordinates, setDraftCoordinates] = useState([]);
  const [mapType, setMapType] = useState('hybrid');
  const [mapProvider, setMapProvider] = useState(Platform.OS === 'android' ? 'google' : 'apple');
  const [appleCalibration, setAppleCalibration] = useState(emptyKmlDisplayCalibration);
  const [calibrationReference, setCalibrationReference] = useState(null);
  const [choosingCalibrationPin, setChoosingCalibrationPin] = useState(false);
  const [lastMapRegion, setLastMapRegion] = useState(null);
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  const [progressTasks, setProgressTasks] = useState([]);
  const googleMapsConfigured = Boolean(Constants.expoConfig?.extra?.maps?.googleMapsIosEnabled);
  const googleProviderAvailable = Platform.OS === 'android'
    || (googleMapsConfigured && Constants.executionEnvironment !== 'storeClient');
  const [mapLongitudeDelta, setMapLongitudeDelta] = useState(DEFAULT_REGION.longitudeDelta);
  const [openSheet, setOpenSheet] = useState('');
  const [selectedCoordinate, setSelectedCoordinate] = useState(null);
  const [layerStyleDraft, setLayerStyleDraft] = useState(null);
  const [selectedLayer, setSelectedLayer] = useState(null);

  const currentFeatures = useMemo(() => ({ pins, lines, polygons }), [lines, pins, polygons]);
  const documentFeatures = useMemo(() => ({
    pins: document?.pins || [],
    lines: document?.overlays?.lines || [],
    polygons: document?.overlays?.polygons || [],
  }), [document]);
  const allFeatures = useMemo(() => [
    ...activeFeatures(pins).map((feature) => ({ ...feature, type: 'pin' })),
    ...activeFeatures(lines).map((feature) => ({ ...feature, type: 'line' })),
    ...activeFeatures(polygons).map((feature) => ({ ...feature, type: 'polygon' })),
  ], [lines, pins, polygons]);
  const layers = useMemo(() => {
    const sourceLayers = document?.layers || [];
    return sourceLayers.map((layer) => {
      const direct = allFeatures.filter((feature) => feature.folderId === layer.id);
      const contained = allFeatures.filter((feature) => featureBelongsToLayer(feature, layer.id, sourceLayers));
      const children = sourceLayers.filter((candidate) => candidate.parentId === layer.id);
      return {
        ...layer,
        directFeatureCount: direct.length,
        directPinCount: direct.filter((feature) => feature.type === 'pin').length,
        directLineCount: direct.filter((feature) => feature.type === 'line').length,
        directPolygonCount: direct.filter((feature) => feature.type === 'polygon').length,
        featureCount: contained.length,
        pinCount: contained.filter((feature) => feature.type === 'pin').length,
        lineCount: contained.filter((feature) => feature.type === 'line').length,
        polygonCount: contained.filter((feature) => feature.type === 'polygon').length,
        childCount: children.length,
        style: direct[0]?.style || contained[0]?.style || layer.style,
        mixedStyle: new Set(contained.map((feature) => JSON.stringify(feature.style))).size > 1,
      };
    });
  }, [allFeatures, document]);
  const {
    layerVisibility,
    hiddenLayers,
    hiddenFeatures,
    hydrate: hydrateUserView,
    updateLayerVisibility: updatePersonalLayerVisibility,
    setLayerHidden: setPersonalLayerHidden,
    setFeatureHidden: setPersonalFeatureHidden,
    isLayerHidden: isPersonalLayerHidden,
    isFeatureHidden: isPersonalFeatureHidden,
  } = useKmlUserViewSettings({ job, layers, features: allFeatures });

  const progressHiddenLayers = useMemo(
    () => progressHiddenLayerIds(progressTasks, layers),
    [layers, progressTasks],
  );
  const progressHiddenFeatures = useMemo(
    () => progressHiddenFeatureIds(progressTasks, allFeatures),
    [allFeatures, progressTasks],
  );
  const effectiveHiddenLayers = useMemo(
    () => ({ ...hiddenLayers, ...progressHiddenLayers }),
    [hiddenLayers, progressHiddenLayers],
  );
  const effectiveHiddenFeatures = useMemo(
    () => ({ ...hiddenFeatures, ...progressHiddenFeatures }),
    [hiddenFeatures, progressHiddenFeatures],
  );
  const dirty = Boolean(document) && !kmlFeaturesEqual(currentFeatures, documentFeatures);
  const visiblePins = useMemo(() => activeFeatures(pins).filter((pin) => {
    const manuallyHidden = hiddenFeatures[pin.id] || layerIsHidden(pin, layers, hiddenLayers);
    const progressHidden = progressHiddenFeatures[pin.id] || layerIsHidden(pin, layers, progressHiddenLayers);
    const locallyActive = locallyEditedFeatureIds[pin.id]
      || draggingPinId === pin.id
      || pinDraft?.id === pin.id;
    return !manuallyHidden && (!progressHidden || locallyActive);
  }), [draggingPinId, hiddenFeatures, hiddenLayers, layers, locallyEditedFeatureIds, pinDraft?.id, pins, progressHiddenFeatures, progressHiddenLayers]);
  const visibleLines = useMemo(() => activeFeatures(lines).filter((line) => {
    const manuallyHidden = hiddenFeatures[line.id] || layerIsHidden(line, layers, hiddenLayers);
    const progressHidden = progressHiddenFeatures[line.id] || layerIsHidden(line, layers, progressHiddenLayers);
    const locallyActive = locallyEditedFeatureIds[line.id]
      || geometryDraft?.id === line.id
      || geometryVertexDraft?.id === line.id;
    return !manuallyHidden && (!progressHidden || locallyActive);
  }), [geometryDraft?.id, geometryVertexDraft?.id, hiddenFeatures, hiddenLayers, layers, lines, locallyEditedFeatureIds, progressHiddenFeatures, progressHiddenLayers]);
  const visiblePolygons = useMemo(() => activeFeatures(polygons).filter((polygon) => {
    const manuallyHidden = hiddenFeatures[polygon.id] || layerIsHidden(polygon, layers, hiddenLayers);
    const progressHidden = progressHiddenFeatures[polygon.id] || layerIsHidden(polygon, layers, progressHiddenLayers);
    const locallyActive = locallyEditedFeatureIds[polygon.id]
      || geometryDraft?.id === polygon.id
      || geometryVertexDraft?.id === polygon.id;
    return !manuallyHidden && (!progressHidden || locallyActive);
  }), [geometryDraft?.id, geometryVertexDraft?.id, hiddenFeatures, hiddenLayers, layers, locallyEditedFeatureIds, polygons, progressHiddenFeatures, progressHiddenLayers]);
  const effectiveDisplayCalibration = mapProvider === 'apple' && appleCalibration.enabled
    ? appleCalibration
    : null;
  const calibrationActive = Boolean(effectiveDisplayCalibration?.exists);
  const toDisplayCoordinate = useCallback(
    (coordinate) => applyKmlDisplayCalibration(coordinate, effectiveDisplayCalibration),
    [effectiveDisplayCalibration],
  );
  const fromDisplayCoordinate = useCallback(
    (coordinate) => removeKmlDisplayCalibration(coordinate, effectiveDisplayCalibration),
    [effectiveDisplayCalibration],
  );
  const toDisplayCoordinates = useCallback(
    (coordinates) => (coordinates || []).map(toDisplayCoordinate),
    [toDisplayCoordinate],
  );
  const initialRegion = useMemo(() => regionFor(
    pins.map((pin) => ({ ...pin, ...toDisplayCoordinate(pin) })),
    lines.map((line) => ({ ...line, coordinates: toDisplayCoordinates(line.coordinates) })),
    polygons.map((polygon) => ({ ...polygon, coordinates: toDisplayCoordinates(polygon.coordinates) })),
    job,
  ), [job, lines, pins, polygons, toDisplayCoordinate, toDisplayCoordinates]);
  const currentMapRegion = lastMapRegion || initialRegion;
  const editingViewportSpanMetres = useMemo(
    () => kmlRegionSpanMetres(currentMapRegion),
    [currentMapRegion],
  );
  const editingUnlocked = useMemo(
    () => kmlEditingIsUnlocked(currentMapRegion, KML_EDIT_UNLOCK_SPAN_METRES),
    [currentMapRegion],
  );
  const mapMarkerScale = useMemo(
    () => markerScaleForLongitudeDelta(mapLongitudeDelta),
    [mapLongitudeDelta],
  );

  const fitCoordinates = useCallback((coordinates, animated = true) => {
    if (!coordinates?.length) return;
    requestAnimationFrame(() => {
      if (coordinates.length === 1) {
        mapRef.current?.animateToRegion({
          ...coordinates[0],
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, animated ? 450 : 0);
        return;
      }
      mapRef.current?.fitToCoordinates(coordinates, {
        edgePadding: { top: 120, right: 70, bottom: 190, left: 70 },
        animated,
      });
    });
  }, []);

  const fitVisibleDocument = useCallback(() => {
    fitCoordinates(toDisplayCoordinates(documentCoordinates(
      layerVisibility.pins ? visiblePins : [],
      layerVisibility.lines ? visibleLines : [],
      layerVisibility.polygons ? visiblePolygons : [],
    )));
  }, [fitCoordinates, layerVisibility, toDisplayCoordinates, visibleLines, visiblePins, visiblePolygons]);

  const loadKml = useCallback(async () => {
    if (!job?.number || typeof getAccessToken !== 'function') {
      setError('Choose an active job before opening the shared KML.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    if (pendingMapLongPressRef.current) {
      clearTimeout(pendingMapLongPressRef.current);
      pendingMapLongPressRef.current = null;
    }
    draggingPinIdRef.current = null;
    suppressMapGestureUntilRef.current = 0;
    setDraggingPinId(null);
    try {
      const accessToken = await getAccessToken();
      const [nextDocument, nextProgress, nextCalibration, savedUserView] = await Promise.all([
        loadSharedKml({ accessToken, job }),
        loadSharedJobProgress({ accessToken, job }).catch(() => ({ tasks: [] })),
        loadKmlDisplayCalibration(job),
        loadKmlUserViewSettings(job),
      ]);
      const nextLines = nextDocument.overlays?.lines || [];
      const nextPolygons = nextDocument.overlays?.polygons || [];
      const nextFeatures = [
        ...(nextDocument.pins || []),
        ...nextLines,
        ...nextPolygons,
      ];
      hydrateUserView(savedUserView, nextDocument.layers || [], nextFeatures);
      setDocument(nextDocument);
      setPins(nextDocument.pins);
      setLines(nextLines);
      setPolygons(nextPolygons);
      setAppleCalibration(nextCalibration);
      setCalibrationReference(null);
      setChoosingCalibrationPin(false);
      setMovedPinIds({});
      setLocallyEditedFeatureIds({});
      draggingPinIdRef.current = null;
      suppressMapGestureUntilRef.current = 0;
      setDraggingPinId(null);
      setProgressTasks(nextProgress.tasks || []);
      setSelectedLayer(null);
      setLayerStyleDraft(null);
      setActiveTool(null);
      setDraftCoordinates([]);
      setGeometryDraft(null);
      setGeometryVertexDraft(null);
      setGeometryVertexOriginal(null);
      const loadedDisplayCalibration = Platform.OS === 'ios' && nextCalibration.enabled
        ? nextCalibration
        : null;
      fitCoordinates(documentCoordinates(nextDocument.pins, nextLines, nextPolygons).map((coordinate) => (
        applyKmlDisplayCalibration(coordinate, loadedDisplayCalibration)
      )));
    } catch (loadError) {
      setError(loadError?.message || 'The shared KML could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [fitCoordinates, getAccessToken, hydrateUserView, job]);

  useEffect(() => {
    loadKml();
  }, [loadKml]);

  useEffect(() => () => {
    if (pendingMapLongPressRef.current) clearTimeout(pendingMapLongPressRef.current);
    pendingMapLongPressRef.current = null;
    measureSessionRef.current += 1;
    measureTouchRef.current = null;
    draggingPinIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!document || typeof getAccessToken !== 'function' || !job?.number) return undefined;
    let active = true;
    const refreshProgress = async () => {
      try {
        const accessToken = await getAccessToken();
        const nextProgress = await loadSharedJobProgress({ accessToken, job });
        if (active) setProgressTasks(nextProgress.tasks || []);
      } catch {
        // Keep the last crew-visible state when the background refresh is unavailable.
      }
    };
    const interval = setInterval(refreshProgress, 45000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [document, getAccessToken, job]);

  const toggleLayer = useCallback((id) => {
    if (layerIsHidden({ folderId: id }, layers, progressHiddenLayers)) {
      const layer = layers.find((item) => item.id === id);
      Alert.alert(
        'Layer completed in Job Progress',
        `${layer?.name || 'This layer'} is automatically hidden because its linked Progress task is complete. Reopen that task to show the layer again.`,
      );
      return;
    }
    setPersonalLayerHidden(id, !isPersonalLayerHidden(id));
  }, [isPersonalLayerHidden, layers, progressHiddenLayers, setPersonalLayerHidden]);

  const toggleFeature = useCallback((id) => {
    if (progressHiddenFeatures[id]) {
      const feature = allFeatures.find((item) => item.id === id);
      Alert.alert(
        'Feature completed in Job Progress',
        `${feature?.name || 'This feature'} is automatically hidden because its matching Progress task is complete. Reopen that task to show it again.`,
      );
      return;
    }
    setPersonalFeatureHidden(id, !isPersonalFeatureHidden(id));
  }, [allFeatures, isPersonalFeatureHidden, progressHiddenFeatures, setPersonalFeatureHidden]);

  const requestBack = useCallback(() => {
    if (!dirty || saving) {
      goBack?.();
      return;
    }
    Alert.alert(
      'Discard KML changes?',
      'Your unsaved pins, lines or areas will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: goBack },
      ],
    );
  }, [dirty, goBack, saving]);

  const applyPinDraft = useCallback(() => {
    if (!pinDraft) return;
    const nextPin = {
      ...pinDraft,
      name: String(pinDraft.name || '').trim() || 'Untitled pin',
      style: {
        ...(pinDraft.style || {}),
        iconUri: pinDraft.style?.iconHref ? (pinDraft.style?.iconUri || '') : '',
      },
    };
    setPins((current) => {
      const layerStyled = current.map((pin) => (
        featureBelongsToLayer(pin, nextPin.folderId, layers)
          ? applyPinLayerStyle(pin, nextPin.style)
          : pin
      ));
      if (nextPin.isNew) return [...layerStyled, { ...nextPin, styleEdited: true }];
      return layerStyled.map((pin) => (
        pin.id === nextPin.id ? { ...nextPin, styleEdited: true } : pin
      ));
    });
    setLocallyEditedFeatureIds((current) => ({ ...current, [nextPin.id]: true }));
    Keyboard.dismiss();
    draggingPinIdRef.current = null;
    setDraggingPinId(null);
    setPinDraft(null);
  }, [layers, pinDraft]);

  const deletePin = useCallback(() => {
    if (!pinDraft) return;
    Alert.alert('Delete this pin?', 'The pin will be removed from the shared KML when you press Save.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setPins((current) => current.map((pin) => (pin.id === pinDraft.id ? { ...pin, deleted: true } : pin)));
          setLocallyEditedFeatureIds((current) => ({ ...current, [pinDraft.id]: true }));
          draggingPinIdRef.current = null;
          setDraggingPinId(null);
          setPinDraft(null);
        },
      },
    ]);
  }, [pinDraft]);

  const applyGeometryDraft = useCallback(() => {
    if (!geometryDraft) return;
    const fallback = geometryDraft.type === 'line' ? 'Survey line' : 'Survey area';
    const nextFeature = { ...geometryDraft, name: String(geometryDraft.name || '').trim() || fallback };
    if (geometryDraft.type === 'line') {
      setLines((current) => (
        nextFeature.isNew
          ? [...current, nextFeature]
          : current.map((line) => (line.id === nextFeature.id ? nextFeature : line))
      ));
    } else {
      setPolygons((current) => (
        nextFeature.isNew
          ? [...current, nextFeature]
          : current.map((polygon) => (polygon.id === nextFeature.id ? nextFeature : polygon))
      ));
    }
    setLocallyEditedFeatureIds((current) => ({ ...current, [nextFeature.id]: true }));
    Keyboard.dismiss();
    setGeometryDraft(null);
    setActiveTool(null);
    setDraftCoordinates([]);
  }, [geometryDraft]);

  const deleteGeometry = useCallback(() => {
    if (!geometryDraft || geometryDraft.isNew) return;
    const label = geometryDraft.type === 'polygon' ? 'area' : 'line';
    Alert.alert(`Delete this ${label}?`, `The ${label} will be removed from the shared KML when you press Save.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const remove = (feature) => (feature.id === geometryDraft.id ? { ...feature, deleted: true } : feature);
          if (geometryDraft.type === 'line') setLines((current) => current.map(remove));
          else setPolygons((current) => current.map(remove));
          setLocallyEditedFeatureIds((current) => ({ ...current, [geometryDraft.id]: true }));
          setGeometryDraft(null);
        },
      },
    ]);
  }, [geometryDraft]);

  const beginVertexEdit = useCallback(() => {
    if (!editingUnlocked || !geometryDraft || geometryDraft.isNew) return;
    setGeometryVertexOriginal({ ...geometryDraft, coordinates: [...(geometryDraft.coordinates || [])] });
    setGeometryVertexDraft({ ...geometryDraft, coordinates: [...(geometryDraft.coordinates || [])] });
    setGeometryDraft(null);
    setSelectedCoordinate(null);
  }, [editingUnlocked, geometryDraft]);

  const moveGeometryVertex = useCallback((index, coordinate) => {
    if (!editingUnlocked) return;
    setGeometryVertexDraft((current) => current ? ({
      ...current,
      coordinates: current.coordinates.map((item, itemIndex) => (
        itemIndex === index ? { ...item, ...coordinate } : item
      )),
    }) : current);
  }, [editingUnlocked]);

  const finishVertexEdit = useCallback(() => {
    if (!geometryVertexDraft) return;
    setGeometryDraft({ ...geometryVertexDraft });
    setGeometryVertexDraft(null);
    setGeometryVertexOriginal(null);
  }, [geometryVertexDraft]);

  const cancelVertexEdit = useCallback(() => {
    setGeometryDraft(geometryVertexOriginal ? { ...geometryVertexOriginal } : null);
    setGeometryVertexDraft(null);
    setGeometryVertexOriginal(null);
  }, [geometryVertexOriginal]);

  const editLayerStyle = useCallback((layer) => {
    if (!editingUnlocked) return;
    setSelectedLayer(layer);
    setLayerStyleDraft({ ...(layer.style || {}) });
    setOpenSheet('layer-style');
  }, [editingUnlocked]);

  const applyLayerStyle = useCallback(() => {
    if (!selectedLayer || !layerStyleDraft) return;
    const resolvedDraft = {
      ...layerStyleDraft,
      iconUri: layerStyleDraft.iconHref ? (layerStyleDraft.iconUri || '') : '',
    };
    const apply = (feature) => featureBelongsToLayer(feature, selectedLayer.id, layers)
      ? { ...feature, style: { ...feature.style, ...resolvedDraft }, styleEdited: true }
      : feature;
    setPins((current) => current.map(apply));
    setLines((current) => current.map(apply));
    setPolygons((current) => current.map(apply));
    const editedIds = allFeatures.reduce((result, feature) => (
      featureBelongsToLayer(feature, selectedLayer.id, layers)
        ? { ...result, [feature.id]: true }
        : result
    ), {});
    setLocallyEditedFeatureIds((current) => ({ ...current, ...editedIds }));
    setSelectedLayer(null);
    setLayerStyleDraft(null);
    setOpenSheet('layers');
  }, [allFeatures, layerStyleDraft, layers, selectedLayer]);

  const addMeasurementPoint = useCallback((displayCoordinate) => {
    if (!displayCoordinate) return;
    const rawCoordinate = fromDisplayCoordinate(displayCoordinate);
    const maxDistanceMetres = measurementSnapRadiusMetres({
      region: lastMapRegion || initialRegion,
      mapSize: mapLayoutRef.current,
    });
    const snapped = snapKmlMeasurementCoordinate({
      coordinate: rawCoordinate,
      pins: layerVisibility.pins ? visiblePins : [],
      lines: layerVisibility.lines ? visibleLines : [],
      polygons: layerVisibility.polygons ? visiblePolygons : [],
      maxDistanceMetres,
    });
    if (!snapped?.coordinate) return;
    setDraftCoordinates((current) => {
      const previous = current[current.length - 1];
      if (previous && distanceMetres(previous, snapped.coordinate) < 0.05) return current;
      return [...current, snapped.coordinate];
    });
  }, [fromDisplayCoordinate, initialRegion, lastMapRegion, layerVisibility, visibleLines, visiblePins, visiblePolygons]);

  const measureFeaturePressed = useCallback((displayCoordinate, event) => {
    event?.stopPropagation?.();
    measureFeaturePressRef.current = Date.now();
    measureTouchRef.current = null;
    addMeasurementPoint(displayCoordinate);
  }, [addMeasurementPoint]);

  const movePin = useCallback((pinId, coordinate) => {
    const movedCoordinate = {
      latitude: Number(coordinate.latitude),
      longitude: Number(coordinate.longitude),
    };
    setPins((current) => current.map((pin) => (
      pin.id === pinId ? { ...pin, ...movedCoordinate } : pin
    )));
    setPinDraft((current) => (
      current?.id === pinId ? { ...current, ...movedCoordinate } : current
    ));
    setMovedPinIds((current) => ({ ...current, [pinId]: true }));
    setLocallyEditedFeatureIds((current) => ({ ...current, [pinId]: true }));
  }, []);

  const mapGestureIsSuppressed = useCallback(() => (
    Boolean(pendingMapLongPressRef.current)
    || shouldSuppressKmlMapGesture({
      draggingPinId: draggingPinIdRef.current,
      suppressUntil: suppressMapGestureUntilRef.current,
    })
  ), []);

  const beginPinDrag = useCallback((pinId, event) => {
    event?.stopPropagation?.();
    if (!editingUnlocked) return;
    if (pendingMapLongPressRef.current) {
      clearTimeout(pendingMapLongPressRef.current);
      pendingMapLongPressRef.current = null;
    }
    draggingPinIdRef.current = pinId;
    suppressMapGestureUntilRef.current = 0;
    setDraggingPinId(pinId);
    setSelectedCoordinate(null);
  }, [editingUnlocked]);

  const endPinDrag = useCallback((pinId, event) => {
    event?.stopPropagation?.();
    const displayCoordinate = event?.nativeEvent?.coordinate;
    if (displayCoordinate) movePin(pinId, fromDisplayCoordinate(displayCoordinate));
    draggingPinIdRef.current = null;
    suppressMapGestureUntilRef.current = Date.now() + KML_POST_DRAG_GESTURE_GUARD_MS;
    setDraggingPinId(null);
  }, [fromDisplayCoordinate, movePin]);

  const pressPin = useCallback((pinId, event) => {
    event?.stopPropagation?.();
    if (calibrationReference || mapGestureIsSuppressed()) return;
    if (activeTool !== 'measure' && !editingUnlocked) return;
    const pin = pins.find((candidate) => candidate.id === pinId && !candidate.deleted);
    if (!pin) return;
    if (activeTool === 'measure') {
      measureFeaturePressed(toDisplayCoordinate(pin), event);
      return;
    }
    draggingPinIdRef.current = null;
    setDraggingPinId(null);
    setPinDraft({ ...pin });
  }, [activeTool, calibrationReference, editingUnlocked, mapGestureIsSuppressed, measureFeaturePressed, pins, toDisplayCoordinate]);

  const moveDraftVertex = useCallback((index, coordinate) => {
    setDraftCoordinates((current) => current.map((item, itemIndex) => (
      itemIndex === index ? coordinate : item
    )));
  }, []);

  const openPinDirections = useCallback((pin) => {
    const links = buildKmlPinMapLinks(pin);
    if (!links) {
      Alert.alert('Directions unavailable', 'This pin does not contain a valid latitude and longitude.');
      return;
    }

    const openUrl = async (url) => {
      try {
        await Linking.openURL(url);
      } catch {
        Alert.alert('Maps could not be opened', 'Please check the available map apps and try again.');
      }
    };
    const openAppleMaps = () => openUrl(links.apple);
    const openGoogleMaps = () => openUrl(links.google);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Drive to ${links.label}`,
          message: `${Number(pin.latitude).toFixed(7)}, ${Number(pin.longitude).toFixed(7)}`,
          options: ['Apple Maps', 'Google Maps', 'Cancel'],
          cancelButtonIndex: 2,
          userInterfaceStyle: colors.isDark ? 'dark' : 'light',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) openAppleMaps();
          if (buttonIndex === 1) openGoogleMaps();
        },
      );
      return;
    }

    Alert.alert(`Drive to ${links.label}`, 'Choose a navigation app.', [
      { text: 'Google Maps', onPress: openGoogleMaps },
      { text: 'Apple Maps', onPress: openAppleMaps },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [colors.isDark]);

  const beginAppleCalibration = useCallback((pin) => {
    if (!pin || Platform.OS !== 'ios' || mapProvider !== 'apple') {
      Alert.alert('Apple calibration unavailable', 'Switch the imagery source to Apple detail before calibrating.');
      return;
    }
    setOpenSheet('');
    setChoosingCalibrationPin(false);
    setPinDraft(null);
    setSelectedCoordinate(null);
    setActiveTool(null);
    setDraftCoordinates([]);
    setCalibrationReference({ pin: { ...pin }, verifying: Boolean(appleCalibration.exists) });
    const calibrationForPreview = appleCalibration.enabled ? appleCalibration : null;
    fitCoordinates([applyKmlDisplayCalibration(pin, calibrationForPreview)]);
  }, [appleCalibration, fitCoordinates, mapProvider]);

  const commitAppleCalibration = useCallback(async (calibration, successMessage) => {
    try {
      const savedCalibration = await saveKmlDisplayCalibration(job, calibration);
      setAppleCalibration(savedCalibration);
      setCalibrationReference(null);
      Alert.alert('Apple imagery calibrated', successMessage || `${formatKmlCalibrationOffset(savedCalibration)} is now applied to this job on this device.`);
    } catch {
      Alert.alert('Calibration not saved', 'The Apple imagery offset could not be stored. Please try again.');
    }
  }, [job]);

  const completeAppleCalibration = useCallback((imageryCoordinate) => {
    const referencePin = calibrationReference?.pin;
    if (!referencePin) return;
    const candidate = createKmlDisplayCalibration({ referencePin, imageryCoordinate });
    if (!candidate) {
      Alert.alert(
        'Control point is too far away',
        'Apple imagery calibration is limited to 250 m for safety. Zoom in and tap the same physical object as the selected pin.',
      );
      return;
    }

    const offset = kmlCalibrationOffsetMetres(candidate);
    if (calibrationReference.verifying && appleCalibration.exists) {
      const residual = kmlCalibrationDifferenceMetres(appleCalibration, candidate);
      if (residual <= 2) {
        setCalibrationReference(null);
        Alert.alert(
          'Apple alignment verified',
          `${referencePin.name || 'This control pin'} agrees with the saved calibration within ${residual.toFixed(1)} m. The existing offset has been kept.`,
        );
        return;
      }
      Alert.alert(
        'Alignment varies here',
        `This control point differs from the saved Apple calibration by ${residual.toFixed(1)} m. Apple imagery may not have one constant offset across the whole job.`,
        [
          { text: 'Keep current', style: 'cancel', onPress: () => setCalibrationReference(null) },
          {
            text: 'Use this pin',
            onPress: () => commitAppleCalibration(
              candidate,
              `${formatKmlCalibrationOffset(candidate)} now uses ${referencePin.name || 'this pin'} as the job control point.`,
            ),
          },
        ],
      );
      return;
    }

    const applyCandidate = () => commitAppleCalibration(
      candidate,
      `${formatKmlCalibrationOffset(candidate)} now aligns the KML display to ${referencePin.name || 'the selected control pin'}.`,
    );
    if (offset.distance > 40) {
      Alert.alert(
        'Large imagery offset',
        `This would shift the KML display by ${offset.distance.toFixed(1)} m. Confirm that you tapped the same physical object.`,
        [
          { text: 'Try again', style: 'cancel' },
          { text: 'Use offset', onPress: applyCandidate },
        ],
      );
      return;
    }
    applyCandidate();
  }, [appleCalibration, calibrationReference, commitAppleCalibration]);

  const toggleAppleCalibration = useCallback(async (enabled) => {
    if (!appleCalibration.exists) return;
    try {
      const savedCalibration = await saveKmlDisplayCalibration(job, { ...appleCalibration, enabled });
      setAppleCalibration(savedCalibration);
    } catch {
      Alert.alert('Calibration not updated', 'The Apple imagery display setting could not be saved.');
    }
  }, [appleCalibration, job]);

  const resetAppleCalibration = useCallback(() => {
    Alert.alert(
      'Reset Apple calibration?',
      'The KML will return to its original, unshifted display. No KML coordinates will be changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setAppleCalibration(await clearKmlDisplayCalibration(job));
              setCalibrationReference(null);
            } catch {
              Alert.alert('Calibration not reset', 'The saved Apple imagery offset could not be removed.');
            }
          },
        },
      ],
    );
  }, [job]);

  const save = useCallback(async () => {
    if (!dirty || saving || !document) return;
    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      const saved = await saveSharedKml({ accessToken, document, pins, lines, polygons });
      setDocument(saved);
      setPins(saved.pins);
      setLines(saved.overlays?.lines || []);
      setPolygons(saved.overlays?.polygons || []);
      setMovedPinIds({});
      setLocallyEditedFeatureIds({});
      draggingPinIdRef.current = null;
      suppressMapGestureUntilRef.current = 0;
      setDraggingPinId(null);
      goBack?.();
    } catch (saveError) {
      if (saveError?.code === 'KML_VERSION_CONFLICT') {
        Alert.alert(
          'A newer KML was saved',
          'Another user changed this file after you opened it. Reload their latest version before making your changes again.',
          [
            { text: 'Keep this screen', style: 'cancel' },
            { text: 'Reload latest', onPress: loadKml },
          ],
        );
      } else {
        Alert.alert('KML not saved', saveError?.message || 'The shared KML could not be saved.');
      }
    } finally {
      setSaving(false);
    }
  }, [dirty, document, getAccessToken, goBack, lines, loadKml, pins, polygons, saving]);

  const setTool = useCallback((tool) => {
    if (geometryVertexDraft) return;
    const editingTool = tool === 'pin' || tool === 'line' || tool === 'polygon';
    if (editingTool && !editingUnlocked) return;
    measureSessionRef.current += 1;
    measureFeaturePressRef.current = 0;
    measureTouchRef.current = null;
    setOpenSheet('');
    setSelectedCoordinate(null);
    setActiveTool((current) => (current === tool ? null : tool));
    setDraftCoordinates([]);
  }, [editingUnlocked, geometryVertexDraft]);

  const cancelActiveTool = useCallback(() => {
    measureSessionRef.current += 1;
    measureFeaturePressRef.current = 0;
    measureTouchRef.current = null;
    setActiveTool(null);
    setDraftCoordinates([]);
  }, []);

  const undoDraftCoordinate = useCallback(() => {
    measureSessionRef.current += 1;
    measureTouchRef.current = null;
    setDraftCoordinates((current) => current.slice(0, -1));
  }, []);

  const measureTouchStarted = useCallback((event) => {
    if (activeTool !== 'measure') return;
    const nativeEvent = event?.nativeEvent || {};
    const touches = nativeEvent.touches || [];
    const touch = touches[0] || nativeEvent;
    const x = Number(touch?.locationX);
    const y = Number(touch?.locationY);
    measureTouchRef.current = {
      x,
      y,
      moved: false,
      cancelled: touches.length > 1 || !Number.isFinite(x) || !Number.isFinite(y),
      session: measureSessionRef.current,
      startedAt: Date.now(),
    };
  }, [activeTool]);

  const measureTouchMoved = useCallback((event) => {
    const gesture = measureTouchRef.current;
    if (activeTool !== 'measure' || !gesture) return;
    const nativeEvent = event?.nativeEvent || {};
    const touches = nativeEvent.touches || [];
    if (touches.length > 1) {
      gesture.cancelled = true;
      return;
    }
    const touch = touches[0] || nativeEvent;
    const x = Number(touch?.locationX);
    const y = Number(touch?.locationY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.hypot(x - gesture.x, y - gesture.y) > 7) gesture.moved = true;
  }, [activeTool]);

  const measureTouchEnded = useCallback((event) => {
    const gesture = measureTouchRef.current;
    measureTouchRef.current = null;
    if (activeTool !== 'measure' || !gesture || gesture.cancelled || gesture.moved) return;
    if (gesture.session !== measureSessionRef.current) return;
    const nativeEvent = event?.nativeEvent || {};
    const touch = nativeEvent.changedTouches?.[0] || nativeEvent;
    const x = Number.isFinite(Number(touch?.locationX)) ? Number(touch.locationX) : gesture.x;
    const y = Number.isFinite(Number(touch?.locationY)) ? Number(touch.locationY) : gesture.y;
    const map = mapRef.current;
    if (!map?.coordinateForPoint || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const session = measureSessionRef.current;
    Promise.resolve(map.coordinateForPoint({ x, y }))
      .then((coordinate) => {
        setTimeout(() => {
          if (session !== measureSessionRef.current) return;
          if (measureFeaturePressRef.current >= gesture.startedAt) return;
          addMeasurementPoint(coordinate);
        }, 0);
      })
      .catch(() => {});
  }, [activeTool, addMeasurementPoint]);

  const cancelMeasureTouch = useCallback(() => {
    measureTouchRef.current = null;
  }, []);

  const mapPressed = useCallback((event) => {
    if (mapGestureIsSuppressed() || activeTool === 'measure') return;
    if ((activeTool === 'pin' || activeTool === 'line' || activeTool === 'polygon') && !editingUnlocked) return;
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate || geometryVertexDraft) return;
    if (calibrationReference) {
      completeAppleCalibration(coordinate);
      return;
    }
    const rawCoordinate = fromDisplayCoordinate(coordinate);
    if (activeTool === 'pin') {
      setPinDraft(createKmlPin(rawCoordinate, preferredLayer(layers, 'pin')));
      setActiveTool(null);
      return;
    }
    if (activeTool) {
      setDraftCoordinates((current) => [...current, rawCoordinate]);
      return;
    }
    setSelectedCoordinate(rawCoordinate);
  }, [activeTool, calibrationReference, completeAppleCalibration, editingUnlocked, fromDisplayCoordinate, geometryVertexDraft, layers, mapGestureIsSuppressed]);

  const mapLongPressed = useCallback((event) => {
    if (!editingUnlocked || activeTool || geometryVertexDraft || calibrationReference || mapGestureIsSuppressed()) return;
    const coordinate = event?.nativeEvent?.coordinate;
    if (!coordinate) return;
    const rawCoordinate = fromDisplayCoordinate(coordinate);

    pendingMapLongPressRef.current = setTimeout(() => {
      pendingMapLongPressRef.current = null;
      if (shouldSuppressKmlMapGesture({
        draggingPinId: draggingPinIdRef.current,
        suppressUntil: suppressMapGestureUntilRef.current,
      })) return;
      suppressMapGestureUntilRef.current = Date.now() + KML_POST_DRAG_GESTURE_GUARD_MS;
      setPinDraft(createKmlPin(rawCoordinate, preferredLayer(layers, 'pin')));
    }, 90);
  }, [activeTool, calibrationReference, editingUnlocked, fromDisplayCoordinate, geometryVertexDraft, layers, mapGestureIsSuppressed]);

  const completeDrawing = useCallback(() => {
    if (!editingUnlocked) return;
    if (activeTool === 'line' && draftCoordinates.length >= 2) {
      setGeometryDraft({ ...createKmlLine(draftCoordinates, preferredLayer(layers, 'line')), type: 'line' });
    }
    if (activeTool === 'polygon' && draftCoordinates.length >= 3) {
      setGeometryDraft({ ...createKmlPolygon(draftCoordinates, preferredLayer(layers, 'polygon')), type: 'polygon' });
    }
  }, [activeTool, draftCoordinates, editingUnlocked, layers]);

  const goToCurrentLocation = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location unavailable', 'Allow location access to centre the KML map on your position.');
        return;
      }
      setShowsUserLocation(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      mapRef.current?.animateToRegion({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      }, 550);
    } catch (locationError) {
      Alert.alert('Location unavailable', locationError?.message || 'Your current position could not be found.');
    }
  }, []);

  const resetNorth = useCallback(async () => {
    const camera = await mapRef.current?.getCamera();
    if (camera) mapRef.current?.animateCamera({ ...camera, heading: 0 }, { duration: 450 });
  }, []);

  const selectFeature = useCallback((feature) => {
    if (activeTool === 'measure') return;
    setOpenSheet('');
    setPersonalFeatureHidden(feature.id, false);

    if (!editingUnlocked) {
      const displayCoordinates = feature.type === 'line' || feature.type === 'polygon'
        ? toDisplayCoordinates(feature.coordinates || [])
        : [toDisplayCoordinate({ latitude: feature.latitude, longitude: feature.longitude })];
      const focusCoordinate = displayCoordinates[Math.floor(displayCoordinates.length / 2)] || displayCoordinates[0];
      if (focusCoordinate) {
        mapRef.current?.animateToRegion({
          ...focusCoordinate,
          latitudeDelta: 0.0042,
          longitudeDelta: 0.0042,
        }, 420);
      }
      return;
    }

    if (feature.type === 'line' || feature.type === 'polygon') {
      fitCoordinates(toDisplayCoordinates(feature.coordinates || []));
      setTimeout(() => setGeometryDraft({ ...feature }), 180);
      return;
    }
    fitCoordinates([toDisplayCoordinate({ latitude: feature.latitude, longitude: feature.longitude })]);
    setTimeout(() => setPinDraft({ ...feature }), 180);
  }, [activeTool, editingUnlocked, fitCoordinates, setPersonalFeatureHidden, toDisplayCoordinate, toDisplayCoordinates]);

  const updatedBy = document?.item?.lastModifiedBy?.user?.displayName
    || document?.item?.lastModifiedBy?.application?.displayName
    || '';
  const featureCount = allFeatures.length;
  const draftMetric = activeTool === 'polygon'
    ? formatArea(polygonAreaSquareMetres(draftCoordinates))
    : formatDistance(pathDistanceMetres(draftCoordinates));

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <EditorHeader fileName={document?.item?.name} dirty={dirty} saving={saving} onBack={requestBack} onSave={save} />

      {loading ? (
        <View style={styles.statePanel}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.stateTitle}>Opening the shared job KML…</Text>
          <Text style={styles.stateCopy}>Preparing a local working copy for this editing session.</Text>
        </View>
      ) : null}

      {!loading && error ? (
        <View style={styles.statePanel}>
          <View style={styles.errorIcon}><Ionicons name="map-outline" size={30} color={colors.accentDark} /></View>
          <Text style={styles.stateTitle}>KML unavailable</Text>
          <Text style={styles.stateCopy}>{error}</Text>
          <View style={styles.stateActions}>
            <Pressable style={styles.secondaryStateButton} onPress={requestBack}><Text style={styles.secondaryStateText}>Back to workspace</Text></Pressable>
            <Pressable style={styles.primaryStateButton} onPress={loadKml}><Text style={styles.primaryStateText}>Try again</Text></Pressable>
          </View>
        </View>
      ) : null}

      {!loading && !error && document ? (
        <View style={styles.mapWrap}>
          <MapView
            key={`kml-map-${mapProvider}`}
            ref={mapRef}
            style={StyleSheet.absoluteFillObject}
            initialRegion={lastMapRegion || initialRegion}
            provider={mapProvider === 'google' ? PROVIDER_GOOGLE : undefined}
            mapType={mapType}
            showsCompass={false}
            showsUserLocation={showsUserLocation}
            showsMyLocationButton={false}
            pitchEnabled={false}
            rotateEnabled
            zoomEnabled
            zoomTapEnabled
            onLayout={(event) => {
              const layout = event?.nativeEvent?.layout;
              if (layout?.width > 0 && layout?.height > 0) {
                mapLayoutRef.current = { width: layout.width, height: layout.height };
              }
            }}
            onRegionChangeComplete={(region) => {
              if (Number.isFinite(region?.longitudeDelta)) setMapLongitudeDelta(region.longitudeDelta);
              if (Number.isFinite(region?.latitude) && Number.isFinite(region?.longitude)) setLastMapRegion(region);
            }}
            onTouchStart={measureTouchStarted}
            onTouchMove={measureTouchMoved}
            onTouchEnd={measureTouchEnded}
            onTouchCancel={cancelMeasureTouch}
            onPress={activeTool === 'measure' ? undefined : mapPressed}
            onLongPress={mapLongPressed}
          >
            {layerVisibility.polygons ? visiblePolygons
              .filter((polygon) => polygon.id !== geometryVertexDraft?.id)
              .map((polygon) => {
                const displayCoordinates = toDisplayCoordinates(polygon.coordinates);
                const boundaryCoordinates = kmlClosedPolygonBoundary(displayCoordinates);
                const canPressBoundary = !calibrationReference && (activeTool === 'measure' || editingUnlocked);
                const boundaryPressed = (event) => {
                  if (activeTool === 'measure') {
                    measureFeaturePressed(event?.nativeEvent?.coordinate, event);
                    return;
                  }
                  event?.stopPropagation?.();
                  selectFeature({ ...polygon, type: 'polygon' });
                };
                return (
                  <React.Fragment key={polygon.id}>
                    <Polygon
                      coordinates={displayCoordinates}
                      strokeColor={withOpacity(polygon.style?.lineColor || colors.accent, polygon.style?.lineOpacity ?? 1)}
                      fillColor={withOpacity(polygon.style?.fillColor || colors.accent, polygon.style?.fillOpacity ?? 0.3)}
                      strokeWidth={Number(polygon.style?.lineWidth || 3)}
                      tappable={false}
                    />
                    {canPressBoundary && boundaryCoordinates.length >= 2 ? (
                      <Polyline
                        coordinates={boundaryCoordinates}
                        strokeColor="#FFFFFF01"
                        strokeWidth={Math.max(18, Number(polygon.style?.lineWidth || 3) + 14)}
                        lineCap="round"
                        lineJoin="round"
                        tappable
                        onPress={boundaryPressed}
                      />
                    ) : null}
                  </React.Fragment>
                );
              }) : null}
            {layerVisibility.lines ? visibleLines
              .filter((line) => line.id !== geometryVertexDraft?.id)
              .map((line) => (
              <Polyline
                key={line.id}
                coordinates={toDisplayCoordinates(line.coordinates)}
                strokeColor={withOpacity(line.style?.lineColor || colors.accent, line.style?.lineOpacity ?? 1)}
                strokeWidth={Number(line.style?.lineWidth || 4)}
                tappable={!calibrationReference && (activeTool === 'measure' || editingUnlocked)}
                onPress={calibrationReference || (activeTool !== 'measure' && !editingUnlocked) ? undefined : (event) => {
                  if (activeTool === 'measure') {
                    measureFeaturePressed(event?.nativeEvent?.coordinate, event);
                    return;
                  }
                  event?.stopPropagation?.();
                  selectFeature({ ...line, type: 'line' });
                }}
              />
            )) : null}
            {geometryVertexDraft?.type === 'polygon' ? (
              <Polygon
                coordinates={toDisplayCoordinates(geometryVertexDraft.coordinates)}
                strokeColor={withOpacity(geometryVertexDraft.style?.lineColor || colors.accent, 1)}
                fillColor={withOpacity(geometryVertexDraft.style?.fillColor || colors.accent, 0.2)}
                strokeWidth={Math.max(4, Number(geometryVertexDraft.style?.lineWidth || 4))}
                lineDashPattern={[8, 5]}
              />
            ) : null}
            {geometryVertexDraft?.type === 'line' ? (
              <Polyline
                coordinates={toDisplayCoordinates(geometryVertexDraft.coordinates)}
                strokeColor={withOpacity(geometryVertexDraft.style?.lineColor || colors.accent, 1)}
                strokeWidth={Math.max(4, Number(geometryVertexDraft.style?.lineWidth || 4))}
                lineDashPattern={[8, 5]}
              />
            ) : null}
            {(geometryVertexDraft?.coordinates || []).map((coordinate, index) => (
              <Marker
                key={`geometry-vertex-${geometryVertexDraft.id}-${index}`}
                coordinate={toDisplayCoordinate(coordinate)}
                draggable={editingUnlocked}
                anchor={{ x: 0.5, y: 0.5 }}
                onDragEnd={editingUnlocked ? (event) => moveGeometryVertex(index, fromDisplayCoordinate(event.nativeEvent.coordinate)) : undefined}
              >
                <View style={styles.vertexMarker}>
                  <Text style={styles.vertexMarkerText}>{index + 1}</Text>
                </View>
              </Marker>
            ))}
            {draftCoordinates.length >= 2 && activeTool === 'polygon' ? (
              <Polygon coordinates={toDisplayCoordinates(draftCoordinates)} strokeColor={colors.white} fillColor={`${colors.accent}45`} strokeWidth={3} lineDashPattern={[8, 5]} />
            ) : null}
            {draftCoordinates.length >= 2 && activeTool && activeTool !== 'pin' ? (
              <Polyline coordinates={toDisplayCoordinates(draftCoordinates)} strokeColor={activeTool === 'measure' ? colors.info : colors.white} strokeWidth={4} lineDashPattern={[8, 5]} />
            ) : null}
            {draftCoordinates.map((coordinate, index) => (
              <Marker
                key={`draft-${index}`}
                coordinate={toDisplayCoordinate(coordinate)}
                draggable={activeTool !== 'measure'}
                tappable={activeTool !== 'measure'}
                pinColor={activeTool === 'measure' ? colors.info : colors.accent}
                onDragEnd={activeTool === 'measure' ? undefined : (event) => moveDraftVertex(index, fromDisplayCoordinate(event.nativeEvent.coordinate))}
              />
            ))}
            {layerVisibility.pins ? visiblePins.map((pin) => (
              <KmlPinMarker
                key={pin.id}
                pin={pin}
                coordinate={toDisplayCoordinate(pin)}
                mapScale={mapMarkerScale}
                moved={Boolean(movedPinIds[pin.id])}
                selected={pinDraft?.id === pin.id || calibrationReference?.pin?.id === pin.id}
                dragging={draggingPinId === pin.id}
                draggable={editingUnlocked && !calibrationReference && activeTool !== 'measure'}
                onSelect={activeTool === 'measure' || editingUnlocked ? pressPin : undefined}
                onMoveStart={editingUnlocked && activeTool !== 'measure' ? beginPinDrag : undefined}
                onMoveEnd={editingUnlocked && activeTool !== 'measure' ? endPinDrag : undefined}
              />
            )) : null}
          </MapView>

          <Pressable style={styles.searchBar} onPress={() => setOpenSheet('features')}>
            <Ionicons name="search" size={20} color={colors.bodyText} />
            <View style={styles.searchCopy}>
              <Text style={styles.searchPlaceholder}>Search this KML</Text>
              <Text style={styles.searchMeta} numberOfLines={1}>
                {featureCount} {featureCount === 1 ? 'feature' : 'features'} · {formatUpdated(document.item.lastModifiedDateTime)}{updatedBy ? ` by ${updatedBy}` : ''}
              </Text>
            </View>
            <Pressable
              style={styles.reloadButton}
              onPress={(event) => {
                event.stopPropagation?.();
                if (!dirty) return loadKml();
                Alert.alert('Reload latest KML?', 'This will discard your unsaved map changes.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reload', style: 'destructive', onPress: loadKml },
                ]);
              }}
              accessibilityLabel="Reload latest shared KML"
            >
              <Ionicons name="refresh" size={18} color={colors.accentDark} />
            </Pressable>
          </Pressable>

          <MapControls
            onLayers={() => setOpenSheet('layers')}
            onLocation={goToCurrentLocation}
            onNorth={resetNorth}
            onFit={fitVisibleDocument}
          />

          {calibrationActive && !activeTool && !geometryVertexDraft && !calibrationReference ? (
            <CalibrationBadge calibration={appleCalibration} onPress={() => setOpenSheet('layers')} />
          ) : null}

          {activeTool ? (
            <DrawingHud
              tool={activeTool}
              coordinates={draftCoordinates}
              editingUnlocked={editingUnlocked}
              onUndo={undoDraftCoordinate}
              onCancel={cancelActiveTool}
              onComplete={completeDrawing}
            />
          ) : null}

          {geometryVertexDraft ? (
            <VertexEditHud
              feature={geometryVertexDraft}
              editingUnlocked={editingUnlocked}
              onCancel={cancelVertexEdit}
              onComplete={finishVertexEdit}
            />
          ) : null}

          {calibrationReference ? (
            <CalibrationHud
              pin={calibrationReference.pin}
              verifying={calibrationReference.verifying}
              onCancel={() => setCalibrationReference(null)}
            />
          ) : null}

          {!activeTool && !geometryVertexDraft && !calibrationReference && selectedCoordinate ? (
            <CoordinateCard
              coordinate={selectedCoordinate}
              onPress={() => setOpenSheet('coordinate')}
              onClose={() => setSelectedCoordinate(null)}
            />
          ) : null}

          {!editingUnlocked && !activeTool && !geometryVertexDraft && !calibrationReference && !selectedCoordinate ? (
            <EditZoomLockBadge
              bottom={insets.bottom + SPACING.sm + 78}
              spanMetres={editingViewportSpanMetres}
            />
          ) : null}

          {!geometryVertexDraft && !calibrationReference ? (
            <SurveyToolDock
              activeTool={activeTool}
              bottom={insets.bottom + SPACING.sm}
              editingUnlocked={editingUnlocked}
              onTool={setTool}
              onFeatures={() => setOpenSheet('features')}
            />
          ) : null}

          {activeTool === 'measure' && draftCoordinates.length >= 2 ? (
            <View style={styles.measureBadge}><Text style={styles.measureBadgeText}>{draftMetric}</Text></View>
          ) : null}
        </View>
      ) : null}

      <PinEditorSheet
        visible={Boolean(pinDraft)}
        pin={pinDraft}
        layers={layers}
        appleCalibrationAvailable={Platform.OS === 'ios' && mapProvider === 'apple'}
        appleCalibrationActive={calibrationActive}
        onChange={setPinDraft}
        layerHidden={Boolean(pinDraft && layerIsHidden(pinDraft, layers, effectiveHiddenLayers))}
        onToggleLayer={toggleLayer}
        onDirections={() => pinDraft && openPinDirections(pinDraft)}
        onCalibrate={() => pinDraft && beginAppleCalibration(pinDraft)}
        onCancel={() => { Keyboard.dismiss(); setDraggingPinId(null); setPinDraft(null); }}
        onApply={applyPinDraft}
        onDelete={deletePin}
      />
      <GeometryEditorSheet
        visible={Boolean(geometryDraft)}
        feature={geometryDraft}
        layers={layers}
        featureHidden={Boolean(geometryDraft && effectiveHiddenFeatures[geometryDraft.id])}
        onChange={setGeometryDraft}
        onCancel={() => { Keyboard.dismiss(); setGeometryDraft(null); }}
        onApply={applyGeometryDraft}
        onDelete={deleteGeometry}
        onToggleVisibility={() => geometryDraft && toggleFeature(geometryDraft.id)}
        onEditVertices={beginVertexEdit}
      />
      <LayersSheet
        visible={openSheet === 'layers'}
        mapType={mapType}
        mapProvider={mapProvider}
        showMapProviderChoice={Platform.OS === 'ios'}
        googleProviderAvailable={googleProviderAvailable}
        appleCalibration={appleCalibration}
        appleCalibrationOffset={formatKmlCalibrationOffset(appleCalibration)}
        visibility={layerVisibility}
        layers={layers}
        hiddenLayers={effectiveHiddenLayers}
        editingUnlocked={editingUnlocked}
        onMapType={setMapType}
        onMapProvider={(provider) => { setCalibrationReference(null); setMapProvider(provider); }}
        onChooseCalibrationPin={() => { setChoosingCalibrationPin(true); setOpenSheet('features'); }}
        onToggleAppleCalibration={toggleAppleCalibration}
        onResetAppleCalibration={resetAppleCalibration}
        onVisibility={updatePersonalLayerVisibility}
        onToggleLayer={toggleLayer}
        onEditLayer={editLayerStyle}
        onClose={() => setOpenSheet('')}
      />
      <LayerStyleSheet
        visible={openSheet === 'layer-style'}
        layer={selectedLayer}
        draft={layerStyleDraft}
        onChange={setLayerStyleDraft}
        onCancel={() => { setSelectedLayer(null); setLayerStyleDraft(null); setOpenSheet('layers'); }}
        onApply={applyLayerStyle}
      />
      <FeatureBrowserSheet
        visible={openSheet === 'features'}
        features={choosingCalibrationPin ? allFeatures.filter((feature) => feature.type === 'pin') : allFeatures}
        layers={layers}
        hidden={effectiveHiddenFeatures}
        hiddenLayers={effectiveHiddenLayers}
        onToggle={toggleFeature}
        onToggleLayer={toggleLayer}
        eyebrow={choosingCalibrationPin ? 'APPLE IMAGERY CALIBRATION' : 'SHARED JOB KML'}
        title={choosingCalibrationPin ? 'Choose a control pin' : 'Features'}
        searchPlaceholder={choosingCalibrationPin ? 'Search trusted KML pins' : 'Search pins, lines, areas or notes'}
        showVisibility={!choosingCalibrationPin}
        onSelect={choosingCalibrationPin ? beginAppleCalibration : selectFeature}
        onClose={() => { setChoosingCalibrationPin(false); setOpenSheet(''); }}
      />
      <CoordinateSheet
        visible={openSheet === 'coordinate'}
        coordinate={selectedCoordinate}
        onClose={() => setOpenSheet('')}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  header: { backgroundColor: colors.navy },
  headerImage: { opacity: 0.58 },
  headerShade: { backgroundColor: colors.overlay, paddingBottom: SPACING.md },
  headerRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: SPACING.sm },
  headerEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  headerTitle: { color: colors.white, fontSize: 12, fontWeight: '800', marginTop: 3, maxWidth: 160 },
  saveButton: { minWidth: 62, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: colors.accent },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: colors.navy, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  pressed: { opacity: 0.76 },
  statePanel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl },
  stateTitle: { color: colors.bodyText, fontSize: 20, fontWeight: '900', marginTop: SPACING.lg, textAlign: 'center' },
  stateCopy: { color: colors.supportingText, fontSize: 14, lineHeight: 21, marginTop: SPACING.sm, textAlign: 'center' },
  errorIcon: { width: 66, height: 66, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raisedSurface, borderWidth: 1, borderColor: colors.border },
  stateActions: { flexDirection: 'row', marginTop: SPACING.xl },
  primaryStateButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: colors.accent, marginLeft: SPACING.sm },
  primaryStateText: { color: colors.navy, fontWeight: '900' },
  secondaryStateButton: { minHeight: 48, justifyContent: 'center', paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.cardBackground },
  secondaryStateText: { color: colors.bodyText, fontWeight: '800' },
  mapWrap: { flex: 1, overflow: 'hidden' },
  searchBar: { position: 'absolute', top: SPACING.md, left: SPACING.md, right: SPACING.md, minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingLeft: SPACING.md, paddingRight: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  searchCopy: { flex: 1, minWidth: 0, marginLeft: SPACING.sm },
  searchPlaceholder: { color: colors.bodyText, fontSize: 14, fontWeight: '900' },
  searchMeta: { color: colors.supportingText, fontSize: 9, fontWeight: '700', marginTop: 3 },
  reloadButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.sm, backgroundColor: colors.raisedSurface, borderWidth: 1, borderColor: colors.border },
  mapControls: { position: 'absolute', top: 84, right: SPACING.md, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 9, elevation: 4 },
  mapControl: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  mapControlActive: { backgroundColor: colors.accent },
  controlDivider: { height: StyleSheet.hairlineWidth, marginHorizontal: 8, backgroundColor: colors.border },
  calibrationBadge: { position: 'absolute', top: 84, left: SPACING.md, maxWidth: 236, minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.success, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 7, elevation: 4 },
  calibrationBadgeCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.xs },
  calibrationBadgeTitle: { color: colors.success, fontSize: 7, fontWeight: '900', letterSpacing: 0.5 },
  calibrationBadgeValue: { color: colors.bodyText, fontSize: 9, fontWeight: '800', marginTop: 2 },
  drawingHud: { position: 'absolute', left: SPACING.md, right: SPACING.md, bottom: 92, minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 9, elevation: 5 },
  drawingCopy: { flex: 1, minWidth: 0 },
  drawingTitle: { color: colors.bodyText, fontSize: 12, fontWeight: '900' },
  drawingDetail: { color: colors.supportingText, fontSize: 9, marginTop: 3 },
  vertexMarker: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 3, borderColor: colors.white, backgroundColor: colors.accent },
  vertexMarkerText: { color: colors.navy, fontSize: 10, fontWeight: '900' },
  hudIconButton: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginLeft: 4, backgroundColor: colors.raisedSurface },
  hudDoneButton: { minWidth: 52, minHeight: 38, alignItems: 'center', justifyContent: 'center', marginLeft: 5, borderRadius: 12, backgroundColor: colors.accent },
  hudDoneDisabled: { opacity: 0.42 },
  hudDoneText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  coordinateCard: { position: 'absolute', left: SPACING.md, right: SPACING.md, bottom: 92, minHeight: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 9, elevation: 5 },
  coordinateCardIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raisedSurface },
  coordinateCardCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.sm },
  coordinateCardLabel: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  coordinateCardValue: { color: colors.bodyText, fontSize: 12, fontWeight: '800', marginTop: 3 },
  coordinateClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
  measureBadge: { position: 'absolute', top: 84, left: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: colors.navy },
  measureBadgeText: { color: colors.white, fontSize: 12, fontWeight: '900' },
});
