require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildKmlDocument, parseKmlDocument } = require('../src/features/kml/kmlDocument');
const {
  KML_POST_DRAG_GESTURE_GUARD_MS,
  kmlMarkerInteractionScale,
  kmlMarkerPlacement,
  shouldSuppressKmlMapGesture,
} = require('../src/features/kml/kmlMarkerPosition');
const {
  distanceMetres,
  parseCoordinateSearch,
  pathDistanceMetres,
  polygonAreaSquareMetres,
} = require('../src/features/kml/kmlGeometry');
const {
  applyKmlDisplayCalibration,
  createKmlDisplayCalibration,
  formatKmlCalibrationOffset,
  kmlCalibrationDifferenceMetres,
  removeKmlDisplayCalibration,
} = require('../src/features/kml/kmlDisplayCalibration');
const { buildKmlPinMapLinks } = require('../src/features/kml/kmlDirections');
const {
  measurementSnapRadiusMetres,
  snapKmlMeasurementCoordinate,
} = require('../src/features/kml/kmlMeasurement');
const {
  buildKmlUserViewSettings,
  kmlLayerViewKey,
  resolveKmlUserViewSettings,
} = require('../src/features/kml/kmlUserViewSettings');
const {
  kmlClosedPolygonBoundary,
} = require('../src/features/kml/kmlMapState');

const SAMPLE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Job 24001</name>
    <Document>
      <name>Survey Works</name>
      <Folder>
        <name>Lines</name>
        <Placemark id="sx12">
          <name>SX12</name>
          <Point><coordinates>153.02510000,-27.46980000,12</coordinates></Point>
        </Placemark>
        <Placemark id="centreline">
          <name>Road Centreline</name>
          <LineString><coordinates>153.02510000,-27.46980000,0 153.02620000,-27.47090000,0</coordinates></LineString>
        </Placemark>
      </Folder>
      <Folder>
        <name>Areas</name>
        <Placemark id="compound">
          <name>Compound</name>
          <Polygon><outerBoundaryIs><LinearRing><coordinates>153.02000000,-27.46000000,0 153.02100000,-27.46000000,0 153.02100000,-27.46100000,0 153.02000000,-27.46000000,0</coordinates></LinearRing></outerBoundaryIs></Polygon>
        </Placemark>
      </Folder>
    </Document>
  </Document>
