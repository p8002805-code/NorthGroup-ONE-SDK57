import AsyncStorage from '@react-native-async-storage/async-storage';

const TIDE_SITES_CACHE_KEY = 'northgroup_one_bom_tide_sites_v1';
const TIDE_SITES_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_TIDE_DISTANCE_KM = 140;

const TIDE_SITES_URL = 'https://www.bom.gov.au/australia/tides/tide_prediction_sites.json';
const TIDE_TABLE_URL = 'https://www.bom.gov.au/australia/tides/scripts/getTidesTable.php';

const unavailableTides = (reason = 'No nearby tide station') => ({
  available: false,
  stationName: '',
  distanceKm: null,
  events: [],
  caution: false,
  reason,
});

const unavailableMarine = (reason = 'Marine forecast unavailable') => ({
  available: false,
  waveHeight: 'N/A',
  waveDirection: 'N/A',
  wavePeriod: 'N/A',
  swellHeight: 'N/A',
  swellDirection: 'N/A',
  swellPeriod: 'N/A',
  seaLevel: 'N/A',
  hourly: [],
  reason,
});

const withTimeout = (promise, timeoutMs, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  }),
]);

const fetchText = async (url) => {
  const response = await withTimeout(fetch(url), REQUEST_TIMEOUT_MS, 'Marine request timed out');
  if (!response.ok) throw new Error(`Marine request failed (${response.status})`);
  return response.text();
};

const fetchJson = async (url) => {
  const response = await withTimeout(fetch(url), REQUEST_TIMEOUT_MS, 'Marine request timed out');
  if (!response.ok) throw new Error(`Marine request failed (${response.status})`);
  return response.json();
};

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const distanceKm = (latitudeOne, longitudeOne, latitudeTwo, longitudeTwo) => {
  const earthRadius = 6371;
  const latOne = (latitudeOne * Math.PI) / 180;
  const latTwo = (latitudeTwo * Math.PI) / 180;
  const deltaLat = ((latitudeTwo - latitudeOne) * Math.PI) / 180;
  const deltaLon = ((longitudeTwo - longitudeOne) * Math.PI) / 180;
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latOne) * Math.cos(latTwo) * Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const loadTideSites = async () => {
  try {
    const cached = await AsyncStorage.getItem(TIDE_SITES_CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.savedAt && Array.isArray(parsed.sites)
        && Date.now() - parsed.savedAt < TIDE_SITES_CACHE_MAX_AGE_MS) {
        return parsed.sites;
      }
    }
  } catch (_error) {
    // A fresh request below can still recover the station list.
  }

  try {
    const data = await fetchJson(TIDE_SITES_URL);
    const sites = (data?.features || [])
      .map((feature) => {
        const properties = feature?.properties || {};
        const coordinates = feature?.geometry?.coordinates || [];
        return {
          name: String(properties.PORT_NAME || '').trim(),
          aac: properties.AAC,
          stateCode: properties.STATE_CODE,
          timezone: properties.TIME_ZONE,
          latitude: numberOrNull(properties.LAT ?? coordinates[1]),
          longitude: numberOrNull(properties.LON ?? coordinates[0]),
          available: properties.AVAIL_FLAG === 'Y',
          type: properties.TYPE,
          secondary: properties.PS_FLAG === 'S',
        };
      })
      .filter((site) => site.name && site.aac && site.stateCode
        && site.latitude !== null && site.longitude !== null
        && site.available && site.type === 'TIDE');

    await AsyncStorage.setItem(
      TIDE_SITES_CACHE_KEY,
      JSON.stringify({ savedAt: Date.now(), sites })
    );
    return sites;
  } catch (_error) {
    return [];
  }
};

