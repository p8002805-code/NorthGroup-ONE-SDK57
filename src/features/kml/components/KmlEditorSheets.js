import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  KML_COLOUR_OPTIONS,
  KML_ICON_OPTIONS,
} from '../kmlDocument';
import {
  featureCoordinates,
  formatArea,
  formatCoordinateDetails,
  formatDistance,
  pathDistanceMetres,
  polygonAreaSquareMetres,
} from '../kmlGeometry';

function SheetFrame({ visible, title, eyebrow, onClose, children, scroll = false, footer = null }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(0)).current;
  const scrollThumbY = useRef(new Animated.Value(0)).current;
  const scrollOffset = useRef(0);
  const sheetHeight = useRef(0);
  const scrollViewportHeight = useRef(0);
  const scrollContentHeight = useRef(0);
  const dragStartedInChrome = useRef(false);
  const [scrollMetrics, setScrollMetrics] = useState({ viewport: 0, content: 0 });
  const updateScrollThumb = useCallback((offset = scrollOffset.current) => {
    const viewport = scrollViewportHeight.current;
    const content = scrollContentHeight.current;
    if (viewport <= 0 || content <= viewport) {
      scrollThumbY.setValue(0);
      return;
    }
    const trackHeight = Math.max(0, viewport - 16);
    const thumbHeight = Math.max(44, trackHeight * (viewport / content));
    const maximumOffset = Math.max(1, content - viewport);
    const travel = Math.max(0, trackHeight - thumbHeight);
    scrollThumbY.setValue(Math.max(0, Math.min(1, offset / maximumOffset)) * travel);
  }, [scrollThumbY]);
  const setScrollDimensions = useCallback((viewport, content) => {
    if (Number.isFinite(viewport)) scrollViewportHeight.current = viewport;
    if (Number.isFinite(content)) scrollContentHeight.current = content;
    setScrollMetrics({
      viewport: scrollViewportHeight.current,
      content: scrollContentHeight.current,
    });
    updateScrollThumb();
  }, [updateScrollThumb]);
  const finishDrag = useCallback((gesture) => {
    dragStartedInChrome.current = false;
    const closeDistance = Math.max(72, sheetHeight.current * 0.1);
    const projectedDistance = gesture.dy + Math.max(0, gesture.vy) * 140;
    if (projectedDistance > closeDistance || gesture.vy > 0.35) {
      Animated.timing(translateY, {
        toValue: Math.max(700, sheetHeight.current),
        duration: 165,
        useNativeDriver: true,
      }).start(() => {
        translateY.setValue(0);
        onClose();
      });
      return;
    }
    Animated.spring(translateY, {
      toValue: 0,
      damping: 20,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [onClose, translateY]);
  const resetDrag = useCallback(() => {
    dragStartedInChrome.current = false;
    Animated.spring(translateY, {
      toValue: 0,
      damping: 20,
      stiffness: 230,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [translateY]);
  const sheetPanResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => (
      Math.abs(gesture.dy) > 5
      && Math.abs(gesture.dy) > Math.abs(gesture.dx)
      && (dragStartedInChrome.current || (scrollOffset.current <= 0 && gesture.dy > 0))
    ),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      (dragStartedInChrome.current || scrollOffset.current <= 0)
      && gesture.dy > 5
      && Math.abs(gesture.dy) > Math.abs(gesture.dx)
    ),
    onPanResponderGrant: () => {
      Keyboard.dismiss();
      translateY.stopAnimation();
    },
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, gesture) => {
      translateY.setValue(Math.max(-18, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture) => finishDrag(gesture),
    onPanResponderTerminate: resetDrag,
  }), [finishDrag, resetDrag, translateY]);

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      scrollThumbY.setValue(0);
      scrollOffset.current = 0;
    }
  }, [scrollThumbY, translateY, visible]);

  const scrollTrackHeight = Math.max(0, scrollMetrics.viewport - 16);
  const scrollThumbHeight = scrollMetrics.content > scrollMetrics.viewport
    ? Math.max(44, scrollTrackHeight * (scrollMetrics.viewport / scrollMetrics.content))
    : 0;
  const showScrollThumb = scroll && scrollThumbHeight > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalShade}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <Animated.View
            style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg, transform: [{ translateY }] }]}
            onLayout={(event) => { sheetHeight.current = event.nativeEvent.layout.height; }}
            {...sheetPanResponder.panHandlers}
          >
            <View
              style={styles.sheetChrome}
              onTouchStart={() => { dragStartedInChrome.current = true; }}
              onTouchEnd={() => { dragStartedInChrome.current = false; }}
              onTouchCancel={() => { dragStartedInChrome.current = false; }}
            >
              <View
                style={styles.handleTouch}
                accessibilityLabel="Draggable sheet handle"
                accessibilityHint="Drag down to return to the map"
              >
                <View style={styles.handle} />
              </View>
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleCopy}>
                  {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
                  <Text style={styles.sheetTitle}>{title}</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
                  <Ionicons name="close" size={22} color={colors.bodyText} />
                </Pressable>
              </View>
            </View>
            {scroll ? (
              <View
                style={styles.sheetBody}
                onLayout={(event) => setScrollDimensions(event.nativeEvent.layout.height, undefined)}
              >
                <ScrollView
                  style={styles.sheetScroll}
                  contentContainerStyle={styles.sheetScrollContent}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  scrollEventThrottle={16}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(_width, height) => setScrollDimensions(undefined, height)}
                  onScroll={(event) => {
                    scrollOffset.current = Math.max(0, event.nativeEvent.contentOffset.y);
                    updateScrollThumb(scrollOffset.current);
                  }}
                >
                  {children}
                </ScrollView>
                {showScrollThumb ? (
                  <View pointerEvents="none" style={[styles.scrollTrack, { height: scrollTrackHeight }]}>
                    <Animated.View
                      style={[
                        styles.scrollThumb,
                        { height: scrollThumbHeight, transform: [{ translateY: scrollThumbY }] },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            ) : (
              <View>{children}</View>
            )}
            {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function LayerPicker({ layers, feature, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const available = (layers || []).filter((layer) => layer.name);
  const rootLayer = available.find((layer) => layer.isRoot);
  const rootId = rootLayer?.id || null;
  const [browsing, setBrowsing] = useState(false);
  const [parentId, setParentId] = useState(rootId);
  const selected = available.find((layer) => layer.id === feature.folderId);
  const currentParent = available.find((layer) => layer.id === parentId);
  const folders = available.filter((layer) => layer.parentId === parentId);

  useEffect(() => {
    if (!browsing) setParentId(selected?.parentId || rootId);
  }, [browsing, rootId, selected?.parentId]);

  if (!available.length) return null;
  return (
    <>
      <Text style={styles.inputLabel}>KML FOLDER</Text>
      <Pressable style={styles.selectedFolder} onPress={() => setBrowsing((current) => !current)}>
        <View style={styles.selectedFolderIcon}><Ionicons name="folder" size={18} color={colors.accentDark} /></View>
        <View style={styles.selectedFolderCopy}>
          <Text style={styles.selectedFolderName} numberOfLines={1}>{selected?.name || 'Choose a folder'}</Text>
          <Text style={styles.selectedFolderPath} numberOfLines={1}>
            {selected?.path?.length ? selected.path.join(' / ') : 'This feature is stored at the KML document level'}
          </Text>
        </View>
        <Text style={styles.changeFolderText}>{browsing ? 'DONE' : 'CHANGE'}</Text>
      </Pressable>
      {browsing ? (
        <View style={styles.folderBrowser}>
          <View style={styles.folderBrowserHeader}>
            {parentId !== rootId ? (
              <Pressable style={styles.folderBack} onPress={() => setParentId(currentParent?.parentId || rootId)}>
                <Ionicons name="chevron-back" size={18} color={colors.bodyText} />
              </Pressable>
            ) : null}
            <Text style={styles.folderBrowserTitle} numberOfLines={1}>{currentParent?.name || 'Top-level folders'}</Text>
          </View>
          {parentId === rootId && rootLayer ? (
            <View style={[styles.folderChoiceRow, feature.folderId === rootId && styles.folderChoiceRowActive]}>
              <Pressable
                style={styles.folderChoiceMain}
                onPress={() => onChange({
                  ...feature,
                  folderId: rootId,
                  folderName: rootLayer.name,
                  folderPath: [],
                })}
              >
                <Ionicons name="document-outline" size={17} color={feature.folderId === rootId ? colors.navy : colors.accentDark} />
                <Text style={[styles.folderChoiceText, feature.folderId === rootId && styles.folderChoiceTextActive]} numberOfLines={1}>
                  {rootLayer.name} · Unfiled
                </Text>
                {feature.folderId === rootId ? <Ionicons name="checkmark" size={18} color={colors.navy} /> : null}
              </Pressable>
            </View>
          ) : null}
          {folders.map((layer) => {
            const active = feature.folderId === layer.id;
            const hasChildren = available.some((candidate) => candidate.parentId === layer.id);
            return (
              <View key={layer.id} style={[styles.folderChoiceRow, active && styles.folderChoiceRowActive]}>
                <Pressable
                  style={styles.folderChoiceMain}
                  onPress={() => onChange({
                    ...feature,
                    folderId: layer.id,
                    folderName: layer.name,
                    folderPath: layer.path || [],
                  })}
                >
                  <Ionicons name={active ? 'folder-open' : 'folder-outline'} size={17} color={active ? colors.navy : colors.accentDark} />
                  <Text style={[styles.folderChoiceText, active && styles.folderChoiceTextActive]} numberOfLines={1}>{layer.name}</Text>
                  {active ? <Ionicons name="checkmark" size={18} color={colors.navy} /> : null}
                </Pressable>
                {hasChildren ? (
                  <Pressable style={styles.folderDrillButton} onPress={() => setParentId(layer.id)} accessibilityLabel={`Open ${layer.name} folder`}>
                    <Ionicons name="chevron-forward" size={18} color={active ? colors.navy : colors.supportingText} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {!folders.length ? <Text style={styles.folderEmpty}>No folders inside this folder.</Text> : null}
        </View>
      ) : null}
    </>
  );
}

export function PinEditorSheet({
  visible,
  pin,
  layers,
  layerHidden,
  appleCalibrationAvailable = false,
  appleCalibrationActive = false,
  onChange,
  onToggleLayer,
  onDirections,
  onCalibrate,
  onCancel,
  onApply,
  onDelete,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!pin) return null;
  const pinLayer = (layers || []).find((layer) => layer.id === pin.folderId);
  const changeStyle = (style) => onChange({
    ...pin,
    style: { ...(pin.style || {}), ...style },
    styleEdited: true,
  });

  return (
    <SheetFrame
      visible={visible}
      eyebrow={pin.isNew ? 'NEW KML PIN' : 'EDIT KML PIN'}
      title={pin.name || 'Untitled pin'}
      onClose={onCancel}
      scroll
      footer={(
        <View style={styles.stickyActionRow}>
          {!pin.isNew ? (
            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          ) : <View />}
          <Pressable style={styles.primaryButton} onPress={() => { Keyboard.dismiss(); onApply(); }}>
            <Text style={styles.primaryButtonText}>{pin.isNew ? 'Add pin' : 'Save changes'}</Text>
          </Pressable>
        </View>
      )}
    >
      {!pin.isNew ? (
        <View style={styles.geometryQuickActions}>
          <Pressable style={styles.geometryQuickAction} onPress={onDirections}>
            <View style={styles.geometryActionIcon}><Ionicons name="navigate-outline" size={19} color={colors.accentDark} /></View>
            <View style={styles.geometryActionCopy}>
              <Text style={styles.geometryActionTitle}>Drive to this pin</Text>
              <Text style={styles.geometryActionDetail}>Choose Apple Maps or Google Maps</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
          </Pressable>
          {appleCalibrationAvailable ? (
            <Pressable style={styles.geometryQuickAction} onPress={onCalibrate}>
              <View style={styles.geometryActionIcon}><Ionicons name="locate-outline" size={19} color={colors.accentDark} /></View>
              <View style={styles.geometryActionCopy}>
                <Text style={styles.geometryActionTitle}>{appleCalibrationActive ? 'Check Apple alignment' : 'Align Apple imagery here'}</Text>
                <Text style={styles.geometryActionDetail}>Uses this pin as a control point; stored coordinates stay unchanged</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.inputLabel}>NAME</Text>
      <TextInput
        value={pin.name}
        onChangeText={(name) => onChange({ ...pin, name })}
        style={styles.input}
        placeholder="Pin name"
        placeholderTextColor={colors.placeholderText}
      />
      <Text style={styles.inputLabel}>NOTES</Text>
      <TextInput
        value={pin.notes}
        onChangeText={(notes) => onChange({ ...pin, notes })}
        style={[styles.input, styles.notesInput]}
        placeholder="Site notes, access details or instructions"
        placeholderTextColor={colors.placeholderText}
        multiline
        textAlignVertical="top"
      />
      <View style={styles.layerStyleNotice}>
        <View style={styles.layerStyleNoticeIcon}>
          <Ionicons name="layers-outline" size={18} color={colors.accentDark} />
        </View>
        <View style={styles.layerStyleNoticeCopy}>
          <Text style={styles.layerStyleNoticeTitle}>STYLE APPLIES TO {pinLayer?.name?.toUpperCase() || 'THIS LAYER'}</Text>
          <Text style={styles.layerStyleNoticeText}>Icon, colour and size will update every pin in this layer. Name, notes and position stay specific to this pin.</Text>
        </View>
      </View>
      {!pin.isNew && pinLayer && !pinLayer.isRoot ? (
        <View style={styles.pinLayerVisibility}>
          <View style={styles.pinLayerVisibilityIcon}>
            <Ionicons name={layerHidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.accentDark} />
          </View>
          <View style={styles.pinLayerVisibilityCopy}>
            <Text style={styles.pinLayerVisibilityTitle}>Show {pinLayer.name}</Text>
            <Text style={styles.pinLayerVisibilityDetail}>Turn this off to hide the whole layer from the map</Text>
          </View>
          <Switch
            value={!layerHidden}
            onValueChange={() => onToggleLayer?.(pinLayer.id)}
            trackColor={{ false: colors.borderStrong, true: colors.accent }}
            thumbColor={colors.white}
          />
        </View>
      ) : null}
      <Text style={styles.inputLabel}>LAYER PIN ICON</Text>
      <View style={styles.optionGrid}>
        {KML_ICON_OPTIONS.map((option) => (
          <OptionButton
            key={option.id}
            active={pin.style?.icon === option.id}
            icon={option.icon}
            label={option.label}
            onPress={() => changeStyle({ icon: option.id, iconHref: '' })}
          />
        ))}
      </View>
      <Text style={[styles.inputLabel, styles.inputLabelSpacing]}>LAYER PIN COLOUR</Text>
      <View style={styles.colourGrid}>
        {KML_COLOUR_OPTIONS.map((colour) => (
          <OptionButton
            key={colour}
            active={(pin.style?.color || '').toUpperCase() === colour}
            colour={colour}
            onPress={() => changeStyle({ color: colour })}
          />
        ))}
      </View>
      <Text style={[styles.inputLabel, styles.inputLabelSpacing]}>LAYER PIN SIZE</Text>
      <View style={styles.optionGrid}>
        {[{ label: 'Small', value: 0.8 }, { label: 'Normal', value: 1.1 }, { label: 'Large', value: 1.45 }].map((option) => (
          <OptionButton
            key={option.label}
            active={Math.abs(Number(pin.style?.scale || 1.1) - option.value) < 0.1}
            label={option.label}
            onPress={() => changeStyle({ scale: option.value })}
          />
        ))}
      </View>
      <View style={styles.editorDivider} />
      <LayerPicker layers={layers} feature={pin} onChange={onChange} />
      <View style={styles.coordinateRow}>
        <Ionicons name="location-outline" size={16} color={colors.accentDark} />
        <Text style={styles.coordinateText}>
          {pin.latitude.toFixed(7)}, {pin.longitude.toFixed(7)}
        </Text>
      </View>
      <Text style={styles.hint}>Drag the pin on the map to update its position.</Text>
      {appleCalibrationActive ? (
        <Text style={styles.calibrationCoordinateHint}>This is the original KML coordinate. Apple calibration only changes where the pin is drawn on screen.</Text>
      ) : null}
    </SheetFrame>
  );
}

export function GeometryEditorSheet({
  visible,
  feature,
  layers,
  featureHidden,
  onChange,
  onCancel,
  onApply,
  onDelete,
  onToggleVisibility,
  onEditVertices,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!feature) return null;
  const isPolygon = feature.type === 'polygon';
  const isExisting = !feature.isNew;
  const metric = isPolygon
    ? formatArea(polygonAreaSquareMetres(feature.coordinates))
    : formatDistance(pathDistanceMetres(feature.coordinates));
  const changeStyle = (style) => onChange({
    ...feature,
    style: { ...(feature.style || {}), ...style },
    styleEdited: true,
  });

  return (
    <SheetFrame
      visible={visible}
      eyebrow={isExisting ? (isPolygon ? 'EDIT KML AREA' : 'EDIT KML LINE') : (isPolygon ? 'NEW SURVEY AREA' : 'NEW SURVEY LINE')}
      title={feature.name || (isPolygon ? `Area · ${metric}` : `Distance · ${metric}`)}
      onClose={onCancel}
      scroll
      footer={(
        <View style={styles.stickyActionRow}>
          {isExisting ? (
            <Pressable style={styles.deleteButton} onPress={onDelete}>
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          ) : <View />}
          <Pressable style={styles.primaryButton} onPress={() => { Keyboard.dismiss(); onApply(); }}>
            <Text style={styles.primaryButtonText}>{isExisting ? 'Save changes' : 'Add to KML'}</Text>
          </Pressable>
        </View>
      )}
    >
      <Text style={styles.inputLabel}>NAME</Text>
      <TextInput
        value={feature.name}
        onChangeText={(name) => onChange({ ...feature, name })}
        style={styles.input}
        placeholder={isPolygon ? 'Survey area' : 'Survey line'}
        placeholderTextColor={colors.placeholderText}
      />
      <Text style={styles.inputLabel}>NOTES</Text>
      <TextInput
        value={feature.notes}
        onChangeText={(notes) => onChange({ ...feature, notes })}
        style={[styles.input, styles.notesInput]}
        placeholder="Add field notes or instructions"
        placeholderTextColor={colors.placeholderText}
        multiline
        textAlignVertical="top"
      />
      {isExisting ? (
        <View style={styles.geometryQuickActions}>
          <Pressable style={styles.geometryQuickAction} onPress={onEditVertices}>
            <View style={styles.geometryActionIcon}><Ionicons name="move-outline" size={19} color={colors.accentDark} /></View>
            <View style={styles.geometryActionCopy}>
              <Text style={styles.geometryActionTitle}>Edit vertices</Text>
              <Text style={styles.geometryActionDetail}>Move the corners and points on the map</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
          </Pressable>
          <Pressable style={styles.geometryQuickAction} onPress={onToggleVisibility}>
            <View style={styles.geometryActionIcon}>
              <Ionicons name={featureHidden ? 'eye-off-outline' : 'eye-outline'} size={19} color={colors.accentDark} />
            </View>
            <View style={styles.geometryActionCopy}>
              <Text style={styles.geometryActionTitle}>{featureHidden ? 'Show on map' : 'Hide from map'}</Text>
              <Text style={styles.geometryActionDetail}>Visibility only; the KML feature is not deleted</Text>
            </View>
          </Pressable>
        </View>
      ) : null}
      <Text style={[styles.inputLabel, styles.inputLabelSpacing]}>LINE COLOUR</Text>
      <View style={styles.colourGrid}>
        {KML_COLOUR_OPTIONS.map((colour) => (
          <OptionButton
            key={colour}
            active={(feature.style?.lineColor || '').toUpperCase() === colour}
            colour={colour}
            onPress={() => changeStyle({ lineColor: colour, ...(isPolygon ? { fillColor: colour } : {}) })}
          />
        ))}
      </View>
      <Text style={[styles.inputLabel, styles.inputLabelSpacing]}>LINE WIDTH</Text>
      <View style={styles.optionGrid}>
        {[{ label: 'Thin', value: 2 }, { label: 'Normal', value: 4 }, { label: 'Thick', value: 7 }].map((option) => (
          <OptionButton
            key={option.label}
            active={Number(feature.style?.lineWidth || 4) === option.value}
            label={option.label}
            onPress={() => changeStyle({ lineWidth: option.value })}
          />
        ))}
      </View>
      {isPolygon ? (
        <>
          <Text style={[styles.inputLabel, styles.inputLabelSpacing]}>AREA FILL</Text>
          <View style={styles.optionGrid}>
            {[{ label: 'None', value: 0 }, { label: 'Light', value: 0.18 }, { label: 'Normal', value: 0.3 }, { label: 'Strong', value: 0.5 }].map((option) => (
              <OptionButton
                key={option.label}
                active={Math.abs(Number(feature.style?.fillOpacity ?? 0.3) - option.value) < 0.02}
                label={option.label}
                onPress={() => changeStyle({ fillOpacity: option.value })}
              />
            ))}
          </View>
        </>
      ) : null}
      <View style={styles.editorDivider} />
      <LayerPicker layers={layers} feature={feature} onChange={onChange} />
      <Text style={styles.hint}>
        {feature.coordinates.length} vertices · {metric} · Changes are shared when you press the main KML Save button.
      </Text>
    </SheetFrame>
  );
}

const LayerToggle = ({ icon, label, detail, value, onChange }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.layerRow}>
      <View style={styles.layerIcon}><Ionicons name={icon} size={19} color={colors.accentDark} /></View>
      <View style={styles.layerCopy}>
        <Text style={styles.layerLabel}>{label}</Text>
        <Text style={styles.layerDetail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.borderStrong, true: colors.accent }}
        thumbColor={colors.white}
      />
    </View>
  );
};

const layerDetail = (layer) => {
  const parts = [];
  if (layer.childCount) parts.push(`${layer.childCount} ${layer.childCount === 1 ? 'folder' : 'folders'}`);
  if (layer.pinCount) parts.push(`${layer.pinCount} ${layer.pinCount === 1 ? 'pin' : 'pins'}`);
  if (layer.lineCount) parts.push(`${layer.lineCount} ${layer.lineCount === 1 ? 'line' : 'lines'}`);
  if (layer.polygonCount) parts.push(`${layer.polygonCount} ${layer.polygonCount === 1 ? 'area' : 'areas'}`);
  return parts.join(' · ') || 'Empty KML folder';
};

function KmlLayerRow({ layer, hidden, editDisabled = false, onToggle, onEdit, onOpen }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.kmlLayerRow}>
      <View style={[styles.layerColour, { backgroundColor: layer.style?.color || colors.accent }]}>
        <Ionicons name="folder" size={17} color={colors.navy} />
      </View>
      <Pressable style={styles.layerCopy} onPress={() => onOpen?.(layer)}>
        <Text style={styles.layerLabel} numberOfLines={1}>{layer.name}</Text>
        <Text style={styles.layerDetail} numberOfLines={1}>
          {layerDetail(layer)}{layer.mixedStyle ? ' · Mixed styles' : ''}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.layerAction, editDisabled && styles.layerActionDisabled]}
        onPress={() => onEdit?.(layer)}
        disabled={editDisabled}
        accessibilityLabel={`Edit ${layer.name} layer style${editDisabled ? ', locked until zoomed closer' : ''}`}
        accessibilityState={{ disabled: editDisabled }}
      >
        <Ionicons name={editDisabled ? 'lock-closed-outline' : 'color-palette-outline'} size={20} color={editDisabled ? colors.placeholderText : colors.accentDark} />
      </Pressable>
      <Pressable style={styles.layerAction} onPress={() => onToggle(layer.id)} accessibilityLabel={hidden ? `Show ${layer.name}` : `Hide ${layer.name}`}>
        <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={21} color={hidden ? colors.supportingText : colors.accentDark} />
      </Pressable>
      {onOpen ? (
        <Pressable style={styles.layerDrillButton} onPress={() => onOpen(layer)} accessibilityLabel={`Open ${layer.name} folder`}>
          <Ionicons name="chevron-forward" size={19} color={colors.supportingText} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function LayersSheet({
  visible,
  mapType,
  mapProvider,
  showMapProviderChoice,
  googleProviderAvailable,
  appleCalibration,
  appleCalibrationOffset,
  visibility,
  layers,
  hiddenLayers,
  editingUnlocked = true,
  onMapType,
  onMapProvider,
  onChooseCalibrationPin,
  onToggleAppleCalibration,
  onResetAppleCalibration,
  onVisibility,
  onToggleLayer,
  onEditLayer,
  onClose,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const mapTypes = [
    { id: 'standard', label: 'Map' },
    { id: 'satellite', label: 'Satellite' },
    { id: 'hybrid', label: 'Hybrid' },
  ];
  const rootId = (layers || []).find((layer) => layer.isRoot)?.id || null;
  const rootLayer = (layers || []).find((layer) => layer.isRoot);
  const [folderId, setFolderId] = useState(rootId);
  const currentFolder = (layers || []).find((layer) => layer.id === folderId && !layer.isRoot);
  const childFolders = (layers || []).filter((layer) => !layer.isRoot && layer.parentId === folderId);

  useEffect(() => {
    if (visible) setFolderId(rootId);
  }, [rootId, visible]);

  return (
    <SheetFrame visible={visible} eyebrow="MAP DISPLAY" title="Layers" onClose={onClose} scroll>
      {showMapProviderChoice ? (
        <>
          <Text style={styles.sectionLabel}>IMAGERY SOURCE</Text>
          <View style={styles.segmented}>
            <Pressable
              style={[styles.segment, mapProvider === 'apple' && styles.segmentActive]}
              onPress={() => onMapProvider('apple')}
            >
              <Text style={[styles.segmentText, mapProvider === 'apple' && styles.segmentTextActive]}>Apple detail</Text>
            </Pressable>
            <Pressable
              style={[
                styles.segment,
                mapProvider === 'google' && styles.segmentActive,
                !googleProviderAvailable && styles.segmentDisabled,
              ]}
              disabled={!googleProviderAvailable}
              onPress={() => onMapProvider('google')}
            >
              <Text style={[
                styles.segmentText,
                mapProvider === 'google' && styles.segmentTextActive,
                !googleProviderAvailable && styles.segmentTextDisabled,
              ]}>Google alignment</Text>
            </Pressable>
          </View>
          <Text style={styles.mapProviderHint}>
            {googleProviderAvailable
              ? 'Apple keeps the high-detail imagery. Google alignment gives the closest visual comparison with Google Earth.'
              : 'Google alignment becomes available in a Google Maps-enabled app build. Apple detail remains fully available.'}
          </Text>
          {mapProvider === 'apple' ? (
            <View style={styles.calibrationPanel}>
              <View style={styles.calibrationHeader}>
                <View style={styles.calibrationIcon}>
                  <Ionicons name={appleCalibration?.enabled ? 'checkmark-circle' : 'locate-outline'} size={20} color={colors.accentDark} />
                </View>
                <View style={styles.calibrationCopy}>
                  <Text style={styles.calibrationTitle}>
                    {appleCalibration?.exists
                      ? (appleCalibration.enabled ? 'APPLE CALIBRATION ACTIVE' : 'APPLE CALIBRATION PAUSED')
                      : 'APPLE IMAGERY NOT CALIBRATED'}
                  </Text>
                  <Text style={styles.calibrationDetail}>
                    {appleCalibration?.exists
                      ? `${appleCalibrationOffset} · ${appleCalibration.referencePinName || 'Control pin'}`
                      : 'Match one trusted survey pin to the same object in Apple imagery.'}
                  </Text>
                </View>
                {appleCalibration?.exists ? (
                  <Switch
                    value={Boolean(appleCalibration.enabled)}
                    onValueChange={onToggleAppleCalibration}
                    trackColor={{ false: colors.borderStrong, true: colors.accent }}
                    thumbColor={colors.white}
                  />
                ) : null}
              </View>
              <View style={styles.calibrationActions}>
                <Pressable style={styles.calibrationPrimaryButton} onPress={onChooseCalibrationPin}>
                  <Ionicons name="location-outline" size={17} color={colors.navy} />
                  <Text style={styles.calibrationPrimaryText}>{appleCalibration?.exists ? 'CHECK WITH ANOTHER PIN' : 'CHOOSE CONTROL PIN'}</Text>
                </Pressable>
                {appleCalibration?.exists ? (
                  <Pressable style={styles.calibrationResetButton} onPress={onResetAppleCalibration} accessibilityLabel="Reset Apple imagery calibration">
                    <Ionicons name="trash-outline" size={18} color={colors.danger} />
                  </Pressable>
                ) : null}
              </View>
              <Text style={styles.calibrationSafety}>Display only · never written into the shared KML.</Text>
            </View>
          ) : null}
        </>
      ) : null}
      <Text style={[styles.sectionLabel, showMapProviderChoice && styles.sectionSpacing]}>BASE MAP</Text>
      <View style={styles.segmented}>
        {mapTypes.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.segment, mapType === item.id && styles.segmentActive]}
            onPress={() => onMapType(item.id)}
          >
            <Text style={[styles.segmentText, mapType === item.id && styles.segmentTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>KML FOLDERS & LAYERS</Text>
      <Text style={styles.mapProviderHint}>Visibility is saved automatically to your personal job view. It never changes the shared KML.</Text>
      {!currentFolder && rootLayer ? (
        <>
          <Text style={styles.currentFolderLabel}>KML DOCUMENT</Text>
          <KmlLayerRow
            layer={rootLayer}
            hidden={Boolean(hiddenLayers?.[rootLayer.id])}
            editDisabled={!editingUnlocked}
            onToggle={onToggleLayer}
            onEdit={onEditLayer}
          />
          {childFolders.length ? <Text style={styles.currentFolderLabel}>FOLDERS INSIDE</Text> : null}
        </>
      ) : null}
      {currentFolder ? (
        <>
          <Pressable style={styles.folderTrail} onPress={() => setFolderId(currentFolder.parentId || rootId)}>
            <Ionicons name="chevron-back" size={18} color={colors.bodyText} />
            <View style={styles.folderTrailCopy}>
              <Text style={styles.folderTrailLabel}>BACK</Text>
              <Text style={styles.folderTrailTitle} numberOfLines={1}>{currentFolder.path?.join(' / ') || currentFolder.name}</Text>
            </View>
          </Pressable>
          <Text style={styles.currentFolderLabel}>CURRENT FOLDER</Text>
          <KmlLayerRow
            layer={currentFolder}
            hidden={Boolean(hiddenLayers?.[currentFolder.id])}
            editDisabled={!editingUnlocked}
            onToggle={onToggleLayer}
            onEdit={onEditLayer}
          />
          <Text style={styles.currentFolderLabel}>FOLDERS INSIDE</Text>
        </>
      ) : null}
      {childFolders.map((layer) => (
        <KmlLayerRow
          key={layer.id}
          layer={layer}
          hidden={Boolean(hiddenLayers?.[layer.id])}
          editDisabled={!editingUnlocked}
          onToggle={onToggleLayer}
          onEdit={onEditLayer}
          onOpen={(item) => setFolderId(item.id)}
        />
      ))}
      {!childFolders.length ? (
        <Text style={styles.emptyFolderText}>
          {currentFolder
            ? 'No folders inside this layer.'
            : `All features are stored directly in ${rootLayer?.name || 'this KML document'}.`}
        </Text>
      ) : null}
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>FEATURE TYPES</Text>
      <LayerToggle icon="location" label="Pins" detail="Names and notes" value={visibility.pins} onChange={(pins) => onVisibility({ ...visibility, pins })} />
      <LayerToggle icon="git-commit-outline" label="Lines" detail="Existing and survey lines" value={visibility.lines} onChange={(lines) => onVisibility({ ...visibility, lines })} />
      <LayerToggle icon="shapes-outline" label="Areas" detail="KML polygons and survey areas" value={visibility.polygons} onChange={(polygons) => onVisibility({ ...visibility, polygons })} />
    </SheetFrame>
  );
}

const OptionButton = ({ active, label, icon, colour, onPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable style={[styles.optionButton, active && styles.optionButtonActive]} onPress={onPress}>
      {colour ? <View style={[styles.colourDot, { backgroundColor: colour }]} /> : null}
      {icon ? <Ionicons name={icon} size={18} color={active ? colors.navy : colors.accentDark} /> : null}
      {label ? <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text> : null}
    </Pressable>
  );
};

export function LayerStyleSheet({ visible, layer, draft, onChange, onCancel, onApply }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!layer || !draft) return null;
  const hasPins = layer.pinCount > 0 || layer.featureCount === 0;
  const hasLines = layer.lineCount > 0 || layer.polygonCount > 0 || layer.featureCount === 0;
  const hasAreas = layer.polygonCount > 0 || layer.featureCount === 0;
  return (
    <SheetFrame visible={visible} eyebrow="KML LAYER STYLE" title={layer.name} onClose={onCancel} scroll>
      <Text style={styles.layerPath}>{layer.path?.length ? layer.path.join(' / ') : 'Top-level folder'} · {layerDetail(layer)}</Text>
      {hasPins ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>PIN ICON</Text>
          <View style={styles.optionGrid}>
            {KML_ICON_OPTIONS.map((option) => (
              <OptionButton key={option.id} active={draft.icon === option.id} icon={option.icon} label={option.label} onPress={() => onChange({ ...draft, icon: option.id, iconHref: '' })} />
            ))}
          </View>
          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>PIN SIZE</Text>
          <View style={styles.optionGrid}>
            {[{ label: 'Small', value: 0.8 }, { label: 'Normal', value: 1.1 }, { label: 'Large', value: 1.45 }].map((option) => (
              <OptionButton key={option.label} active={Math.abs(Number(draft.scale) - option.value) < 0.1} label={option.label} onPress={() => onChange({ ...draft, scale: option.value })} />
            ))}
          </View>
        </>
      ) : null}
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>LAYER COLOUR</Text>
      <View style={styles.colourGrid}>
        {KML_COLOUR_OPTIONS.map((colour) => (
          <OptionButton
            key={colour}
            active={(draft.color || '').toUpperCase() === colour}
            colour={colour}
            onPress={() => onChange({ ...draft, color: colour, lineColor: colour, fillColor: colour })}
          />
        ))}
      </View>
      {hasLines ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>LINE WIDTH</Text>
          <View style={styles.optionGrid}>
            {[{ label: 'Thin', value: 2 }, { label: 'Normal', value: 4 }, { label: 'Thick', value: 7 }].map((option) => (
              <OptionButton key={option.label} active={Number(draft.lineWidth) === option.value} label={option.label} onPress={() => onChange({ ...draft, lineWidth: option.value })} />
            ))}
          </View>
        </>
      ) : null}
      {hasAreas ? (
        <>
          <Text style={[styles.sectionLabel, styles.sectionSpacing]}>AREA FILL</Text>
          <View style={styles.optionGrid}>
            {[{ label: 'Light', value: 0.18 }, { label: 'Normal', value: 0.3 }, { label: 'Strong', value: 0.5 }].map((option) => (
              <OptionButton key={option.label} active={Math.abs(Number(draft.fillOpacity) - option.value) < 0.02} label={option.label} onPress={() => onChange({ ...draft, fillOpacity: option.value })} />
            ))}
          </View>
        </>
      ) : null}
      <Text style={styles.hint}>Applying this style updates supported features in this folder and its nested folders.</Text>
      <View style={styles.actionRowEnd}>
        <Pressable style={styles.secondaryButton} onPress={onCancel}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
        <Pressable style={styles.primaryButton} onPress={onApply}><Text style={styles.primaryButtonText}>Apply to layer</Text></Pressable>
      </View>
    </SheetFrame>
  );
}

const featureIcon = (type) => {
  if (type === 'pin') return 'location';
  if (type === 'line') return 'git-commit-outline';
  return 'shapes-outline';
};

const featureMeta = (feature) => {
  const coordinates = featureCoordinates(feature);
  if (feature.type === 'line') return `${coordinates.length} vertices · ${formatDistance(pathDistanceMetres(coordinates))}`;
  if (feature.type === 'polygon') return `${coordinates.length} vertices · ${formatArea(polygonAreaSquareMetres(coordinates))}`;
  return formatCoordinateDetails(coordinates[0]).decimal;
};

export function FeatureBrowserSheet({
  visible,
  features,
  layers,
  hidden,
  hiddenLayers,
  initialQuery = '',
  eyebrow = 'SHARED JOB KML',
  title = 'Features',
  searchPlaceholder = 'Search pins, lines, areas or notes',
  showVisibility = true,
  onToggle,
  onToggleLayer,
  onSelect,
  onClose,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState(initialQuery);
  const rootId = (layers || []).find((layer) => layer.isRoot)?.id || null;
  const [folderId, setFolderId] = useState(rootId);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return features;
    return features.filter((feature) => (
      `${feature.name || ''} ${feature.notes || ''} ${feature.type} ${(feature.folderPath || []).join(' ')}`.toLowerCase().includes(needle)
    ));
  }, [features, query]);
  const currentFolder = (layers || []).find((layer) => layer.id === folderId && !layer.isRoot);
  const childFolders = (layers || []).filter((layer) => !layer.isRoot && layer.parentId === folderId);
  const directFeatures = filtered.filter((feature) => feature.folderId === folderId);
  const isSearching = Boolean(query.trim());

  useEffect(() => {
    if (visible) {
      setFolderId(rootId);
      setQuery(initialQuery);
    }
  }, [initialQuery, rootId, visible]);

  const renderFeature = (feature) => {
    const isHidden = Boolean(hidden?.[feature.id]);
    return (
      <View key={`${feature.type}-${feature.id}`} style={styles.featureRow}>
        <Pressable style={styles.featureMain} onPress={() => onSelect(feature)}>
          <View style={[styles.featureIcon, { borderColor: feature.style?.color || colors.borderStrong }]}>
            <Ionicons name={featureIcon(feature.type)} size={18} color={feature.style?.color || colors.accentDark} />
          </View>
          <View style={styles.featureCopy}>
            <Text style={styles.featureName} numberOfLines={1}>{feature.name || `Untitled ${feature.type}`}</Text>
            <Text style={styles.featureMeta} numberOfLines={1}>
              {isSearching && feature.folderPath?.length ? `${feature.folderPath.join(' / ')} · ` : ''}{featureMeta(feature)}
            </Text>
          </View>
        </Pressable>
        {showVisibility ? (
          <Pressable style={styles.visibilityButton} onPress={() => onToggle(feature.id)} accessibilityLabel={isHidden ? 'Show feature' : 'Hide feature'}>
            <Ionicons name={isHidden ? 'eye-off-outline' : 'eye-outline'} size={21} color={isHidden ? colors.supportingText : colors.accentDark} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <SheetFrame visible={visible} eyebrow={eyebrow} title={title} onClose={onClose} scroll>
      <View style={styles.searchInputWrap}>
        <Ionicons name="search" size={19} color={colors.supportingText} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.placeholderText}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={19} color={colors.supportingText} />
          </Pressable>
        ) : null}
      </View>
      {isSearching ? (
        <>
          <Text style={styles.resultCount}>{filtered.length} {filtered.length === 1 ? 'MATCH' : 'MATCHES'}</Text>
          {filtered.map(renderFeature)}
        </>
      ) : (
        <>
          {currentFolder ? (
            <>
              <Pressable style={styles.folderTrail} onPress={() => setFolderId(currentFolder.parentId || rootId)}>
                <Ionicons name="chevron-back" size={18} color={colors.bodyText} />
                <View style={styles.folderTrailCopy}>
                  <Text style={styles.folderTrailLabel}>BACK</Text>
                  <Text style={styles.folderTrailTitle} numberOfLines={1}>{currentFolder.path?.join(' / ') || currentFolder.name}</Text>
                </View>
              </Pressable>
              {showVisibility ? <View style={styles.currentLayerVisibility}>
                <View style={[styles.featureFolderIcon, { backgroundColor: currentFolder.style?.color || colors.accent }]}>
                  <Ionicons name="folder" size={18} color={colors.navy} />
                </View>
                <View style={styles.featureGroupCopy}>
                  <Text style={styles.featureGroupName} numberOfLines={1}>{currentFolder.name}</Text>
                  <Text style={styles.featureGroupMeta}>Show this whole layer on the map</Text>
                </View>
                <Switch
                  value={!hiddenLayers?.[currentFolder.id]}
                  onValueChange={() => onToggleLayer?.(currentFolder.id)}
                  trackColor={{ false: colors.borderStrong, true: colors.accent }}
                  thumbColor={colors.white}
                />
              </View> : null}
            </>
          ) : null}
          <Text style={styles.resultCount}>
            {currentFolder ? `${currentFolder.name.toUpperCase()} · ` : ''}{childFolders.length} {childFolders.length === 1 ? 'FOLDER' : 'FOLDERS'} · {directFeatures.length} {directFeatures.length === 1 ? 'FEATURE' : 'FEATURES'}
          </Text>
          {childFolders.map((layer) => {
            const layerHidden = Boolean(hiddenLayers?.[layer.id]);
            return (
              <View key={layer.id} style={styles.featureFolderRow}>
                <Pressable style={styles.featureFolderMain} onPress={() => setFolderId(layer.id)}>
                  <View style={[styles.featureFolderIcon, { backgroundColor: layer.style?.color || colors.accent }]}> 
                    <Ionicons name="folder" size={18} color={colors.navy} />
                  </View>
                  <View style={styles.featureGroupCopy}>
                    <Text style={styles.featureGroupName} numberOfLines={1}>{layer.name}</Text>
                    <Text style={styles.featureGroupMeta} numberOfLines={1}>{layerDetail(layer)}</Text>
                  </View>
                </Pressable>
                {showVisibility ? (
                  <Pressable
                    style={styles.visibilityButton}
                    onPress={() => onToggleLayer?.(layer.id)}
                    accessibilityLabel={layerHidden ? `Show ${layer.name} layer` : `Hide ${layer.name} layer`}
                  >
                    <Ionicons name={layerHidden ? 'eye-off-outline' : 'eye-outline'} size={21} color={layerHidden ? colors.supportingText : colors.accentDark} />
                  </Pressable>
                ) : null}
                <Pressable style={styles.folderChevron} onPress={() => setFolderId(layer.id)} accessibilityLabel={`Open ${layer.name} layer`}>
                  <Ionicons name="chevron-forward" size={19} color={colors.supportingText} />
                </Pressable>
              </View>
            );
          })}
          {folderId === rootId && directFeatures.length ? <Text style={styles.unfiledLabel}>UNFILED FEATURES</Text> : null}
          {directFeatures.map(renderFeature)}
        </>
      )}
      {isSearching && !filtered.length ? <Text style={styles.emptyText}>No matching KML features.</Text> : null}
      {!isSearching && !childFolders.length && !directFeatures.length ? <Text style={styles.emptyText}>This folder has no features or nested folders.</Text> : null}
    </SheetFrame>
  );
}

export function CoordinateSheet({ visible, coordinate, onClose }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState('');
  if (!coordinate) return null;
  const details = formatCoordinateDetails(coordinate);
  const copy = async (label, value) => {
    await Clipboard.setStringAsync(value);
    setCopied(label);
  };

  return (
    <SheetFrame visible={visible} eyebrow="MAP POSITION" title="Coordinate details" onClose={onClose}>
      <Pressable style={styles.coordinateCard} onPress={() => copy('Decimal degrees', details.decimal)}>
        <View style={styles.coordinateCardCopy}>
          <Text style={styles.coordinateFormat}>DECIMAL DEGREES</Text>
          <Text style={styles.coordinateValue}>{details.decimal}</Text>
        </View>
        <Ionicons name={copied === 'Decimal degrees' ? 'checkmark' : 'copy-outline'} size={20} color={colors.accentDark} />
      </Pressable>
      <Pressable style={styles.coordinateCard} onPress={() => copy('DMS', details.dms)}>
        <View style={styles.coordinateCardCopy}>
          <Text style={styles.coordinateFormat}>DEGREES, MINUTES, SECONDS</Text>
          <Text style={styles.coordinateValue}>{details.dms}</Text>
        </View>
        <Ionicons name={copied === 'DMS' ? 'checkmark' : 'copy-outline'} size={20} color={colors.accentDark} />
      </Pressable>
      <Text style={styles.hint}>Tap either coordinate to copy it.</Text>
    </SheetFrame>
  );
}

const createStyles = (colors) => StyleSheet.create({
  modalKeyboard: { flex: 1 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '88%',
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.cardBackground,
  },
  sheetChrome: { marginHorizontal: -SPACING.lg, paddingHorizontal: SPACING.lg },
  handleTouch: { minHeight: 44, alignItems: 'center', justifyContent: 'flex-start', marginTop: -SPACING.sm, paddingTop: SPACING.sm },
  handle: { width: 54, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: SPACING.lg },
  sheetTitleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  sheetTitle: { color: colors.bodyText, fontSize: 22, fontWeight: '900', marginTop: 3 },
  closeButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raisedSurface },
  sheetBody: { position: 'relative', flexShrink: 1, minHeight: 0 },
  sheetScroll: { flexGrow: 0 },
  sheetScrollContent: { paddingRight: SPACING.sm, paddingBottom: SPACING.sm },
  scrollTrack: { position: 'absolute', top: 8, right: -10, width: 4, borderRadius: 2, backgroundColor: colors.border },
  scrollThumb: { width: 4, borderRadius: 2, backgroundColor: colors.accentDark },
  sheetFooter: { paddingTop: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.cardBackground },
  inputLabel: { color: colors.accentDark, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 7 },
  inputLabelSpacing: { marginTop: SPACING.lg },
  input: { minHeight: 48, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.inputBackground, color: colors.inputText, fontSize: 15, marginBottom: SPACING.lg },
  notesInput: { minHeight: 104, paddingTop: SPACING.md },
  selectedFolder: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  selectedFolderIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.cardBackground },
  selectedFolderCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.sm },
  selectedFolderName: { color: colors.bodyText, fontSize: 13, fontWeight: '900' },
  selectedFolderPath: { color: colors.supportingText, fontSize: 9, marginTop: 3 },
  changeFolderText: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  folderBrowser: { marginBottom: SPACING.lg, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBackground },
  folderBrowserHeader: { minHeight: 38, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.xs },
  folderBack: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  folderBrowserTitle: { flex: 1, color: colors.supportingText, fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  folderChoiceRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', marginTop: 5, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  folderChoiceRowActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  folderChoiceMain: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm },
  folderChoiceText: { flex: 1, color: colors.bodyText, fontSize: 12, fontWeight: '800', marginHorizontal: SPACING.sm },
  folderChoiceTextActive: { color: colors.navy },
  folderDrillButton: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderStrong },
  folderEmpty: { color: colors.supportingText, fontSize: 11, textAlign: 'center', paddingVertical: SPACING.lg },
  editorDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: SPACING.xl },
  pinLayerVisibility: { minHeight: 66, flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.md, paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.raisedSurface },
  pinLayerVisibilityIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.cardBackground },
  pinLayerVisibilityCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.sm },
  pinLayerVisibilityTitle: { color: colors.bodyText, fontSize: 12, fontWeight: '900' },
  pinLayerVisibilityDetail: { color: colors.supportingText, fontSize: 9, marginTop: 3 },
  layerStyleNotice: { flexDirection: 'row', alignItems: 'center', padding: SPACING.sm, marginBottom: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.raisedSurface },
  layerStyleNoticeIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.cardBackground },
  layerStyleNoticeCopy: { flex: 1, minWidth: 0, marginLeft: SPACING.sm },
  layerStyleNoticeTitle: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  layerStyleNoticeText: { color: colors.supportingText, fontSize: 10, lineHeight: 15, marginTop: 3 },
  geometryQuickActions: { marginBottom: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.raisedSurface },
  geometryQuickAction: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  geometryActionIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.cardBackground },
  geometryActionCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.sm },
  geometryActionTitle: { color: colors.bodyText, fontSize: 12, fontWeight: '900' },
  geometryActionDetail: { color: colors.supportingText, fontSize: 9, marginTop: 3 },
  coordinateRow: { flexDirection: 'row', alignItems: 'center' },
  coordinateText: { color: colors.bodyText, fontSize: 12, fontWeight: '800', marginLeft: 6 },
  hint: { color: colors.supportingText, fontSize: 11, lineHeight: 16, marginTop: SPACING.sm },
  calibrationCoordinateHint: { color: colors.accentDark, fontSize: 10, fontWeight: '700', lineHeight: 15, marginTop: SPACING.xs },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.xl },
  stickyActionRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actionRowEnd: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: SPACING.xl },
  deleteButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md },
  deleteText: { color: colors.danger, fontSize: 14, fontWeight: '900', marginLeft: 6 },
  primaryButton: { minHeight: 50, justifyContent: 'center', paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, backgroundColor: colors.accent, marginLeft: SPACING.sm },
  primaryButtonText: { color: colors.navy, fontSize: 14, fontWeight: '900' },
  secondaryButton: { minHeight: 50, justifyContent: 'center', paddingHorizontal: SPACING.xl, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong },
  secondaryButtonText: { color: colors.bodyText, fontSize: 14, fontWeight: '900' },
  sectionLabel: { color: colors.supportingText, fontSize: 9, fontWeight: '900', letterSpacing: 1.1, marginBottom: SPACING.sm },
  sectionSpacing: { marginTop: SPACING.xl },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: RADIUS.md, backgroundColor: colors.raisedSurface },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentActive: { backgroundColor: colors.accent },
  segmentDisabled: { opacity: 0.45 },
  segmentText: { color: colors.supportingText, fontSize: 12, fontWeight: '800' },
  segmentTextActive: { color: colors.navy },
  segmentTextDisabled: { color: colors.placeholderText },
  mapProviderHint: { marginTop: SPACING.sm, color: colors.supportingText, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  calibrationPanel: { marginTop: SPACING.md, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.raisedSurface },
  calibrationHeader: { flexDirection: 'row', alignItems: 'center' },
  calibrationIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.cardBackground },
  calibrationCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.sm },
  calibrationTitle: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  calibrationDetail: { color: colors.bodyText, fontSize: 10, fontWeight: '700', lineHeight: 15, marginTop: 3 },
  calibrationActions: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm },
  calibrationPrimaryButton: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: 12, backgroundColor: colors.accent },
  calibrationPrimaryText: { color: colors.navy, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, marginLeft: 6 },
  calibrationResetButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.xs, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cardBackground },
  calibrationSafety: { color: colors.supportingText, fontSize: 9, fontWeight: '700', marginTop: SPACING.xs, textAlign: 'center' },
  layerRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  layerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raisedSurface },
  layerCopy: { flex: 1, minWidth: 0, paddingHorizontal: SPACING.md },
  layerLabel: { color: colors.bodyText, fontSize: 14, fontWeight: '900' },
  layerDetail: { color: colors.supportingText, fontSize: 11, marginTop: 2 },
  kmlLayerRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  layerColour: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  layerAction: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  layerActionDisabled: { opacity: 0.55 },
  layerDrillButton: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
  folderTrail: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.raisedSurface },
  folderTrailCopy: { flex: 1, minWidth: 0, marginLeft: SPACING.xs },
  folderTrailLabel: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  folderTrailTitle: { color: colors.bodyText, fontSize: 12, fontWeight: '800', marginTop: 3 },
  currentFolderLabel: { color: colors.supportingText, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: SPACING.md, marginBottom: SPACING.xs },
  emptyFolderText: { color: colors.supportingText, fontSize: 11, textAlign: 'center', paddingVertical: SPACING.lg },
  layerPath: { color: colors.supportingText, fontSize: 11, lineHeight: 16, marginBottom: SPACING.sm },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  optionButton: { minWidth: 72, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm, margin: 3, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  optionButtonActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  optionText: { color: colors.bodyText, fontSize: 11, fontWeight: '800', marginLeft: 5 },
  optionTextActive: { color: colors.navy },
  colourGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -3 },
  colourDot: { width: 25, height: 25, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  searchInputWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, backgroundColor: colors.raisedSurface, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.inputText, fontSize: 14, marginHorizontal: SPACING.sm },
  resultCount: { color: colors.supportingText, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  featureRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  featureMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raisedSurface, borderWidth: 1 },
  featureCopy: { flex: 1, minWidth: 0, paddingHorizontal: SPACING.md },
  featureName: { color: colors.bodyText, fontSize: 14, fontWeight: '900' },
  featureMeta: { color: colors.supportingText, fontSize: 10, marginTop: 3 },
  visibilityButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  featureGroup: { marginBottom: SPACING.xs },
  featureGroupHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.raisedSurface },
  featureGroupCopy: { flex: 1, minWidth: 0, marginHorizontal: SPACING.sm },
  featureGroupName: { color: colors.bodyText, fontSize: 13, fontWeight: '900' },
  featureGroupMeta: { color: colors.supportingText, fontSize: 9, marginTop: 2 },
  featureFolderRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  featureFolderMain: { flex: 1, minWidth: 0, minHeight: 62, flexDirection: 'row', alignItems: 'center' },
  featureFolderIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  folderChevron: { width: 30, height: 44, alignItems: 'center', justifyContent: 'center' },
  currentLayerVisibility: { minHeight: 66, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.sm, marginBottom: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  unfiledLabel: { color: colors.supportingText, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, marginTop: SPACING.lg, marginBottom: SPACING.xs },
  emptyText: { color: colors.supportingText, fontSize: 13, textAlign: 'center', paddingVertical: SPACING.xxl },
  coordinateCard: { minHeight: 72, flexDirection: 'row', alignItems: 'center', padding: SPACING.md, marginBottom: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  coordinateCardCopy: { flex: 1, minWidth: 0 },
  coordinateFormat: { color: colors.accentDark, fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  coordinateValue: { color: colors.bodyText, fontSize: 13, fontWeight: '800', marginTop: 5 },
});
