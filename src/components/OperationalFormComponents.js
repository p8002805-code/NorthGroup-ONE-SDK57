import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import AppButton from './AppButton';
import AppCard from './AppCard';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

// Retained for the few native props that require a literal fallback colour.
export const COLORS = {
  navy: '#061A2D',
  gold: '#D6A84F',
  white: '#FFFFFF',
};

export function FormInput({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  editable = true,
  helper,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createControlStyles(colors), [colors]);

  if (label === 'Job Number' || label === 'Project Number') return null;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholderText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        editable={editable}
        returnKeyType={multiline ? 'default' : 'done'}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multiline,
          !editable && styles.inputDisabled,
        ]}
      />
    </View>
  );
}

export function ChoiceRow({
  value,
  options,
  onChange,
  accessibilityLabel,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createControlStyles(colors), [colors]);

  return (
    <View
      style={styles.choiceRow}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option) => {
        const selected = value === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            style={({ pressed }) => [
              styles.choice,
              selected && styles.choiceSelected,
              pressed && styles.pressed,
            ]}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <Text
              style={[
                styles.choiceText,
                selected && styles.choiceTextSelected,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  danger = false,
  loading = false,
  disabled = false,
  style,
}) {
  return (
    <AppButton
      title={label}
      onPress={onPress}
      variant={danger ? 'danger' : 'primary'}
      loading={loading}
      disabled={disabled}
      style={style}
    />
  );
}

export function FormSection({
  title,
  hint,
  children,
  style,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createOperationalStyles(colors), [colors]);

  return (
    <AppCard style={[styles.card, style]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      {children}
    </AppCard>
  );
}

export const useOperationalStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => createOperationalStyles(colors), [colors]);
};

const createControlStyles = (colors) => StyleSheet.create({
  field: {
    marginBottom: SPACING.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    flexShrink: 1,
    color: colors.bodyText,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '900',
  },
  helper: {
    color: colors.placeholderText,
    fontSize: 10,
    lineHeight: 15,
    marginLeft: SPACING.sm,
  },
  input: {
    minHeight: 50,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: RADIUS.md,
    color: colors.inputText,
    backgroundColor: colors.inputBackground,
    fontSize: 15,
  },
  multiline: {
    minHeight: 92,
    paddingTop: SPACING.md,
    textAlignVertical: 'top',
  },
  inputDisabled: {
    opacity: 0.66,
    backgroundColor: colors.raisedSurface,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  choice: {
    minWidth: 72,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.raisedSurface,
  },
  choiceSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.navy,
  },
  choiceText: {
    color: colors.supportingText,
    fontSize: 11,
    fontWeight: '900',
  },
  choiceTextSelected: {
    color: colors.accent,
  },
  pressed: {
    opacity: 0.75,
  },
});

const createOperationalStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 45,
  },
  card: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    color: colors.bodyText,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
  },
  sectionHint: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 18,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  standaloneSection: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  half: {
    flex: 1,
  },
  checklistItem: {
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  checklistTitle: {
    color: colors.bodyText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  issueChecklistItem: {
    borderColor: colors.warning,
    backgroundColor: colors.warningBackground,
  },
  infoButton: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: RADIUS.lg,
    backgroundColor: colors.warningBackground,
  },
  infoButtonTitle: {
    color: colors.bodyText,
    fontSize: 14,
    fontWeight: '900',
  },
  infoButtonHint: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  infoIcon: {
    color: colors.accentDark,
    fontSize: 22,
    fontWeight: '900',
  },
  saving: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.scrim,
  },
  savingPanel: {
    minWidth: 190,
    alignItems: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.headerSurface,
  },
  savingText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '900',
    marginTop: SPACING.md,
  },
});
