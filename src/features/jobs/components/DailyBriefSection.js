import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

export function BriefDisplay({ value = '' }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brief = String(value || '').trim();

  if (!brief) {
    return <Text style={styles.emptyText}>No brief has been added.</Text>;
  }

  return <Text style={styles.briefText}>{brief}</Text>;
}

export function BriefEditor({
  value,
  saving = false,
  onChange,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View>
      <Text style={styles.inputLabel}>BRIEF</Text>
      <Text style={styles.inputHelp}>
        This is one shared brief. Saving updates the same brief for every member of the job.
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        editable={!saving}
        multiline
        textAlignVertical="top"
        style={styles.input}
        placeholder={'MLS capture\nSX12 scans'}
        placeholderTextColor={colors.placeholderText}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  briefText: {
    color: colors.bodyText,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.placeholderText,
    fontSize: 14,
    lineHeight: 21,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  inputLabel: {
    color: colors.accentDark,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  inputHelp: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '600',
    marginBottom: SPACING.sm,
  },
  input: {
    minHeight: 126,
    color: colors.bodyText,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: SPACING.lg,
  },
});
