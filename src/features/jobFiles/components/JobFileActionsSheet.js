import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

function ActionRow({
  icon,
  label,
  colour,
  chevronColour,
  styles,
  onPress,
  disabled = false,
  showChevron = true,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={colour} />
      </View>
      <Text style={[styles.actionLabel, { color: colour }]}>{label}</Text>
      {showChevron ? (
        <Ionicons name="chevron-forward" size={17} color={chevronColour} />
      ) : null}
    </Pressable>
  );
}

export default function JobFileActionsSheet({
  item,
  onClose,
  onRename,
  onRequestMove,
  onRequestDelete,
  onOpenSharePoint,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [mode, setMode] = useState('menu');
  const [draftName, setDraftName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isFolder = Boolean(item?.folder);
  const itemType = isFolder ? 'folder' : 'file';

  useEffect(() => {
    if (!item) return;
    setMode('menu');
    setDraftName(String(item.name || ''));
    setSaving(false);
    setError('');
  }, [item]);

  const close = useCallback(() => {
    if (!saving) onClose?.();
  }, [onClose, saving]);

  const beginRename = useCallback(() => {
    setError('');
    setDraftName(String(item?.name || ''));
    setMode('rename');
  }, [item?.name]);

  const saveRename = useCallback(async () => {
    if (!item || saving) return;
    const nextName = draftName.trim();
    if (!nextName) {
      setError(`Enter a ${itemType} name before saving.`);
      return;
    }
    if (nextName === String(item.name || '').trim()) {
      onClose?.();
      return;
    }

    try {
      setSaving(true);
      setError('');
      await onRename?.(item, nextName);
      onClose?.();
    } catch (renameError) {
      setError(renameError?.message || `This ${itemType} could not be renamed.`);
    } finally {
      setSaving(false);
    }
  }, [draftName, item, itemType, onClose, onRename, saving]);

  const requestDelete = useCallback(() => {
    if (!item || saving) return;
    const target = item;
    onClose?.();
    setTimeout(() => onRequestDelete?.(target), 180);
  }, [item, onClose, onRequestDelete, saving]);

  const requestMove = useCallback(() => {
    if (!item || saving) return;
    const target = item;
    onClose?.();
    setTimeout(() => onRequestMove?.(target), 180);
  }, [item, onClose, onRequestMove, saving]);

  const openSharePoint = useCallback(() => {
    if (!item?.webUrl || saving) return;
    const target = item;
    onClose?.();
    setTimeout(() => onOpenSharePoint?.(target), 180);
  }, [item, onClose, onOpenSharePoint, saving]);

  return (
    <Modal
      visible={Boolean(item)}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        style={styles.modalPage}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.shade}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close file actions"
            style={StyleSheet.absoluteFillObject}
            onPress={close}
          />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.sm }]}>
            <View style={styles.handle} />

            {mode === 'menu' ? (
              <>
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryIcon, isFolder && styles.summaryFolderIcon]}>
                    <Ionicons
                      name={isFolder ? 'folder-outline' : 'document-outline'}
                      size={23}
                      color={isFolder ? colors.accentDark : colors.navy}
                    />
                  </View>
                  <View style={styles.summaryCopy}>
                    <Text style={styles.eyebrow}>{isFolder ? 'FOLDER ACTIONS' : 'FILE ACTIONS'}</Text>
                    <Text numberOfLines={2} style={styles.summaryName}>{item?.name || 'Job item'}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close actions"
                    onPress={close}
                    style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                  >
                    <Ionicons name="close" size={21} color={colors.bodyText} />
                  </Pressable>
                </View>

                <View style={styles.actionList}>
                  <ActionRow
                    icon="create-outline"
                    label={`Rename ${itemType}`}
                    colour={colors.bodyText}
                    chevronColour={colors.iconMuted}
                    styles={styles}
                    onPress={beginRename}
                  />
                  <ActionRow
                    icon="folder-open-outline"
                    label={`Move ${itemType}`}
                    colour={colors.bodyText}
                    chevronColour={colors.iconMuted}
                    styles={styles}
                    onPress={requestMove}
                  />
                  <ActionRow
                    icon="trash-outline"
                    label={`Delete ${itemType}`}
                    colour={colors.danger}
                    chevronColour={colors.iconMuted}
                    styles={styles}
                    onPress={requestDelete}
                  />
                  <View style={styles.actionDivider} />
                  <ActionRow
                    icon="open-outline"
                    label="Open in SharePoint"
                    colour={colors.accentDark}
                    chevronColour={colors.iconMuted}
                    styles={styles}
                    disabled={!item?.webUrl}
                    onPress={openSharePoint}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.renameHeader}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Back to actions"
                    disabled={saving}
                    onPress={() => setMode('menu')}
                    style={({ pressed }) => [styles.backButton, pressed && !saving && styles.pressed]}
                  >
                    <Ionicons name="chevron-back" size={22} color={colors.bodyText} />
                  </Pressable>
                  <View style={styles.renameHeading}>
                    <Text style={styles.eyebrow}>EDIT NAME</Text>
                    <Text style={styles.renameTitle}>Rename {itemType}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close rename"
                    disabled={saving}
                    onPress={close}
                    style={({ pressed }) => [styles.closeButton, pressed && !saving && styles.pressed]}
                  >
                    <Ionicons name="close" size={21} color={colors.bodyText} />
                  </Pressable>
                </View>

                <Text style={styles.inputLabel}>{isFolder ? 'FOLDER NAME' : 'FILE NAME'}</Text>
                <TextInput
                  autoFocus
                  autoCorrect={false}
                  editable={!saving}
                  maxLength={255}
                  onChangeText={setDraftName}
                  onSubmitEditing={saveRename}
                  placeholder={`Enter ${itemType} name`}
                  placeholderTextColor={colors.placeholderText}
                  returnKeyType="done"
                  selectTextOnFocus
                  style={[styles.nameInput, error && styles.nameInputError]}
                  value={draftName}
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View style={styles.renameActions}>
                  <Pressable
                    disabled={saving}
                    onPress={() => setMode('menu')}
                    style={({ pressed }) => [styles.cancelButton, pressed && !saving && styles.pressed]}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    disabled={saving || !draftName.trim()}
                    onPress={saveRename}
                    style={({ pressed }) => [
                      styles.saveButton,
                      (saving || !draftName.trim()) && styles.disabled,
                      pressed && !saving && styles.pressed,
                    ]}
                  >
                    {saving ? <ActivityIndicator size="small" color={colors.navy} /> : null}
                    <Text style={styles.saveText}>{saving ? 'Renaming…' : 'Save name'}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  modalPage: {
    flex: 1,
  },
  shade: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    paddingTop: 10,
    paddingHorizontal: SPACING.lg,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    backgroundColor: colors.surface,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: colors.isDark ? 0.34 : 0.18,
    shadowRadius: 24,
    elevation: 18,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    marginBottom: SPACING.lg,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
  },
  summaryFolderIcon: {
    backgroundColor: colors.warningBackground,
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  summaryName: {
    color: colors.bodyText,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 3,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surfaceRaised,
  },
  actionList: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.lg,
    backgroundColor: colors.raisedSurface,
  },
  actionRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  actionIcon: {
    width: 34,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
  },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 48,
    backgroundColor: colors.border,
  },
  renameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.surfaceRaised,
  },
  renameHeading: {
    flex: 1,
    minWidth: 0,
  },
  renameTitle: {
    color: colors.bodyText,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    marginTop: 2,
  },
  inputLabel: {
    color: colors.supportingText,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.85,
    marginBottom: 7,
  },
  nameInput: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: RADIUS.md,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 15,
    fontWeight: '700',
  },
  nameInputError: {
    borderColor: colors.danger,
  },
  errorText: {
    color: colors.danger,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 8,
  },
  renameActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.xl,
  },
  cancelButton: {
    flex: 0.72,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    backgroundColor: colors.surfaceRaised,
  },
  cancelText: {
    color: colors.bodyText,
    fontSize: 12,
    fontWeight: '800',
  },
  saveButton: {
    flex: 1.28,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: RADIUS.md,
    backgroundColor: colors.accent,
  },
  saveText: {
    color: colors.navy,
    fontSize: 12,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.42,
  },
  pressed: {
    opacity: 0.68,
  },
});
