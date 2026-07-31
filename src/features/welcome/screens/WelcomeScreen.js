import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COMPASS_FEATURE_ENABLED } from '../../../config/featureFlags';
import CompassScreen from '../../compass/screens/CompassScreen';
import {
  DEFAULT_WELCOME_DATA,
  formatWelcomeDate,
  getGreeting,
} from '../utils/welcomeContent';

function FirstRunWelcome() {
  return (
    <View style={styles.firstRunPage}>
      <View style={styles.firstRunBrand}>
        <Animated.Image
          source={require('../../../../assets/logo-transparent.png')}
          style={styles.firstRunLogo}
          resizeMode="contain"
        />
        <Text style={styles.firstRunBrandName}>NORTHGROUP ONE</Text>
        <View style={styles.firstRunBrandRule} />
      </View>

      <View style={styles.firstRunMessage}>
        <Text style={styles.firstRunEyebrow}>WELCOME TO YOUR FIELD WORKSPACE</Text>
        <Text style={styles.firstRunTitle}>One platform.{'\n'}Built for the field.</Text>
        <Text style={styles.firstRunCopy}>
          Set up your profile, choose your first job and you’re ready to begin.
        </Text>
      </View>

      <View style={styles.firstRunDock}>
        <View style={styles.firstRunDockHeader}>
          <Text style={styles.firstRunDockTitle}>YOUR STARTING POINT</Text>
          <Text style={styles.firstRunDockMeta}>TWO QUICK STEPS</Text>
        </View>
        <View style={styles.firstRunSteps}>
          <View style={styles.firstRunStep}>
            <View style={styles.firstRunNumberActive}>
              <Text style={styles.firstRunNumberActiveText}>1</Text>
            </View>
            <View>
              <Text style={styles.firstRunStepKicker}>PROFILE</Text>
              <Text style={styles.firstRunStepText}>Your work details</Text>
            </View>
          </View>
          <View style={styles.firstRunStepDivider} />
          <View style={styles.firstRunStep}>
            <View style={styles.firstRunNumber}>
              <Text style={styles.firstRunNumberText}>2</Text>
            </View>
            <View>
              <Text style={styles.firstRunStepKickerMuted}>FIRST JOB</Text>
              <Text style={styles.firstRunStepText}>Your workspace</Text>
            </View>
          </View>
        </View>
        <View style={styles.firstRunAction}>
          <Text style={styles.firstRunActionText}>GET STARTED</Text>
          <Text style={styles.firstRunActionArrow}>›</Text>
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen({
  isFirstRun = false,
  onContinue,
  user = DEFAULT_WELCOME_DATA,
}) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;
  const promptOpacity = useRef(new Animated.Value(0.48)).current;
  const [compassActive, setCompassActive] = useState(false);

  useEffect(() => {
    if (compassActive) {
      float.stopAnimation();
      promptOpacity.stopAnimation();
      return undefined;
    }

    float.setValue(0);
    promptOpacity.setValue(0.48);
    Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -7,
          duration: 2300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const promptLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(promptOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(promptOpacity, {
          toValue: 0.48,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    floatLoop.start();
    promptLoop.start();
    return () => {
      floatLoop.stop();
      promptLoop.stop();
    };
  }, [compassActive, entrance, float, promptOpacity]);

  if (compassActive) {
    return <CompassScreen onBack={() => setCompassActive(false)} />;
  }

  const entranceY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const currentJob = user.currentJob || DEFAULT_WELCOME_DATA.currentJob;
  const weather = user.weather || DEFAULT_WELCOME_DATA.weather;

  return (
    <Pressable
      style={styles.container}
      onPress={onContinue}
      accessibilityRole="button"
      accessibilityLabel={isFirstRun
        ? 'Start NorthGroup One profile setup'
        : 'Open NorthGroup One dashboard'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#061A2D" />
      <ImageBackground
        source={isFirstRun
          ? require('../../../../assets/first-welcome-field-heritage.jpg')
          : require('../../../../assets/topo-bg-vertical.png')}
        style={StyleSheet.absoluteFillObject}
        imageStyle={isFirstRun
          ? styles.firstRunBackgroundImage
          : styles.backgroundImage}
        resizeMode="cover"
      />
      <View style={isFirstRun ? styles.firstRunOverlay : styles.overlay} />

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + 25,
            paddingBottom: insets.bottom + 22,
          },
        ]}
      >
        {isFirstRun ? (
          <Animated.View
            style={[
              styles.firstRunContainer,
              {
                opacity: entrance,
                transform: [{ translateY: entranceY }],
              },
            ]}
          >
            <FirstRunWelcome />
          </Animated.View>
        ) : (
          <>
            <View style={styles.welcomeArea}>
              <Animated.View
                style={[
                  styles.floatingContent,
                  {
                    opacity: entrance,
                    transform: [
                      { translateY: Animated.add(float, entranceY) },
                    ],
                  },
                ]}
              >
                <Pressable
                  onPress={(event) => {
                    event.stopPropagation?.();
                    if (COMPASS_FEATURE_ENABLED) setCompassActive(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={COMPASS_FEATURE_ENABLED
                    ? 'Open compass'
                    : 'NorthGroup logo'}
                  accessibilityState={{ disabled: !COMPASS_FEATURE_ENABLED }}
                >
                  <View style={styles.logoStage}>
                    <Animated.Image
                      source={require('../../../../assets/logo-transparent.png')}
                      style={styles.logo}
                      resizeMode="contain"
                    />
                  </View>
                </Pressable>
                <Text style={styles.brand}>NORTHGROUP ONE</Text>
                <View style={styles.divider} />
                <Text style={styles.greeting}>{getGreeting()},</Text>
                <Text
                  style={styles.name}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {user.firstName}
                </Text>
                <Text style={styles.date}>{formatWelcomeDate()}</Text>
              </Animated.View>
            </View>

            <View style={styles.bottomArea}>
              <View style={styles.summaryCard}>
                <View style={styles.summarySection}>
                  <Text style={styles.eyebrow}>TODAY&apos;S JOB</Text>
                  <Text style={styles.jobNumber} numberOfLines={1}>
                    {currentJob.number}
                  </Text>
                  <Text style={styles.jobName} numberOfLines={2}>
                    {currentJob.name}
                  </Text>
                </View>
                <View style={styles.verticalLine} />
                <View style={styles.summarySection}>
                  <Text style={styles.eyebrow}>WEATHER</Text>
                  <View style={styles.weatherRow}>
                    <Text style={styles.weatherIcon}>{weather.icon || '☁'}</Text>
                    <Text style={styles.temperature}>{weather.temperature}</Text>
                  </View>
                  <Text style={styles.wind}>Wind {weather.wind}</Text>
                  <Text style={styles.condition} numberOfLines={1}>
                    {weather.condition}
                  </Text>
                </View>
              </View>

              <Animated.View
                style={[styles.continueRow, { opacity: promptOpacity }]}
              >
                <Text style={styles.continueText}>TAP ANYWHERE TO CONTINUE</Text>
                <Text style={styles.arrow}>›</Text>
              </Animated.View>
            </View>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#061A2D',
  },
  backgroundImage: {
    opacity: 0.72,
  },
  firstRunBackgroundImage: {
    opacity: 0.96,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,17,30,0.48)',
  },
  firstRunOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,17,30,0.14)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  firstRunContainer: {
    flex: 1,
    width: '100%',
  },
  firstRunPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 5,
    paddingBottom: 8,
  },
  firstRunBrand: {
    alignItems: 'center',
    transform: [{ translateY: 40 }],
  },
  firstRunLogo: {
    width: 142,
    height: 119,
  },
  firstRunBrandName: {
    color: '#D6A84F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3.4,
    marginTop: 8,
  },
  firstRunBrandRule: {
    width: 42,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#D6A84F',
    marginTop: 15,
  },
  firstRunMessage: {
    width: '100%',
    alignItems: 'center',
  },
  firstRunEyebrow: {
    color: '#D6A84F',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.55,
  },
  firstRunTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.55,
    textAlign: 'center',
    marginTop: 11,
  },
  firstRunCopy: {
    maxWidth: 295,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
  },
  firstRunDock: {
    width: '100%',
    paddingHorizontal: 18,
    paddingTop: 17,
    paddingBottom: 17,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.19)',
    backgroundColor: 'rgba(3,20,35,0.9)',
    shadowColor: '#000000',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  firstRunDockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  firstRunDockTitle: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  firstRunDockMeta: {
    color: '#D6A84F',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  firstRunSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  firstRunStep: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  firstRunStepDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 12,
  },
  firstRunNumberActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D6A84F',
    marginRight: 9,
  },
  firstRunNumberActiveText: {
    color: '#061A2D',
    fontSize: 11,
    fontWeight: '900',
  },
  firstRunNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    marginRight: 9,
  },
  firstRunNumberText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  firstRunStepKicker: {
    color: '#D6A84F',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  firstRunStepKickerMuted: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  firstRunStepText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  firstRunAction: {
    minHeight: 54,
    borderRadius: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D6A84F',
  },
  firstRunActionText: {
    color: '#061A2D',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.7,
  },
  firstRunActionArrow: {
    color: '#061A2D',
    fontSize: 24,
    lineHeight: 24,
    marginLeft: 10,
    marginTop: -2,
  },
  welcomeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingContent: {
    width: '100%',
    alignItems: 'center',
  },
  logoStage: {
    width: 232,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 198,
    height: 145,
  },
  brand: {
    color: '#D6A84F',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.4,
    marginTop: 8,
  },
  divider: {
    width: 42,
    height: 2,
    marginVertical: 20,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  greeting: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 22,
  },
  name: {
    maxWidth: '100%',
    color: '#FFFFFF',
    fontSize: 43,
    lineHeight: 50,
    fontWeight: '700',
  },
  date: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 14,
    marginTop: 8,
  },
  bottomArea: {
    width: '100%',
  },
  summaryCard: {
    width: '100%',
    flexDirection: 'row',
    padding: 18,
    paddingBottom: 45,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(4,25,43,0.8)',
  },
  summarySection: {
    flex: 1,
    minWidth: 0,
  },
  verticalLine: {
    width: 1,
    marginHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  eyebrow: {
    color: '#D6A84F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  jobNumber: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  jobName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weatherIcon: {
    color: '#FFFFFF',
    fontSize: 22,
    marginRight: 7,
  },
  temperature: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  wind: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    marginTop: 2,
  },
  condition: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 11,
    marginTop: 10,
  },
  continueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
  },
  arrow: {
    color: '#D6A84F',
    fontSize: 22,
    lineHeight: 22,
    marginLeft: 8,
  },
});
