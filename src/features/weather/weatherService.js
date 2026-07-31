import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

import { loadHydroDetails } from './marineService';

const WEATHER_CACHE_KEY = 'northgroup_one_weather_v2';
const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
const LOCATION_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 12000;
const HYDRO_TIMEOUT_MS = 4500;

const EMPTY_DETAILS = {
  feelsLike: '…',
  humidity: '…',
  rainChance: '…',
  gusts: '…',
  visibility: '…',
  uvIndex: '…',
  sunrise: '…',
  sunset: '…',
  hourly: [],
  daily: [],
  bestWorkingWindow: {
    title: 'Working window loading',
    detail: 'Comparing the next few hours for rain, wind, heat and visibility.',
    start: '',
    end: '',
  },
  weatherChange: null,
  safetyAlerts: [],
  tides: { available: false, events: [] },
  marine: { available: false, hourly: [] },
  fieldOutlook: {
    level: 'loading',
    title: 'Checking field conditions',
    detail: 'Gathering the latest forecast for your work location.',
  },
};

export const WEATHER_LOADING = {
  temperature: '…',
  condition: 'Updating local weather',
  wind: '…',
  icon: '☁️',
  code: null,
  isDay: true,
  isWet: false,
  locationLabel: 'Locating…',
  locationSource: 'auto',
  updatedAt: null,
  ...EMPTY_DETAILS,
};

const OFFICE_COORDINATES = [
  { match: 'brisbane', label: 'Brisbane office', latitude: -27.4698, longitude: 153.0251 },
  { match: 'gold coast', label: 'Gold Coast office', latitude: -28.0167, longitude: 153.4 },
  { match: 'sunshine coast', label: 'Sunshine Coast office', latitude: -26.65, longitude: 153.0667 },
  { match: 'toowoomba', label: 'Toowoomba office', latitude: -27.5598, longitude: 151.9507 },
  { match: 'rockhampton', label: 'Rockhampton office', latitude: -23.3791, longitude: 150.51 },
  { match: 'mackay', label: 'Mackay office', latitude: -21.1411, longitude: 149.186 },
  { match: 'townsville', label: 'Townsville office', latitude: -19.2589, longitude: 146.8169 },
  { match: 'cairns', label: 'Cairns office', latitude: -16.9186, longitude: 145.7781 },
];

const numberOrNull = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const roundedOrNull = (value) => {
  const number = numberOrNull(value);
  return number === null ? null : Math.round(number);
};

const coordinatesFrom = (value) => {
  if (!value || typeof value !== 'object') return null;
  const latitude = numberOrNull(value.latitude ?? value.lat ?? value.coords?.latitude);
  const longitude = numberOrNull(value.longitude ?? value.lng ?? value.lon ?? value.coords?.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
};

const textFromLocation = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  return String(
    value.address
      || value.name
      || value.label
      || value.suburb
      || value.city
      || ''
  ).trim();
};

const jobLocation = (job) => {
  if (!job || typeof job !== 'object') return null;
  const coordinates = coordinatesFrom(job)
    || coordinatesFrom(job?.location)
    || coordinatesFrom(job?.siteLocation)
    || coordinatesFrom(job?.coordinates)
    || coordinatesFrom(job?.siteCoordinates);
  const query = [
    textFromLocation(job?.siteAddress),
    textFromLocation(job?.address),
    textFromLocation(job?.siteLocation),
    textFromLocation(job?.location),
    textFromLocation(job?.locationName),
    textFromLocation(job?.name),
  ].find(Boolean) || '';
  if (!coordinates && !query) return null;
  return {
    ...(coordinates || {}),
    query,
    label: textFromLocation(job?.siteLocation)
      || textFromLocation(job?.location)
      || job?.name
      || job?.number
      || 'Today\'s job',
    source: 'job',
    jobNumber: String(job?.number || '').trim(),
  };
};

