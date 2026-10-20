import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

export default function JobFileUploadProgress({ progress = 0, status, visible }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  if (!visible) return null;

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const title = status?.phase === 'connecting'
    ? 'Connecting securely to SharePoint…'
    : status?.total > 1
      ? `Uploading PDF ${status.current} of ${status.total}`
      : 'Uploading file to SharePoint…';

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.copyRow}>
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          <Text numberOfLines={1} style={styles.fileName}>
            {status?.fileName || 'Preparing the first secure transfer…'}
          </Text>
        </View>
        <Text style={styles.value}>{percent}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(3, percent)}%` }]} />
      </View>
      <Text style={styles.note}>
        Keep NorthGroup ONE open. Each completed PDF is confirmed separately; anything unfinished stays queued on this phone.
      </Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  wrap: {
    marginHorizontal: SPACING.lg,
    marginTop: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    backgroundColor: colors.surface,
  },
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { color: colors.bodyText, fontSize: 12, lineHeight: 17, fontWeight: '900' },
  fileName: { color: colors.supportingText, fontSize: 9, marginTop: 2 },
  track: {
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
    marginTop: 9,
  },
  fill: { height: 7, borderRadius: 4, backgroundColor: colors.accent },
  value: {
    width: 36,
    color: colors.bodyText,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  note: { color: colors.supportingText, fontSize: 9, lineHeight: 14, marginTop: 8 },
});
