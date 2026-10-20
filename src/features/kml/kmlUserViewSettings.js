import AsyncStorage from '@react-native-async-storage/async-storage';

import { jobStorageKey } from '../jobs/jobContext';

const STORAGE_KEY = 'northgroup_kml_user_view_v1';

export const DEFAULT_KML_VIEW_VISIBILITY = Object.freeze({
  pins: true,
  lines: true,
  polygons: true,
});

const cleanText = (value) => String(value || '')
  .trim()
  .replace(/\s+/g, ' ')
  .toLowerCase();

const uniqueStrings = (values) => [...new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean),
)];

const normaliseVisibility = (value = {}) => ({
  pins: value.pins !== false,
  lines: value.lines !== false,
  polygons: value.polygons !== false,
});

export const emptyKmlUserViewSettings = () => ({
  version: 1,
  layerVisibility: { ...DEFAULT_KML_VIEW_VISIBILITY },
  hiddenLayerKeys: [],
  hiddenFeatureKeys: [],
  updatedAt: '',
});

export const normaliseKmlUserViewSettings = (value = {}) => ({
  version: 1,
  layerVisibility: normaliseVisibility(value.layerVisibility),
  hiddenLayerKeys: uniqueStrings(value.hiddenLayerKeys),
  hiddenFeatureKeys: uniqueStrings(value.hiddenFeatureKeys),
  updatedAt: String(value.updatedAt || ''),
});

export const kmlLayerViewKey = (layer) => {
  if (!layer) return '';
  if (layer.isRoot) return 'layer:__root__';
  const path = (Array.isArray(layer.path) && layer.path.length ? layer.path : [layer.name])
    .map(cleanText)
    .filter(Boolean);
  if (!path.length) return '';
  return `layer:${JSON.stringify(path)}`;
};

const layerKeyForFeature = (feature, layers = []) => {
  const layer = layers.find((candidate) => candidate.id === feature?.folderId);
  if (layer) return kmlLayerViewKey(layer);
  const path = (Array.isArray(feature?.folderPath) ? feature.folderPath : [])
    .map(cleanText)
    .filter(Boolean);
  return path.length ? `layer:${JSON.stringify(path)}` : 'layer:__root__';
};

export const kmlFeatureViewKey = (feature, layers = []) => {
  if (!feature) return '';
  const type = cleanText(feature.type) || 'feature';
  const placemarkId = cleanText(feature.placemarkId);
  if (placemarkId) return `feature:${type}:id:${placemarkId}`;

  const name = cleanText(feature.name);
  const layerKey = layerKeyForFeature(feature, layers);
  if (name) return `feature:${type}:${layerKey}:name:${name}`;

  if (feature.isNew && feature.id) return `feature:${type}:local:${cleanText(feature.id)}`;
  if (Number.isInteger(feature.sourceIndex)) return `feature:${type}:${layerKey}:source:${feature.sourceIndex}`;
  return feature.id ? `feature:${type}:fallback:${cleanText(feature.id)}` : '';
};

const currentKeySet = (items, keyForItem) => new Set(
  (Array.isArray(items) ? items : [])
    .map(keyForItem)
    .filter(Boolean),
);

export const resolveKmlUserViewSettings = (settings, layers = [], features = []) => {
  const clean = normaliseKmlUserViewSettings(settings);
  const hiddenLayerKeys = new Set(clean.hiddenLayerKeys);
  const hiddenFeatureKeys = new Set(clean.hiddenFeatureKeys);
  const hiddenLayers = {};
  const hiddenFeatures = {};

  layers.forEach((layer) => {
    const key = kmlLayerViewKey(layer);
    if (key && hiddenLayerKeys.has(key)) hiddenLayers[layer.id] = true;
  });
  features.forEach((feature) => {
    const key = kmlFeatureViewKey(feature, layers);
    if (key && hiddenFeatureKeys.has(key)) hiddenFeatures[feature.id] = true;
  });

  return {
    settings: clean,
    layerVisibility: { ...clean.layerVisibility },
    hiddenLayers,
    hiddenFeatures,
  };
};

export const buildKmlUserViewSettings = ({
  layerVisibility,
  hiddenLayers = {},
  hiddenFeatures = {},
  layers = [],
  features = [],
  previousSettings = null,
} = {}) => {
  const previous = normaliseKmlUserViewSettings(previousSettings || {});
  const layerKeysNow = currentKeySet(layers, kmlLayerViewKey);
  const featureKeysNow = currentKeySet(features, (feature) => kmlFeatureViewKey(feature, layers));

  const hiddenLayerKeys = previous.hiddenLayerKeys.filter((key) => !layerKeysNow.has(key));
  layers.forEach((layer) => {
    if (!hiddenLayers[layer.id]) return;
    const key = kmlLayerViewKey(layer);
    if (key) hiddenLayerKeys.push(key);
  });

  const hiddenFeatureKeys = previous.hiddenFeatureKeys.filter((key) => !featureKeysNow.has(key));
  features.forEach((feature) => {
    if (!hiddenFeatures[feature.id]) return;
    const key = kmlFeatureViewKey(feature, layers);
    if (key) hiddenFeatureKeys.push(key);
  });

  return normaliseKmlUserViewSettings({
    layerVisibility,
    hiddenLayerKeys,
    hiddenFeatureKeys,
    updatedAt: new Date().toISOString(),
  });
};

export const loadKmlUserViewSettings = async (job) => {
  try {
    const saved = await AsyncStorage.getItem(jobStorageKey(STORAGE_KEY, job));
    return saved
      ? normaliseKmlUserViewSettings(JSON.parse(saved))
      : emptyKmlUserViewSettings();
  } catch {
    return emptyKmlUserViewSettings();
  }
};

export const saveKmlUserViewSettings = async (job, settings) => {
  const clean = normaliseKmlUserViewSettings({
    ...settings,
    updatedAt: new Date().toISOString(),
  });
  await AsyncStorage.setItem(jobStorageKey(STORAGE_KEY, job), JSON.stringify(clean));
  return clean;
};
