import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppStatusPill from '../../../components/AppStatusPill';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

export default function JobDetailsHubHeader({
  expanded,
  onToggle,
  loading,
  status,
  tone,
  action = 'toggle',
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.header,
        !expanded && styles.headerCollapsed,
        pressed && styles.pressed,
      ]}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={action === 'open'
        ? 'Open Job Details page'
        : `${expanded ? 'Collapse' : 'Expand'} Job Details`}
    >
      <View style={styles.icon}>
        <Ionicons name="grid-outline" size={20} color={colors.accentDark} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>SHARED JOB HUB</Text>
        <Text style={styles.title}>Job details</Text>
      </View>
      {loading
        ? <ActivityIndicator size="small" color={colors.accentDark} />
        : <AppStatusPill label={status} tone={tone} />}
      <Ionicons
        name={action === 'open' ? 'chevron-forward' : expanded ? 'chevron-up' : 'chevron-down'}
        size={17}
        color={colors.supportingText}
        style={styles.chevron}
      />
    </Pressable>
  );
}

const createStyles = (colors) => StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  headerCollapsed: { paddingBottom: SPACING.lg },
  pressed: { opacity: 0.78 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: SPACING.md,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  title: {
    color: colors.bodyText,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  chevron: { marginLeft: SPACING.sm },
});
