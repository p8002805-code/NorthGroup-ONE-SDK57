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
import LoadingOverlay from '../components/LoadingOverlay';
import { FORMS } from '../constants/forms';
import JobWorkspaceDock from '../features/jobs/components/JobWorkspaceDock';
import { useTheme } from '../theme/ThemeContext';
import { SPACING } from '../theme/spacing';

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
  job,
  openWorkspace,
  openJobFiles,
  openCapture,
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
      <View style={[styles.pageHeader, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.pageTitle}>Forms</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 112 },
        ]}
      >
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

      <JobWorkspaceDock
        job={job}
        activeTab="forms"
        onWorkspace={openWorkspace}
        onForms={undefined}
        onJobFiles={openJobFiles}
        onCapture={openCapture}
      />

      {loading ? <LoadingOverlay text="Opening form…" /> : null}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  pageHeader: {
    minHeight: 76,
    justifyContent: 'flex-end',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: colors.navy,
  },
  pageTitle: {
    color: colors.white,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
});
