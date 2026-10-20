
export const KML_EDIT_UNLOCK_SPAN_METRES = 550;

const METRES_PER_LATITUDE_DEGREE = 111320;

export const kmlRegionSpanMetres = (region) => {
  const latitude = Number(region?.latitude);
  const latitudeDelta = Math.abs(Number(region?.latitudeDelta));
  const longitudeDelta = Math.abs(Number(region?.longitudeDelta));
  if (!Number.isFinite(latitudeDelta) || !Number.isFinite(longitudeDelta)) return Number.POSITIVE_INFINITY;

  const northSouthMetres = latitudeDelta * METRES_PER_LATITUDE_DEGREE;
  const longitudeScale = Math.max(0.01, Math.cos((Number.isFinite(latitude) ? latitude : 0) * Math.PI / 180));
  const eastWestMetres = longitudeDelta * METRES_PER_LATITUDE_DEGREE * longitudeScale;
  return Math.max(northSouthMetres, eastWestMetres);
};

export const kmlEditingIsUnlocked = (region, thresholdMetres = KML_EDIT_UNLOCK_SPAN_METRES) => (
  kmlRegionSpanMetres(region) <= Number(thresholdMetres || KML_EDIT_UNLOCK_SPAN_METRES)
);


export const kmlClosedPolygonBoundary = (coordinates) => {
  const points = Array.isArray(coordinates) ? coordinates : [];
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  const alreadyClosed = Number(first?.latitude) === Number(last?.latitude)
    && Number(first?.longitude) === Number(last?.longitude);
  return alreadyClosed ? points : [...points, first];
};

export const DEFAULT_KML_REGION = {
  latitude: -27.4698,
  longitude: 153.0251,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

export const activeKmlFeatures = (features) => (
  (features || []).filter((feature) => !feature.deleted)
);

export const kmlLayerIsHidden = (feature, layers, hiddenLayers) => {
  const byId = new Map((layers || []).map((layer) => [layer.id, layer]));
  let layer = byId.get(feature.folderId);
  while (layer) {
    if (hiddenLayers[layer.id]) return true;
    layer = byId.get(layer.parentId);
  }
  return false;
};

export const preferredKmlLayer = (layers, type) => (
  (layers || []).find((layer) => {
    const directCountKey = `direct${type.charAt(0).toUpperCase()}${type.slice(1)}Count`;
    return !layer.isRoot && layer[directCountKey] > 0;
  })
  || (layers || []).find((layer) => !layer.isRoot && !layer.childCount)
  || (layers || []).find((layer) => !layer.isRoot)
  || (layers || [])[0]
);

export const kmlFeatureBelongsToLayer = (feature, layerId, layers) => {
  const byId = new Map((layers || []).map((layer) => [layer.id, layer]));
  let layer = byId.get(feature.folderId);
  while (layer) {
    if (layer.id === layerId) return true;
    layer = byId.get(layer.parentId);
  }
  return false;
};

export const kmlDocumentCoordinates = (pins, lines, polygons) => [
  ...activeKmlFeatures(pins).map(({ latitude, longitude }) => ({ latitude, longitude })),
  ...activeKmlFeatures(lines).flatMap((line) => line.coordinates || []),
  ...activeKmlFeatures(polygons).flatMap((polygon) => polygon.coordinates || []),
];

export const kmlMarkerScaleForLongitudeDelta = (longitudeDelta) => {
  const minimumDelta = 0.0015;
  const maximumDelta = 0.08;
  const safeDelta = Math.max(minimumDelta, Math.min(maximumDelta, Number(longitudeDelta) || maximumDelta));
  const progress = (Math.log(safeDelta) - Math.log(minimumDelta))
    / (Math.log(maximumDelta) - Math.log(minimumDelta));
  return Math.round((0.56 + Math.max(0, Math.min(1, progress)) * 0.44) * 20) / 20;
};

export const kmlRegionFor = (pins, lines, polygons, job) => {
  const coordinates = kmlDocumentCoordinates(pins, lines, polygons);
  if (!coordinates.length) {
    const latitude = Number(job?.latitude);
    const longitude = Number(job?.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? { ...DEFAULT_KML_REGION, latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }
      : DEFAULT_KML_REGION;
  }

  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  const minimumLatitude = Math.min(...latitudes);
  const maximumLatitude = Math.max(...latitudes);
  const minimumLongitude = Math.min(...longitudes);
  const maximumLongitude = Math.max(...longitudes);
  return {
    latitude: (minimumLatitude + maximumLatitude) / 2,
    longitude: (minimumLongitude + maximumLongitude) / 2,
    latitudeDelta: Math.max(0.01, (maximumLatitude - minimumLatitude) * 1.45),
    longitudeDelta: Math.max(0.01, (maximumLongitude - minimumLongitude) * 1.45),
  };
};
