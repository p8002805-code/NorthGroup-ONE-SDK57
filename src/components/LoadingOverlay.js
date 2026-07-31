import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

export default function LoadingOverlay({ text }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.overlay}>
      <View style={styles.panel}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>{text || 'Working…'}</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: colors.scrim,
  },
  panel: {
    minWidth: 190,
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.headerSurface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 8,
  },
  loadingText: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
});
