const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const positiveDimension = (value, fallback = 1) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const unitPosition = (value, units, dimension, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  if (units === 'pixels') return number / dimension;
  if (units === 'insetPixels') return 1 - (number / dimension);
  return number;
};

export const KML_POST_DRAG_GESTURE_GUARD_MS = 320;

export const kmlHotSpotFractions = (hotSpot, symbolSize = {}) => {
  const width = positiveDimension(symbolSize.width);
  const height = positiveDimension(symbolSize.height);
  const x = unitPosition(hotSpot?.x, hotSpot?.xunits, width, 0.5);
  const yFromBottom = unitPosition(hotSpot?.y, hotSpot?.yunits, height, 0);
  return {
    x: clamp(x, 0, 1),
    yFromTop: clamp(1 - yFromBottom, 0, 1),
  };
};

export const kmlMarkerPlacement = ({ hotSpot, markerSize, symbolFrame }) => {
  const markerWidth = positiveDimension(markerSize?.width);
  const markerHeight = positiveDimension(markerSize?.height);
  const frame = {
    x: Number.isFinite(Number(symbolFrame?.x)) ? Number(symbolFrame.x) : 0,
    y: Number.isFinite(Number(symbolFrame?.y)) ? Number(symbolFrame.y) : 0,
    width: positiveDimension(symbolFrame?.width, markerWidth),
    height: positiveDimension(symbolFrame?.height, markerHeight),
  };
  const fractions = kmlHotSpotFractions(hotSpot, frame);
  const point = {
    x: frame.x + (fractions.x * frame.width),
    y: frame.y + (fractions.yFromTop * frame.height),
  };

  return {
    anchor: {
      x: clamp(point.x / markerWidth, 0, 1),
      y: clamp(point.y / markerHeight, 0, 1),
    },
    centerOffset: {
      x: (markerWidth / 2) - point.x,
      y: (markerHeight / 2) - point.y,
    },
  };
};

// Keep marker geometry fixed through press, selection and drag states. Native map
// dragging owns the marker position until onDragEnd commits the local coordinate.
export const kmlMarkerInteractionScale = () => 1;

export const shouldSuppressKmlMapGesture = ({
  draggingPinId = null,
  suppressUntil = 0,
  now = Date.now(),
} = {}) => Boolean(draggingPinId) || Number(now) < Number(suppressUntil || 0);
