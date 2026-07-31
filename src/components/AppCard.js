import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {
  SPACING,
  RADIUS,
} from '../theme/spacing';
import { useTheme } from '../theme/ThemeContext';

export default function AppCard({
  children,
  style,
  onPress,
  accessibilityLabel,
  elevated = false,
  padding = 'default',
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const baseStyle = [
    styles.card,
    elevated && styles.elevated,
    padding === 'compact' && styles.compact,
    padding === 'none' && styles.noPadding,
    style,
  ];

  if (!onPress) return <View style={baseStyle}>{children}</View>;

  return (
    <Pressable
      style={({ pressed }) => [baseStyle, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: SPACING.lg,
  },
  compact: {
    padding: SPACING.md,
  },
  noPadding: {
    padding: 0,
  },
  elevated: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: colors.isDark ? 0.24 : 0.1,
    shadowRadius: 13,
    elevation: 3,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.992 }],
  },
});
