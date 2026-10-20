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

export default function JobWorkspaceCreateModal({ expectedName, onClose, onCreate, visible }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDraft(String(expectedName || ''));
    setCreating(false);
    setError('');
  }, [expectedName, visible]);

  const create = useCallback(async () => {
    if (!draft.trim() || creating) return;
    try {
      setCreating(true);
      setError('');
      await onCreate(draft.trim());
    } catch (createError) {
      setError(createError?.message || 'The job folder could not be created.');
    } finally {
      setCreating(false);
    }
  }, [creating, draft, onCreate]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !creating && onClose()}>
      <View style={styles.shade}>
        <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
            <View style={styles.handle} />
            <View style={styles.icon}>
              <Ionicons name="folder-open-outline" size={28} color={colors.accentDark} />
            </View>
            <Text style={styles.eyebrow}>SHAREPOINT JOB FILES</Text>
            <Text style={styles.title}>Create the missing job folder</Text>
            <Text style={styles.body}>Review the folder name below. It must begin with the active job number so every user can find the same workspace.</Text>
            <Text style={styles.label}>JOB FOLDER NAME</Text>
            <TextInput
              autoFocus
              autoCorrect={false}
              editable={!creating}
              maxLength={255}
              onChangeText={setDraft}
              onSubmitEditing={create}
              returnKeyType="done"
              selectTextOnFocus
              style={[styles.input, error && styles.inputError]}
              value={draft}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Pressable disabled={creating} onPress={onClose} style={({ pressed }) => [styles.cancel, pressed && styles.pressed, creating && styles.disabled]}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable disabled={creating || !draft.trim()} onPress={create} style={({ pressed }) => [styles.create, pressed && styles.pressed, (creating || !draft.trim()) && styles.disabled]}>
                {creating ? <ActivityIndicator size="small" color={colors.navy} /> : <Ionicons name="add-circle-outline" size={18} color={colors.navy} />}
                <Text style={styles.createText}>{creating ? 'Creating…' : 'Create job folder'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  keyboard: { width: '100%', justifyContent: 'flex-end' },
  sheet: { padding: SPACING.xl, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, backgroundColor: colors.surface },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, marginBottom: SPACING.lg, backgroundColor: colors.borderStrong },
  icon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.warningBackground },
  eyebrow: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, marginTop: SPACING.md },
  title: { color: colors.bodyText, fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 4 },
  body: { color: colors.supportingText, fontSize: 12, lineHeight: 18, marginTop: 6, marginBottom: SPACING.lg },
  label: { color: colors.supportingText, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 7 },
  input: { minHeight: 52, paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.inputBackground, color: colors.bodyText, fontSize: 14, fontWeight: '800' },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 10, lineHeight: 15, marginTop: 7 },
  actions: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },
  cancel: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.supportingText, fontSize: 11, fontWeight: '900' },
  create: { flex: 1.6, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: RADIUS.md, backgroundColor: colors.accent },
  createText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
