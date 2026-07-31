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
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const TOOLS = [
  {
    id: 'photo',
    icon: '◉',
    eyebrow: 'CAPTURE + QA',
    title: 'Survey Photo Capture',
    subtitle: 'Capture, review, organise and export official job photos.',
    status: 'CAMERA READY',
    statusTone: 'success',
    action: 'openSurveyPhotoCapture',
  },
  {
    id: 'tmr',
    icon: '▦',
    eyebrow: 'REFERENCE',
    title: 'TMR Feature Guide',
    subtitle: 'Search feature codes and compare field reference images.',
    status: 'OFFLINE GUIDE',
    statusTone: 'info',
    action: 'openTmrFeatureGuide',
  },
  {
    id: 'compass',
    icon: '⌖',
    eyebrow: 'NAVIGATION',
    title: 'Compass',
    subtitle: 'Open a clear live bearing display using the NorthGroup pointer.',
    status: 'LIVE HEADING',
    statusTone: 'accent',
    action: 'openCompass',
  },
  {
    id: 'scanner',
    icon: '◈',
    eyebrow: '3D CAPTURE',
    title: '3D Feature Scanner',
    subtitle: 'Create a textured 3D model of pits, structures and site features.',
    status: 'LIDAR · NATIVE',
    statusTone: 'accent',
    action: 'openFeatureScanner',
  },
];

export default function FieldToolsScreen({
  goBack,
  openSurveyPhotoCapture,
  openTmrFeatureGuide,
  openCompass,
  openFeatureScanner,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const actions = {
    openSurveyPhotoCapture,
    openTmrFeatureGuide,
    openCompass,
    openFeatureScanner,
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="FIELD WORKSPACE"
        title="Field Tools"
        subtitle="Practical tools for capture, identification and navigation."
        onBack={goBack}
        backLabel="Dashboard"
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
            <Text style={styles.introIconText}>ONE</Text>
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>Choose the tool for the task</Text>
            <Text style={styles.introText}>
              Each tool keeps the active job context and returns you to this workspace.
            </Text>
          </View>
        </AppCard>

        <AppSectionHeader
          title="Available tools"
          subtitle="Designed for fast use on site."
        />

        {TOOLS.map((tool) => (
          <AppActionCard
            key={tool.id}
            icon={tool.icon}
            eyebrow={tool.eyebrow}
            title={tool.title}
            subtitle={tool.subtitle}
            status={tool.status}
            statusTone={tool.statusTone}
            onPress={actions[tool.action]}
          />
        ))}
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
  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  introIcon: {
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  introIconText: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
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
