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
      <View style={styles.jobIcon}>
        <Text style={styles.jobIconText}>{hasJob ? '⌖' : '!'}</Text>
      </View>
      <View style={styles.copy}>
        <View style={styles.eyebrowRow}>
          <View style={[styles.dot, !hasJob && styles.dotInactive]} />
          <Text style={styles.eyebrow}>
            {hasJob ? 'CURRENT JOB' : 'JOB REQUIRED'}
          </Text>
        </View>
        <View style={styles.jobLine}>
          <Text style={styles.title} numberOfLines={1}>
            {job?.number || 'No job selected'}
          </Text>
          {job?.name ? (
            <Text style={styles.name} numberOfLines={1}>· {job.name}</Text>
          ) : null}
        </View>
        {job?.location ? <Text style={styles.location} numberOfLines={1}>{job.location}</Text> : null}
      </View>
      <View style={styles.status}>
        <Text style={styles.statusText}>{hasJob ? 'ACTIVE' : 'SELECT'}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.headerSurface,
  },
  compact: {
    marginHorizontal: 18,
    marginTop: 16,
  },
  jobIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    backgroundColor: colors.warningBackground,
  },
  jobIconText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.sm,
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
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  jobLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 3,
  },
  title: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
  },
  name: {
    flex: 1,
    minWidth: 0,
    color: colors.white,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: 5,
  },
  location: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 2,
  },
  status: {
    minHeight: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.warningBackground,
  },
  statusText: {
    color: colors.accent,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
});
