import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { FILE_FILTERS } from '../jobFilePresentation';

export default function JobFilesHeader({
  creatingFolder,
  currentFolder,
  fileFilter,
  itemCount,
  jobNumber,
  loading,
  onChangeFilter,
  onChangeSearch,
  onCreateFolder,
  onGoUp,
  onSort,
  onUpload,
  parentPathLabel,
  queuedAssetsCount,
  queuedUpload,
  searchQuery,
  sortMode,
  totalCount,
  uploading,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showFilters, setShowFilters] = useState(false);
  const selectedFilter = FILE_FILTERS.find((filter) => filter.key === fileFilter) || FILE_FILTERS[0];
  const controlsDisabled = !currentFolder || uploading || creatingFolder;

  useEffect(() => setShowFilters(false), [currentFolder?.id]);

  return (
    <>
      <View style={[styles.titleBar, { paddingTop: insets.top + SPACING.sm }]}>
        <Text style={styles.title}>Job Files</Text>
        <View style={styles.jobBadge}>
          <Text numberOfLines={1} style={styles.jobBadgeText}>{jobNumber || 'NO JOB'}</Text>
        </View>
      </View>

      <View style={styles.browserTools}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={19} color={colors.supportingText} />
          <TextInput
            value={searchQuery}
            onChangeText={onChangeSearch}
            placeholder="Search this folder"
            placeholderTextColor={colors.placeholderText}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {searchQuery ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => onChangeSearch('')}
              style={({ pressed }) => [styles.searchClear, pressed && styles.pressed]}
            >
              <Ionicons name="close-circle" size={18} color={colors.supportingText} />
            </Pressable>
          ) : null}
        </View>

        <View style={styles.toolRow}>
          <View style={styles.filterWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Filter files. Current filter ${selectedFilter.label}`}
              onPress={() => setShowFilters((visible) => !visible)}
              style={({ pressed }) => [styles.dropdownButton, pressed && styles.pressed]}
            >
              <Ionicons name="filter-outline" size={15} color={colors.accentDark} />
              <Text style={styles.dropdownText}>{selectedFilter.label}</Text>
              <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={14} color={colors.supportingText} />
            </Pressable>
            {showFilters ? (
              <View style={styles.filterMenu}>
                {FILE_FILTERS.map((filter) => {
                  const active = filter.key === fileFilter;
                  return (
                    <Pressable
                      key={filter.key}
                      accessibilityRole="button"
                      onPress={() => {
                        onChangeFilter(filter.key);
                        setShowFilters(false);
                      }}
                      style={({ pressed }) => [styles.filterOption, active && styles.filterOptionActive, pressed && styles.pressed]}
                    >
                      <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{filter.label}</Text>
                      {active ? <Ionicons name="checkmark" size={16} color={colors.navy} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sort files by ${sortMode === 'name' ? 'recently modified' : 'name'}`}
            onPress={onSort}
            style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}
          >
            <Ionicons name={sortMode === 'name' ? 'text-outline' : 'time-outline'} size={15} color={colors.accentDark} />
            <Text style={styles.sortText}>{sortMode === 'name' ? 'A–Z' : 'Recent'}</Text>
          </Pressable>
          {!loading ? (
            <Text style={styles.resultCount}>
              {itemCount} shown{itemCount !== totalCount ? ` · ${totalCount} total` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.folderBar}>
        {currentFolder && parentPathLabel !== 'CURRENT FOLDER' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to parent folder"
            onPress={onGoUp}
            style={({ pressed }) => [styles.upButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={20} color={colors.bodyText} />
          </Pressable>
        ) : null}
        <View style={styles.folderCopy}>
          <Text numberOfLines={1} style={styles.folderEyebrow}>
            {queuedUpload ? (queuedAssetsCount > 1 ? 'SAVE GNSS DAY TO' : 'SAVE FORM TO') : parentPathLabel}
          </Text>
          <Text numberOfLines={1} style={styles.folderName}>{currentFolder?.name || 'Connecting to SharePoint…'}</Text>
        </View>
        <Pressable
          disabled={controlsDisabled}
          onPress={onCreateFolder}
          style={({ pressed }) => [styles.newButton, controlsDisabled && styles.disabled, pressed && styles.pressed]}
        >
          {creatingFolder ? <ActivityIndicator size="small" color={colors.accentDark} /> : <Ionicons name="folder-outline" size={17} color={colors.accentDark} />}
          <Text style={styles.newText}>New</Text>
        </Pressable>
        <Pressable
          disabled={controlsDisabled}
          onPress={onUpload}
          style={({ pressed }) => [styles.uploadButton, controlsDisabled && styles.disabled, pressed && styles.pressed]}
        >
          <Ionicons name={queuedUpload ? 'save-outline' : 'cloud-upload-outline'} size={18} color={colors.navy} />
          <Text style={styles.uploadText}>{uploading ? 'Saving' : queuedUpload ? (queuedAssetsCount > 1 ? 'Upload day' : 'Save here') : 'Upload'}</Text>
        </Pressable>
      </View>
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  titleBar: { minHeight: 72, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md, backgroundColor: colors.navy },
  title: { color: colors.white, fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.35 },
  jobBadge: { maxWidth: '42%', minHeight: 27, justifyContent: 'center', marginBottom: 1, paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: colors.accent },
  jobBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  browserTools: { zIndex: 20, paddingHorizontal: SPACING.lg, paddingTop: 10, paddingBottom: 8, backgroundColor: colors.pageBackground, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  searchBar: { height: 44, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  searchInput: { flex: 1, height: 42, color: colors.bodyText, fontSize: 13, fontWeight: '700', paddingVertical: 0 },
  searchClear: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  toolRow: { minHeight: 39, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 7 },
  filterWrap: { zIndex: 30 },
  dropdownButton: { minWidth: 112, height: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dropdownText: { flex: 1, color: colors.bodyText, fontSize: 9, fontWeight: '900' },
  filterMenu: { position: 'absolute', top: 37, left: 0, width: 148, padding: 5, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 8 },
  filterOption: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, borderRadius: RADIUS.sm },
  filterOptionActive: { backgroundColor: colors.accent },
  filterOptionText: { color: colors.supportingText, fontSize: 10, fontWeight: '800' },
  filterOptionTextActive: { color: colors.navy, fontWeight: '900' },
  sortButton: { height: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  sortText: { color: colors.accentDark, fontSize: 9, fontWeight: '900' },
  resultCount: { flex: 1, color: colors.supportingText, fontSize: 9, fontWeight: '800', textAlign: 'right' },
  folderBar: { zIndex: 1, minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.lg, paddingVertical: 10, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  upButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border },
  folderCopy: { flex: 1, minWidth: 0 },
  folderEyebrow: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  folderName: { color: colors.bodyText, fontSize: 13, fontWeight: '900', marginTop: 3 },
  newButton: { height: 40, paddingHorizontal: 10, borderRadius: RADIUS.md, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  newText: { color: colors.accentDark, fontSize: 10, fontWeight: '900' },
  uploadButton: { height: 40, paddingHorizontal: 12, borderRadius: RADIUS.md, flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: colors.accent },
  uploadText: { color: colors.navy, fontSize: 10, fontWeight: '900' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
