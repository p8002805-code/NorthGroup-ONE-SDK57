import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { SPACING } from '../theme/spacing';

export default function AppSectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.row, style]}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          disabled={!onAction}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.md,
  },
  title: {
    color: colors.bodyText,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  action: {
    color: colors.accentDark,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.65,
  },
});
