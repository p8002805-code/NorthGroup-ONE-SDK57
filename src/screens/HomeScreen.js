import React, { useEffect, useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppActionCard from '../components/AppActionCard';
import AppCard from '../components/AppCard';
import AppHeader from '../components/AppHeader';
import AppSectionHeader from '../components/AppSectionHeader';
import LoadingOverlay from '../components/LoadingOverlay';
import { FORMS } from '../constants/forms';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

const FORM_DETAILS = {
  s500: {
    icon: '✓',
    eyebrow: 'DAILY SAFETY',
    description: 'Pre-start risk assessment with guided hazards and PPE.',
    status: 'PRE-START',
    statusTone: 'accent',
  },
  se14: {
    icon: '⌖',
    eyebrow: 'GNSS OBSERVATION',
    description: 'Start, end and export single static GNSS sessions.',
    status: 'SESSIONS',
    statusTone: 'info',
  },
  s501: {
    icon: '▣',
    eyebrow: 'VEHICLE',
    description: 'Complete the light vehicle pre-start checklist.',
    status: 'CHECKLIST',
    statusTone: 'success',
  },
  s506: {
    icon: '↗',
    eyebrow: 'TRAVEL',
    description: 'Plan long-distance field travel and buddy contact.',
    status: 'JOURNEY',
    statusTone: 'warning',
  },
};

export default function HomeScreen({
  loading,
  playIntroLanding = false,
  onIntroLandingComplete,
  openForm,
  goDashboard,
  backLabel = 'Job Workspace',
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    if (playIntroLanding) onIntroLandingComplete?.();
  }, [onIntroLandingComplete, playIntroLanding]);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="JOB DOCUMENTS"
        title="Forms"
        subtitle="Create, save and export field records for the active job."
        onBack={goDashboard}
        backLabel={backLabel}
        showTopo
        compact
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxxl },
        ]}
      >
        <AppCard style={styles.introCard} padding="compact">
          <View style={styles.introIcon}>
            <Text style={styles.introIconText}>▤</Text>
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Active-job forms</Text>
            <Text style={styles.introText}>
              Job details are applied automatically and drafts stay with this workspace.
            </Text>
          </View>
        </AppCard>

        <AppSectionHeader
          title="Available forms"
          subtitle="Choose a record to begin or continue."
        />

        {FORMS.map((form) => {
          const details = FORM_DETAILS[form.id] || {};
          return (
            <AppActionCard
              key={form.id}
              icon={details.icon || '▤'}
              eyebrow={`${details.eyebrow || 'FIELD FORM'} · ${form.subtitle}`}
              title={form.title}
              subtitle={details.description}
              status={details.status || 'OPEN'}
              statusTone={details.statusTone || 'neutral'}
              onPress={() => openForm(form)}
            />
          );
        })}
      </ScrollView>

      {loading ? <LoadingOverlay text="Opening form…" /> : null}
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
    paddingTop: SPACING.lg,
  },
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  introIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  introIconText: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '900',
  },
  introCopy: {
    flex: 1,
  },
  introTitle: {
    color: colors.bodyText,
    fontSize: 14,
    fontWeight: '900',
  },
  introText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});
