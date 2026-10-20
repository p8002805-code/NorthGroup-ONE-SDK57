import React, { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

export function HubBubble({ section, onPress, highlighted = false }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.hubBubble,
        highlighted && styles.hubBubbleHighlighted,
        pressed && styles.pressed,
      ]}
      onPress={() => onPress(section)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${section.title}`}
    >
      <View style={styles.hubBubbleIcon}>
        <Ionicons name={section.icon || 'folder-open-outline'} size={21} color={colors.accentDark} />
      </View>
      <Text style={styles.hubBubbleTitle} numberOfLines={1}>{section.title}</Text>
      <View style={styles.hubBubbleFooter}>
        <Text style={styles.hubBubbleHint}>OPEN SECTION</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.accentDark} />
      </View>
    </Pressable>
  );
}

export function SectionBlock({
  icon,
  title,
  value,
  emptyText,
  hideValue = false,
  accessory,
  children,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cleanValue = String(value || '').trim();

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionBlockHeader}>
        <View style={styles.sectionBlockIcon}>
          <Ionicons name={icon} size={17} color={colors.accentDark} />
        </View>
        <Text style={styles.sectionBlockTitle}>{title}</Text>
        {accessory}
      </View>
      {!hideValue ? (
        <Text style={[styles.sectionBlockText, !cleanValue && styles.emptyText]}>
          {cleanValue || emptyText}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  hubBubble: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 126,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
  },
  hubBubbleHighlighted: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  hubBubbleIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  hubBubbleTitle: {
    flex: 1,
    color: colors.bodyText,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: '900',
    marginTop: SPACING.sm,
  },
  hubBubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hubBubbleHint: {
    color: colors.accentDark,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionBlock: {
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    marginBottom: SPACING.md,
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionBlockIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: SPACING.sm,
  },
  sectionBlockTitle: {
    flex: 1,
    color: colors.bodyText,
    fontSize: 17,
    lineHeight: 21,
    fontWeight: '900',
  },
  sectionBlockText: {
    color: colors.bodyText,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.placeholderText,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.72,
  },
});
