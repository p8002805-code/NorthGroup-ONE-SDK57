import React, { useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppActionCard from '../../../components/AppActionCard';
import AppCard from '../../../components/AppCard';
import AppHeader from '../../../components/AppHeader';
import AppSectionHeader from '../../../components/AppSectionHeader';
import AppStatusPill from '../../../components/AppStatusPill';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const formatDateTime = (value) => {
  if (!value) return 'Not supplied in Teams';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

function DetailRow({ label, value, last = false, muted = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.detailRow, last && styles.detailRowLast]}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, muted && styles.detailValueMuted]}>
        {value}
      </Text>
    </View>
  );
}

export default function JobWorkspaceScreen({ job, goBack, openForms, openJobFiles }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasJob = Boolean(job?.number);
  const coordinates = Number.isFinite(Number(job?.latitude))
    && Number.isFinite(Number(job?.longitude))
    ? `${Number(job.latitude).toFixed(5)}, ${Number(job.longitude).toFixed(5)}`
    : '';
  const sourceLabel = job?.microsoftTeamNames?.length
    ? job.microsoftTeamNames.join(', ')
    : '';

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="JOB WORKSPACE"
        title={hasJob ? job.number : 'No job selected'}
        subtitle={job?.name || 'Choose a job to open its workspace.'}
        onBack={goBack}
        backLabel="Dashboard"
        showTopo
        compact
        rightContent={(
          <AppStatusPill
            label={hasJob ? 'ACTIVE' : 'NOT SET'}
            tone={hasJob ? 'success' : 'warning'}
            dot
          />
        )}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxxl },
        ]}
      >
        <AppSectionHeader
          title="Workspace"
          subtitle="Job details flow into forms, photos and exports."
        />

        <AppActionCard
          icon="▤"
          eyebrow="JOB FORMS"
          title="Useful Forms"
          subtitle="Open pre-starts, GNSS sessions, vehicle checks and journey plans."
          status="OPEN"
          statusTone="accent"
          onPress={openForms}
          disabled={!hasJob}
        />

        <AppActionCard
          icon="↥"
          eyebrow="SHAREPOINT"
          title="Job Files"
          subtitle="View, upload, download and share files stored against this job."
          status="OPEN"
          statusTone="info"
          onPress={openJobFiles}
          disabled={!hasJob}
        />

        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>◷</Text>
            </View>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.cardEyebrow}>SHIFT DETAILS</Text>
              <Text style={styles.cardTitle}>Schedule</Text>
            </View>
          </View>
          <DetailRow label="START" value={formatDateTime(job?.scheduleStart)} />
          <DetailRow
            label="END"
            value={formatDateTime(job?.scheduleEnd)}
            last
          />
        </AppCard>

        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>⌖</Text>
            </View>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.cardEyebrow}>SITE</Text>
              <Text style={styles.cardTitle}>Location</Text>
            </View>
          </View>
          <Text style={styles.location}>
            {job?.location || 'Location not supplied'}
          </Text>
          <Text style={styles.helper}>
            {coordinates || 'Imported roster text will be resolved when a map location is selected.'}
          </Text>
        </AppCard>

        <AppCard style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <Text style={styles.cardIconText}>i</Text>
            </View>
            <View style={styles.cardHeadingCopy}>
              <Text style={styles.cardEyebrow}>BRIEF</Text>
              <Text style={styles.cardTitle}>Job Details</Text>
            </View>
            {sourceLabel ? (
              <AppStatusPill label="TEAMS IMPORT" tone="info" />
            ) : null}
          </View>
          {job?.workType ? (
            <DetailRow label="WORK TYPE" value={job.workType} />
          ) : null}
          {sourceLabel ? (
            <DetailRow label="SOURCE" value={sourceLabel} />
          ) : null}
          <DetailRow
            label="INSTRUCTIONS"
            value={job?.details || 'No additional instructions supplied.'}
            last
            muted={!job?.details}
          />
        </AppCard>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  card: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cardIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.warningBackground,
  },
  cardIconText: {
    color: colors.accentDark,
    fontSize: 21,
    fontWeight: '900',
  },
  cardHeadingCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardEyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  cardTitle: {
    color: colors.bodyText,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  detailRow: {
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  detailRowLast: {
    paddingBottom: 0,
  },
  detailLabel: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  detailValue: {
    color: colors.bodyText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginTop: 4,
  },
  detailValueMuted: {
    color: colors.supportingText,
    fontWeight: '500',
  },
  location: {
    color: colors.bodyText,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  helper: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: SPACING.sm,
  },
});
