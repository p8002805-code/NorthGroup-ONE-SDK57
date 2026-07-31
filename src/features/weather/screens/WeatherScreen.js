import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  loadWeatherForecast,
  weatherLocationOptions,
} from '../weatherService';
import WeatherScene from '../components/WeatherScene';
import AppBackButton from '../../../components/AppBackButton';

const NAVY = '#061A2D';
const GOLD = '#D6A84F';

const screenTheme = (weather) => {
  if (!weather?.isDay) return { top: '#071827', bottom: '#173651', card: 'rgba(255,255,255,0.10)' };
  if ([95, 96, 99].includes(weather?.code)) return { top: '#263342', bottom: '#526170', card: 'rgba(255,255,255,0.13)' };
  if (weather?.isWet) return { top: '#31546B', bottom: '#6E8C9C', card: 'rgba(255,255,255,0.15)' };
  if ([0, 1].includes(weather?.code)) return { top: '#176A9A', bottom: '#71B6D8', card: 'rgba(255,255,255,0.18)' };
  return { top: '#244F6A', bottom: '#7194A8', card: 'rgba(255,255,255,0.16)' };
};

const updatedLabel = (value, cached) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return cached ? 'Saved forecast' : 'Updating forecast';
  return `${cached ? 'Saved' : 'Updated'} ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

function GlassCard({ title, children, style }) {
  return (
    <View style={[styles.glassCard, style]}>
      {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function Metric({ icon, label, value, detail }) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricHeading}>
        <Text style={styles.metricIcon}>{icon}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      {detail ? <Text style={styles.metricDetail}>{detail}</Text> : null}
    </View>
  );
}

function HydroMetric({ symbol, label, value, detail }) {
  return (
    <View style={styles.hydroMetric}>
      <View style={styles.hydroMetricHeading}>
        <View style={styles.hydroIcon}>
          <Text style={styles.hydroIconText}>{symbol}</Text>
        </View>
        <Text style={styles.hydroMetricLabel}>{label}</Text>
      </View>
      <Text
        style={styles.hydroMetricValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.72}
      >
        {value}
      </Text>
      <Text style={styles.hydroMetricDetail} numberOfLines={2}>{detail}</Text>
    </View>
  );
}

const chartPoints = (hourly) => (hourly || [])
  .filter((_hour, index) => index % 3 === 0)
  .slice(0, 8);

function TimelineChart({ title, data, field, color, suffix = '' }) {
  const points = chartPoints(data);
  const values = points
    .map((point) => Number(point?.[field]))
    .filter((value) => Number.isFinite(value));
  const minimum = values.length ? Math.min(...values) : 0;
  const maximum = values.length ? Math.max(...values) : 0;

  return (
    <View style={styles.timelineChart}>
      <View style={styles.timelineHeader}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineHint}>Next 24 hours</Text>
      </View>
      {points.length ? (
        <View style={styles.chartColumns}>
          {points.map((point) => {
            const value = Number(point?.[field]);
            const usableValue = Number.isFinite(value) ? value : null;
            const height = usableValue === null
              ? 8
              : maximum === minimum
                ? 38
                : 14 + ((usableValue - minimum) / (maximum - minimum)) * 62;
            return (
              <View key={`${title}-${point.time}`} style={styles.chartColumn}>
                <Text style={styles.chartValue}>
                  {usableValue === null ? '—' : `${Math.round(usableValue)}${suffix}`}
                </Text>
                <View style={styles.chartTrack}>
                  <View style={[styles.chartBar, { height, backgroundColor: color }]} />
                </View>
                <Text style={styles.chartLabel}>{point.label}</Text>
              </View>
            );
          })}
        </View>
      ) : <Text style={styles.emptyText}>Timeline unavailable</Text>}
    </View>
  );
}

const severityStyle = (level) => styles[`severity_${level}`] || styles.severity_warning;

export default function WeatherScreen({
  initialWeather,
  profile,
  job,
  onWeatherChange,
  locationPreference,
  onPreferenceChange,
  goBack,
  openRadar,
}) {
  const insets = useSafeAreaInsets();
  const [weather, setWeather] = useState(initialWeather);
  const [preference, setPreference] = useState(
    locationPreference || (initialWeather?.locationSource === 'job' ? 'job' : 'current')
  );
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const theme = useMemo(() => screenTheme(weather), [weather]);
  const locationOptions = useMemo(
    () => weatherLocationOptions({ profile, job }),
    [profile, job]
  );

  useEffect(() => {
    setWeather(initialWeather);
  }, [initialWeather]);

  useEffect(() => {
    if (locationPreference === 'job' || locationPreference === 'current') {
      setPreference(locationPreference);
    }
  }, [locationPreference]);

  const refresh = async (nextPreference = preference) => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      const nextWeather = await loadWeatherForecast({
        office: profile?.office,
        profile,
        job,
        preference: nextPreference,
        forceRefresh: true,
      });
      setWeather(nextWeather);
      onWeatherChange?.(nextWeather);
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  };

  const chooseLocation = (nextPreference) => {
    if (nextPreference === preference) return;
    setPreference(nextPreference);
    onPreferenceChange?.(nextPreference);
    refresh(nextPreference);
  };

  const windDirection = Number.isFinite(weather?.windDirection)
    ? (weather.windDirectionLabel || `${weather.windDirection}°`)
    : (weather?.windDirectionLabel || 'Direction unavailable');
  const bestWindow = weather?.bestWorkingWindow;
  const weatherChange = weather?.weatherChange;
  const safetyAlerts = weather?.safetyAlerts || [];
  const tides = weather?.tides || { available: false, events: [] };
  const marine = weather?.marine || { available: false };

  return (
    <View style={[styles.page, { backgroundColor: theme.bottom }]}> 
      <WeatherScene weather={weather} />
      <StatusBar barStyle="light-content" backgroundColor={theme.top} />
      <ScrollView
        style={styles.weatherScroll}
        bounces={false}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 34 }}
      >
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}> 
          <View style={styles.navRow}>
            <AppBackButton label="Dashboard" onPress={goBack} style={{ minWidth: 112 }} />
            <View style={styles.locationHeading}>
              <Text style={styles.location} numberOfLines={2}>
                {weather?.locationLabel || 'Current location'}
              </Text>
              <Text style={styles.updated}>{updatedLabel(weather?.updatedAt, weather?.isCached)}</Text>
            </View>
            <View style={styles.navActionSlot}>
              <Pressable
                onPress={() => refresh()}
                style={({ pressed }) => [styles.navButton, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Refresh weather"
              >
                {refreshing
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.refresh}>↻</Text>}
              </Pressable>
            </View>
          </View>

          <Text style={styles.mainIcon}>{weather?.icon || '☁️'}</Text>
          <Text style={styles.temperature}>{weather?.temperature || 'N/A'}</Text>
          <Text style={styles.condition}>{weather?.condition || 'Weather unavailable'}</Text>
          <Text style={styles.highLow}>H:{weather?.high || '—'}  L:{weather?.low || '—'}  •  Feels like {weather?.feelsLike || '—'}</Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.locationChoices}
          >
            {locationOptions.map((option) => {
              const selected = option.id === preference;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => chooseLocation(option.id)}
                  style={({ pressed }) => [
                    styles.locationChoice,
                    selected && styles.locationChoiceSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.locationChoiceText, selected && styles.locationChoiceTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.forecastBody}> 
          <Pressable
            onPress={openRadar}
            style={({ pressed }) => [styles.radarCard, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Open rain radar"
          >
            <View style={styles.radarIcon}>
              <View style={styles.radarSweep} />
              <View style={styles.radarCentre} />
            </View>
            <View style={styles.radarCopy}>
              <Text style={styles.radarEyebrow}>LIVE WEATHER MAP</Text>
              <Text style={styles.radarTitle}>Rain radar</Text>
              <Text style={styles.radarDetail}>View the official BOM radar map</Text>
            </View>
            <Text style={styles.radarArrow}>›</Text>
          </Pressable>

          <GlassCard>
            <View style={styles.hourlySummary}>
              <Text style={styles.cardTitle}>HOURLY FORECAST</Text>
              <Text style={styles.hourlyHint}>Swipe for 24 hours</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyList}>
              {(weather?.hourly || []).map((hour) => (
                <View key={hour.time} style={styles.hourItem}>
                  <Text style={styles.hourTime}>{hour.label}</Text>
                  <Text style={styles.hourIcon}>{hour.icon}</Text>
                  <Text style={styles.hourTemp}>{hour.temperature}°</Text>
                  <Text style={styles.hourRain}>{hour.rainChance}%</Text>
                </View>
              ))}
              {!weather?.hourly?.length ? <Text style={styles.emptyText}>Hourly forecast unavailable</Text> : null}
            </ScrollView>
          </GlassCard>

          <GlassCard title="BEST WORKING WINDOW TODAY">
            <View style={[styles.insightRow, severityStyle(bestWindow?.level || 'warning')]}> 
              <View style={styles.insightMarker}>
                <Text style={styles.insightMarkerText}>{bestWindow?.level === 'good' ? '✓' : '!'}</Text>
              </View>
              <View style={styles.insightCopy}>
                <Text style={styles.insightTitle}>{bestWindow?.title || 'Working window loading'}</Text>
                <Text style={styles.insightDetail}>{bestWindow?.detail || 'Comparing the next few hours for field conditions.'}</Text>
              </View>
            </View>
          </GlassCard>

          {weatherChange ? (
            <View style={[styles.changeCard, severityStyle(weatherChange.level)]}>
              <View style={styles.changeIcon}><Text style={styles.changeIconText}>↗</Text></View>
              <View style={styles.insightCopy}>
                <Text style={styles.changeEyebrow}>WEATHER CHANGING SOON</Text>
                <Text style={styles.changeTitle}>{weatherChange.detail}</Text>
              </View>
            </View>
          ) : null}

          <GlassCard title="FIELD SAFETY ALERTS">
            {safetyAlerts.length ? safetyAlerts.slice(0, 5).map((alert) => (
              <View key={alert.id} style={[styles.alertRow, styles.alertBorder, severityStyle(alert.level)]}>
                <View style={styles.alertMarker}><Text style={styles.alertMarkerText}>!</Text></View>
                <View style={styles.alertCopy}>
                  <View style={styles.alertHeading}>
                    <Text style={styles.alertTitle}>{alert.title}</Text>
                    {alert.timeLabel ? <Text style={styles.alertTime}>{alert.timeLabel}</Text> : null}
                  </View>
                  <Text style={styles.alertDetail}>{alert.detail}</Text>
                </View>
              </View>
            )) : (
              <View style={styles.clearConditions}>
                <Text style={styles.clearConditionsIcon}>✓</Text>
                <Text style={styles.clearConditionsText}>No field-weather alerts are showing in the next 24 hours.</Text>
              </View>
            )}
          </GlassCard>

          <GlassCard title="FIELD TIMELINES">
            <TimelineChart title="TEMPERATURE" data={weather?.hourly} field="temperature" color="#F0B85A" suffix="°" />
            <TimelineChart title="RAIN PROBABILITY" data={weather?.hourly} field="rainChance" color="#64B6E5" suffix="%" />
            <TimelineChart title="WIND GUSTS" data={weather?.hourly} field="gusts" color="#A9D7C0" suffix="" />
          </GlassCard>

          <GlassCard title="7-DAY FORECAST">
            {(weather?.daily || []).map((day, index) => (
              <View key={day.date} style={[styles.dayRow, index > 0 && styles.dayBorder]}>
                <Text style={styles.dayName}>{day.label}</Text>
                <Text style={styles.dayRain}>{day.rainChance ? `${day.rainChance}%` : ''}</Text>
                <Text style={styles.dayIcon}>{day.icon}</Text>
                <Text style={styles.dayLow}>{day.low}°</Text>
                <View style={styles.temperatureTrack}>
                  <View style={styles.temperatureFill} />
                </View>
                <Text style={styles.dayHigh}>{day.high}°</Text>
              </View>
            ))}
            {!weather?.daily?.length ? <Text style={styles.emptyText}>Daily forecast unavailable</Text> : null}
          </GlassCard>

          <View style={styles.metricsGrid}>
            <Metric icon="☀" label="UV INDEX" value={weather?.uvIndex || 'N/A'} detail="Sun-safe PPE" />
            <Metric icon="↗" label="WIND" value={weather?.wind || 'N/A'} detail={`Gusts ${weather?.gusts || 'N/A'} • ${windDirection}`} />
            <Metric icon="●" label="RAIN CHANCE" value={weather?.rainChance || 'N/A'} detail="Next forecast hour" />
            <Metric icon="≈" label="HUMIDITY" value={weather?.humidity || 'N/A'} detail={`Feels like ${weather?.feelsLike || 'N/A'}`} />
            <Metric icon="◉" label="VISIBILITY" value={weather?.visibility || 'N/A'} detail="Traffic and sight lines" />
            <Metric icon="◐" label="DAYLIGHT" value={weather?.sunrise || 'N/A'} detail={`Sunset ${weather?.sunset || 'N/A'}`} />
          </View>

          <GlassCard title="HYDRO CONDITIONS">
            {marine.available ? (
              <View style={styles.marineGrid}>
                <HydroMetric symbol="≈" label="WAVE" value={marine.waveHeight} detail={`${marine.waveDirection} • ${marine.wavePeriod}`} />
                <HydroMetric symbol="∿" label="SWELL" value={marine.swellHeight} detail={`${marine.swellDirection} • ${marine.swellPeriod}`} />
                <HydroMetric symbol="↕" label="SEA LEVEL" value={marine.seaLevel} detail="Modelled level" />
              </View>
            ) : null}

            {tides.available ? (
              <View style={styles.tideSection}>
                <View style={styles.hydroHeading}>
                  <View>
                    <Text style={styles.hydroTitle}>Tide predictions</Text>
                    <Text style={styles.hydroDetail}>{tides.stationName} • {tides.distanceKm} km away</Text>
                  </View>
                  <Text style={styles.hydroBadge}>TIDES</Text>
                </View>
                {(tides.events || []).slice(0, 6).map((event, index) => (
                  <View key={`${event.isoTime}-${index}`} style={[styles.tideRow, index > 0 && styles.tideBorder]}>
                    <Text style={styles.tideDay}>{event.dayLabel}</Text>
                    <Text style={styles.tideType}>{event.type}</Text>
                    <Text style={styles.tideTime}>{event.time}</Text>
                    <Text style={styles.tideHeight}>{event.height}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.hydroUnavailable}>
                {tides.reason || 'No nearby tide prediction station for this location.'}
              </Text>
            )}

            <Text style={styles.hydroCaution}>
              Predicted tide levels do not account for weather surge or local site effects and are not for navigation.
            </Text>
          </GlassCard>

          <Text style={styles.sourceNote}>
            Forecast source: the selected Job site or My location. Weather: Open-Meteo. Tide predictions: Bureau of Meteorology. Forecast time: {updatedLabel(weather?.updatedAt, weather?.isCached).toLowerCase()}.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  weatherScroll: { flex: 1, backgroundColor: 'transparent', zIndex: 1 },
  hero: { paddingHorizontal: 18, paddingBottom: 28, alignItems: 'center' },
  navRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navActionSlot: { width: 112, alignItems: 'flex-end' },
  navButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  back: { color: '#FFFFFF', fontSize: 34, lineHeight: 36, marginTop: -2 },
  refresh: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  locationHeading: { flex: 1, alignItems: 'center', paddingHorizontal: 10 },
  location: { color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  updated: { color: 'rgba(255,255,255,0.67)', fontSize: 10, marginTop: 2 },
  mainIcon: { fontSize: 70, marginTop: 22 },
  temperature: { color: '#FFFFFF', fontSize: 76, fontWeight: '200', letterSpacing: -4, marginTop: -4 },
  condition: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginTop: -4 },
  highLow: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600', marginTop: 7 },
  locationChoices: { paddingTop: 23, paddingHorizontal: 6, gap: 8 },
  locationChoice: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(0,0,0,0.08)' },
  locationChoiceSelected: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  locationChoiceText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  locationChoiceTextSelected: { color: NAVY },
  forecastBody: { padding: 14, gap: 12 },
  radarCard: { minHeight: 88, borderRadius: 21, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(5,25,40,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  radarIcon: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: 'rgba(157,218,255,0.7)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(100,182,229,0.12)' },
  radarSweep: { position: 'absolute', width: 25, height: 2, left: 22, top: 16, borderRadius: 1, backgroundColor: '#9DDAFF', transform: [{ rotate: '-34deg' }] },
  radarCentre: { width: 7, height: 7, borderRadius: 4, backgroundColor: GOLD, borderWidth: 1, borderColor: '#FFFFFF' },
  radarCopy: { flex: 1, marginLeft: 14 },
  radarEyebrow: { color: '#9DDAFF', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  radarTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', marginTop: 2 },
  radarDetail: { color: 'rgba(255,255,255,0.62)', fontSize: 10, marginTop: 3 },
  radarArrow: { color: '#FFFFFF', fontSize: 33, fontWeight: '300', marginLeft: 8, marginTop: -2 },
  glassCard: { borderRadius: 21, padding: 16, backgroundColor: 'rgba(5,25,40,0.43)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  cardTitle: { color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  hourlySummary: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  hourlyHint: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
  hourlyList: { gap: 19, paddingRight: 6 },
  hourItem: { minWidth: 38, alignItems: 'center' },
  hourTime: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  hourIcon: { fontSize: 25, marginVertical: 9 },
  hourTemp: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  hourRain: { color: '#9DDAFF', fontSize: 10, fontWeight: '800', marginTop: 5 },
  emptyText: { color: 'rgba(255,255,255,0.7)', paddingVertical: 12 },
  insightRow: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderRadius: 13, padding: 11, marginTop: 12 },
  severity_good: { borderLeftColor: '#5DB484', backgroundColor: 'rgba(62,147,100,0.15)' },
  severity_warning: { borderLeftColor: GOLD, backgroundColor: 'rgba(214,168,79,0.15)' },
  severity_danger: { borderLeftColor: '#E36B6B', backgroundColor: 'rgba(185,65,65,0.2)' },
  insightMarker: { width: 31, height: 31, borderRadius: 16, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  insightMarkerText: { color: NAVY, fontSize: 16, fontWeight: '900' },
  insightCopy: { flex: 1, marginLeft: 10 },
  insightTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  insightDetail: { color: 'rgba(255,255,255,0.68)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  changeCard: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderRadius: 16, padding: 13 },
  changeIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  changeIconText: { color: NAVY, fontSize: 17, fontWeight: '900' },
  changeEyebrow: { color: '#F3C978', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  changeTitle: { color: '#FFFFFF', fontSize: 11, lineHeight: 16, marginTop: 3 },
  alertRow: { flexDirection: 'row', borderLeftWidth: 3, borderRadius: 12, padding: 11, marginTop: 9 },
  alertBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  alertMarker: { width: 25, height: 25, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' },
  alertMarkerText: { color: NAVY, fontSize: 14, fontWeight: '900' },
  alertCopy: { flex: 1, marginLeft: 9 },
  alertHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  alertTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', flex: 1 },
  alertTime: { color: 'rgba(255,255,255,0.55)', fontSize: 9, fontWeight: '800' },
  alertDetail: { color: 'rgba(255,255,255,0.65)', fontSize: 10, lineHeight: 15, marginTop: 3 },
  clearConditions: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  clearConditionsIcon: { color: '#7BD09A', fontSize: 22, fontWeight: '900', marginRight: 9 },
  clearConditionsText: { color: 'rgba(255,255,255,0.7)', flex: 1, fontSize: 11, lineHeight: 16 },
  timelineChart: { marginTop: 13 },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timelineTitle: { color: 'rgba(255,255,255,0.76)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  timelineHint: { color: 'rgba(255,255,255,0.44)', fontSize: 9 },
  chartColumns: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 91 },
  chartColumn: { flex: 1, alignItems: 'center', minWidth: 30 },
  chartValue: { color: 'rgba(255,255,255,0.7)', fontSize: 8, height: 13 },
  chartTrack: { height: 66, width: 8, justifyContent: 'flex-end', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden' },
  chartBar: { width: 8, borderRadius: 4, minHeight: 5 },
  chartLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 8, marginTop: 6 },
  dayRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center' },
  dayBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.15)' },
  dayName: { color: '#FFFFFF', width: 57, fontSize: 13, fontWeight: '800' },
  dayRain: { color: '#9DDAFF', width: 36, fontSize: 10, fontWeight: '800', textAlign: 'right' },
  dayIcon: { width: 39, fontSize: 21, textAlign: 'center' },
  dayLow: { color: 'rgba(255,255,255,0.62)', width: 31, fontSize: 12, textAlign: 'right' },
  dayHigh: { color: '#FFFFFF', width: 31, fontSize: 12, fontWeight: '800' },
  temperatureTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 9, overflow: 'hidden' },
  temperatureFill: { width: '68%', height: 4, borderRadius: 2, backgroundColor: GOLD },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { width: '48.5%', minHeight: 137, borderRadius: 20, padding: 15, backgroundColor: 'rgba(5,25,40,0.43)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  metricHeading: { flexDirection: 'row', alignItems: 'center' },
  metricIcon: { color: 'rgba(255,255,255,0.72)', width: 19, fontSize: 14 },
  metricLabel: { color: 'rgba(255,255,255,0.72)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  metricValue: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', marginTop: 16 },
  metricDetail: { color: 'rgba(255,255,255,0.62)', fontSize: 10, lineHeight: 14, marginTop: 5 },
  marineGrid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hydroMetric: { flex: 1, minWidth: 0, minHeight: 132, borderRadius: 17, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: 'rgba(4,21,35,0.42)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  hydroMetricHeading: { flexDirection: 'row', alignItems: 'center', minHeight: 28 },
  hydroIcon: { width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(157,218,255,0.14)', borderWidth: 1, borderColor: 'rgba(157,218,255,0.38)' },
  hydroIconText: { color: '#BFE8FF', fontSize: 14, fontWeight: '900', marginTop: -1 },
  hydroMetricLabel: { flex: 1, color: 'rgba(255,255,255,0.74)', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginLeft: 6 },
  hydroMetricValue: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 15 },
  hydroMetricDetail: { color: 'rgba(255,255,255,0.58)', fontSize: 9, lineHeight: 13, marginTop: 5 },
  tideSection: { marginTop: 16 },
  hydroHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  hydroTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  hydroDetail: { color: 'rgba(255,255,255,0.58)', fontSize: 10, marginTop: 3 },
  hydroBadge: { color: NAVY, backgroundColor: GOLD, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, fontWeight: '900', letterSpacing: 0.8 },
  tideRow: { flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingVertical: 6 },
  tideBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.13)' },
  tideDay: { color: 'rgba(255,255,255,0.6)', width: 54, fontSize: 9 },
  tideType: { color: '#FFFFFF', width: 35, fontSize: 10, fontWeight: '800' },
  tideTime: { color: '#FFFFFF', flex: 1, fontSize: 11, fontWeight: '700' },
  tideHeight: { color: '#9DDAFF', fontSize: 11, fontWeight: '800' },
  hydroUnavailable: { color: 'rgba(255,255,255,0.66)', fontSize: 11, lineHeight: 16, marginTop: 11 },
  hydroCaution: { color: 'rgba(255,255,255,0.48)', fontSize: 9, lineHeight: 14, marginTop: 14 },
  sourceNote: { color: 'rgba(255,255,255,0.66)', fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 12, paddingTop: 5 },
  pressed: { opacity: 0.72 },
});
