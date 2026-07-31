import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import AppStatusPill from './AppStatusPill';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

export default function AppActionCard({
  icon,
  eyebrow,
  title,
  subtitle,
  meta,
  status,
  statusTone = 'neutral',
  onPress,
  disabled = false,
  style,
  children,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { disabled } : undefined}
      accessibilityLabel={onPress ? [title, subtitle].filter(Boolean).join('. ') : undefined}
    >
      <View style={styles.icon}>
        <Text style={styles.iconText}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
        {children}
      </View>
      <View style={styles.trailing}>
        {status ? <AppStatusPill label={status} tone={statusTone} /> : null}
        {onPress ? <Text style={styles.arrow}>›</Text> : null}
      </View>
    </Pressable>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: colors.isDark ? 0.2 : 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: colors.raisedSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconText: {
    color: colors.accentDark,
    fontSize: 22,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  title: {
    color: colors.bodyText,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  meta: {
    color: colors.placeholderText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  trailing: {
    minWidth: 30,
    alignItems: 'flex-end',
    alignSelf: 'stretch',
    justifyContent: 'space-between',
    marginLeft: SPACING.sm,
  },
  arrow: {
    color: colors.accent,
    fontSize: 27,
    lineHeight: 28,
    fontWeight: '400',
  },
  disabled: {
    opacity: 0.58,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.992 }],
  },
});
