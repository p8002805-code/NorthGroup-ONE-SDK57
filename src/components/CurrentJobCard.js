import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

export default function CurrentJobCard({ job, compact = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasJob = Boolean(job?.number);

  return (
    <View style={[styles.card, compact && styles.compact]}>
      <View style={styles.rule} />
      <View style={styles.copy}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, !hasJob && styles.dotInactive]} />
          <Text style={styles.eyebrow}>
            {hasJob ? 'CURRENT JOB' : 'JOB REQUIRED'}
          </Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {job?.number || 'No job selected'}
          {job?.name ? ` · ${job.name}` : ''}
        </Text>
        {job?.location ? (
          <Text style={styles.location} numberOfLines={2}>
            ⌖  {job.location}
          </Text>
        ) : null}
      </View>
      <View style={styles.status}>
        <Text style={styles.statusText}>{hasJob ? '✓' : '!'}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.headerSurface,
  },
  compact: {
    marginHorizontal: 18,
    marginTop: 16,
  },
  rule: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accent,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingLeft: SPACING.xs,
    paddingRight: SPACING.md,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
    backgroundColor: colors.success,
  },
  dotInactive: {
    backgroundColor: colors.warning,
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: SPACING.xs,
  },
  location: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: SPACING.xs,
  },
  status: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningBackground,
  },
  statusText: {
    color: colors.accent,
    fontWeight: '900',
  },
});
