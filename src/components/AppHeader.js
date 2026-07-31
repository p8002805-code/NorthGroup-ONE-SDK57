import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBackButton from './AppBackButton';

import {
  SPACING,
  RADIUS,
} from '../theme/spacing';
import { TYPOGRAPHY } from '../theme/typography';
import { useTheme } from '../theme/ThemeContext';

export default function AppHeader({
  title,
  subtitle,
  eyebrow,
  onBack,
  backLabel = 'Back',
  showTopo = false,
  rightContent = null,
  compact = false,
  centred = false,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerContent = (
    <View
      style={[
        styles.overlay,
        showTopo && styles.topoOverlay,
      ]}
    >
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + SPACING.sm },
          compact && styles.containerCompact,
          centred && styles.containerCentred,
        ]}
      >
        <View
          style={[
            styles.navigationRow,
            centred && styles.navigationRowCentred,
            centred && { top: insets.top + SPACING.xs },
          ]}
        >
          {onBack ? (
            <AppBackButton
              label={backLabel}
              style={styles.navigationButton}
              onPress={onBack}
            />
          ) : (
            <View style={styles.navigationButton} />
          )}

          <View style={styles.navigationCentre} />

          <View
            style={[
              styles.navigationButton,
              centred && styles.navigationButtonRight,
            ]}
          >
            {rightContent}
          </View>
        </View>

        <View style={centred && styles.titleGroupCentred}>
          {!!eyebrow && (
            <Text style={[styles.eyebrow, centred && styles.textCentred]}>
              {eyebrow}
            </Text>
          )}

          <Text
            style={[
              styles.title,
              compact && styles.titleCompact,
              centred && styles.textCentred,
            ]}
          >
            {title}
          </Text>

          <View style={[styles.titleAccent, centred && styles.titleAccentCentred]} />

          {!!subtitle && (
            <Text
              numberOfLines={centred ? 1 : undefined}
              style={[styles.subtitle, centred && styles.subtitleCentred]}
            >
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  if (showTopo) {
    return (
      <ImageBackground
        source={require('../../assets/topo-bg.png')}
        resizeMode="cover"
        style={styles.backgroundImage}
        imageStyle={styles.backgroundImageStyle}
      >
        {headerContent}
      </ImageBackground>
    );
  }

  return (
    <View style={styles.background}>
      {headerContent}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  background: {
    backgroundColor: colors.headerSurface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  backgroundImage: {
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  backgroundImageStyle: {
    opacity: 0.7,
  },

  overlay: {
    backgroundColor: colors.headerSurface,
  },

  topoOverlay: {
    backgroundColor: colors.overlay,
  },

  container: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },

  containerCompact: {
    paddingBottom: SPACING.lg,
  },

  containerCentred: {
    position: 'relative',
    paddingBottom: SPACING.md,
  },

  navigationRow: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },

  navigationRowCentred: {
    position: 'absolute',
    left: SPACING.lg,
    right: SPACING.lg,
    zIndex: 2,
    marginBottom: 0,
  },

  navigationButton: {
    minWidth: 112,
    minHeight: 40,
    justifyContent: 'center',
  },

  navigationButtonRight: {
    alignItems: 'flex-end',
  },

  navigationCentre: {
    flex: 1,
  },

  titleGroupCentred: {
    alignItems: 'center',
    paddingHorizontal: 76,
  },

  textCentred: {
    width: '100%',
    textAlign: 'center',
  },

  eyebrow: {
    ...TYPOGRAPHY.label,
    color: colors.accent,
    marginBottom: SPACING.xs,
  },

  title: {
    ...TYPOGRAPHY.screenTitle,
    color: colors.white,
    letterSpacing: -0.3,
  },

  titleCompact: {
    fontSize: 25,
  },

  titleAccent: {
    width: 54,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.sm,
  },

  titleAccentCentred: {
    alignSelf: 'center',
  },

  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: SPACING.sm,
    maxWidth: 420,
  },

  subtitleCentred: {
    width: '100%',
    maxWidth: 320,
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 17,
    marginTop: SPACING.xs,
  },
});
