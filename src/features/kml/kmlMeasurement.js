const LATITUDE_METRES_PER_DEGREE = 111132;
const LONGITUDE_METRES_PER_DEGREE = 111320;
const DEFAULT_SNAP_RADIUS_PIXELS = 30;
const MINIMUM_SNAP_RADIUS_METRES = 1.5;
const MAXIMUM_SNAP_RADIUS_METRES = 35;

const safeNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const longitudeScaleAt = (latitude) => (
  LONGITUDE_METRES_PER_DEGREE * Math.max(0.01, Math.cos((safeNumber(latitude) * Math.PI) / 180))
);

const projectCoordinate = (coordinate, origin) => ({
  x: (safeNumber(coordinate?.longitude) - safeNumber(origin?.longitude)) * longitudeScaleAt(origin?.latitude),
  y: (safeNumber(coordinate?.latitude) - safeNumber(origin?.latitude)) * LATITUDE_METRES_PER_DEGREE,
});

const unprojectCoordinate = (point, origin) => ({
  latitude: safeNumber(origin?.latitude) + (safeNumber(point?.y) / LATITUDE_METRES_PER_DEGREE),
  longitude: safeNumber(origin?.longitude) + (safeNumber(point?.x) / longitudeScaleAt(origin?.latitude)),
});

const planarDistanceMetres = (from, to) => {
  const projected = projectCoordinate(to, from);
  return Math.hypot(projected.x, projected.y);
};

const nearestPointOnSegment = (coordinate, start, end) => {
  if (!start || !end) return null;
  const projectedStart = projectCoordinate(start, coordinate);
  const projectedEnd = projectCoordinate(end, coordinate);
  const dx = projectedEnd.x - projectedStart.x;
  const dy = projectedEnd.y - projectedStart.y;
  const lengthSquared = (dx * dx) + (dy * dy);
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, -((projectedStart.x * dx) + (projectedStart.y * dy)) / lengthSquared))
    : 0;
  const projected = {
    x: projectedStart.x + (dx * t),
    y: projectedStart.y + (dy * t),
  };
  return {
    coordinate: unprojectCoordinate(projected, coordinate),
    distanceMetres: Math.hypot(projected.x, projected.y),
  };
};

const nearestPointOnPath = (coordinate, coordinates, closePath = false) => {
  const path = (coordinates || []).filter((item) => (
    Number.isFinite(Number(item?.latitude)) && Number.isFinite(Number(item?.longitude))
  ));
  if (!path.length) return null;
  if (path.length === 1) {
    return {
      coordinate: { latitude: Number(path[0].latitude), longitude: Number(path[0].longitude) },
      distanceMetres: planarDistanceMetres(coordinate, path[0]),
    };
  }

  let nearest = null;
  const segmentCount = closePath ? path.length : path.length - 1;
  for (let index = 0; index < segmentCount; index += 1) {
    const start = path[index];
    const end = path[(index + 1) % path.length];
    const candidate = nearestPointOnSegment(coordinate, start, end);
    if (candidate && (!nearest || candidate.distanceMetres < nearest.distanceMetres)) nearest = candidate;
  }
  return nearest;
};

export const measurementSnapRadiusMetres = ({
  region,
  mapSize,
  radiusPixels = DEFAULT_SNAP_RADIUS_PIXELS,
} = {}) => {
  const latitude = safeNumber(region?.latitude);
  const latitudeDelta = Math.abs(safeNumber(region?.latitudeDelta));
  const longitudeDelta = Math.abs(safeNumber(region?.longitudeDelta));
  const height = Math.max(1, safeNumber(mapSize?.height));
  const width = Math.max(1, safeNumber(mapSize?.width));
  const verticalMetresPerPixel = (latitudeDelta * LATITUDE_METRES_PER_DEGREE) / height;
  const horizontalMetresPerPixel = (longitudeDelta * longitudeScaleAt(latitude)) / width;
  const metresPerPixel = Math.max(verticalMetresPerPixel, horizontalMetresPerPixel, 0.05);
  return Math.max(
    MINIMUM_SNAP_RADIUS_METRES,
    Math.min(MAXIMUM_SNAP_RADIUS_METRES, metresPerPixel * Math.max(1, safeNumber(radiusPixels))),
  );
};

export const snapKmlMeasurementCoordinate = ({
  coordinate,
  pins = [],
  lines = [],
  polygons = [],
  maxDistanceMetres = 0,
} = {}) => {
  if (!coordinate) return null;
  const target = {
    latitude: Number(coordinate.latitude),
    longitude: Number(coordinate.longitude),
  };
  if (!Number.isFinite(target.latitude) || !Number.isFinite(target.longitude)) return null;

  const candidates = [];
  (pins || []).forEach((pin) => {
    if (pin?.deleted) return;
    const pinCoordinate = { latitude: Number(pin?.latitude), longitude: Number(pin?.longitude) };
    if (!Number.isFinite(pinCoordinate.latitude) || !Number.isFinite(pinCoordinate.longitude)) return;
    candidates.push({
      coordinate: pinCoordinate,
      distanceMetres: planarDistanceMetres(target, pinCoordinate),
      featureId: pin.id,
      featureType: 'pin',
      priority: 0,
    });
  });
  (lines || []).forEach((line) => {
    if (line?.deleted) return;
    const nearest = nearestPointOnPath(target, line.coordinates, false);
    if (!nearest) return;
    candidates.push({ ...nearest, featureId: line.id, featureType: 'line', priority: 1 });
  });
  (polygons || []).forEach((polygon) => {
    if (polygon?.deleted) return;
    const nearest = nearestPointOnPath(target, polygon.coordinates, true);
    if (!nearest) return;
    candidates.push({ ...nearest, featureId: polygon.id, featureType: 'polygon', priority: 2 });
  });

  const nearest = candidates.sort((left, right) => (
    Math.abs(left.distanceMetres - right.distanceMetres) < 0.05
      ? left.priority - right.priority
      : left.distanceMetres - right.distanceMetres
  ))[0];
  const threshold = Math.max(0, safeNumber(maxDistanceMetres));
  if (!nearest || !threshold || nearest.distanceMetres > threshold) {
    return { coordinate: target, snapped: false, distanceMetres: nearest?.distanceMetres ?? null };
  }
  return {
    coordinate: nearest.coordinate,
    snapped: true,
    featureId: nearest.featureId,
    featureType: nearest.featureType,
    distanceMetres: nearest.distanceMetres,
  };
};
