export const MAX_TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;

const TEXT_FILE_PATTERN = /\.(txt|md|markdown|csv|tsv|json|geojson|xml|kml|gpx|log|ini|cfg|conf|yaml|yml)$/i;

export const isTextJobFile = (item) => {
  const name = String(item?.name || '');
  const mimeType = String(item?.file?.mimeType || '').toLowerCase();

  return mimeType.startsWith('text/')
    || ['application/json', 'application/geo+json', 'application/xml'].includes(mimeType)
    || mimeType.endsWith('+json')
    || mimeType.endsWith('+xml')
    || TEXT_FILE_PATTERN.test(name);
};

export const formatJobFileText = (value, fileName = '') => {
  const text = String(value || '').replace(/^\uFEFF/, '');
  if (!/\.(json|geojson)$/i.test(String(fileName))) return text;

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};
