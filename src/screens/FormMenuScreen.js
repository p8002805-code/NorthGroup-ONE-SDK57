import React, { useMemo } from 'react';
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
import AppStatusPill from '../components/AppStatusPill';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

const getFormBadge = (id) => ({
  s500: 'S-500',
  se14: 'SE-14',
  s501: 'S-501',
  s506: 'S-506',
}[id] || 'FORM');

export default function FormMenuScreen({
  selectedForm,
  setScreen,
  openFillForm,
  openInProgress,
  inProgressCount = 0,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const formId = selectedForm?.id;
  const formBadge = getFormBadge(formId);
  const isSe14 = formId === 'se14';

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow={formBadge}
        title={selectedForm?.title || 'Form'}
        subtitle={selectedForm?.subtitle}
        onBack={() => setScreen('home')}
        backLabel="Forms"
        showTopo
        compact
        rightContent={<AppStatusPill label="READY" tone="success" dot />}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxxl },
        ]}
      >
        <AppCard style={styles.summaryCard} padding="compact">
          <View style={styles.summaryBadge}>
            <Text style={styles.summaryBadgeText}>{formBadge}</Text>
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>Field-ready workflow</Text>
            <Text style={styles.summaryText}>
              Save progress at any time and export when the record is complete.
            </Text>
          </View>
        </AppCard>

        <AppSectionHeader
          title="Choose an action"
          subtitle={isSe14
            ? 'Start a session or reopen work already under way.'
            : 'Open the current job form.'}
        />

        <AppActionCard
          icon={isSe14 ? '⌖' : '▤'}
          eyebrow="FIELD FORM"
          title={isSe14 ? 'Start New Session' : 'Fill Form'}
          subtitle={isSe14
            ? 'Record the setup checks and start observations.'
            : 'Enter field data, save a draft and export the completed document.'}
          status="BEGIN"
          statusTone="accent"
          onPress={openFillForm}
        />

        {isSe14 ? (
          <AppActionCard
            icon="↺"
            eyebrow="SAVED SESSIONS"
            title="In Progress"
            subtitle="Reopen a started session to enter the end observations and export."
            meta={inProgressCount
              ? `${inProgressCount} active ${inProgressCount === 1 ? 'session' : 'sessions'}`
              : 'No active sessions'}
            status={String(inProgressCount)}
            statusTone={inProgressCount ? 'info' : 'neutral'}
            onPress={openInProgress}
          />
        ) : null}
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
    paddingTop: SPACING.lg,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  summaryBadge: {
    minWidth: 54,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  summaryBadgeText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  summaryCopy: {
    flex: 1,
  },
  summaryTitle: {
    color: colors.bodyText,
    fontSize: 14,
    fontWeight: '900',
  },
  summaryText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});
