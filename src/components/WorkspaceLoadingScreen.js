import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  StatusBar,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

export default function WorkspaceLoadingScreen({
  message = 'Preparing your workspace…',
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>ONE</Text>
      </View>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    backgroundColor: colors.navy,
  },
  brandMark: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.navy2,
  },
  brandMarkText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  message: {
    color: colors.white,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '800',
    marginTop: SPACING.lg,
    letterSpacing: 0.3,
  },
});
