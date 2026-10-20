import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../theme/ThemeContext';
import { RADIUS, SPACING } from '../theme/spacing';

const ActionTile = ({
  icon,
  label,
  onPress,
  tone = 'secondary',
  variant = 'default',
  disabled = false,
  loading = false,
  wide = false,
}) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, variant), [colors, variant]);
  const dark = variant === 'dark';
  const isDisabled = disabled || loading || !onPress;
  const iconColor = tone === 'primary'
    ? (dark ? '#D6A84F' : colors.accent)
    : tone === 'accent'
      ? (dark ? '#061A2D' : colors.navy)
      : tone === 'danger'
        ? colors.danger
        : (dark ? '#D6A84F' : colors.accentDark);

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.actionTile,
        wide && styles.actionTileWide,
        styles[`tone_${tone}`],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator size="small" color={tone === 'primary' ? iconColor : colors.navy} />
      ) : (
        <Ionicons
          name={icon}
          size={18}
          color={iconColor}
        />
      )}
      <Text numberOfLines={1} style={[styles.actionLabel, styles[`tone_${tone}Text`]]}>
        {label}
      </Text>
    </Pressable>
  );
};

export default function FormActionBar({
  onSave,
  onClear,
  onExport,
  onUpload,
  onEmail,
  saving = false,
  exporting = false,
  uploading = false,
  saveDisabled = false,
  clearDisabled = false,
  exportDisabled = false,
  uploadDisabled = false,
  emailDisabled = false,
  uploadLabel = 'Upload PDF',
  uploadIcon = 'cloud-upload-outline',
  style,
  subtitle = 'Save a draft or send the finished PDF.',
  variant = 'default',
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, variant), [colors, variant]);
  const dark = variant === 'dark';
  const hasSecondaryActions = Boolean(onSave || onClear);
  const hasPrimaryActions = Boolean(onExport || onUpload);

  return (
    <View style={[styles.panel, style]}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>FORM ACTIONS</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.headingIcon}>
          <Ionicons
            name="checkmark-done-outline"
            size={20}
            color={dark ? '#D6A84F' : colors.accentDark}
          />
        </View>
      </View>

      {hasSecondaryActions ? (
        <View style={styles.row}>
          {onSave ? (
            <ActionTile
              icon="save-outline"
              label="Save draft"
              onPress={onSave}
              variant={variant}
              disabled={saveDisabled}
              loading={saving}
            />
          ) : null}
          {onClear ? (
            <ActionTile
              icon="trash-outline"
              label="Clear form"
              onPress={onClear}
              tone="danger"
              variant={variant}
              disabled={clearDisabled}
            />
          ) : null}
        </View>
      ) : null}

      {hasPrimaryActions ? (
        <View style={styles.row}>
          {onExport ? (
            <ActionTile
              icon="download-outline"
              label="Export PDF"
              onPress={onExport}
              tone="primary"
              variant={variant}
              disabled={exportDisabled}
              loading={exporting}
            />
          ) : null}
          {onUpload ? (
            <ActionTile
              icon={uploadIcon}
              label={uploadLabel}
              onPress={onUpload}
              tone="accent"
              variant={variant}
              disabled={uploadDisabled}
              loading={uploading}
            />
          ) : null}
        </View>
      ) : null}

      {onEmail ? (
        <ActionTile
          icon="mail-outline"
          label="Email PDF to OHS"
          onPress={onEmail}
          tone="secondary"
          variant={variant}
          disabled={emailDisabled}
          wide
        />
      ) : null}
    </View>
  );
}

const createStyles = (colors, variant = 'default') => {
  const dark = variant === 'dark';

  return StyleSheet.create({
    panel: {
      marginTop: dark ? SPACING.md : SPACING.lg,
      padding: dark ? 14 : SPACING.md,
      borderRadius: dark ? 18 : RADIUS.xl,
      borderWidth: 1,
      borderColor: dark ? 'rgba(214,168,79,0.42)' : colors.border,
      backgroundColor: dark ? 'rgba(9,35,60,0.96)' : colors.raisedSurface,
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: dark ? 0.12 : 0,
      shadowRadius: 8,
      elevation: dark ? 2 : 0,
    },
    headingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.md,
    },
    headingCopy: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      color: dark ? '#D6A84F' : colors.accentDark,
      fontSize: 10,
      fontWeight: '900',
      letterSpacing: 1.2,
    },
    subtitle: {
      color: dark ? '#B8C4D0' : colors.supportingText,
      fontSize: 11,
      lineHeight: 16,
      marginTop: 3,
    },
    headingIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: SPACING.sm,
      backgroundColor: dark ? 'rgba(214,168,79,0.13)' : colors.warningBackground,
    },
    row: {
      flexDirection: 'row',
      gap: SPACING.sm,
      marginBottom: SPACING.sm,
    },
    actionTile: {
      flex: 1,
      minWidth: 0,
      minHeight: dark ? 52 : 56,
      paddingHorizontal: SPACING.sm,
      borderRadius: 15,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
    },
    actionTileWide: {
      flex: 0,
      width: '100%',
      marginBottom: 0,
    },
    tone_primary: {
      backgroundColor: dark ? '#0E2D48' : colors.navy,
      borderWidth: 1,
      borderColor: dark ? 'rgba(214,168,79,0.48)' : colors.navy,
    },
    tone_accent: {
      backgroundColor: dark ? '#D6A84F' : colors.accent,
      borderWidth: 1,
      borderColor: dark ? '#E6C477' : colors.accent,
    },
    tone_secondary: {
      backgroundColor: dark ? 'rgba(255,255,255,0.06)' : colors.cardBackground,
      borderWidth: 1,
      borderColor: dark ? 'rgba(255,255,255,0.16)' : colors.borderStrong,
    },
    tone_danger: {
      backgroundColor: colors.dangerBackground,
      borderWidth: 1,
      borderColor: colors.danger,
    },
    actionLabel: {
      flexShrink: 1,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '900',
      textAlign: 'center',
    },
    tone_primaryText: { color: colors.white },
    tone_accentText: { color: dark ? '#061A2D' : colors.navy },
    tone_secondaryText: { color: dark ? '#F4F8FB' : colors.bodyText },
    tone_dangerText: { color: colors.statusDangerText },
    disabled: { opacity: 0.48 },
    pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  });
};
