import { secureRandomId } from '../../services/security/secureRandom';

const PLACEMARK_PATTERN = /<(?:[\w.-]+:)?Placemark\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Placemark\s*>/gi;
const POINT_PATTERN = /<(?:[\w.-]+:)?Point\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Point\s*>/i;
const COORDINATES_PATTERN = /(<(?:[\w.-]+:)?coordinates\b[^>]*>)([\s\S]*?)(<\/(?:[\w.-]+:)?coordinates\s*>)/i;
const LINE_STRING_PATTERN = /<(?:[\w.-]+:)?LineString\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?LineString\s*>/i;
const POLYGON_PATTERN = /<(?:[\w.-]+:)?Polygon\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Polygon\s*>/i;
const OUTER_BOUNDARY_PATTERN = /<(?:[\w.-]+:)?outerBoundaryIs\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?outerBoundaryIs\s*>/i;
const ROOT_LAYER_ID = 'document-root';

export const KML_ICON_OPTIONS = [
  { id: 'pin', label: 'Pin', icon: 'location' },
  { id: 'dot', label: 'Dot', icon: 'ellipse' },
  { id: 'flag', label: 'Flag', icon: 'flag' },
  { id: 'star', label: 'Star', icon: 'star' },
  { id: 'warning', label: 'Warning', icon: 'warning' },
  { id: 'target', label: 'Target', icon: 'locate' },
];

const KML_ICON_HREFS = {
  pin: 'https://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png',
  dot: 'https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png',
  flag: 'https://maps.google.com/mapfiles/kml/shapes/flag.png',
  star: 'https://maps.google.com/mapfiles/kml/shapes/star.png',
  warning: 'https://maps.google.com/mapfiles/kml/shapes/caution.png',
  target: 'https://maps.google.com/mapfiles/kml/shapes/target.png',
};

export const KML_COLOUR_OPTIONS = [
  '#D6A84F', '#F4C542', '#E84C3D', '#E67E22', '#33A852',
  '#2D8CFF', '#7857D6', '#E34BA9', '#FFFFFF', '#263645',
];

const DEFAULT_STYLE = {
  icon: 'pin',
  iconHref: '',
  iconUri: '',
  color: '#D6A84F',
  opacity: 1,
  scale: 1.1,
  heading: 0,
  hotSpot: {
    x: 0.5,
    y: 0.5,
    xunits: 'fraction',
    yunits: 'fraction',
  },
  labelColor: '#FFFFFF',
  labelOpacity: 1,
  labelScale: 1,
  lineColor: '#D6A84F',
  lineOpacity: 1,
  lineWidth: 4,
  fillColor: '#D6A84F',
  fillOpacity: 0.3,
};

const decodeXml = (value) => String(value || '')
  .replace(/^\s*<!\[CDATA\[([\s\S]*)\]\]>\s*$/i, '$1')
  .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&');

