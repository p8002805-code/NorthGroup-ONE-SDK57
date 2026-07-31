import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const SCENES = {
  clearDay: require('../../../../assets/weather-scenes/clear-day.jpg'),
  clearNight: require('../../../../assets/weather-scenes/clear-night.jpg'),
  cloudy: require('../../../../assets/weather-scenes/cloudy.jpg'),
  rainStorm: require('../../../../assets/weather-scenes/rain-storm.jpg'),
  fog: require('../../../../assets/weather-scenes/fog.jpg'),
};

const RAIN_CODES = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99];
const STORM_CODES = [95, 96, 99];
const FOG_CODES = [45, 48];
const CLOUD_CODES = [2, 3];
const RAIN_DROPS = Array.from({ length: 42 }, (_, index) => ({
  id: index,
  left: `${(index * 37) % 103}%`,
  top: (index % 12) * 94 - 380,
  height: 16 + (index % 5) * 5,
  opacity: 0.2 + (index % 4) * 0.1,
}));

const weatherNumber = (value) => {
  const match = String(value || '').match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
};

const sceneFor = (weather) => {
  const code = Number(weather?.code);
  if (FOG_CODES.includes(code)) return SCENES.fog;
  if (RAIN_CODES.includes(code)) return SCENES.rainStorm;
  if (CLOUD_CODES.includes(code)) return SCENES.cloudy;
  return weather?.isDay === false ? SCENES.clearNight : SCENES.clearDay;
};

export default function WeatherScene({ weather }) {
  const drift = useRef(new Animated.Value(0)).current;
  const rainFall = useRef(new Animated.Value(0)).current;
  const atmospherePulse = useRef(new Animated.Value(0)).current;
  const lightning = useRef(new Animated.Value(0)).current;
  const code = Number(weather?.code);
  const raining = RAIN_CODES.includes(code);
  const storming = STORM_CODES.includes(code);
  const foggy = FOG_CODES.includes(code);
  const scene = useMemo(() => sceneFor(weather), [code, weather?.isDay]);
  const windSpeed = weatherNumber(weather?.wind);
  const driftDuration = Math.max(7000, Math.min(30000, 26000 - windSpeed * 320));

  useEffect(() => {
    drift.stopAnimation();
    rainFall.stopAnimation();
    atmospherePulse.stopAnimation();
    lightning.stopAnimation();
    drift.setValue(0);
    rainFall.setValue(0);
    atmospherePulse.setValue(0);
    lightning.setValue(0);

    const driftAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: driftDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: -1, duration: driftDuration * 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: driftDuration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(atmospherePulse, { toValue: 1, duration: weather?.isDay ? 5200 : 3100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(atmospherePulse, { toValue: 0, duration: weather?.isDay ? 5200 : 3100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    driftAnimation.start();
    pulseAnimation.start();

    let rainAnimation;
    if (raining) {
      rainAnimation = Animated.loop(
        Animated.timing(rainFall, {
          toValue: 1,
          duration: storming ? 620 : 920,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rainAnimation.start();
    }

    let lightningAnimation;
    if (storming) {
      lightningAnimation = Animated.loop(
        Animated.sequence([
          Animated.delay(3900),
          Animated.timing(lightning, { toValue: 0.78, duration: 70, useNativeDriver: true }),
          Animated.timing(lightning, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.delay(110),
          Animated.timing(lightning, { toValue: 0.42, duration: 60, useNativeDriver: true }),
          Animated.timing(lightning, { toValue: 0, duration: 170, useNativeDriver: true }),
          Animated.delay(7200),
        ])
      );
      lightningAnimation.start();
    }

    return () => {
      driftAnimation.stop();
      pulseAnimation.stop();
      rainAnimation?.stop();
      lightningAnimation?.stop();
    };
  }, [atmospherePulse, code, drift, driftDuration, lightning, rainFall, raining, storming, weather?.isDay]);

  const driftX = drift.interpolate({ inputRange: [-1, 1], outputRange: [-22, 22] });
  const slowDriftX = drift.interpolate({ inputRange: [-1, 1], outputRange: [28, -28] });
  const fallY = rainFall.interpolate({ inputRange: [0, 1], outputRange: [-120, 620] });
  const pulseOpacity = atmospherePulse.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.24] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sceneLayer]}>
      <Animated.Image
        source={scene}
        resizeMode="cover"
        style={[
          styles.scene,
          { transform: [{ translateX: driftX }, { scale: 1.09 }] },
        ]}
      />
      <View style={[styles.readabilityTint, !weather?.isDay && styles.nightTint]} />

      {weather?.isDay && [0, 1].includes(code) ? (
        <Animated.View style={[styles.sunGlow, { opacity: pulseOpacity, transform: [{ scale: atmospherePulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.14] }) }] }]} />
      ) : null}

      {!weather?.isDay && !raining ? (
        <Animated.View style={[styles.nightShimmer, { opacity: pulseOpacity }]} />
      ) : null}

      {foggy ? (
        <>
          <Animated.View style={[styles.fogBand, styles.fogBandOne, { transform: [{ translateX: slowDriftX }] }]} />
          <Animated.View style={[styles.fogBand, styles.fogBandTwo, { transform: [{ translateX: driftX }] }]} />
          <Animated.View style={[styles.fogBand, styles.fogBandThree, { transform: [{ translateX: slowDriftX }] }]} />
        </>
      ) : null}

      {raining ? (
        <Animated.View style={[styles.rainLayer, { transform: [{ translateY: fallY }, { translateX: storming ? -8 : -3 }] }]}>
          {RAIN_DROPS.map((drop) => (
            <View
              key={drop.id}
              style={[
                styles.rainDrop,
                {
                  left: drop.left,
                  top: drop.top,
                  height: drop.height,
                  opacity: drop.opacity,
                },
              ]}
            />
          ))}
        </Animated.View>
      ) : null}

      {storming ? <Animated.View style={[styles.lightningFlash, { opacity: lightning }]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sceneLayer: {
    zIndex: 0,
    elevation: 0,
  },
  scene: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  readabilityTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,24,39,0.25)',
  },
  nightTint: { backgroundColor: 'rgba(2,14,28,0.34)' },
  sunGlow: {
    position: 'absolute',
    top: -90,
    right: -75,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: '#FFE4A1',
  },
  nightShimmer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(173,214,255,0.10)',
  },
  fogBand: {
    position: 'absolute',
    left: '-18%',
    width: '136%',
    borderRadius: 90,
    backgroundColor: 'rgba(226,239,246,0.16)',
  },
  fogBandOne: { top: '18%', height: 105 },
  fogBandTwo: { top: '46%', height: 145, opacity: 0.72 },
  fogBandThree: { top: '74%', height: 118, opacity: 0.58 },
  rainLayer: {
    ...StyleSheet.absoluteFillObject,
    top: -240,
    height: '170%',
  },
  rainDrop: {
    position: 'absolute',
    width: 1.2,
    borderRadius: 1,
    backgroundColor: '#D8EEFF',
    transform: [{ rotate: '8deg' }],
  },
  lightningFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EAF5FF',
  },
});
