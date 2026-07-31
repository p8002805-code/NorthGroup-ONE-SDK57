import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function IntroScreen({
  onComplete,
}) {
  const [logoReady, setLogoReady] =
    useState(false);

  const logoOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const logoScale = useRef(
    new Animated.Value(0.88)
  ).current;

  const logoTranslateY = useRef(
    new Animated.Value(18)
  ).current;

  const textOpacity = useRef(
    new Animated.Value(0)
  ).current;

  const textTranslateY = useRef(
    new Animated.Value(8)
  ).current;

  const fullWhiteOpacity = useRef(
    new Animated.Value(0)
  ).current;

  useEffect(() => {
    if (!logoReady) {
      return undefined;
    }

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        Animated.spring(logoScale, {
          toValue: 1,
          friction: 8,
          tension: 55,
          useNativeDriver: true,
        }),

        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),

        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(850),

      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),

        Animated.timing(textTranslateY, {
          toValue: 10,
          duration: 180,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(logoScale, {
          toValue: 2.4,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),

        Animated.timing(logoTranslateY, {
          toValue: -8,
          duration: 520,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),

        Animated.sequence([
          Animated.delay(440),

          Animated.timing(fullWhiteOpacity, {
            toValue: 1,
            duration: 80,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      ]),

      Animated.delay(140),
    ]);

    animation.start(({ finished }) => {
      if (finished) {
        onComplete();
      }
    });

    return () => {
      animation.stop();
    };
  }, [
    fullWhiteOpacity,
    logoOpacity,
    logoReady,
    logoScale,
    logoTranslateY,
    onComplete,
    textOpacity,
    textTranslateY,
  ]);

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#071B2C"
      />

      <View style={styles.content}>
        <Animated.View
          style={{
            opacity: logoOpacity,
            transform: [
              {
                translateY: logoTranslateY,
              },
              {
                scale: logoScale,
              },
            ],
          }}
        >
          <Image
            source={require('../../assets/logo-transparent.png')}
            style={styles.logo}
            resizeMode="contain"
            onLoadEnd={() => setLogoReady(true)}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [
                {
                  translateY: textTranslateY,
                },
              ],
            },
          ]}
        >
          <Text style={styles.title}>
            NORTHGROUP ONE
          </Text>

          <View style={styles.divider} />

          <Text style={styles.subtitle}>
            ONE TEAM · ONE PLATFORM
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.fullWhite,
          {
            opacity: fullWhiteOpacity,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#071B2C',
    overflow: 'hidden',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 38,
    overflow: 'hidden',
  },

  logo: {
    width: 280,
    height: 202,
  },

  textContainer: {
    alignItems: 'center',
    marginTop: 22,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 3.2,
    textAlign: 'center',
  },

  divider: {
    width: 54,
    height: 2,
    marginTop: 14,
    marginBottom: 12,
    backgroundColor:
      'rgba(255, 255, 255, 0.55)',
    borderRadius: 2,
  },

  subtitle: {
    color:
      'rgba(255, 255, 255, 0.68)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2.4,
    textAlign: 'center',
  },

  fullWhite: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFFFF',
  },
});
