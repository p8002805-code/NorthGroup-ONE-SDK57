import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const PARTICLE_COUNT = 28;

const formatAmount = (value) => Number(value || 0).toLocaleString('en-AU', {
  maximumFractionDigits: 2,
});

export default function ProgressCompletionCelebration({ celebration, onDone }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const toast = useRef(new Animated.Value(0)).current;
  const particleAnimations = useRef(
    Array.from({ length: PARTICLE_COUNT }, () => new Animated.Value(0)),
  ).current;
  const particles = useMemo(() => {
    const palette = [colors.accent, colors.success, colors.info, colors.warning, colors.white];
    return Array.from({ length: PARTICLE_COUNT }, (_, index) => ({
      left: 3 + ((index * 37) % 94),
      drift: -54 + ((index * 29) % 109),
      distance: Math.max(300, height * (0.47 + ((index % 6) * 0.035))),
      delay: (index % 7) * 46,
      duration: 1120 + ((index * 71) % 520),
      colour: palette[index % palette.length],
      size: 6 + (index % 4) * 2,
      round: index % 3 === 0,
      direction: index % 2 ? 1 : -1,
    }));
  }, [colors, height]);

  useEffect(() => {
    if (!celebration?.requestId) return undefined;

    toast.setValue(0);
    particleAnimations.forEach((animation) => animation.setValue(0));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    AccessibilityInfo.announceForAccessibility(
      `${celebration.taskName || celebration.task?.name || 'Progress task'} complete`,
    );

    const toastAnimation = Animated.sequence([
      Animated.spring(toast, {
        toValue: 1,
        damping: 13,
        stiffness: 190,
        mass: 0.72,
        useNativeDriver: true,
      }),
      Animated.delay(1450),
      Animated.timing(toast, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    const confettiAnimation = Animated.parallel(
      particleAnimations.map((animation, index) => Animated.sequence([
        Animated.delay(particles[index].delay),
        Animated.timing(animation, {
          toValue: 1,
          duration: particles[index].duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ])),
    );
    Animated.parallel([toastAnimation, confettiAnimation]).start();

    const doneTimer = setTimeout(() => onDone?.(celebration), 2250);
    return () => {
      clearTimeout(doneTimer);
      toast.stopAnimation();
      particleAnimations.forEach((animation) => animation.stopAnimation());
    };
  }, [
    celebration?.requestId,
    celebration?.task?.name,
    celebration?.taskName,
    onDone,
    particleAnimations,
    particles,
    toast,
  ]);

  if (!celebration?.requestId) return null;

  const task = celebration.task || {};
  const taskName = celebration.taskName || task.name || 'Progress task';
  const completed = celebration.completed ?? task.completed;
  const target = celebration.target ?? task.target;
  const unit = celebration.unit || task.unit;
  const amount = `${formatAmount(completed)}/${formatAmount(target)}${unit ? ` ${unit}` : ''}`;
  const toastTranslateY = toast.interpolate({
    inputRange: [0, 1],
    outputRange: [-22, 0],
  });
  const toastScale = toast.interpolate({
    inputRange: [0, 0.65, 1],
    outputRange: [0.88, 1.035, 1],
  });

  return (
    <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden>
      {particles.map((particle, index) => {
        const animation = particleAnimations[index];
        const opacity = animation.interpolate({
          inputRange: [0, 0.08, 0.78, 1],
          outputRange: [0, 1, 1, 0],
        });
        const translateY = animation.interpolate({
          inputRange: [0, 1],
          outputRange: [-18, particle.distance],
        });
        const translateX = animation.interpolate({
          inputRange: [0, 0.45, 1],
          outputRange: [0, particle.drift, particle.drift * 0.45],
        });
        const rotate = animation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${particle.direction * (460 + index * 23)}deg`],
        });
        return (
          <Animated.View
            key={`${celebration.requestId}-${index}`}
            style={[
              styles.particle,
              {
                left: `${particle.left}%`,
                top: insets.top + 18,
                width: particle.size,
                height: particle.round ? particle.size : particle.size * 0.55,
                borderRadius: particle.round ? particle.size / 2 : 2,
                backgroundColor: particle.colour,
                opacity,
                transform: [{ translateX }, { translateY }, { rotate }],
              },
            ]}
          />
        );
      })}

      <Animated.View
        style={[
          styles.toast,
          {
            top: insets.top + 62,
            opacity: toast,
            transform: [{ translateY: toastTranslateY }, { scale: toastScale }],
          },
        ]}
      >
        <View style={styles.trophy}>
          <Ionicons name="trophy" size={24} color={colors.navy} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>TASK COMPLETE</Text>
          <Text style={styles.title} numberOfLines={1}>{taskName}</Text>
          <Text style={styles.amount}>{amount} · Shared progress updated</Text>
        </View>
        <View style={styles.check}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
        </View>
      </Animated.View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 120,
    elevation: 24,
  },
  particle: {
    position: 'absolute',
  },
  toast: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.navy,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  trophy: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: colors.accent,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  title: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  amount: {
    color: colors.white,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    marginTop: 2,
    opacity: 0.76,
  },
  check: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.success,
  },
});
