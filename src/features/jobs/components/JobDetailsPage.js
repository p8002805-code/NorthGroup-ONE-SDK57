import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppCard from '../../../components/AppCard';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import JobDetailsHub from './JobDetailsHub';
import JobDetailsHubHeader from './JobDetailsHubHeader';

export function JobDetailsLaunchCard({ onOpen }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AppCard style={styles.launchCard} padding="none">
      <JobDetailsHubHeader
        expanded={false}
        onToggle={onOpen}
        loading={false}
        status="OPEN"
        tone="accent"
        action="open"
      />
    </AppCard>
  );
}

export default function JobDetailsPage({
  visible,
  active,
  onClose,
  job,
  focusRequest,
  getAccessToken,
  updatedBy,
  legacyBrief,
  legacyBriefLoading,
  legacyBriefError,
  taskNames,
  sourceLabel,
  onBriefSaved,
  onProgressSectionsChange,
  openJobFiles,
  openTmrFeatureGuide,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle={colors.isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.pageBackground}
        />
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Back to Job Workspace"
          >
            <Ionicons name="chevron-back" size={23} color={colors.bodyText} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>SHARED JOB WORKSPACE</Text>
            <Text style={styles.title}>Job Details</Text>
          </View>
          <View style={styles.sharedPill}>
            <Ionicons name="people-outline" size={13} color={colors.success} />
            <Text style={styles.sharedText}>SHARED</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + SPACING.xxl },
          ]}
        >
          <Text style={styles.intro}>
            Open a section to view or edit its brief, requirements, procedures and linked files.
          </Text>
          <JobDetailsHub
            job={job}
            active={active}
            expanded
            standalone
            onToggle={onClose}
            focusRequest={focusRequest}
            getAccessToken={getAccessToken}
            updatedBy={updatedBy}
            legacyBrief={legacyBrief}
            legacyBriefLoading={legacyBriefLoading}
            legacyBriefError={legacyBriefError}
            taskNames={taskNames}
            sourceLabel={sourceLabel}
            onBriefSaved={onBriefSaved}
            onProgressSectionsChange={onProgressSectionsChange}
            openJobFiles={() => {
              onClose?.();
              openJobFiles?.();
            }}
            openTmrFeatureGuide={openTmrFeatureGuide}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.surface,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  pressed: { opacity: 0.66 },
  headerCopy: { flex: 1, minWidth: 0, marginLeft: SPACING.xs },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  title: {
    color: colors.bodyText,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  sharedPill: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: 9,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.successBackground,
  },
  sharedText: {
    color: colors.success,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  content: { padding: SPACING.lg },
  intro: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: SPACING.md,
  },
  launchCard: {
    borderColor: colors.accent,
    borderWidth: 1,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
});