const encodeXml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const descriptionToText = (value) => decodeXml(value)
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p\s*>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/\u00a0/g, ' ')
  .replace(/\r/g, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

const elementPattern = (tagName) => new RegExp(
  `<(?:[\\w.-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tagName}\\s*>`,
  'i',
);

const readElement = (xml, tagName) => {
  const match = String(xml || '').match(elementPattern(tagName));
  return match ? match[1] : '';
};

const readAttributes = (xml, tagName) => {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${tagName}\\b([^>]*)\\/?\\s*>`, 'i');
  const opening = String(xml || '').match(pattern)?.[1] || '';
  const attributes = {};
  for (const match of opening.matchAll(/([\w.-]+)\s*=\s*["']([^"']*)["']/g)) {
    attributes[match[1]] = decodeXml(match[2]).trim();
  }
  return attributes;
};

const readPlacemarkId = (xml) => {
  const opening = String(xml || '').match(/<(?:[\w.-]+:)?Placemark\b([^>]*)>/i);
  const id = opening?.[1]?.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
  return decodeXml(id || '').trim();
};

const replaceElement = (xml, tagName, value) => {
  const pattern = new RegExp(
    `(<(?:[\\w.-]+:)?${tagName}\\b[^>]*>)([\\s\\S]*?)(<\\/(?:[\\w.-]+:)?${tagName}\\s*>)`,
    'i',
  );
  const encoded = encodeXml(value);
  if (pattern.test(xml)) {
    return xml.replace(pattern, (_match, opening, _content, closing) => `${opening}${encoded}${closing}`);
  }
  return xml.replace(/(<(?:[\w.-]+:)?Placemark\b[^>]*>)/i, `$1\n      <${tagName}>${encoded}</${tagName}>`);
};

const parseCoordinateList = (value) => String(value || '')
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .map((coordinate) => {
    const parts = coordinate.split(',');
    return {
      longitude: Number(parts[0]),
      latitude: Number(parts[1]),
      altitude: Number(parts[2] || 0),
    };
  })
  .filter(({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude));

const coordinateXml = (coordinates, closeRing = false) => {
  const source = Array.isArray(coordinates) ? coordinates : [];
  const points = closeRing && source.length ? [...source, source[0]] : source;
  return points.map((coordinate) => (
    `${Number(coordinate.longitude).toFixed(8)},${Number(coordinate.latitude).toFixed(8)},${Number(coordinate.altitude || 0)}`
  )).join(' ');
};

const normaliseHex = (value, fallback) => {
  const raw = String(value || '').trim().replace('#', '');
  return /^[0-9a-f]{6}$/i.test(raw) ? `#${raw.toUpperCase()}` : fallback;
};

const kmlColourToStyle = (value, fallbackColor, fallbackOpacity = 1) => {
  const raw = String(value || '').trim().replace('#', '');
  if (!/^[0-9a-f]{8}$/i.test(raw)) return { color: fallbackColor, opacity: fallbackOpacity };
  return {
    color: `#${raw.slice(6, 8)}${raw.slice(4, 6)}${raw.slice(2, 4)}`.toUpperCase(),
    opacity: parseInt(raw.slice(0, 2), 16) / 255,
  };
};

const styleToKmlColour = (color, opacity = 1) => {
  const rgb = normaliseHex(color, DEFAULT_STYLE.color).slice(1);
  const alpha = Math.max(0, Math.min(255, Math.round(Number(opacity) * 255)))
    .toString(16).padStart(2, '0');
  return `${alpha}${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}`.toLowerCase();
};

const inferIcon = (href) => {
  const value = String(href || '').toLowerCase();
  if (/flag/.test(value)) return 'flag';
  if (/star/.test(value)) return 'star';
  if (/warn|caution|alert/.test(value)) return 'warning';
  if (/target|crosshair|bullseye/.test(value)) return 'target';
  if (/circle|dot|shaded_dot/.test(value)) return 'dot';
  return 'pin';
};

const parseStyleBlock = (xml, inherited = DEFAULT_STYLE) => {
  const iconStyle = readElement(xml, 'IconStyle');
  const labelStyle = readElement(xml, 'LabelStyle');
  const lineStyle = readElement(xml, 'LineStyle');
  const polyStyle = readElement(xml, 'PolyStyle');
  const iconHref = decodeXml(readElement(readElement(iconStyle, 'Icon'), 'href')).trim();
  const iconColour = kmlColourToStyle(readElement(iconStyle, 'color'), inherited.color, inherited.opacity);
  const labelColour = kmlColourToStyle(
    readElement(labelStyle, 'color'),
    inherited.labelColor,
    inherited.labelOpacity,
  );
  const lineColour = kmlColourToStyle(readElement(lineStyle, 'color'), inherited.lineColor, inherited.lineOpacity);
  const fillColour = kmlColourToStyle(readElement(polyStyle, 'color'), inherited.fillColor, inherited.fillOpacity);
  const scale = Number(readElement(iconStyle, 'scale'));
  const heading = Number(readElement(iconStyle, 'heading'));
  const labelScaleValue = readElement(labelStyle, 'scale').trim();
  const labelScale = Number(labelScaleValue);
  const hotSpotAttributes = readAttributes(iconStyle, 'hotSpot');
  const hotSpotX = Number(hotSpotAttributes.x);
  const hotSpotY = Number(hotSpotAttributes.y);
  const lineWidth = Number(readElement(lineStyle, 'width'));
  return {
    ...inherited,
    iconHref: iconHref || inherited.iconHref,
    iconUri: '',
    icon: iconHref ? inferIcon(iconHref) : inherited.icon,
    color: iconColour.color,
    opacity: iconColour.opacity,
    scale: Number.isFinite(scale) && scale > 0 ? scale : inherited.scale,
    heading: Number.isFinite(heading) ? heading : inherited.heading,
    hotSpot: {
      x: Number.isFinite(hotSpotX) ? hotSpotX : inherited.hotSpot.x,
      y: Number.isFinite(hotSpotY) ? hotSpotY : inherited.hotSpot.y,
      xunits: hotSpotAttributes.xunits || inherited.hotSpot.xunits,
      yunits: hotSpotAttributes.yunits || inherited.hotSpot.yunits,
    },
    labelColor: labelColour.color,
    labelOpacity: labelColour.opacity,
    labelScale: labelScaleValue && Number.isFinite(labelScale) && labelScale >= 0
      ? labelScale
      : inherited.labelScale,
    lineColor: lineColour.color,
    lineOpacity: lineColour.opacity,
    lineWidth: Number.isFinite(lineWidth) && lineWidth > 0 ? lineWidth : inherited.lineWidth,
    fillColor: fillColour.color,
    fillOpacity: fillColour.opacity,
  };
};

const parseSharedStyles = (xml) => {
  const styles = new Map();
  const maps = new Map();
  const stylePattern = /<(?:[\w.-]+:)?Style\b([^>]*)>[\s\S]*?<\/(?:[\w.-]+:)?Style\s*>/gi;
  const mapPattern = /<(?:[\w.-]+:)?StyleMap\b([^>]*)>[\s\S]*?<\/(?:[\w.-]+:)?StyleMap\s*>/gi;
  for (const match of String(xml || '').matchAll(stylePattern)) {
    const id = match[1]?.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    if (id) styles.set(id, parseStyleBlock(match[0]));
  }
  for (const match of String(xml || '').matchAll(mapPattern)) {
    const id = match[1]?.match(/\bid\s*=\s*["']([^"']+)["']/i)?.[1];
    const normalPair = [...match[0].matchAll(/<(?:[\w.-]+:)?Pair\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?Pair\s*>/gi)]
      .find((pair) => decodeXml(readElement(pair[1], 'key')).trim() === 'normal');
    const styleUrl = decodeXml(readElement(normalPair?.[1] || match[0], 'styleUrl')).trim().replace(/^#/, '');
    if (id && styleUrl) maps.set(id, styleUrl);
  }
  return { styles, maps };
};

const resolvedPlacemarkStyle = (block, shared) => {
  const styleUrl = decodeXml(readElement(block, 'styleUrl')).trim().replace(/^#/, '');
  const resolvedId = shared.maps.get(styleUrl) || styleUrl;
  const inherited = shared.styles.get(resolvedId) || DEFAULT_STYLE;
  const inline = block.match(/<(?:[\w.-]+:)?Style\b(?![^>]*\bid\s*=)[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Style\s*>/i)?.[0];
  return inline ? parseStyleBlock(inline, inherited) : { ...inherited };
};

const parseContainerRanges = (xml) => {
  const source = String(xml || '');
  const tokenPattern = /<(\/)?(?:[\w.-]+:)?(Folder|Document)\b[^>]*>/gi;
  const stack = [];
  const containers = [];
  for (const token of source.matchAll(tokenPattern)) {
    if (!token[1]) {
      const parent = stack[stack.length - 1];
      const container = {
        tagName: token[2],
        sourceOrder: containers.length,
        parent,
        depth: stack.length,
        openStart: token.index,
        openEnd: token.index + token[0].length,
        closeStart: source.length,
        closeEnd: source.length,
      };
      stack.push(container);
      containers.push(container);
    } else if (stack.length) {
      const closingTag = token[2].toLowerCase();
      let matchIndex = stack.length - 1;
      while (matchIndex >= 0 && stack[matchIndex].tagName.toLowerCase() !== closingTag) matchIndex -= 1;
      if (matchIndex < 0) continue;
      const [container] = stack.splice(matchIndex, 1);
      container.closeStart = token.index;
      container.closeEnd = token.index + token[0].length;
    }
  }

  const outerDocuments = containers.filter((container) => !container.parent && container.tagName.toLowerCase() === 'document');
  const rootContainer = outerDocuments.length === 1 ? outerDocuments[0] : null;
  const layerContainers = containers.filter((container) => container !== rootContainer);
  layerContainers.forEach((container, index) => {
    container.id = `folder-${index}`;
    container.order = index;
  });

  const directChildren = (container) => containers.filter((candidate) => candidate.parent === container);
  const readContainerName = (container, fallback) => {
    const firstChild = directChildren(container)[0]?.openStart ?? container.closeStart;
    const firstPlacemark = source.slice(container.openEnd, container.closeStart).search(/<(?:[\w.-]+:)?Placemark\b/i);
    const contentEnd = Math.min(
      firstChild,
      firstPlacemark >= 0 ? container.openEnd + firstPlacemark : container.closeStart,
    );
    return decodeXml(readElement(source.slice(container.openEnd, contentEnd), 'name')).trim() || fallback;
  };

  const folders = layerContainers.map((container) => {
    let parent = container.parent;
    while (parent && parent === rootContainer) parent = null;
    const parentLayer = parent && parent !== rootContainer ? parent : null;
    return {
      id: container.id,
      order: container.order,
      parentId: parentLayer?.id || ROOT_LAYER_ID,
      depth: Math.max(0, container.depth - (rootContainer ? 1 : 0)),
      tagName: container.tagName,
      openStart: container.openStart,
      openEnd: container.openEnd,
      closeStart: container.closeStart,
      closeEnd: container.closeEnd,
      name: readContainerName(container, `Untitled ${container.tagName.toLowerCase()} ${container.order + 1}`),
    };
  });
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  folders.forEach((folder) => {
    const parent = byId.get(folder.parentId);
    folder.path = parent ? [...parent.path, folder.name] : [folder.name];
  });

  return {
    folders,
    root: rootContainer ? {
      openStart: rootContainer.openStart,
      openEnd: rootContainer.openEnd,
      closeStart: rootContainer.closeStart,
      closeEnd: rootContainer.closeEnd,
      name: readContainerName(rootContainer, 'Document'),
    } : null,
  };
};

const folderForPosition = (folders, position) => {
  const matches = folders.filter((folder) => position > folder.openEnd && position < folder.closeStart);
  return matches.sort((left, right) => right.depth - left.depth)[0] || null;
};

const geometryDetails = (block, folder, style) => ({
  placemarkId: readPlacemarkId(block),
  name: decodeXml(readElement(block, 'name')).trim(),
  notes: descriptionToText(readElement(block, 'description')),
  folderId: folder?.id || ROOT_LAYER_ID,
  originalFolderId: folder?.id || ROOT_LAYER_ID,
  folderName: folder?.name || 'Document',
  folderPath: folder?.path || [],
  style,
});

const layerSummary = (layer, features) => {
  const direct = features.filter((feature) => feature.folderId === layer.id);
  const styles = direct.map((feature) => JSON.stringify(feature.style));
  return {
    ...layer,
    featureCount: direct.length,
    pinCount: direct.filter((feature) => feature.type === 'pin').length,
    lineCount: direct.filter((feature) => feature.type === 'line').length,
    polygonCount: direct.filter((feature) => feature.type === 'polygon').length,
    style: direct[0]?.style || { ...DEFAULT_STYLE },
    mixedStyle: new Set(styles).size > 1,
  };
};

export const parseKmlDocument = (xml) => {
  const source = String(xml || '');
  const shared = parseSharedStyles(source);
  const containers = parseContainerRanges(source);
  const folderRanges = containers.folders;
  const pins = [];
  const lines = [];
  const polygons = [];
  const indexes = { pin: 0, line: 0, polygon: 0 };

  for (const match of source.matchAll(PLACEMARK_PATTERN)) {
    const block = match[0];
    const folder = folderForPosition(folderRanges, match.index);
    const style = resolvedPlacemarkStyle(block, shared);
    const details = geometryDetails(block, folder, style);
    const pointXml = block.match(POINT_PATTERN)?.[0];
    if (pointXml) {
      const coordinate = parseCoordinateList(pointXml.match(COORDINATES_PATTERN)?.[2])[0];
      if (coordinate) {
        const sourceIndex = indexes.pin++;
        pins.push({
          id: details.placemarkId ? `placemark-${details.placemarkId}` : `source-${sourceIndex}`,
          ...details,
          sourceIndex,
          ...coordinate,
          type: 'pin',
          isNew: false,
        });
      }
      continue;
    }

    const polygonXml = block.match(POLYGON_PATTERN)?.[0];
    if (polygonXml) {
      const outerBoundary = polygonXml.match(OUTER_BOUNDARY_PATTERN)?.[0] || polygonXml;
      const coordinates = parseCoordinateList(outerBoundary.match(COORDINATES_PATTERN)?.[2]);
      if (coordinates.length >= 3) {
        const sourceIndex = indexes.polygon++;
        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];
        const closed = first && last && first.latitude === last.latitude && first.longitude === last.longitude;
        polygons.push({
          id: details.placemarkId ? `polygon-${details.placemarkId}` : `polygon-source-${sourceIndex}`,
          ...details,
          sourceIndex,
          coordinates: closed ? coordinates.slice(0, -1) : coordinates,
          type: 'polygon',
          isNew: false,
        });
      }
      continue;
    }

    const lineXml = block.match(LINE_STRING_PATTERN)?.[0];
    if (lineXml) {
      const coordinates = parseCoordinateList(lineXml.match(COORDINATES_PATTERN)?.[2]);
      if (coordinates.length >= 2) {
        const sourceIndex = indexes.line++;
        lines.push({
          id: details.placemarkId ? `line-${details.placemarkId}` : `line-source-${sourceIndex}`,
          ...details,
          sourceIndex,
          coordinates,
          type: 'line',
          isNew: false,
        });
      }
    }
  }

  const features = [...pins, ...lines, ...polygons];
  const rootLayer = layerSummary({
    id: ROOT_LAYER_ID,
    order: -1,
    parentId: null,
    depth: 0,
    name: containers.root?.name || 'Document',
    path: [],
    isRoot: true,
  }, features);
  const layers = [rootLayer, ...folderRanges.map((folder) => layerSummary(folder, features))]
    .filter((layer) => !layer.isRoot || layer.featureCount > 0 || !folderRanges.length);

  return { pins, overlays: { lines, polygons }, layers };
};

export const parseKmlPins = (xml) => parseKmlDocument(xml).pins;
export const parseKmlOverlays = (xml) => parseKmlDocument(xml).overlays;
export const parseKmlLayers = (xml) => parseKmlDocument(xml).layers;

const updateGeometryCoordinates = (block, geometryPattern, coordinates, closeRing = false) => (
  block.replace(geometryPattern, (geometryXml) => geometryXml.replace(
    COORDINATES_PATTERN,
    (_match, opening, _coordinates, closing) => `${opening}${coordinateXml(coordinates, closeRing)}${closing}`,
  ))
);

const styleXml = (style, type, indent = '      ') => {
  const resolved = { ...DEFAULT_STYLE, ...(style || {}) };
  const parts = [`${indent}<Style>`];
  if (type === 'pin') {
    const iconHref = resolved.iconHref || KML_ICON_HREFS[resolved.icon] || KML_ICON_HREFS.pin;
    parts.push(`${indent}  <IconStyle>`);
    parts.push(`${indent}    <color>${styleToKmlColour(resolved.color, resolved.opacity)}</color>`);
    parts.push(`${indent}    <scale>${Number(resolved.scale || 1.1).toFixed(2)}</scale>`);
    if (Number(resolved.heading)) {
      parts.push(`${indent}    <heading>${Number(resolved.heading).toFixed(1)}</heading>`);
    }
    parts.push(`${indent}    <Icon><href>${encodeXml(iconHref)}</href></Icon>`);
    const hotSpot = resolved.hotSpot || DEFAULT_STYLE.hotSpot;
    parts.push(`${indent}    <hotSpot x="${Number(hotSpot.x)}" y="${Number(hotSpot.y)}" xunits="${encodeXml(hotSpot.xunits || 'fraction')}" yunits="${encodeXml(hotSpot.yunits || 'fraction')}"/>`);
    parts.push(`${indent}  </IconStyle>`);
    parts.push(`${indent}  <LabelStyle>`);
    parts.push(`${indent}    <color>${styleToKmlColour(resolved.labelColor, resolved.labelOpacity)}</color>`);
    parts.push(`${indent}    <scale>${Number(resolved.labelScale ?? 1).toFixed(2)}</scale>`);
    parts.push(`${indent}  </LabelStyle>`);
  }
  if (type === 'line' || type === 'polygon') {
    parts.push(`${indent}  <LineStyle><color>${styleToKmlColour(resolved.lineColor, resolved.lineOpacity)}</color><width>${Number(resolved.lineWidth || 4).toFixed(1)}</width></LineStyle>`);
  }
  if (type === 'polygon') {
    parts.push(`${indent}  <PolyStyle><color>${styleToKmlColour(resolved.fillColor, resolved.fillOpacity)}</color></PolyStyle>`);
  }
  parts.push(`${indent}</Style>`);
  return parts.join('\n');
};

const applyPlacemarkStyle = (block, feature, type) => {
  if (!feature.styleEdited) return block;
  let output = block.replace(/\s*<(?:[\w.-]+:)?styleUrl\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?styleUrl\s*>/i, '');
  const inlinePattern = /<(?:[\w.-]+:)?Style\b(?![^>]*\bid\s*=)[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Style\s*>/i;
  if (inlinePattern.test(output)) return output.replace(inlinePattern, styleXml(feature.style, type, '      '));
  return output.replace(/(<(?:[\w.-]+:)?Placemark\b[^>]*>)/i, `$1\n${styleXml(feature.style, type, '      ')}`);
};

const createPlacemark = ({ name, notes, geometryXml, style, type }) => [
  '    <Placemark>',
  `      <name>${encodeXml(name || 'Untitled feature')}</name>`,
  `      <description>${encodeXml(notes || '')}</description>`,
  styleXml(style, type),
  geometryXml,
  '    </Placemark>',
].join('\n');

const createPointPlacemark = (pin) => createPlacemark({
  name: pin.name || 'New pin', notes: pin.notes, style: pin.style, type: 'pin',
  geometryXml: `      <Point>\n        <coordinates>${coordinateXml([pin])}</coordinates>\n      </Point>`,
});

const createLinePlacemark = (line) => createPlacemark({
  name: line.name || 'Survey line', notes: line.notes, style: line.style, type: 'line',
  geometryXml: `      <LineString>\n        <tessellate>1</tessellate>\n        <coordinates>${coordinateXml(line.coordinates)}</coordinates>\n      </LineString>`,
});

const createPolygonPlacemark = (polygon) => createPlacemark({
  name: polygon.name || 'Survey area', notes: polygon.notes, style: polygon.style, type: 'polygon',
  geometryXml: `      <Polygon>\n        <tessellate>1</tessellate>\n        <outerBoundaryIs><LinearRing>\n          <coordinates>${coordinateXml(polygon.coordinates, true)}</coordinates>\n        </LinearRing></outerBoundaryIs>\n      </Polygon>`,
});

const sourceMap = (features) => new Map(
  (Array.isArray(features) ? features : [])
    .filter((feature) => !feature.isNew && Number.isInteger(feature.sourceIndex))
    .map((feature) => [feature.sourceIndex, feature]),
);

const insertPlacemark = (xml, folderId, placemarkXml) => {
  const output = String(xml || '');
  if (folderId && folderId !== ROOT_LAYER_ID) {
    const folder = parseContainerRanges(output).folders.find((item) => item.id === folderId);
    if (folder) return `${output.slice(0, folder.closeStart)}${placemarkXml}\n${output.slice(folder.closeStart)}`;
  }
  const documentClose = /<\/(?:[\w.-]+:)?Document\s*>/gi;
  const matches = [...output.matchAll(documentClose)];
  const target = matches[matches.length - 1];
  if (target) return `${output.slice(0, target.index)}${placemarkXml}\n  ${output.slice(target.index)}`;
  return output.replace(/(<\/(?:[\w.-]+:)?kml\s*>)/i, `${placemarkXml}\n$1`);
};

export const buildKmlDocument = (originalXml, features = {}) => {
  const pins = Array.isArray(features.pins) ? features.pins : [];
  const lines = Array.isArray(features.lines) ? features.lines : [];
  const polygons = Array.isArray(features.polygons) ? features.polygons : [];
  const sources = { pin: sourceMap(pins), line: sourceMap(lines), polygon: sourceMap(polygons) };
  const sourceIndexes = { pin: 0, line: 0, polygon: 0 };
  const insertions = [];

  let output = String(originalXml || '').replace(PLACEMARK_PATTERN, (block) => {
    let type = '';
    let geometryPattern = null;
    let closeRing = false;
    if (POINT_PATTERN.test(block)) { type = 'pin'; geometryPattern = POINT_PATTERN; }
    else if (POLYGON_PATTERN.test(block)) { type = 'polygon'; geometryPattern = POLYGON_PATTERN; closeRing = true; }
    else if (LINE_STRING_PATTERN.test(block)) { type = 'line'; geometryPattern = LINE_STRING_PATTERN; }
    else return block;

    const feature = sources[type].get(sourceIndexes[type]++);
    if (!feature) return block;
    if (feature.deleted) return '';
    let updated = replaceElement(block, 'name', feature.name || `Untitled ${type}`);
    updated = replaceElement(updated, 'description', feature.notes || '');
    updated = updateGeometryCoordinates(updated, geometryPattern, type === 'pin' ? [feature] : feature.coordinates, closeRing);
    updated = applyPlacemarkStyle(updated, feature, type);
    if (feature.folderId !== feature.originalFolderId) {
      insertions.push({ folderId: feature.folderId, xml: updated });
      return '';
    }
    return updated;
  });

  pins.filter((item) => item.isNew && !item.deleted).forEach((item) => insertions.push({ folderId: item.folderId, xml: createPointPlacemark(item) }));
  lines.filter((item) => item.isNew && !item.deleted).forEach((item) => insertions.push({ folderId: item.folderId, xml: createLinePlacemark(item) }));
  polygons.filter((item) => item.isNew && !item.deleted).forEach((item) => insertions.push({ folderId: item.folderId, xml: createPolygonPlacemark(item) }));
  insertions.forEach((item) => { output = insertPlacemark(output, item.folderId, item.xml); });
  return output;
};

export const buildKmlWithPins = (originalXml, pins) => buildKmlDocument(originalXml, { pins });

const layerDefaults = (layer) => ({
  folderId: layer?.id || ROOT_LAYER_ID,
  originalFolderId: layer?.id || ROOT_LAYER_ID,
  folderName: layer?.name || 'Document',
  folderPath: layer?.path || [],
  style: { ...DEFAULT_STYLE, ...(layer?.style || {}) },
});

export const createKmlPin = ({ latitude, longitude }, layer) => ({
  id: secureRandomId('new-pin'),
  sourceIndex: null,
  placemarkId: '',
  latitude: Number(latitude),
  longitude: Number(longitude),
  altitude: 0,
  name: 'New pin',
  notes: '',
  type: 'pin',
  ...layerDefaults(layer),
  styleEdited: true,
  isNew: true,
});

const createGeometry = (type, coordinates, layer) => ({
  id: secureRandomId(`new-${type}`),
  sourceIndex: null,
  placemarkId: '',
  coordinates: (coordinates || []).map((coordinate) => ({
    latitude: Number(coordinate.latitude),
    longitude: Number(coordinate.longitude),
    altitude: Number(coordinate.altitude || 0),
  })),
  name: type === 'line' ? 'Survey line' : 'Survey area',
  notes: '',
  type,
  ...layerDefaults(layer),
  styleEdited: true,
  isNew: true,
});

export const createKmlLine = (coordinates, layer) => createGeometry('line', coordinates, layer);
export const createKmlPolygon = (coordinates, layer) => createGeometry('polygon', coordinates, layer);

export const kmlFeaturesEqual = (left = {}, right = {}) => JSON.stringify({
  pins: left.pins || [], lines: left.lines || [], polygons: left.polygons || [],
}) === JSON.stringify({
  pins: right.pins || [], lines: right.lines || [], polygons: right.polygons || [],
});

export const kmlPinsEqual = (left = [], right = []) => JSON.stringify(left) === JSON.stringify(right);
export { DEFAULT_STYLE as KML_DEFAULT_STYLE, ROOT_LAYER_ID as KML_ROOT_LAYER_ID };