const nearestTideSite = async (location) => {
  const latitude = numberOrNull(location?.latitude);
  const longitude = numberOrNull(location?.longitude);
  if (latitude === null || longitude === null) return null;

  const sites = await loadTideSites();
  return sites
    .map((site) => ({
      ...site,
      distanceKm: distanceKm(latitude, longitude, site.latitude, site.longitude),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .find((site) => site.distanceKm <= MAX_TIDE_DISTANCE_KM) || null;
};

const bomDateFor = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone || 'Australia/Brisbane',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `${parts.day}-${parts.month}-${parts.year}`;
};

const timeLabelFromIso = (value) => {
  const match = String(value || '').match(/(?:T|\s)(\d{2}):(\d{2})/);
  if (!match) return 'N/A';
  const hour = Number(match[1]);
  const minute = match[2];
  const suffix = hour >= 12 ? 'pm' : 'am';
  const twelveHour = hour % 12 || 12;
  return `${twelveHour}:${minute} ${suffix}`;
};

const parseTideTable = (html) => {
  const dayBlocks = String(html || '')
    .split(/<div class="tide-day[^>]*">/i)
    .slice(1)
    .map((block) => block.split(/<div class="tide-day[^>]*">/i)[0]);

  const events = [];
  dayBlocks.forEach((block) => {
    const dayLabel = block.match(/<h[23][^>]*>\s*([^<]+)\s*<\/h[23]>/i)?.[1]?.trim() || '';
    const eventPattern = /<th[^>]*class="[^"]*instance[^\"]*(?:high-tide|low-tide)[^\"]*"[^>]*>\s*(High|Low)\s*<\/th>[\s\S]*?<td[^>]*data-time-local="([^"]+)"[^>]*>[\s\S]*?<\/td>[\s\S]*?<td[^>]*class="[^"]*height[^\"]*(?:high-tide|low-tide)[^\"]*"[^>]*>\s*([^<]+)\s*<\/td>/gi;
    let match = eventPattern.exec(block);
    while (match) {
      events.push({
        dayLabel,
        type: match[1],
        isoTime: match[2],
        time: timeLabelFromIso(match[2]),
        height: match[3].trim(),
      });
      match = eventPattern.exec(block);
    }
  });
  return events;
};

export const fetchTideForecast = async (location) => {
  try {
    const site = await nearestTideSite(location);
    if (!site) return unavailableTides();

    const query = [
      `type=tide`,
      `aac=${encodeURIComponent(site.aac)}`,
      `date=${encodeURIComponent(bomDateFor(new Date(), site.timezone))}`,
      'days=2',
      `region=${encodeURIComponent(site.stateCode)}`,
      'offset=0',
      'offsetName=',
      `tz=${encodeURIComponent(site.timezone || 'Australia/Brisbane')}`,
      'tz_js=AEST',
    ].join('&');
    const html = await fetchText(`${TIDE_TABLE_URL}?${query}`);
    const events = parseTideTable(html);
    if (!events.length) return unavailableTides('Tide data is currently unavailable');

    return {
      available: true,
      stationName: site.name,
      distanceKm: Math.round(site.distanceKm),
      events: events.slice(0, 8),
      caution: site.secondary,
      source: 'Bureau of Meteorology tide predictions',
    };
  } catch (_error) {
    return unavailableTides('Tide data is currently unavailable');
  }
};

const marineNumber = (value, decimals = 1) => {
  const number = numberOrNull(value);
  if (number === null) return 'N/A';
  return `${number.toFixed(decimals)} m`;
};

const marineHourLabel = (isoTime, offset) => {
  if (offset === 0) return 'Now';
  const match = String(isoTime || '').match(/T(\d{2}):/);
  if (!match) return '';
  const hour = Number(match[1]);
  return `${hour % 12 || 12}${hour >= 12 ? 'pm' : 'am'}`;
};

export const fetchMarineForecast = async (location) => {
  try {
    const variables = [
      'wave_height',
      'wave_direction',
      'wave_period',
      'swell_wave_height',
      'swell_wave_direction',
      'swell_wave_period',
      'sea_level_height_msl',
    ].join(',');
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${location.latitude}&longitude=${location.longitude}&hourly=${variables}&forecast_days=2&timezone=auto&length_unit=metric`;
    const data = await fetchJson(url);
    const hourly = data?.hourly || {};
    const times = hourly.time || [];
    if (!times.length) return unavailableMarine();

    let startIndex = times.findIndex((time) => new Date(time).getTime() >= Date.now());
    if (startIndex < 0) startIndex = 0;
    const forecast = times.slice(startIndex, startIndex + 24).map((time, offset) => {
      const index = startIndex + offset;
      return {
        time,
        label: marineHourLabel(time, offset),
        waveHeight: numberOrNull(hourly.wave_height?.[index]),
        waveDirection: numberOrNull(hourly.wave_direction?.[index]),
        wavePeriod: numberOrNull(hourly.wave_period?.[index]),
        swellHeight: numberOrNull(hourly.swell_wave_height?.[index]),
        swellDirection: numberOrNull(hourly.swell_wave_direction?.[index]),
        swellPeriod: numberOrNull(hourly.swell_wave_period?.[index]),
        seaLevel: numberOrNull(hourly.sea_level_height_msl?.[index]),
      };
    });
    const current = forecast[0] || {};
    const available = forecast.some((item) => [
      item.waveHeight,
      item.swellHeight,
      item.seaLevel,
    ].some((value) => value !== null));
    if (!available) return unavailableMarine('No marine data for this location');

    return {
      available: true,
      waveHeight: marineNumber(current.waveHeight),
      waveDirection: current.waveDirection === null ? 'N/A' : `${Math.round(current.waveDirection)}°`,
      wavePeriod: current.wavePeriod === null ? 'N/A' : `${current.wavePeriod.toFixed(1)} s`,
      swellHeight: marineNumber(current.swellHeight),
      swellDirection: current.swellDirection === null ? 'N/A' : `${Math.round(current.swellDirection)}°`,
      swellPeriod: current.swellPeriod === null ? 'N/A' : `${current.swellPeriod.toFixed(1)} s`,
      seaLevel: current.seaLevel === null ? 'N/A' : `${current.seaLevel.toFixed(2)} m`,
      hourly: forecast,
      timezone: data.timezone,
      source: 'Open-Meteo marine forecast',
    };
  } catch (_error) {
    return unavailableMarine();
  }
};

export const loadHydroDetails = async (location) => {
  const [marine, tides] = await Promise.all([
    fetchMarineForecast(location),
    fetchTideForecast(location),
  ]);
  return { marine, tides };
};
