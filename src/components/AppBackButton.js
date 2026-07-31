import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../theme/ThemeContext';

export default function AppBackButton({
  label = 'Back',
  onPress,
  style,
  accessibilityLabel,
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `Go to ${label}`}
    >
      <Text style={[styles.arrow, { color: colors.accent }]}>‹</Text>
      <Text style={[styles.text, { color: colors.accent }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 112,
    minHeight: 44,
    paddingHorizontal: 2,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderRadius: 12,
  },
  arrow: {
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '300',
    marginRight: 3,
  },
  text: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.985 }],
  },
});
