import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppCard from '../../../components/AppCard';
import AppStatusPill from '../../../components/AppStatusPill';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const parseDate = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatMoment = (value) => {
  const date = parseDate(value);
  if (!date) return 'Not supplied';
  return date.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const formatUpdated = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};

const scheduleStatus = (startValue, endValue) => {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  const now = Date.now();
  if (start && now < start.getTime()) return { label: 'UPCOMING', tone: 'info' };
  if (start && end && now >= start.getTime() && now <= end.getTime()) {
    return { label: 'IN PROGRESS', tone: 'success' };
  }
  if (end && now > end.getTime()) return { label: 'ENDED', tone: 'neutral' };
  return { label: 'SHIFT WINDOW', tone: 'accent' };
};

function InfoRow({
  icon,
  eyebrow,
  title,
  detail,
  helper,
  onPress,
  onEdit,
  last = false,
  trailing,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress || onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${onPress ? 'Open' : 'Edit'} ${title}`}
    >
      <View style={styles.icon}>
        <Ionicons name={icon} size={19} color={colors.accentDark} />
      </View>
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <Text style={styles.detail} numberOfLines={2}>{detail}</Text>
        {helper ? <Text style={styles.helper} numberOfLines={1}>{helper}</Text> : null}
      </View>
      <View style={styles.trailing}>
        {trailing}
        <Pressable
          style={styles.editButton}
          onPress={(event) => {
            event.stopPropagation();
            onEdit?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${title}`}
        >
          <Ionicons name="create-outline" size={15} color={colors.accentDark} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function WorkspaceInfoPanel({
  job,
  mapLinks,
  openDirections,
  accommodation,
  sharedAccommodation,
  accommodationLoading,
  accommodationError,
  onEditSchedule,
  onEditLocation,
  onEditAccommodation,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const status = scheduleStatus(job?.scheduleStart, job?.scheduleEnd);
  const stay = String(accommodation || '').trim();
  const stayShared = Boolean(sharedAccommodation?.itemId);

  return (
    <AppCard style={styles.panel} padding="none">
      <InfoRow
        icon="calendar-clear-outline"
        eyebrow="SHIFT"
        title="Schedule"
        detail={`${formatMoment(job?.scheduleStart)} → ${formatMoment(job?.scheduleEnd)}`}
        helper="Shared with everyone on this job"
        onEdit={onEditSchedule}
        trailing={<AppStatusPill label={status.label} tone={status.tone} />}
      />
      <InfoRow
        icon="location-outline"
        eyebrow="SITE"
        title="Location"
        detail={job?.location || 'Not supplied'}
        helper={mapLinks ? 'Tap for directions' : 'Add a location to enable directions'}
        onPress={mapLinks ? openDirections : onEditLocation}
        onEdit={onEditLocation}
        trailing={mapLinks ? <Ionicons name="navigate" size={16} color={colors.accentDark} /> : null}
      />
      <InfoRow
        icon="bed-outline"
        eyebrow="STAY"
        title="Accommodation"
        detail={stay || 'Not supplied'}
        helper={accommodationLoading
          ? 'Loading shared details…'
          : accommodationError
            ? 'Saved copy shown · sync issue'
            : stayShared && sharedAccommodation?.updatedAt
              ? `Shared · Updated ${formatUpdated(sharedAccommodation.updatedAt)}`
              : 'Shared with everyone on this job'}
        onEdit={onEditAccommodation}
        last
      />
    </AppCard>
  );
}

const createStyles = (colors) => StyleSheet.create({
  panel: { overflow: 'hidden', marginBottom: SPACING.md },
  row: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowPressed: { backgroundColor: colors.raisedSurface },
  icon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.accentSoft,
  },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', columnGap: 7 },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: { color: colors.bodyText, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  detail: {
    color: colors.bodyText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    marginTop: 3,
  },
  helper: {
    color: colors.supportingText,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  trailing: {
    maxWidth: 104,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 7,
    marginLeft: SPACING.sm,
  },
  editButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
});
