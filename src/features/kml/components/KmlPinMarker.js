import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker } from 'react-native-maps';

import { useTheme } from '../../../theme/ThemeContext';
import { kmlMarkerPlacement } from '../kmlMarkerPosition';

const MARKER_TRACKING_SETTLE_MS = 180;

const pinIconName = (icon) => ({
  dot: 'ellipse',
  flag: 'flag',
  star: 'star',
  warning: 'warning',
  target: 'locate',
}[icon] || 'location');

function KmlPinMarker({
  pin,
  coordinate,
  mapScale = 1,
  moved = false,
  selected = false,
  dragging = false,
  draggable = true,
  onSelect,
  onMoveStart,
  onMoveEnd,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const colour = pin.style?.color || colors.accent;
  const layerScale = Math.max(0.75, Math.min(1.55, Number(pin.style?.scale || 1.1)));
  const emphasised = moved || selected;
  const iconScale = layerScale * mapScale;
  const pointScale = Math.max(0.62, mapScale);
  const [markerSize, setMarkerSize] = useState({ width: 40, height: 62 });
  const [symbolFrame, setSymbolFrame] = useState({ x: 5, y: 25, width: 30, height: 37 });
  const [tracksViewChanges, setTracksViewChanges] = useState(true);
  const placement = useMemo(() => kmlMarkerPlacement({
    hotSpot: pin.style?.hotSpot,
    markerSize,
    symbolFrame,
  }), [markerSize, pin.style?.hotSpot, symbolFrame]);
  const visualSignature = `${pin.name || ''}|${pin.style?.icon || ''}|${colour}|${layerScale}|${mapScale}|${moved ? 1 : 0}|${selected ? 1 : 0}|${JSON.stringify(pin.style?.hotSpot || null)}`;

  const rememberLayout = useCallback((setter) => (event) => {
    const layout = event.nativeEvent.layout;
    setter((current) => (
      Math.abs(current.x - layout.x) < 0.5
      && Math.abs(current.y - layout.y) < 0.5
      && Math.abs(current.width - layout.width) < 0.5
      && Math.abs(current.height - layout.height) < 0.5
        ? current
        : layout
    ));
  }, []);

  useEffect(() => {
    if (dragging) {
      setTracksViewChanges(false);
      return undefined;
    }
    setTracksViewChanges(true);
    const timeout = setTimeout(() => setTracksViewChanges(false), MARKER_TRACKING_SETTLE_MS);
    return () => clearTimeout(timeout);
  }, [dragging, visualSignature]);

  const handlePress = useCallback((event) => {
    onSelect?.(pin.id, event);
  }, [onSelect, pin.id]);
  const handleDragStart = useCallback((event) => {
    onMoveStart?.(pin.id, event);
  }, [onMoveStart, pin.id]);
  const handleDragEnd = useCallback((event) => {
    onMoveEnd?.(pin.id, event);
  }, [onMoveEnd, pin.id]);

  return (
    <Marker
      coordinate={coordinate || { latitude: pin.latitude, longitude: pin.longitude }}
      anchor={placement.anchor}
      centerOffset={placement.centerOffset}
      draggable={draggable}
      tappable={Boolean(onSelect)}
      tracksViewChanges={tracksViewChanges}
      accessibilityLabel={`${pin.name || 'Untitled pin'}, ${pin.folderName || 'KML layer'}${moved ? ', moved' : ''}`}
      onPress={onSelect ? handlePress : undefined}
      onDragStart={draggable && onMoveStart ? handleDragStart : undefined}
      onDragEnd={draggable && onMoveEnd ? handleDragEnd : undefined}
    >
      <View style={styles.markerWrap} onLayout={rememberLayout(setMarkerSize)}>
        <View style={[
          styles.markerLabel,
          emphasised && styles.markerLabelActive,
          { borderColor: emphasised ? colour : colors.borderStrong },
        ]}>
          <Text style={styles.markerLabelText}>{pin.name || 'Untitled pin'}</Text>
        </View>
        <View style={styles.markerSymbol} onLayout={rememberLayout(setSymbolFrame)}>
          <View style={[
            styles.markerIcon,
            {
              width: 30 * iconScale,
              height: 30 * iconScale,
              borderRadius: 15 * iconScale,
              backgroundColor: colour,
            },
          ]}>
            <Ionicons name={pinIconName(pin.style?.icon)} size={17 * iconScale} color={colors.white} />
          </View>
          <View style={[
            styles.markerPoint,
            {
              marginTop: -2 * pointScale,
              borderLeftWidth: 5 * pointScale,
              borderRightWidth: 5 * pointScale,
              borderTopWidth: 8 * pointScale,
              borderTopColor: colour,
            },
          ]} />
        </View>
      </View>
    </Marker>
  );
}

const propsAreEqual = (previous, next) => (
  previous.pin === next.pin
  && previous.coordinate?.latitude === next.coordinate?.latitude
  && previous.coordinate?.longitude === next.coordinate?.longitude
  && previous.mapScale === next.mapScale
  && previous.moved === next.moved
  && previous.selected === next.selected
  && previous.dragging === next.dragging
  && previous.draggable === next.draggable
  && previous.onSelect === next.onSelect
  && previous.onMoveStart === next.onMoveStart
  && previous.onMoveEnd === next.onMoveEnd
);

export default React.memo(KmlPinMarker, propsAreEqual);

const createStyles = (colors) => StyleSheet.create({
  markerWrap: { alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 2 },
  markerSymbol: { alignItems: 'center', justifyContent: 'flex-start' },
  markerLabel: {
    maxWidth: 220,
    minHeight: 22,
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginBottom: 3,
    borderRadius: 7,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  markerLabelActive: {
    backgroundColor: colors.raisedSurface,
    shadowOpacity: 0.34,
    shadowRadius: 5,
    elevation: 5,
  },
  markerLabelText: { color: colors.bodyText, fontSize: 10, fontWeight: '900', textAlign: 'center', flexShrink: 1 },
  markerIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 3,
    elevation: 3,
  },
  markerPoint: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
