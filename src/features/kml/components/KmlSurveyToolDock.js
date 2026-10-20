import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const TOOL_CONFIG = {
  pin: { label: 'Pin', icon: 'location-outline' },
  measure: { label: 'Measure', icon: 'resize-outline' },
  line: { label: 'Line', icon: 'git-commit-outline' },
  polygon: { label: 'Area', icon: 'shapes-outline' },
};

function ToolButton({ icon, label, active = false, disabled = false, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable
      style={[styles.toolButton, disabled && styles.toolButtonDisabled]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}${disabled ? ', locked until zoomed closer' : ''}`}
      accessibilityState={{ disabled, selected: active }}
    >
      <View style={[styles.toolIcon, active && styles.toolIconActive]}>
        <Ionicons name={icon} size={20} color={disabled ? colors.placeholderText : (active ? colors.navy : colors.bodyText)} />
        {disabled ? (
          <View style={styles.toolLockBadge}>
            <Ionicons name="lock-closed" size={8} color={colors.navy} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.toolLabel, active && styles.toolLabelActive, disabled && styles.toolLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

export function SurveyToolDock({ activeTool, bottom, editingUnlocked, onTool, onFeatures }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.toolDock, { bottom }]}>
      {Object.entries(TOOL_CONFIG).map(([id, tool]) => {
        const editingTool = id === 'pin' || id === 'line' || id === 'polygon';
        return (
          <ToolButton
            key={id}
            icon={tool.icon}
            label={tool.label}
            active={activeTool === id}
            disabled={editingTool && !editingUnlocked}
            onPress={() => onTool(id)}
          />
        );
      })}
      <ToolButton icon="list-outline" label="Features" onPress={onFeatures} />
    </View>
  );
}

export function EditZoomLockBadge({ bottom, spanMetres }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const spanLabel = Number.isFinite(spanMetres)
    ? (spanMetres >= 1000
      ? `${(spanMetres / 1000).toFixed(spanMetres >= 10000 ? 0 : 1)} km view`
      : `${Math.round(spanMetres / 10) * 10} m view`)
    : 'Wide map view';

  return (
    <View style={[styles.editZoomLockBadge, { bottom }]} pointerEvents="none">
      <View style={styles.editZoomLockIcon}>
        <Ionicons name="lock-closed" size={14} color={colors.accentDark} />
      </View>
      <View style={styles.editZoomLockCopy}>
        <Text style={styles.editZoomLockTitle}>EDITING LOCKED · {spanLabel}</Text>
        <Text style={styles.editZoomLockText}>Double-tap to zoom to 500 m or closer.</Text>
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  toolDock: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
    borderRadius: 22,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  toolButton: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  toolButtonDisabled: { opacity: 0.56 },
  toolIcon: { width: 36, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  toolIconActive: { backgroundColor: colors.accent },
  toolLockBadge: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  toolLabel: { color: colors.supportingText, fontSize: 8, fontWeight: '800', marginTop: 2 },
  toolLabelActive: { color: colors.accentDark },
  toolLabelDisabled: { color: colors.placeholderText },
  editZoomLockBadge: {
    position: 'absolute',
    left: SPACING.xl,
    right: SPACING.xl,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    borderRadius: RADIUS.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 9,
    elevation: 5,
  },
  editZoomLockIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raisedSurface,
  },
  editZoomLockCopy: { flex: 1, minWidth: 0, marginLeft: SPACING.sm },
  editZoomLockTitle: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 0.65 },
  editZoomLockText: { color: colors.bodyText, fontSize: 9, fontWeight: '700', marginTop: 2 },
});
