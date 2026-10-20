import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GOLD, NAVY, WHITE } from '../styles/styles';
import {
  getSE14UploadState,
  SE14_SESSION_NUMBER_OPTIONS,
} from '../utils/se14Records';

const GREEN = '#219653';
const MUTED = '#64748B';

export default function SE14BulkSessionNumberEditor({
  group,
  onApply,
  onClose,
  recordTitle,
}) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(), []);
  const records = group?.records || [];
  const [selectedIds, setSelectedIds] = useState([]);
  const [sessionNumber, setSessionNumber] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!group) return;
    setSelectedIds(group.records.map((record) => record.id));
    const numbers = [...new Set(group.records.map(
      (record) => String(record?.data?.sessionNumber || '').trim()
    ))];
    setSessionNumber(numbers.length === 1 ? numbers[0] : '');
    setSaving(false);
  }, [group]);

  const selected = new Set(selectedIds);
  const allSelected = records.length > 0 && selectedIds.length === records.length;
  const uploadedCount = records.filter(
    (record) => selected.has(record.id) && getSE14UploadState(record) === 'uploaded'
  ).length;

  const toggleRecord = (recordId) => {
    if (saving) return;
    setSelectedIds((current) => (
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    ));
  };

  const toggleAll = () => {
    if (saving) return;
    setSelectedIds(allSelected ? [] : records.map((record) => record.id));
  };

  const apply = () => {
    if (!selectedIds.length || !sessionNumber || saving) return;
    const reuploadNote = uploadedCount
      ? ` ${uploadedCount} uploaded PDF${uploadedCount === 1 ? '' : 's'} will return to Waiting to upload. Existing SharePoint copies are not automatically deleted.`
      : '';

    Alert.alert(
      `Apply Session ${sessionNumber}?`,
      `${selectedIds.length} selected record${selectedIds.length === 1 ? '' : 's'} will be updated.${reuploadNote}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update sessions',
          onPress: async () => {
            setSaving(true);
            const saved = await onApply?.({
              recordIds: selectedIds,
              sessionNumber,
            });
            setSaving(false);
            if (saved) onClose?.();
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={Boolean(group)}
      transparent
      animationType="slide"
      onRequestClose={() => !saving && onClose?.()}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>SAVED DAY · BULK EDIT</Text>
              <Text style={styles.title}>Edit session numbers</Text>
              <Text style={styles.subtitle}>{group?.folderName || ''}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              activeOpacity={0.82}
              disabled={saving}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close session number editor"
            >
              <Ionicons name="close" size={22} color={NAVY} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.selectAllRow}
            activeOpacity={0.82}
            onPress={toggleAll}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allSelected }}
          >
            <View style={[styles.checkbox, allSelected && styles.checkboxSelected]}>
              {allSelected ? <Ionicons name="checkmark" size={15} color={WHITE} /> : null}
            </View>
            <View style={styles.selectAllCopy}>
              <Text style={styles.selectAllTitle}>SELECT WHOLE DAY</Text>
              <Text style={styles.selectAllMeta}>
                {selectedIds.length} of {records.length} sessions selected
              </Text>
            </View>
            <Text style={styles.selectAllAction}>{allSelected ? 'CLEAR' : 'ALL'}</Text>
          </TouchableOpacity>

          <ScrollView
            style={styles.recordList}
            contentContainerStyle={styles.recordListContent}
            showsVerticalScrollIndicator={false}
          >
            {records.map((record) => {
              const checked = selected.has(record.id);
              const uploaded = getSE14UploadState(record) === 'uploaded';
              return (
                <TouchableOpacity
                  key={record.id}
                  style={[styles.recordRow, checked && styles.recordRowSelected]}
                  activeOpacity={0.82}
                  onPress={() => toggleRecord(record.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <View style={[styles.checkbox, checked && styles.checkboxSelected]}>
                    {checked ? <Ionicons name="checkmark" size={15} color={WHITE} /> : null}
                  </View>
                  <View style={styles.recordCopy}>
                    <Text style={styles.recordTitle}>{recordTitle?.(record) || record.name}</Text>
                    <Text style={styles.recordMeta}>
                      Current Session {record?.data?.sessionNumber || '—'} · {uploaded ? 'Uploaded' : 'Local'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.numberLabel}>APPLY SESSION NUMBER</Text>
          <View style={styles.numberGrid}>
            {SE14_SESSION_NUMBER_OPTIONS.map((number) => (
              <TouchableOpacity
                key={number}
                style={[
                  styles.numberButton,
                  sessionNumber === number && styles.numberButtonSelected,
                ]}
                activeOpacity={0.82}
                disabled={saving}
                onPress={() => setSessionNumber(number)}
                accessibilityRole="button"
                accessibilityState={{ selected: sessionNumber === number }}
              >
                <Text style={[
                  styles.numberText,
                  sessionNumber === number && styles.numberTextSelected,
                ]}>{number}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {uploadedCount ? (
            <View style={styles.warning}>
              <Ionicons name="cloud-upload-outline" size={18} color="#8A5C08" />
              <Text style={styles.warningText}>
                Corrected uploaded records will be marked for re-upload.
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.applyButton,
              (!selectedIds.length || !sessionNumber || saving) && styles.applyButtonDisabled,
            ]}
            activeOpacity={0.84}
            disabled={!selectedIds.length || !sessionNumber || saving}
            onPress={apply}
          >
            <Text style={styles.applyButtonText}>
              {saving
                ? 'UPDATING…'
                : `APPLY TO ${selectedIds.length} SESSION${selectedIds.length === 1 ? '' : 'S'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = () => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,18,31,0.72)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: '#F4F7F9', paddingHorizontal: 16, paddingTop: 9 },
  handle: { width: 42, height: 5, borderRadius: 3, alignSelf: 'center', backgroundColor: '#C3CDD4', marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerCopy: { flex: 1 },
  eyebrow: { color: '#9A6A13', fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  title: { color: NAVY, fontSize: 22, fontWeight: '900', marginTop: 2 },
  subtitle: { color: MUTED, fontSize: 11, fontWeight: '700', marginTop: 3 },
  closeButton: { width: 42, height: 42, borderRadius: 13, borderWidth: 1, borderColor: '#D3DCE3', backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  selectAllRow: { minHeight: 58, borderRadius: 13, borderWidth: 1, borderColor: '#D6B661', backgroundColor: '#FFF7E1', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 1.5, borderColor: '#AAB8C2', backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxSelected: { borderColor: NAVY, backgroundColor: NAVY },
  selectAllCopy: { flex: 1 },
  selectAllTitle: { color: NAVY, fontSize: 11, fontWeight: '900', letterSpacing: 0.45 },
  selectAllMeta: { color: MUTED, fontSize: 9, marginTop: 3 },
  selectAllAction: { color: '#8A5C08', fontSize: 9, fontWeight: '900' },
  recordList: { maxHeight: 260 },
  recordListContent: { paddingBottom: 4 },
  recordRow: { minHeight: 54, borderRadius: 12, borderWidth: 1, borderColor: '#D7E0E5', backgroundColor: WHITE, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', marginBottom: 7 },
  recordRowSelected: { borderColor: '#BFA04E', backgroundColor: '#FFFCF3' },
  recordCopy: { flex: 1 },
  recordTitle: { color: NAVY, fontSize: 12, fontWeight: '900' },
  recordMeta: { color: MUTED, fontSize: 9, marginTop: 3 },
  numberLabel: { color: NAVY, fontSize: 9, fontWeight: '900', letterSpacing: 0.8, marginTop: 9, marginBottom: 7 },
  numberGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  numberButton: { width: '18%', minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: '#CCD6DD', backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center' },
  numberButtonSelected: { borderColor: GOLD, backgroundColor: NAVY },
  numberText: { color: NAVY, fontSize: 14, fontWeight: '900' },
  numberTextSelected: { color: GOLD },
  warning: { minHeight: 42, borderRadius: 11, backgroundColor: '#FFF1CC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, marginTop: 10 },
  warningText: { flex: 1, color: '#76510D', fontSize: 9, lineHeight: 13, fontWeight: '700', marginLeft: 8 },
  applyButton: { minHeight: 50, borderRadius: 13, backgroundColor: GOLD, borderWidth: 1, borderColor: '#C99737', alignItems: 'center', justifyContent: 'center', marginTop: 11 },
  applyButtonDisabled: { opacity: 0.38 },
  applyButtonText: { color: NAVY, fontSize: 10, fontWeight: '900', letterSpacing: 0.65 },
});
