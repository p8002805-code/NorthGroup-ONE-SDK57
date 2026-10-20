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
  backOnly = false,
  backLarge = false,
  backCompact = false,
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
            compact && styles.navigationRowCompact,
          ]}
        >
          {onBack ? (
            <AppBackButton
              label={backLabel}
              showLabel={!backOnly}
              large={backLarge}
              compact={backCompact}
              style={[
                styles.navigationButton,
                backLarge && styles.navigationButtonLarge,
                backCompact && styles.navigationButtonCompact,
              ]}
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
              compact && styles.navigationButtonRightCompact,
            ]}
          >
            {rightContent}
          </View>
        </View>

        <View
          style={[
            centred && styles.titleGroupCentred,
            compact && centred && styles.titleGroupCompact,
            compact && !centred && styles.titleGroupCompactLeft,
          ]}
        >
          {!!eyebrow && (
            <Text
              style={[
                styles.eyebrow,
                compact && styles.eyebrowCompact,
                centred && styles.textCentred,
              ]}
            >
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

          <View
            style={[
              styles.titleAccent,
              compact && styles.titleAccentCompact,
              centred && styles.titleAccentCentred,
            ]}
          />

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
    opacity: 0.5,
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
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
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

  navigationButtonLarge: {
    minWidth: 54,
    width: 54,
    minHeight: 54,
    height: 54,
    paddingHorizontal: 0,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  navigationButtonCompact: {
    minWidth: 42,
    width: 42,
    minHeight: 40,
    height: 40,
    paddingHorizontal: 0,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  navigationRowCompact: {
    minHeight: 40,
  },

  navigationButtonRight: {
    alignItems: 'flex-end',
  },

  navigationButtonRightCompact: {
    minWidth: 100,
  },

  navigationCentre: {
    flex: 1,
  },

  titleGroupCentred: {
    alignItems: 'center',
    paddingHorizontal: 76,
  },

  titleGroupCompact: {
    paddingHorizontal: 68,
  },

  titleGroupCompactLeft: {
    paddingHorizontal: SPACING.xs,
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

  eyebrowCompact: {
    fontSize: 8,
    letterSpacing: 1.4,
    marginBottom: 2,
  },

  title: {
    ...TYPOGRAPHY.screenTitle,
    color: colors.white,
    letterSpacing: -0.3,
  },

  titleCompact: {
    fontSize: 18,
    lineHeight: 22,
    letterSpacing: -0.1,
  },

  titleAccent: {
    width: 54,
    height: 4,
    backgroundColor: colors.accent,
    borderRadius: RADIUS.pill,
    marginTop: SPACING.sm,
  },

  titleAccentCompact: {
    display: 'none',
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