</kml>`;

test('KML parser exposes nested Document and Folder layers', () => {
  const parsed = parseKmlDocument(SAMPLE_KML);
  const surveyWorks = parsed.layers.find((layer) => layer.name === 'Survey Works');
  const lines = parsed.layers.find((layer) => layer.name === 'Lines');
  const areas = parsed.layers.find((layer) => layer.name === 'Areas');
  assert.ok(surveyWorks);
  assert.deepEqual(lines.path, ['Survey Works', 'Lines']);
  assert.equal(lines.parentId, surveyWorks.id);
  assert.deepEqual(areas.path, ['Survey Works', 'Areas']);
  assert.equal(parsed.pins[0].folderId, lines.id);
  assert.equal(parsed.overlays.lines[0].folderId, lines.id);
  assert.equal(parsed.overlays.polygons[0].folderId, areas.id);
});

test('KML round trip preserves untouched survey coordinates', () => {
  const parsed = parseKmlDocument(SAMPLE_KML);
  const rebuilt = buildKmlDocument(SAMPLE_KML, {
    pins: parsed.pins,
    lines: parsed.overlays.lines,
    polygons: parsed.overlays.polygons,
  });
  const reopened = parseKmlDocument(rebuilt);
  assert.deepEqual(
    reopened.pins.map(({ latitude, longitude, altitude }) => ({ latitude, longitude, altitude })),
    parsed.pins.map(({ latitude, longitude, altitude }) => ({ latitude, longitude, altitude })),
  );
  assert.deepEqual(reopened.overlays.lines[0].coordinates, parsed.overlays.lines[0].coordinates);
  assert.deepEqual(reopened.overlays.polygons[0].coordinates, parsed.overlays.polygons[0].coordinates);
});

test('KML edits persist name, style, coordinates and layer location', () => {
  const parsed = parseKmlDocument(SAMPLE_KML);
  const areas = parsed.layers.find((layer) => layer.name === 'Areas');
  const line = {
    ...parsed.overlays.lines[0],
    name: 'Revised Centreline',
    folderId: areas.id,
    coordinates: [
      { latitude: -27.4701, longitude: 153.0254, altitude: 0 },
      { latitude: -27.4712, longitude: 153.0268, altitude: 0 },
    ],
    style: { ...parsed.overlays.lines[0].style, lineColor: '#2D8CFF', lineWidth: 7 },
    styleEdited: true,
  };
  const rebuilt = buildKmlDocument(SAMPLE_KML, {
    pins: parsed.pins,
    lines: [line],
    polygons: parsed.overlays.polygons,
  });
  const reopenedLine = parseKmlDocument(rebuilt).overlays.lines[0];
  assert.equal(reopenedLine.name, 'Revised Centreline');
  assert.equal(reopenedLine.folderName, 'Areas');
  assert.equal(reopenedLine.style.lineColor, '#2D8CFF');
  assert.equal(reopenedLine.style.lineWidth, 7);
  assert.deepEqual(reopenedLine.coordinates, line.coordinates);
});

test('KML deletion removes only the selected feature', () => {
  const parsed = parseKmlDocument(SAMPLE_KML);
  const rebuilt = buildKmlDocument(SAMPLE_KML, {
    pins: [{ ...parsed.pins[0], deleted: true }],
    lines: parsed.overlays.lines,
    polygons: parsed.overlays.polygons,
  });
  const reopened = parseKmlDocument(rebuilt);
  assert.equal(reopened.pins.length, 0);
  assert.equal(reopened.overlays.lines.length, 1);
  assert.equal(reopened.overlays.polygons.length, 1);
});

test('survey geometry helpers return field-scale distances and areas', () => {
  const start = { latitude: -27.4698, longitude: 153.0251 };
  const east = { latitude: -27.4698, longitude: 153.0261 };
  const distance = distanceMetres(start, east);
  assert.ok(distance > 98 && distance < 100);
  assert.equal(pathDistanceMetres([start, east]), distance);
  const area = polygonAreaSquareMetres([
    start,
    east,
    { latitude: -27.4688, longitude: 153.0261 },
    { latitude: -27.4688, longitude: 153.0251 },
  ]);
  assert.ok(area > 10800 && area < 11200);
});

test('coordinate search rejects invalid field coordinates', () => {
  assert.deepEqual(parseCoordinateSearch('-27.4698, 153.0251'), {
    latitude: -27.4698,
    longitude: 153.0251,
  });
  assert.equal(parseCoordinateSearch('-91, 153'), null);
  assert.equal(parseCoordinateSearch('not a coordinate'), null);
});

test('KML bottom-centre hotspots place the custom marker tip on the coordinate', () => {
  const placement = kmlMarkerPlacement({
    hotSpot: { x: 0.5, y: 0, xunits: 'fraction', yunits: 'fraction' },
    markerSize: { width: 100, height: 70 },
    symbolFrame: { x: 20, y: 25, width: 60, height: 45 },
  });
  assert.deepEqual(placement.anchor, { x: 0.5, y: 1 });
  assert.deepEqual(placement.centerOffset, { x: 0, y: -35 });
});

test('KML pixel hotspots convert from the lower-left icon origin', () => {
  const placement = kmlMarkerPlacement({
    hotSpot: { x: 20, y: 2, xunits: 'pixels', yunits: 'pixels' },
    markerSize: { width: 60, height: 60 },
    symbolFrame: { x: 10, y: 10, width: 40, height: 40 },
  });
  assert.deepEqual(placement.anchor, { x: 0.5, y: 0.8 });
  assert.deepEqual(placement.centerOffset, { x: 0, y: -18 });
});

test('KML marker interaction states never change marker geometry', () => {
  assert.equal(kmlMarkerInteractionScale(), 1);
  assert.equal(kmlMarkerInteractionScale({ moved: true }), 1);
  assert.equal(kmlMarkerInteractionScale({ selected: true }), 1);
  assert.equal(kmlMarkerInteractionScale({ moved: true, selected: true, dragging: true }), 1);
});

test('KML map gestures are guarded during and immediately after a pin drag', () => {
  const now = 1000;
  assert.equal(shouldSuppressKmlMapGesture({ draggingPinId: 'pin-1', now }), true);
  assert.equal(shouldSuppressKmlMapGesture({ suppressUntil: now + KML_POST_DRAG_GESTURE_GUARD_MS, now }), true);
  assert.equal(shouldSuppressKmlMapGesture({ suppressUntil: now - 1, now }), false);
});

test('Apple imagery calibration shifts display coordinates and reverses before KML storage', () => {
  const pin = { id: 'bm14', name: 'BM14', latitude: -24.31788, longitude: 151.52442, altitude: 18.2 };
  const imageryCoordinate = { latitude: -24.31785, longitude: 151.52438 };
  const calibration = createKmlDisplayCalibration({ referencePin: pin, imageryCoordinate });
  assert.ok(calibration);
  assert.equal(calibration.exists, true);
  assert.deepEqual(
    applyKmlDisplayCalibration(pin, calibration),
    { ...pin, ...imageryCoordinate },
  );
  const rawCoordinate = removeKmlDisplayCalibration(imageryCoordinate, calibration);
  assert.ok(distanceMetres(rawCoordinate, pin) < 0.001);
  assert.match(formatKmlCalibrationOffset(calibration), /^E [+−]\d+\.\d m · N [+−]\d+\.\d m$/);
});

test('a second Apple control pin reports residual alignment difference', () => {
  const reference = { id: 'one', name: 'One', latitude: -24.3, longitude: 151.5 };
  const first = createKmlDisplayCalibration({
    referencePin: reference,
    imageryCoordinate: { latitude: -24.29998, longitude: 151.50003 },
  });
  const second = createKmlDisplayCalibration({
    referencePin: { ...reference, id: 'two', name: 'Two', latitude: -24.31 },
    imageryCoordinate: { latitude: -24.30997, longitude: 151.50005 },
  });
  const residual = kmlCalibrationDifferenceMetres(first, second);
  assert.ok(residual > 2 && residual < 3);
});

test('pin directions use authoritative coordinates for Apple and Google Maps', () => {
  const links = buildKmlPinMapLinks({ name: 'BM14', latitude: -24.31788, longitude: 151.52442 });
  assert.equal(links.label, 'BM14');
  assert.match(links.apple, /maps\.apple\.com\/\?daddr=-24\.31788%2C151\.52442&dirflg=d&q=BM14/);
  assert.match(links.google, /destination=-24\.31788%2C151\.52442/);
  assert.match(links.google, /dir_action=navigate/);
  assert.equal(buildKmlPinMapLinks({ latitude: 100, longitude: 151 }), null);
});


test('KML measure snapping uses a screen-scale tolerance instead of a fixed field distance', () => {
  const radius = measurementSnapRadiusMetres({
    region: {
      latitude: -24.3,
      longitude: 151.5,
      latitudeDelta: 0.006,
      longitudeDelta: 0.004,
    },
    mapSize: { width: 390, height: 780 },
  });
  assert.ok(radius > 35 / 2 && radius < 35);
});

test('KML measure taps snap exactly to a nearby pin', () => {
  const result = snapKmlMeasurementCoordinate({
    coordinate: { latitude: -24.30001, longitude: 151.50001 },
    pins: [{ id: 'bm20', latitude: -24.3, longitude: 151.5 }],
    maxDistanceMetres: 5,
  });
  assert.equal(result.snapped, true);
  assert.equal(result.featureType, 'pin');
  assert.equal(result.featureId, 'bm20');
  assert.deepEqual(result.coordinate, { latitude: -24.3, longitude: 151.5 });
});

test('KML measure taps snap to the nearest point along a line or polygon edge', () => {
  const lineResult = snapKmlMeasurementCoordinate({
    coordinate: { latitude: -24.29995, longitude: 151.5005 },
    lines: [{
      id: 'road-edge',
      coordinates: [
        { latitude: -24.3, longitude: 151.5 },
        { latitude: -24.3, longitude: 151.501 },
      ],
    }],
    maxDistanceMetres: 10,
  });
  assert.equal(lineResult.snapped, true);
  assert.equal(lineResult.featureType, 'line');
  assert.ok(Math.abs(lineResult.coordinate.latitude - (-24.3)) < 1e-8);
  assert.ok(Math.abs(lineResult.coordinate.longitude - 151.5005) < 1e-8);

  const polygonResult = snapKmlMeasurementCoordinate({
    coordinate: { latitude: -24.3005, longitude: 151.49998 },
    polygons: [{
      id: 'boundary',
      coordinates: [
        { latitude: -24.3, longitude: 151.5 },
        { latitude: -24.3, longitude: 151.501 },
        { latitude: -24.301, longitude: 151.501 },
        { latitude: -24.301, longitude: 151.5 },
      ],
    }],
    maxDistanceMetres: 5,
  });
  assert.equal(polygonResult.snapped, true);
  assert.equal(polygonResult.featureType, 'polygon');
  assert.ok(Math.abs(polygonResult.coordinate.longitude - 151.5) < 1e-8);
});

test('KML measure taps remain at the tapped map coordinate when no feature is close enough', () => {
  const coordinate = { latitude: -24.31, longitude: 151.51 };
  const result = snapKmlMeasurementCoordinate({
    coordinate,
    pins: [{ id: 'bm20', latitude: -24.3, longitude: 151.5 }],
    maxDistanceMetres: 5,
  });
  assert.equal(result.snapped, false);
  assert.deepEqual(result.coordinate, coordinate);
});

test('KML personal layer visibility survives shared KML folder reordering', () => {
  const original = parseKmlDocument(SAMPLE_KML);
  const originalLines = original.layers.find((layer) => layer.name === 'Lines');
  const settings = buildKmlUserViewSettings({
    layerVisibility: { pins: true, lines: true, polygons: true },
    hiddenLayers: { [originalLines.id]: true },
    hiddenFeatures: {},
    layers: original.layers,
    features: [...original.pins, ...original.overlays.lines, ...original.overlays.polygons],
  });

  const reorderedXml = SAMPLE_KML.replace(
    '      <Folder>\n        <name>Lines</name>',
    '      <Folder><name>Temporary Notes</name></Folder>\n      <Folder>\n        <name>Lines</name>',
  );
  const refreshed = parseKmlDocument(reorderedXml);
  const refreshedLines = refreshed.layers.find((layer) => layer.name === 'Lines');
  assert.notEqual(refreshedLines.id, originalLines.id);
  assert.equal(kmlLayerViewKey(refreshedLines), kmlLayerViewKey(originalLines));

  const resolved = resolveKmlUserViewSettings(
    settings,
    refreshed.layers,
    [...refreshed.pins, ...refreshed.overlays.lines, ...refreshed.overlays.polygons],
  );
  assert.equal(resolved.hiddenLayers[refreshedLines.id], true);
});

test('KML personal view keeps feature-type visibility separate from shared geometry', () => {
  const parsed = parseKmlDocument(SAMPLE_KML);
  const settings = buildKmlUserViewSettings({
    layerVisibility: { pins: true, lines: false, polygons: true },
    hiddenLayers: {},
    hiddenFeatures: { [parsed.pins[0].id]: true },
    layers: parsed.layers,
    features: [...parsed.pins, ...parsed.overlays.lines, ...parsed.overlays.polygons],
  });
  const resolved = resolveKmlUserViewSettings(
    settings,
    parsed.layers,
    [...parsed.pins, ...parsed.overlays.lines, ...parsed.overlays.polygons],
  );

  assert.deepEqual(resolved.layerVisibility, { pins: true, lines: false, polygons: true });
  assert.equal(resolved.hiddenFeatures[parsed.pins[0].id], true);
  assert.equal(parsed.pins[0].deleted, undefined);
});


test('KML polygon interaction boundary is closed without mutating the source coordinates', () => {
  const coordinates = [
    { latitude: -24.3, longitude: 151.5 },
    { latitude: -24.3, longitude: 151.501 },
    { latitude: -24.301, longitude: 151.501 },
  ];
  const closed = kmlClosedPolygonBoundary(coordinates);
  assert.equal(closed.length, 4);
  assert.deepEqual(closed[0], closed[closed.length - 1]);
  assert.equal(coordinates.length, 3);

  const alreadyClosed = [...coordinates, coordinates[0]];
  assert.equal(kmlClosedPolygonBoundary(alreadyClosed), alreadyClosed);
});
