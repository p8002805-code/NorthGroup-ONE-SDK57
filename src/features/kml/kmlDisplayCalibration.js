import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobStorageKey } from '../jobs/jobContext';
import { distanceMetres } from './kmlGeometry';

const STORAGE_KEY = 'northgroup_kml_apple_display_calibration_v1';

export const MAX_KML_CALIBRATION_METRES = 250;

export const emptyKmlDisplayCalibration = () => ({
  exists: false,
  enabled: false,
  latitudeOffset: 0,
  longitudeOffset: 0,
  referencePinId: '',
  referencePinName: '',
  updatedAt: '',
});

const finiteCoordinate = (coordinate) => (
  Number.isFinite(Number(coordinate?.latitude))
  && Number.isFinite(Number(coordinate?.longitude))
);

const normaliseCalibration = (value) => {
  const latitudeOffset = Number(value?.latitudeOffset);
  const longitudeOffset = Number(value?.longitudeOffset);
  if (!Number.isFinite(latitudeOffset) || !Number.isFinite(longitudeOffset)) {
    return emptyKmlDisplayCalibration();
  }

  const referenceLatitude = Number(value?.referenceLatitude) || 0;
  const distance = distanceMetres(
    { latitude: referenceLatitude, longitude: 0 },
    { latitude: referenceLatitude + latitudeOffset, longitude: longitudeOffset },
  );
  if (!Number.isFinite(distance) || distance > MAX_KML_CALIBRATION_METRES) {
    return emptyKmlDisplayCalibration();
  }

  return {
    exists: value?.exists !== false,
    enabled: value?.enabled !== false,
    latitudeOffset,
    longitudeOffset,
    referenceLatitude,
    referencePinId: String(value?.referencePinId || ''),
    referencePinName: String(value?.referencePinName || ''),
    updatedAt: String(value?.updatedAt || ''),
  };
};

export const createKmlDisplayCalibration = ({ referencePin, imageryCoordinate }) => {
  if (!finiteCoordinate(referencePin) || !finiteCoordinate(imageryCoordinate)) return null;

  const latitudeOffset = Number(imageryCoordinate.latitude) - Number(referencePin.latitude);
  const longitudeOffset = Number(imageryCoordinate.longitude) - Number(referencePin.longitude);
  const distance = distanceMetres(referencePin, imageryCoordinate);

  if (!Number.isFinite(distance) || distance > MAX_KML_CALIBRATION_METRES) return null;

  return normaliseCalibration({
    exists: true,
    enabled: true,
    latitudeOffset,
    longitudeOffset,
    referenceLatitude: Number(referencePin.latitude),
    referencePinId: referencePin.id,
    referencePinName: referencePin.name || 'Untitled pin',
    updatedAt: new Date().toISOString(),
  });
};

export const applyKmlDisplayCalibration = (coordinate, calibration) => {
  if (!finiteCoordinate(coordinate) || !calibration?.exists || !calibration?.enabled) return coordinate;
  return {
    ...coordinate,
    latitude: Number(coordinate.latitude) + Number(calibration.latitudeOffset || 0),
    longitude: Number(coordinate.longitude) + Number(calibration.longitudeOffset || 0),
  };
};

export const removeKmlDisplayCalibration = (coordinate, calibration) => {
  if (!finiteCoordinate(coordinate) || !calibration?.exists || !calibration?.enabled) return coordinate;
  return {
    ...coordinate,
    latitude: Number(coordinate.latitude) - Number(calibration.latitudeOffset || 0),
    longitude: Number(coordinate.longitude) - Number(calibration.longitudeOffset || 0),
  };
};

export const kmlCalibrationOffsetMetres = (calibration) => {
  if (!calibration?.exists) return { east: 0, north: 0, distance: 0 };
  const latitude = Number(calibration.referenceLatitude) || 0;
  const origin = { latitude, longitude: 0 };
  const northPoint = { latitude: latitude + Number(calibration.latitudeOffset || 0), longitude: 0 };
  const eastPoint = { latitude, longitude: Number(calibration.longitudeOffset || 0) };
  const north = distanceMetres(origin, northPoint) * Math.sign(Number(calibration.latitudeOffset || 0));
  const east = distanceMetres(origin, eastPoint) * Math.sign(Number(calibration.longitudeOffset || 0));
  return { east, north, distance: Math.hypot(east, north) };
};

export const formatKmlCalibrationOffset = (calibration) => {
  const { east, north } = kmlCalibrationOffsetMetres(calibration);
  const format = (value) => `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)} m`;
  return `E ${format(east)} · N ${format(north)}`;
};

export const kmlCalibrationDifferenceMetres = (current, candidate) => {
  if (!current?.exists || !candidate?.exists) return Number.POSITIVE_INFINITY;
  const reference = {
    latitude: Number(candidate.referenceLatitude) || Number(current.referenceLatitude) || 0,
    longitude: 0,
  };
  return distanceMetres(
    applyKmlDisplayCalibration(reference, { ...current, enabled: true }),
    applyKmlDisplayCalibration(reference, { ...candidate, enabled: true }),
  );
};

export const loadKmlDisplayCalibration = async (job) => {
  try {
    const saved = await AsyncStorage.getItem(jobStorageKey(STORAGE_KEY, job));
    return saved ? normaliseCalibration(JSON.parse(saved)) : emptyKmlDisplayCalibration();
  } catch {
    return emptyKmlDisplayCalibration();
  }
};

export const saveKmlDisplayCalibration = async (job, calibration) => {
  const next = normaliseCalibration(calibration);
  if (!next.exists) {
    await AsyncStorage.removeItem(jobStorageKey(STORAGE_KEY, job));
    return next;
  }
  await AsyncStorage.setItem(jobStorageKey(STORAGE_KEY, job), JSON.stringify(next));
  return next;
};

export const clearKmlDisplayCalibration = async (job) => {
  await AsyncStorage.removeItem(jobStorageKey(STORAGE_KEY, job));
  return emptyKmlDisplayCalibration();
};