const officeLocation = (office) => {
  const value = String(office || '').trim().toLowerCase();
  const match = OFFICE_COORDINATES.find((item) => value.includes(item.match)) || OFFICE_COORDINATES[0];
  return { ...match, source: 'office' };
};

const knownAreaLocation = (query) => {
  const value = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
  return OFFICE_COORDINATES.find((item) => [
    item.match,
    `${item.match} qld`,
    `${item.match}, qld`,
    `${item.match} queensland`,
    `${item.match}, queensland`,
    `${item.match} australia`,
    `${item.match}, australia`,
  ].includes(value)) || null;
};

const geocodeJobLocation = async (candidate) => {
  if (!candidate) return null;
  if (numberOrNull(candidate.latitude) !== null && numberOrNull(candidate.longitude) !== null) {
    return candidate;
  }
  if (!candidate.query) return null;

  const knownArea = knownAreaLocation(candidate.query);
  if (knownArea) {
    return {
      ...candidate,
      latitude: knownArea.latitude,
      longitude: knownArea.longitude,
      geocoded: true,
      geocodeSource: 'known area fallback',
    };
  }

  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(candidate.query)}&count=5&language=en&format=json&countryCode=AU`;
  try {
    const response = await withTimeout(fetch(url), REQUEST_TIMEOUT_MS, 'Job site lookup timed out');
    if (!response.ok) throw new Error(`Job site lookup failed (${response.status})`);
    const data = await response.json();
    const result = (data?.results || []).find((item) => item?.country_code === 'AU')
      || data?.results?.[0];
    if (!result || numberOrNull(result.latitude) === null || numberOrNull(result.longitude) === null) {
      return null;
    }

    return {
      ...candidate,
      latitude: Number(result.latitude),
      longitude: Number(result.longitude),
      label: candidate.label || `${result.name}${result.admin1 ? `, ${result.admin1}` : ''}`,
      geocoded: true,
    };
  } catch (error) {
    const fallback = knownAreaLocation(candidate.label);
    if (!fallback) throw error;

    return {
      ...candidate,
      latitude: fallback.latitude,
      longitude: fallback.longitude,
      geocoded: true,
      geocodeSource: 'known area fallback',
    };
  }
};

export const weatherLocationOptions = ({ profile, job } = {}) => [
  { id: 'job', label: 'Job site', available: Boolean(jobLocation(job)) },
  { id: 'current', label: 'My location', available: true },
].filter((item) => item.available);

export const weatherDescription = (code) => {
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Current conditions';
};

export const weatherIcon = (code, isDay = true) => {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code === 1) return isDay ? '🌤️' : '🌙';
  if (code === 2) return isDay ? '⛅' : '🌙☁️';
  if (code === 3) return isDay ? '☁️' : '🌙☁️';
  if ([45, 48].includes(code)) return isDay ? '🌫️' : '🌙';
  if ([51, 53, 55, 56, 57].includes(code)) return isDay ? '🌦️' : '🌙🌧️';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return isDay ? '🌧️' : '🌙🌧️';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return isDay ? '🌨️' : '🌙🌨️';
  if ([95, 96, 99].includes(code)) return isDay ? '⛈️' : '🌙⛈️';
  return isDay ? '☁️' : '🌙☁️';
};

const isWetWeather = (code) => [
  51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
  80, 81, 82, 95, 96, 99,
].includes(code);

const withTimeout = (promise, timeoutMs, message) => Promise.race([
  promise,
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs);
  }),
]);

const loadCachedWeather = async () => {
  try {
    const saved = await AsyncStorage.getItem(WEATHER_CACHE_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed?.weather && parsed?.savedAt ? parsed : null;
  } catch (_error) {
    return null;
  }
};

const currentPhoneLocation = async () => {
  let permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted && permission.canAskAgain) {
    permission = await Location.requestForegroundPermissionsAsync();
  }
  if (!permission.granted) return null;

  const lastKnown = await Location.getLastKnownPositionAsync({
    maxAge: CACHE_MAX_AGE_MS,
    requiredAccuracy: 10000,
  });
  const position = lastKnown || await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    LOCATION_TIMEOUT_MS,
    'Location timed out'
  );
  if (!position?.coords) return null;

  let label = 'Current location';
  try {
    const places = await withTimeout(
      Location.reverseGeocodeAsync(position.coords),
      3000,
      'Location name timed out'
    );
    const place = places?.[0];
    label = place?.city || place?.district || place?.subregion || label;
  } catch (_error) {
    // Coordinates are still useful when a readable place name is unavailable.
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    label,
    source: 'current',
  };
};

const resolveLocation = async ({ office, profile, job, preference = 'auto' } = {}) => {
  const jobSite = jobLocation(job);
  const effectivePreference = preference === 'auto'
    ? (jobSite ? 'job' : 'current')
    : preference;

  if (effectivePreference === 'job') {
    const resolvedJob = await geocodeJobLocation(jobSite);
    if (resolvedJob) return resolvedJob;
    throw new Error('The selected job site has no usable location');
  }

  if (effectivePreference === 'current') {
    const current = await currentPhoneLocation();
    if (current) return current;
    throw new Error('Current location is unavailable');
  }

  // Kept for callers from older builds that only supplied an office name.
  return officeLocation(office || profile?.office);
};

const formatHour = (isoTime) => {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: 'numeric' });
};

const formatDay = (isoDate, index) => {
  if (index === 0) return 'Today';
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? isoDate
    : date.toLocaleDateString([], { weekday: 'short' });
};

const formatClockTime = (isoTime) => {
  const date = new Date(isoTime);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

const COMPASS_POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

const compassDirection = (degrees) => {
  const value = numberOrNull(degrees);
  if (value === null) return '';
  return COMPASS_POINTS[Math.round((((value % 360) + 360) % 360) / 22.5) % COMPASS_POINTS.length];
};

const windDirectionLabel = (degrees) => {
  const value = numberOrNull(degrees);
  if (value === null) return 'Direction unavailable';
  return `${compassDirection(value)} ${Math.round(value)}°`;
};

const levelRank = { good: 0, warning: 1, danger: 2 };

const forecastWhen = (hour) => {
  if (!hour) return 'today';
  if (hour.label === 'Now') return 'now';
  return hour.dayOffset > 0
    ? `tomorrow around ${hour.label}`
    : `around ${hour.label}`;
};

const makeAlert = (id, level, title, detail, hour) => ({
  id,
  level,
  title,
  detail,
  timeLabel: hour?.label
    ? `${hour.dayOffset > 0 ? 'Tomorrow ' : ''}${hour.label}`
    : '',
});

const weatherChange = (hourly) => {
  if (!hourly?.length) return null;
  const baseline = hourly[0];
  const future = hourly.slice(1, 9);
  const storm = future.find((hour) => [95, 96, 99].includes(hour.code));
  if (storm) {
    return {
      level: 'danger',
      title: 'Weather changing soon',
      detail: `Thunderstorm risk develops ${forecastWhen(storm)}. Finish exposed GNSS, pole and photo work beforehand.`,
      timeLabel: storm.label,
    };
  }

  const rain = future.find((hour) => (
    hour.rainChance - (baseline.rainChance || 0) >= 25
    && hour.rainChance >= 50
  ));
  if (rain) {
    return {
      level: 'warning',
      title: 'Weather changing soon',
      detail: `Rain probability rises to ${rain.rainChance}% ${forecastWhen(rain)}. Consider completing exposed setup and photo capture earlier.`,
      timeLabel: rain.label,
    };
  }

  const wind = future.find((hour) => (
    hour.gusts - (baseline.gusts || 0) >= 15
    && hour.gusts >= 40
  ));
  if (wind) {
    return {
      level: 'warning',
      title: 'Weather changing soon',
      detail: `Gusts build to ${wind.gusts} km/h ${forecastWhen(wind)}. Secure tripods, poles and lightweight equipment.`,
      timeLabel: wind.label,
    };
  }

  const wet = future.find((hour) => (
    !isWetWeather(baseline.code)
    && isWetWeather(hour.code)
    && hour.rainChance >= 30
  ));
  if (wet) {
    return {
      level: 'warning',
      title: 'Weather changing soon',
      detail: `Showers may develop ${forecastWhen(wet)}. Keep electronics and field records protected.`,
      timeLabel: wet.label,
    };
  }

  return null;
};

const safetyAlertsFor = ({ current, hourly }) => {
  const hours = hourly || [];
  const alerts = [];
  const firstStorm = hours.find((hour) => [95, 96, 99].includes(hour.code));
  if (firstStorm) {
    alerts.push(makeAlert(
      'lightning',
      'danger',
      'Lightning risk',
      `Thunderstorms are possible ${forecastWhen(firstStorm)}. Stop exposed work and move to a safe shelter if thunder is heard.`,
      firstStorm
    ));
  }

  const firstHeavyRain = hours.find((hour) => (
    hour.rainChance >= 80 || [65, 67, 82].includes(hour.code)
  ));
  if (firstHeavyRain) {
    alerts.push(makeAlert(
      firstHeavyRain.code === 65 || firstHeavyRain.code === 82 ? 'heavy-rain' : 'rain',
      firstHeavyRain.code === 65 || firstHeavyRain.code === 82 ? 'danger' : 'warning',
      firstHeavyRain.code === 65 || firstHeavyRain.code === 82 ? 'Heavy rain risk' : 'Rain disruption likely',
      `Rain may affect access, equipment protection and photo capture ${forecastWhen(firstHeavyRain)}.`,
      firstHeavyRain
    ));
  }

  const firstHighWind = hours.find((hour) => hour.gusts >= 45);
  if (firstHighWind) {
    const danger = firstHighWind.gusts >= 60;
    alerts.push(makeAlert(
      'wind',
      danger ? 'danger' : 'warning',
      danger ? 'High wind risk' : 'Strong wind to monitor',
      `Gusts may reach ${firstHighWind.gusts} km/h ${forecastWhen(firstHighWind)}. Take care with GNSS poles, tripods, drones and traffic exposure.`,
      firstHighWind
    ));
  }

  const firstHeat = hours.find((hour) => hour.feelsLike >= 35);
  if (firstHeat) {
    const danger = firstHeat.feelsLike >= 40;
    alerts.push(makeAlert(
      'heat',
      danger ? 'danger' : 'warning',
      danger ? 'Extreme heat' : 'High heat exposure',
      `Feels-like temperature reaches ${firstHeat.feelsLike}° ${forecastWhen(firstHeat)}. Plan water, shade and recovery breaks.`,
      firstHeat
    ));
  }

  const firstVisibility = hours.find((hour) => hour.visibility !== null && hour.visibility < 2000);
  if (firstVisibility) {
    const danger = firstVisibility.visibility < 1000;
    alerts.push(makeAlert(
      'visibility',
      danger ? 'danger' : 'warning',
      danger ? 'Poor visibility' : 'Reduced visibility',
      `Visibility may fall to ${Math.round(firstVisibility.visibility / 100) / 10} km ${forecastWhen(firstVisibility)}. Allow for traffic and reduced sight distance.`,
      firstVisibility
    ));
  }

  const firstHighUv = hours.find((hour) => hour.uvIndex >= 8);
  if (firstHighUv) {
    alerts.push(makeAlert(
      'uv',
      firstHighUv.uvIndex >= 11 ? 'danger' : 'warning',
      firstHighUv.uvIndex >= 11 ? 'Extreme UV' : 'High UV',
      `UV index reaches ${firstHighUv.uvIndex} ${forecastWhen(firstHighUv)}. Use sun-safe PPE, sunscreen and shade where possible.`,
      firstHighUv
    ));
  }

  const change = weatherChange(hours);
  if (change) {
    alerts.push(makeAlert('rapid-change', change.level, change.title, change.detail, { label: change.timeLabel }));
  }

  return alerts.sort((left, right) => (
    (levelRank[right.level] || 0) - (levelRank[left.level] || 0)
  ));
};

const bestWorkingWindow = (hourly) => {
  const candidates = [];
  let current = null;

  const closeWindow = () => {
    if (!current) return;
    candidates.push(current);
    current = null;
  };

  (hourly || []).forEach((hour) => {
    const workable = hour.isDay
      && hour.rainChance <= 30
      && hour.gusts < 45
      && hour.feelsLike < 35
      && (hour.visibility === null || hour.visibility >= 2000)
      && ![95, 96, 99].includes(hour.code);
    if (!workable) {
      closeWindow();
      return;
    }
    if (!current) current = { start: hour, end: hour, count: 0 };
    current.end = hour;
    current.count += 1;
  });
  closeWindow();

  const best = candidates.sort((left, right) => right.count - left.count)[0];
  if (!best) {
    return {
      level: 'warning',
      title: 'No clear working window yet',
      detail: 'Rain, wind, heat, visibility or night conditions limit the next forecast period. Recheck before heading out.',
      start: '',
      end: '',
    };
  }

  const endIndex = (hourly || []).findIndex((hour) => hour.time === best.end.time) + 1;
  const endHour = hourly?.[endIndex] || best.end;
  const start = best.start.label === 'Now' ? 'Now' : formatHour(best.start.time);
  const end = formatHour(endHour.time);
  return {
    level: 'good',
    title: `Best working window ${start}–${end}`,
    detail: 'Lower rain probability, manageable gusts and usable visibility make this the best period for exposed field work.',
    start,
    end,
  };
};

const fieldOutlook = (alerts, change) => {
  const lead = alerts?.[0];
  if (lead) return { level: lead.level, title: lead.title, detail: lead.detail };
  if (change) return { level: change.level, title: change.title, detail: change.detail };
  return { level: 'good', title: 'Conditions look workable', detail: 'No major field-weather trigger is showing. Continue normal site checks.' };
};

const parseHourly = (data) => {
  const hourly = data?.hourly || {};
  const times = hourly.time || [];
  if (!times.length) return [];
  const currentTime = data?.current?.time || times[0];
  let startIndex = times.findIndex((time) => time >= currentTime);
  if (startIndex < 0) startIndex = 0;
  const forecastStartDate = String(times[startIndex] || '').slice(0, 10);

  const daylightFor = (time) => {
    const daily = data?.daily || {};
    const date = String(time || '').slice(0, 10);
    const dayIndex = (daily.time || []).findIndex((item) => item === date);
    if (dayIndex < 0) return null;

    const sunrise = String(daily.sunrise?.[dayIndex] || '').slice(0, 16);
    const sunset = String(daily.sunset?.[dayIndex] || '').slice(0, 16);
    const hour = String(time || '').slice(0, 16);
    if (!sunrise || !sunset || !hour) return null;
    return hour >= sunrise && hour < sunset;
  };

  return times.slice(startIndex, startIndex + 24).map((time, offset) => {
    const index = startIndex + offset;
    const date = String(time || '').slice(0, 10);
    const code = Number(hourly.weather_code?.[index]);
    const isDay = daylightFor(time) ?? Number(hourly.is_day?.[index]) === 1;
    return {
      time,
      dayOffset: date && forecastStartDate && date !== forecastStartDate ? 1 : 0,
      label: offset === 0 ? 'Now' : formatHour(time),
      temperature: roundedOrNull(hourly.temperature_2m?.[index]),
      feelsLike: roundedOrNull(hourly.apparent_temperature?.[index]),
      rainChance: roundedOrNull(hourly.precipitation_probability?.[index]) ?? 0,
      wind: roundedOrNull(hourly.wind_speed_10m?.[index]) ?? 0,
      gusts: roundedOrNull(hourly.wind_gusts_10m?.[index]) ?? 0,
      visibility: roundedOrNull(hourly.visibility?.[index]),
      uvIndex: numberOrNull(hourly.uv_index?.[index]) ?? 0,
      code,
      isDay,
      icon: weatherIcon(code, isDay),
    };
  });
};

const parseDaily = (data) => {
  const daily = data?.daily || {};
  return (daily.time || []).slice(0, 7).map((date, index) => {
    const code = Number(daily.weather_code?.[index]);
    return {
      date,
      label: formatDay(date, index),
      code,
      icon: weatherIcon(code, true),
      high: roundedOrNull(daily.temperature_2m_max?.[index]),
      low: roundedOrNull(daily.temperature_2m_min?.[index]),
      rainChance: roundedOrNull(daily.precipitation_probability_max?.[index]) ?? 0,
      uvIndex: numberOrNull(daily.uv_index_max?.[index]) ?? 0,
      gusts: roundedOrNull(daily.wind_gusts_10m_max?.[index]) ?? 0,
      sunrise: daily.sunrise?.[index],
      sunset: daily.sunset?.[index],
    };
  });
};

const fetchWeather = async (location) => {
  const current = [
    'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
    'precipitation', 'weather_code', 'wind_speed_10m', 'wind_direction_10m',
    'wind_gusts_10m',
  ].join(',');
  const hourly = [
    'temperature_2m', 'apparent_temperature', 'precipitation_probability',
    'weather_code', 'is_day', 'wind_speed_10m', 'wind_gusts_10m',
    'visibility', 'uv_index',
  ].join(',');
  const daily = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'precipitation_probability_max', 'uv_index_max', 'sunrise', 'sunset',
    'wind_gusts_10m_max',
  ].join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=${current}&hourly=${hourly}&daily=${daily}&forecast_days=7&timezone=auto`;
  const hydroPromise = withTimeout(
    loadHydroDetails(location),
    HYDRO_TIMEOUT_MS,
    'Hydro request timed out'
  ).catch(() => ({
    marine: { available: false, hourly: [] },
    tides: { available: false, events: [] },
  }));
  const response = await withTimeout(fetch(url), REQUEST_TIMEOUT_MS, 'Weather request timed out');
  if (!response.ok) throw new Error(`Weather request failed (${response.status})`);

  const data = await response.json();
  const now = data?.current;
  if (!now || !Number.isFinite(now.temperature_2m)) {
    throw new Error('Weather response was incomplete');
  }

  const hourlyForecast = parseHourly(data);
  const dailyForecast = parseDaily(data);
  const code = Number(now.weather_code);
  const isDay = Number(now.is_day) === 1;
  const firstHour = hourlyForecast[0] || {};
  const today = dailyForecast[0] || {};
  const visibility = firstHour.visibility ?? null;
  const rainChance = firstHour.rainChance ?? 0;
  const uvIndex = firstHour.uvIndex ?? today.uvIndex ?? 0;
  const gusts = roundedOrNull(now.wind_gusts_10m) ?? firstHour.gusts ?? 0;
  const alerts = safetyAlertsFor({ current: now, hourly: hourlyForecast });
  const change = weatherChange(hourlyForecast);
  const workingWindow = bestWorkingWindow(hourlyForecast);
  const hydro = await hydroPromise;

  return {
    temperature: `${Math.round(now.temperature_2m)}°`,
    condition: weatherDescription(code),
    wind: `${roundedOrNull(now.wind_speed_10m) ?? 0} km/h`,
    windDirection: numberOrNull(now.wind_direction_10m),
    windDirectionLabel: windDirectionLabel(now.wind_direction_10m),
    icon: weatherIcon(code, isDay),
    code,
    isDay,
    isWet: isWetWeather(code) || rainChance >= 60,
    feelsLike: `${roundedOrNull(now.apparent_temperature) ?? 0}°`,
    humidity: `${roundedOrNull(now.relative_humidity_2m) ?? 0}%`,
    rainChance: `${rainChance}%`,
    gusts: `${gusts} km/h`,
    visibility: visibility === null ? 'N/A' : `${Math.round(visibility / 100) / 10} km`,
    uvIndex: `${Math.round(uvIndex * 10) / 10}`,
    sunrise: formatClockTime(today.sunrise),
    sunset: formatClockTime(today.sunset),
    high: Number.isFinite(today.high) ? `${today.high}°` : 'N/A',
    low: Number.isFinite(today.low) ? `${today.low}°` : 'N/A',
    hourly: hourlyForecast,
    daily: dailyForecast,
    fieldOutlook: fieldOutlook(alerts, change),
    bestWorkingWindow: workingWindow,
    weatherChange: change,
    safetyAlerts: alerts,
    marine: hydro.marine,
    tides: hydro.tides,
    locationLabel: location.label,
    locationSource: location.source,
    jobNumber: location.jobNumber || '',
    latitude: location.latitude,
    longitude: location.longitude,
    updatedAt: new Date().toISOString(),
    timezone: data.timezone,
  };
};

