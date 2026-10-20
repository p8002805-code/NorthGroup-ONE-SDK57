import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

export default function AppBackButton({
  label = 'Back',
  onPress,
  style,
  accessibilityLabel,
  showLabel = Boolean(label),
  large = false,
  compact = false,
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        compact && styles.buttonCompact,
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || (label ? `Go to ${label}` : 'Go back')}
    >
      <Text
        style={[
          styles.arrow,
          large && styles.arrowLarge,
          compact && styles.arrowCompact,
          { color: colors.accent },
        ]}
      >
        ‹
      </Text>
      {showLabel ? (
        <Text style={[styles.text, { color: colors.accent }]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 112,
    height: 40,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  buttonLarge: {
    minWidth: 54,
    width: 54,
    height: 54,
    paddingHorizontal: 0,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: {
    minWidth: 42,
    width: 42,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '300',
    marginRight: 3,
  },
  arrowLarge: {
    fontSize: 39,
    lineHeight: 43,
    marginRight: 0,
  },
  arrowCompact: {
    fontSize: 31,
    lineHeight: 34,
    marginRight: 0,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.72,
  },
});
