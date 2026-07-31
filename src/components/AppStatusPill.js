import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

const TONES = {
  neutral: {
    background: 'raisedSurface',
    text: 'supportingText',
    border: 'border',
  },
  accent: {
    background: 'warningBackground',
    text: 'accentDark',
    border: 'divider',
  },
  success: {
    background: 'successBackground',
    text: 'statusSuccessText',
    border: 'success',
  },
  warning: {
    background: 'warningBackground',
    text: 'statusWarningText',
    border: 'warning',
  },
  danger: {
    background: 'dangerBackground',
    text: 'statusDangerText',
    border: 'danger',
  },
  info: {
    background: 'infoBackground',
    text: 'statusInfoText',
    border: 'info',
  },
};

export default function AppStatusPill({
  label,
  tone = 'neutral',
  dot = false,
  style,
}) {
  const { colors } = useTheme();
  const palette = TONES[tone] || TONES.neutral;
  const styles = useMemo(
    () => createStyles(colors, palette),
    [colors, palette],
  );

  return (
    <View style={[styles.pill, style]}>
      {dot ? <View style={styles.dot} /> : null}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const createStyles = (colors, palette) => StyleSheet.create({
  pill: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors[palette.border],
    backgroundColor: colors[palette.background],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: colors[palette.border],
  },
  label: {
    color: colors[palette.text],
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
