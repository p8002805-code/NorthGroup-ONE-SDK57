import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageBackground,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#061A2D';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';

const MicrosoftMark = () => (
  <View style={styles.microsoftMark}>
    <View style={[styles.microsoftTile, styles.microsoftRed]} />
    <View style={[styles.microsoftTile, styles.microsoftGreen]} />
    <View style={[styles.microsoftTile, styles.microsoftBlue]} />
    <View style={[styles.microsoftTile, styles.microsoftYellow]} />
  </View>
);

export default function MicrosoftSignInScreen({ busy, error, onSignIn }) {
  const insets = useSafeAreaInsets();
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const entranceY = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      <ImageBackground
        source={require('../../../../assets/first-welcome-field-heritage.jpg')}
        style={styles.background}
        imageStyle={styles.backgroundImage}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

      <Animated.View
        style={[
          styles.page,
          {
            paddingTop: insets.top + 30,
            paddingBottom: insets.bottom + 22,
            opacity: entrance,
            transform: [{ translateY: entranceY }],
          },
        ]}
      >
        <View style={styles.brand}>
          <Image
            source={require('../../../../assets/logo-transparent.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <Text style={styles.brandName}>NORTHGROUP ONE</Text>
          <View style={styles.brandRule} />

          <Text style={styles.brandTagline}>
            SURVEYING · SCANNING · TOWN PLANNING
          </Text>
        </View>

        <View style={styles.message}>
          <Text style={styles.eyebrow}>
            WELCOME TO YOUR FIELD WORKSPACE
          </Text>

          <Text style={styles.title}>
            One platform.{'\n'}Built for the field.
          </Text>

          <Text style={styles.copy}>
            Sign in with your NorthGroup work account and you’re ready to begin.
          </Text>
        </View>

        <View style={styles.dock}>
          <View style={styles.dockHeader}>
            <Text style={styles.dockTitle}>YOUR STARTING POINT</Text>
            <Text style={styles.dockMeta}>SECURE WORK ACCESS</Text>
          </View>

          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={styles.numberActive}>
                <Text style={styles.numberActiveText}>1</Text>
              </View>

              <View style={styles.stepTextArea}>
                <Text style={styles.stepKicker}>MICROSOFT</Text>
                <Text style={styles.stepText}>Your work account</Text>
              </View>
            </View>

            <View style={styles.stepDivider} />

            <View style={styles.step}>
              <View style={styles.number}>
                <Text style={styles.numberText}>2</Text>
              </View>

              <View style={styles.stepTextArea}>
                <Text style={styles.stepKickerMuted}>NORTHGROUP ONE</Text>
                <Text style={styles.stepText}>Your workspace</Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in with Microsoft"
            disabled={busy}
            onPress={onSignIn}
            style={({ pressed }) => [
              styles.action,
              pressed && !busy && styles.actionPressed,
              busy && styles.actionDisabled,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={NAVY} />
            ) : (
              <>
                <MicrosoftMark />
                <Text style={styles.actionText}>
                  SIGN IN WITH MICROSOFT
                </Text>
                <Text style={styles.actionArrow}>›</Text>
              </>
            )}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </Animated.View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },

  background: {
    flex: 1,
    width: '100%',
  },

  backgroundImage: {
    opacity: 0.96,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,17,30,0.14)',
  },

  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },

  brand: {
    alignItems: 'center',
    transform: [{ translateY: 14 }],
  },

  logo: {
    width: 158,
    height: 132,
  },

  brandName: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3.6,
    marginTop: 9,
  },

  brandRule: {
    width: 42,
    height: 2,
    borderRadius: 1,
    backgroundColor: GOLD,
    marginTop: 15,
  },

  brandTagline: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.45,
    marginTop: 13,
  },

  message: {
    width: '100%',
    alignItems: 'center',
  },

  eyebrow: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.55,
  },

  title: {
    color: WHITE,
    fontSize: 34,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.55,
    textAlign: 'center',
    marginTop: 11,
  },

  copy: {
    maxWidth: 305,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
  },

  dock: {
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
    shadowOffset: {
      width: 0,
      height: 8,
    },
    elevation: 5,
  },

  dockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },

  dockTitle: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  dockMeta: {
    color: GOLD,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.05,
  },

  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },

  step: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },

  stepTextArea: {
    flexShrink: 1,
  },

  stepDivider: {
    width: 1,
    height: 38,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 10,
  },

  numberActive: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    marginRight: 9,
  },

  numberActiveText: {
    color: NAVY,
    fontSize: 11,
    fontWeight: '900',
  },

  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    marginRight: 9,
  },

  numberText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
  },

  stepKicker: {
    color: GOLD,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 1.1,
  },

  stepKickerMuted: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  stepText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },

  action: {
    minHeight: 54,
    borderRadius: 27,
    backgroundColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  actionPressed: {
    transform: [{ scale: 0.985 }],
    backgroundColor: '#E2B958',
  },

  actionDisabled: {
    opacity: 0.74,
  },

  actionText: {
    color: NAVY,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginLeft: 10,
  },

  actionArrow: {
    color: NAVY,
    fontSize: 24,
    lineHeight: 24,
    marginLeft: 9,
    marginTop: -2,
  },

  microsoftMark: {
    width: 20,
    height: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },

  microsoftTile: {
    width: 9,
    height: 9,
  },

  microsoftRed: {
    backgroundColor: '#F25022',
  },

  microsoftGreen: {
    backgroundColor: '#7FBA00',
  },

  microsoftBlue: {
    backgroundColor: '#00A4EF',
  },

  microsoftYellow: {
    backgroundColor: '#FFB900',
  },

  error: {
    color: '#FFD4D4',
    backgroundColor: 'rgba(124,28,28,0.64)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,184,0.45)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 12,
    textAlign: 'center',
    fontSize: 11,
  },
});
