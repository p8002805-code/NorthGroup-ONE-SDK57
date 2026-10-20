const EARTH_RADIUS_METRES = 6371008.8;
const toRadians = (degrees) => (Number(degrees) * Math.PI) / 180;

export const distanceMetres = (from, to) => {
  if (!from || !to) return 0;
  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);
  const latitudeDelta = latitude2 - latitude1;
  const longitudeDelta = toRadians(Number(to.longitude) - Number(from.longitude));
  const haversine = (
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2
  );
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(haversine)));
};

export const pathDistanceMetres = (coordinates = []) => coordinates.reduce(
  (total, coordinate, index) => (
    index ? total + distanceMetres(coordinates[index - 1], coordinate) : total
  ),
  0,
);

export const polygonAreaSquareMetres = (coordinates = []) => {
  if (coordinates.length < 3) return 0;
  const origin = coordinates[0];
  const latitudeScale = 111132;
  const longitudeScale = 111320 * Math.cos(toRadians(origin.latitude));
  const points = coordinates.map((coordinate) => ({
    x: (Number(coordinate.longitude) - Number(origin.longitude)) * longitudeScale,
    y: (Number(coordinate.latitude) - Number(origin.latitude)) * latitudeScale,
  }));
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + (point.x * next.y) - (next.x * point.y);
  }, 0)) / 2;
};

export const formatDistance = (metres) => {
  const value = Number(metres || 0);
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} km`;
  if (value >= 100) return `${value.toFixed(0)} m`;
  return `${value.toFixed(2)} m`;
};

export const formatArea = (squareMetres) => {
  const value = Number(squareMetres || 0);
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)} km²`;
  if (value >= 10000) return `${(value / 10000).toFixed(2)} ha`;
  return `${value.toFixed(value >= 100 ? 0 : 2)} m²`;
};

const dmsPart = (value, positive, negative) => {
  const absolute = Math.abs(Number(value));
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  return `${degrees}° ${minutes}′ ${seconds.toFixed(2)}″ ${Number(value) >= 0 ? positive : negative}`;
};

export const formatCoordinateDetails = (coordinate) => {
  if (!coordinate) return { decimal: '', dms: '' };
  const latitude = Number(coordinate.latitude);
  const longitude = Number(coordinate.longitude);
  return {
    decimal: `${latitude.toFixed(7)}, ${longitude.toFixed(7)}`,
    dms: `${dmsPart(latitude, 'N', 'S')}  ${dmsPart(longitude, 'E', 'W')}`,
  };
};

export const parseCoordinateSearch = (value) => {
  const matches = String(value || '').trim().match(
    /^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/,
  );
  if (!matches) return null;
  const latitude = Number(matches[1]);
  const longitude = Number(matches[2]);
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

export const featureCoordinates = (feature) => {
  if (!feature) return [];
  if (feature.type === 'pin') {
    return [{ latitude: feature.latitude, longitude: feature.longitude }];
  }
  return feature.coordinates || [];
};
