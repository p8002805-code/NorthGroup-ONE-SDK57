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
import AppHeader from '../../../components/AppHeader';
import { FEATURE_SCANNER_ENABLED } from '../../../config/featureFlags';
import { useTheme } from '../../../theme/ThemeContext';
import { SPACING } from '../../../theme/spacing';

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
    icon: FEATURE_SCANNER_ENABLED ? '◈' : '🔒',
    eyebrow: '3D CAPTURE',
    title: 'Feature Scanner',
    subtitle: FEATURE_SCANNER_ENABLED
      ? 'Move around a feature, inspect captured viewpoints, zoom, spin and measure.'
      : 'Temporarily locked while the Meshroom 3D processing workflow is being built and tested.',
    status: FEATURE_SCANNER_ENABLED ? 'AUTO CAPTURE · LIDAR' : 'UNDER DEVELOPMENT',
    statusTone: FEATURE_SCANNER_ENABLED ? 'accent' : 'warning',
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
        centred
        backOnly
        backCompact
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxxl },
        ]}
      >
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
});
