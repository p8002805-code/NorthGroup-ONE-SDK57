import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

export default function JobFileMoveModal({ move }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const item = move.request?.item;
  const isSameFolder = Boolean(
    move.destination?.id && move.destination.id === move.request?.sourceParentId,
  );
  const visibleFolders = move.folders.filter((folder) => folder.id !== item?.id);

  return (
    <Modal
      visible={Boolean(move.request)}
      transparent
      animationType="slide"
      onRequestClose={move.close}
    >
      <View style={styles.shade}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.md) + SPACING.sm }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back one folder"
              disabled={!move.trail.length || move.loading || move.moving}
              onPress={move.goBack}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, !move.trail.length && styles.disabled]}
            >
              <Ionicons name="chevron-back" size={22} color={colors.bodyText} />
            </Pressable>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>MOVE TO</Text>
              <Text numberOfLines={1} style={styles.destinationName}>
                {move.destination?.name || 'Job Files'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close move"
              disabled={move.moving}
              onPress={move.close}
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={colors.bodyText} />
            </Pressable>
          </View>

          <View style={styles.itemSummary}>
            <Ionicons
              name={item?.folder ? 'folder-outline' : 'document-outline'}
              size={20}
              color={colors.accentDark}
            />
            <Text numberOfLines={2} style={styles.itemName}>Moving “{item?.name || 'item'}”</Text>
          </View>

          <ScrollView style={styles.folderList} contentContainerStyle={styles.folderListContent}>
            {move.loading ? (
              <View style={styles.state}>
                <ActivityIndicator color={colors.accentDark} />
                <Text style={styles.stateText}>Loading folders…</Text>
              </View>
            ) : move.error ? (
              <View style={styles.errorState}>
                <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
                <Text style={styles.errorText}>{move.error}</Text>
              </View>
            ) : visibleFolders.length ? visibleFolders.map((folder) => (
              <Pressable
                key={folder.id}
                accessibilityRole="button"
                accessibilityLabel={`Open ${folder.name}`}
                disabled={move.moving}
                onPress={() => move.openFolder(folder)}
                style={({ pressed }) => [styles.folderRow, pressed && styles.pressed]}
              >
                <View style={styles.folderIcon}>
                  <Ionicons name="folder-outline" size={21} color={colors.accentDark} />
                </View>
                <Text numberOfLines={2} style={styles.folderName}>{folder.name}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
              </Pressable>
            )) : (
              <View style={styles.state}>
                <Ionicons name="folder-open-outline" size={26} color={colors.supportingText} />
                <Text style={styles.stateText}>No subfolders here</Text>
              </View>
            )}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSameFolder ? 'Item is already in this folder' : 'Move item here'}
            disabled={isSameFolder || move.loading || move.moving || Boolean(move.error)}
            onPress={move.moveHere}
            style={({ pressed }) => [
              styles.moveButton,
              (isSameFolder || move.loading || move.moving || move.error) && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {move.moving ? <ActivityIndicator size="small" color={colors.navy} /> : (
              <Ionicons name="folder-open-outline" size={19} color={colors.navy} />
            )}
            <Text style={styles.moveButtonText}>
              {move.moving ? 'Moving…' : isSameFolder ? 'Already here' : 'Move here'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  shade: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: { height: '82%', paddingHorizontal: SPACING.xl, paddingTop: SPACING.md, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, backgroundColor: colors.surface },
  handle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, marginBottom: SPACING.md, backgroundColor: colors.borderStrong },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md },
  headerCopy: { flex: 1, minWidth: 0, alignItems: 'center' },
  eyebrow: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1.1 },
  destinationName: { color: colors.bodyText, fontSize: 16, fontWeight: '900', marginTop: 3 },
  itemSummary: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: SPACING.md, paddingHorizontal: 13, borderRadius: RADIUS.md, backgroundColor: colors.surfaceRaised },
  itemName: { flex: 1, color: colors.bodyText, fontSize: 11, lineHeight: 16, fontWeight: '800' },
  folderList: { flex: 1, marginTop: SPACING.md },
  folderListContent: { flexGrow: 1, paddingBottom: SPACING.md },
  folderRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 8, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  folderIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.warningBackground },
  folderName: { flex: 1, color: colors.bodyText, fontSize: 12, lineHeight: 17, fontWeight: '900', marginHorizontal: 11 },
  state: { flex: 1, minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  stateText: { color: colors.supportingText, fontSize: 11, fontWeight: '800' },
  errorState: { minHeight: 140, alignItems: 'center', justifyContent: 'center', gap: 9, padding: SPACING.lg },
  errorText: { color: colors.supportingText, fontSize: 11, lineHeight: 17, textAlign: 'center' },
  moveButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: RADIUS.md, backgroundColor: colors.accent },
  moveButtonText: { color: colors.navy, fontSize: 12, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