const sameLocation = (weather, location) => {
  const weatherLatitude = numberOrNull(weather?.latitude);
  const weatherLongitude = numberOrNull(weather?.longitude);
  const locationLatitude = numberOrNull(location?.latitude);
  const locationLongitude = numberOrNull(location?.longitude);
  return weatherLatitude !== null
    && weatherLongitude !== null
    && locationLatitude !== null
    && locationLongitude !== null
    && Math.abs(weatherLatitude - locationLatitude) < 0.01
    && Math.abs(weatherLongitude - locationLongitude) < 0.01;
};

const cacheMatchesPreference = (weather, preference, requestedJob) => {
  if (!weather) return false;
  if (preference === 'current') return weather.locationSource === 'current';
  if (preference !== 'job' || weather.locationSource !== 'job') return false;

  const requestedJobNumber = String(requestedJob?.jobNumber || '').trim();
  const cachedJobNumber = String(weather.jobNumber || '').trim();
  if (requestedJobNumber && cachedJobNumber) return requestedJobNumber === cachedJobNumber;
  return sameLocation(weather, requestedJob);
};

export const loadWeatherForecast = async ({
  office,
  profile,
  job,
  preference = 'auto',
  forceRefresh = false,
} = {}) => {
  const cached = await loadCachedWeather();
  const requestedJob = jobLocation(job);
  const effectivePreference = preference === 'job' || preference === 'current'
    ? preference
    : requestedJob
      ? 'job'
      : 'current';

  if (
    !forceRefresh
    && cached
    && Date.now() - cached.savedAt < CACHE_MAX_AGE_MS
    && cacheMatchesPreference(cached.weather, effectivePreference, requestedJob)
  ) {
    return cached.weather;
  }

  try {
    const location = await resolveLocation({ office, profile, job, preference: effectivePreference });
    const weather = await fetchWeather(location);
    await AsyncStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ weather, savedAt: Date.now() }));
    return weather;
  } catch (_error) {
    if (cached?.weather && cacheMatchesPreference(cached.weather, effectivePreference, requestedJob)) {
      return { ...cached.weather, isCached: true };
    }
    const unavailableLabel = effectivePreference === 'job'
      ? requestedJob?.label || 'Job site'
      : 'My location';
    return {
      ...WEATHER_LOADING,
      temperature: 'N/A',
      condition: 'Weather unavailable',
      wind: 'N/A',
      locationLabel: unavailableLabel,
      locationSource: effectivePreference,
      jobNumber: requestedJob?.jobNumber || '',
      bestWorkingWindow: {
        title: 'Working window unavailable',
        detail: 'A forecast is needed before a field window can be suggested.',
        start: '',
        end: '',
      },
      fieldOutlook: {
        level: 'unavailable',
        title: 'Forecast unavailable',
        detail: 'Check your connection and location permission, then try again.',
      },
    };
  }
};

export const loadCurrentWeather = (office) => loadWeatherForecast({ office, preference: 'current' });
