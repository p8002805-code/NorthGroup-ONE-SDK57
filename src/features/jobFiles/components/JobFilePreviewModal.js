import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import { MAX_TEXT_PREVIEW_BYTES } from '../jobFilePreview';

export default function JobFilePreviewModal({ preview, onClose, onSaveText, onShare }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const original = String(preview?.content || '');
  const changed = editing && draft !== original;

  useEffect(() => {
    setEditing(false);
    setDraft(String(preview?.content || ''));
    setSaving(false);
    setError('');
  }, [preview?.item?.id, preview?.item?.eTag, preview?.content]);

  const confirmDiscard = useCallback((action) => {
    if (!changed) {
      action();
      return;
    }
    Alert.alert(
      'Discard unsaved changes?',
      'Your edits have not been saved to SharePoint.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: action },
      ],
    );
  }, [changed]);

  const requestClose = useCallback(() => {
    if (saving) return;
    confirmDiscard(onClose);
  }, [confirmDiscard, onClose, saving]);

  const cancelEdit = useCallback(() => {
    if (saving) return;
    confirmDiscard(() => {
      setDraft(original);
      setEditing(false);
      setError('');
    });
  }, [confirmDiscard, original, saving]);

  const save = useCallback(async () => {
    if (!preview?.item || saving || !changed) return;
    if (draft.length > MAX_TEXT_PREVIEW_BYTES) {
      setError('Edited text files must remain under 2 MB.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await onSaveText(preview.item, draft);
      setEditing(false);
    } catch (saveError) {
      setError(saveError?.message || 'The file could not be saved.');
    } finally {
      setSaving(false);
    }
  }, [changed, draft, onSaveText, preview?.item, saving]);

  return (
    <Modal visible={Boolean(preview)} animationType="slide" onRequestClose={requestClose}>
      <View style={styles.page}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close file preview"
            disabled={saving}
            onPress={requestClose}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.white} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>{preview?.item?.name || 'File preview'}</Text>
            <Text style={styles.subtitle}>{editing ? 'EDITING JOB FILE' : 'JOB FILE'}</Text>
          </View>
          {preview?.kind === 'text' && !editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit text file"
              onPress={() => {
                setDraft(original);
                setError('');
                setEditing(true);
              }}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <Ionicons name="create-outline" size={21} color={colors.accent} />
            </Pressable>
          ) : null}
          {!editing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share file"
              onPress={() => preview?.item && onShare(preview.item)}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
            >
              <Ionicons name="share-outline" size={21} color={colors.white} />
            </Pressable>
          ) : null}
        </View>

        {preview?.kind === 'image' ? (
          <ScrollView maximumZoomScale={4} minimumZoomScale={1} centerContent contentContainerStyle={styles.imageContent}>
            <Image source={{ uri: preview.localUri }} style={styles.image} resizeMode="contain" />
          </ScrollView>
        ) : null}

        {preview?.kind === 'text' && !editing ? (
          <ScrollView style={styles.textPreview} contentContainerStyle={styles.textContent} showsVerticalScrollIndicator showsHorizontalScrollIndicator>
            <Text selectable style={styles.monospace}>{preview.content}</Text>
          </ScrollView>
        ) : null}

        {preview?.kind === 'text' && editing ? (
          <View style={styles.editor}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              editable={!saving}
              multiline
              onChangeText={setDraft}
              scrollEnabled
              style={styles.editorInput}
              textAlignVertical="top"
              value={draft}
            />
            <View style={styles.editorMeta}>
              <Text style={[styles.editorStatus, error && styles.errorText]}>{error || 'Changes are saved back to the same SharePoint file.'}</Text>
              <Text style={styles.characterCount}>{draft.length.toLocaleString('en-AU')} characters</Text>
            </View>
            <View style={[styles.editorActions, { paddingBottom: Math.max(insets.bottom, SPACING.md) }]}>
              <Pressable
                disabled={saving}
                onPress={cancelEdit}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed, saving && styles.disabled]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                disabled={saving || !changed}
                onPress={save}
                style={({ pressed }) => [styles.saveButton, (saving || !changed) && styles.disabled, pressed && styles.pressed]}
              >
                {saving ? <ActivityIndicator size="small" color={colors.navy} /> : <Ionicons name="cloud-upload-outline" size={18} color={colors.navy} />}
                <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  header: { minHeight: 70, paddingHorizontal: 8, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy },
  headerButton: { width: 43, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 6 },
  title: { color: colors.white, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 3 },
  imageContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  textPreview: { flex: 1, backgroundColor: colors.surface },
  textContent: { flexGrow: 1, padding: SPACING.lg },
  monospace: { color: colors.bodyText, fontSize: 12, lineHeight: 18, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  editor: { flex: 1, backgroundColor: colors.pageBackground },
  editorInput: { flex: 1, margin: SPACING.md, marginBottom: 8, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, color: colors.bodyText, fontSize: 12, lineHeight: 18, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  editorMeta: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.lg },
  editorStatus: { flex: 1, color: colors.supportingText, fontSize: 9, lineHeight: 13 },
  errorText: { color: colors.danger },
  characterCount: { color: colors.supportingText, fontSize: 9, fontWeight: '800' },
  editorActions: { flexDirection: 'row', gap: 10, padding: SPACING.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  cancelButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.supportingText, fontSize: 11, fontWeight: '900' },
  saveButton: { flex: 1.45, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: RADIUS.md, backgroundColor: colors.accent },
  saveText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
