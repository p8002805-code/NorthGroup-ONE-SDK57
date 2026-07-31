import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { SPACING, RADIUS } from '../theme/spacing';
import { useTheme } from '../theme/ThemeContext';

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  icon,
  loading = false,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      disabled={isDisabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={accessibilityLabel || title}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.navy : colors.accent}
        />
      ) : (
        <View style={styles.content}>
          {icon ? (
            <Text style={[styles.icon, styles[`${variant}Text`]]}>{icon}</Text>
          ) : null}
          <Text
            style={[
              styles.text,
              styles[`${variant}Text`],
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const createStyles = (colors) => StyleSheet.create({
  button: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  primary: {
    backgroundColor: colors.accent,
  },

  secondary: {
    backgroundColor: colors.secondaryAction,
    borderWidth: 1,
    borderColor: colors.accent,
  },

  light: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.accent,
  },

  danger: {
    backgroundColor: colors.danger,
  },

  text: {
    fontSize: 15,
    fontWeight: '900',
  },
  icon: {
    fontSize: 17,
    fontWeight: '900',
    marginRight: SPACING.sm,
  },

  primaryText: {
    color: colors.navy,
  },

  secondaryText: {
    color: colors.secondaryActionText,
  },

  lightText: {
    color: colors.bodyText,
  },

  dangerText: {
    color: colors.white,
  },

  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
});
