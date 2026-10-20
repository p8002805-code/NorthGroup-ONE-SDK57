import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { GOLD, NAVY, WHITE } from '../styles/styles';
import { getSE14UploadState } from '../utils/se14Records';

const GREEN = '#219653';
const MUTED_TEXT = '#64748B';

function ArchiveSessionCard({
  record,
  onOpen,
  onRestore,
  onDelete,
  recordTitle,
  formatArchiveDate,
  styles,
}) {
  const uploadState = getSE14UploadState(record);

  return (
    <View style={styles.sessionCard}>
      <TouchableOpacity
        style={styles.sessionMain}
        activeOpacity={0.82}
        onPress={() => onOpen(record.id)}
      >
        <View
          style={[
            styles.sessionIcon,
            uploadState === 'uploaded' && styles.sessionIconUploaded,
          ]}
        >
          <Text
            style={[
              styles.sessionIconText,
              uploadState === 'uploaded' && styles.sessionIconTextUploaded,
            ]}
          >
            {uploadState === 'uploaded' ? '✓' : '▣'}
          </Text>
        </View>
        <View style={styles.sessionCopy}>
          <Text style={styles.sessionTitle}>{recordTitle(record)}</Text>
          <Text
            style={[
              styles.uploadState,
              uploadState === 'uploaded'
                ? styles.uploadStateComplete
                : styles.uploadStatePending,
            ]}
          >
            {uploadState === 'uploaded'
              ? 'UPLOADED TO SHAREPOINT'
              : uploadState === 'pending'
                ? 'SAVED OFFLINE · WAITING TO UPLOAD'
                : 'LOCAL ARCHIVE · READY TO PREPARE'}
          </Text>
          <Text style={styles.sessionMeta}>
            Archived {formatArchiveDate(record.archivedAt)}
          </Text>
        </View>
        <Text style={styles.sessionArrow}>›</Text>
      </TouchableOpacity>

      <View style={styles.sessionActions}>
        <TouchableOpacity
          style={styles.restoreButton}
          activeOpacity={0.82}
          onPress={() => onRestore(record.id)}
        >
          <Text style={styles.restoreButtonText}>RESTORE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          activeOpacity={0.82}
          onPress={() => onDelete(record)}
        >
          <Text style={styles.deleteButtonText}>DELETE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function SE14ArchiveDayGroup({
  group,
  open,
  uploadingKey,
  onToggle,
  onUpload,
  onEditSessionNumbers,
  onOpenRecord,
  onRestore,
  onDelete,
  recordTitle,
  formatArchiveDate,
}) {
  const styles = useMemo(() => createStyles(), []);
  const periods = group.rounds || [];
  const periodKeys = periods.map((period) => period.key).join('|');
  const [openPeriods, setOpenPeriods] = useState({});

  useEffect(() => {
    setOpenPeriods((current) => {
      const validKeys = new Set(periods.map((period) => period.key));
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => validKeys.has(key))
      );

      if (!Object.values(next).some(Boolean) && periods[0]) {
        next[periods[0].key] = true;
      }

      return next;
    });
  }, [periodKeys]);

  const togglePeriod = (key) => {
    setOpenPeriods((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <View style={styles.dayCard}>
      <View
        style={styles.dayHeader}
      >
        <TouchableOpacity
          style={styles.dayHeaderMain}
          activeOpacity={0.82}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <View style={styles.dayFolderIcon}>
            <Text style={styles.dayFolderIconText}>▰</Text>
          </View>
          <View style={styles.dayCopy}>
            <Text style={styles.dayTitle}>{group.folderName}</Text>
            <Text style={styles.dayMeta}>
              {group.records.length} session{group.records.length === 1 ? '' : 's'} ·{' '}
              {periods.length} field round{periods.length === 1 ? '' : 's'} ·{' '}
              {group.pendingCount
                ? `${group.pendingCount} waiting to upload`
                : 'Uploaded to SharePoint'}
            </Text>
          </View>
          <Text style={styles.dayChevron}>{open ? '⌃' : '⌄'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dayMenuButton}
          activeOpacity={0.82}
          onPress={onEditSessionNumbers}
          accessibilityRole="button"
          accessibilityLabel={`Edit session numbers for ${group.folderName}`}
        >
          <Text style={styles.dayMenuText}>•••</Text>
        </TouchableOpacity>
      </View>

      {open ? (
        <View style={styles.dayContent}>
          {periods.map((period) => {
            const periodOpen = Boolean(openPeriods[period.key]);
            const uploading = uploadingKey === period.key;

            return (
              <View key={period.key} style={styles.periodCard}>
                <TouchableOpacity
                  style={styles.periodHeader}
                  activeOpacity={0.82}
                  onPress={() => togglePeriod(period.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: periodOpen }}
                >
                  <View style={styles.periodBadge}>
                    <Text style={styles.periodBadgeText}>
                      R{period.sequence}
                    </Text>
                  </View>
                  <View style={styles.periodCopy}>
                    <Text style={styles.periodTitle}>
                      Round {period.sequence} · {period.label}
                    </Text>
                    <Text style={styles.periodMeta}>
                      {period.detail} · {period.records.length} session
                      {period.records.length === 1 ? '' : 's'} ·{' '}
                      {period.pendingCount
                        ? `${period.pendingCount} waiting`
                        : 'Uploaded'}
                    </Text>
                  </View>
                  <Text style={styles.periodChevron}>
                    {periodOpen ? '⌃' : '⌄'}
                  </Text>
                </TouchableOpacity>

                {periodOpen ? (
                  <View style={styles.periodContent}>
                    <TouchableOpacity
                      style={[
                        styles.uploadPeriodButton,
                        !period.pendingCount && styles.uploadPeriodButtonComplete,
                      ]}
                      activeOpacity={0.82}
                      disabled={Boolean(uploadingKey) || !period.pendingCount}
                      onPress={() => onUpload(period)}
                      accessibilityRole="button"
                    >
                      {uploading ? (
                        <ActivityIndicator size="small" color={NAVY} />
                      ) : (
                        <Text
                          style={[
                            styles.uploadPeriodButtonText,
                            !period.pendingCount &&
                              styles.uploadPeriodButtonTextComplete,
                          ]}
                        >
                          {period.pendingCount
                            ? `UPLOAD ROUND ${period.sequence} · ${period.pendingCount} PDF${period.pendingCount === 1 ? '' : 'S'}`
                            : `✓ ROUND ${period.sequence} UPLOADED`}
                        </Text>
                      )}
                    </TouchableOpacity>

                    {period.records.map((record) => (
                      <ArchiveSessionCard
                        key={record.id}
                        record={record}
                        onOpen={onOpenRecord}
                        onRestore={onRestore}
                        onDelete={onDelete}
                        recordTitle={recordTitle}
                        formatArchiveDate={formatArchiveDate}
                        styles={styles}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  dayCard: { borderRadius: 15, borderWidth: 1, borderColor: '#D5DEE4', backgroundColor: WHITE, overflow: 'hidden', marginBottom: 10 },
  dayHeader: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6, backgroundColor: '#F8FAFB' },
  dayHeaderMain: { flex: 1, minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  dayFolderIcon: { width: 38, height: 34, borderRadius: 10, backgroundColor: '#FFF0CA', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dayFolderIconText: { color: '#9A6A13', fontSize: 18, fontWeight: '900' },
  dayCopy: { flex: 1, minWidth: 0 },
  dayTitle: { color: NAVY, fontSize: 15, fontWeight: '900' },
  dayMeta: { color: MUTED_TEXT, fontSize: 9.5, lineHeight: 14, marginTop: 3 },
  dayChevron: { color: '#9A6A13', fontSize: 22, marginLeft: 8 },
  dayMenuButton: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginLeft: 3 },
  dayMenuText: { color: NAVY, fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  dayContent: { borderTopWidth: 1, borderTopColor: '#E1E7EB', backgroundColor: '#EEF2F4', padding: 9 },
  periodCard: { borderRadius: 14, borderWidth: 1, borderColor: '#D5DEE4', backgroundColor: WHITE, overflow: 'hidden', marginBottom: 9 },
  periodHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 9, backgroundColor: '#F8FAFB' },
  periodBadge: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0CA', marginRight: 10 },
  periodBadgeText: { color: '#8A5C08', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  periodCopy: { flex: 1, minWidth: 0 },
  periodTitle: { color: NAVY, fontSize: 13, fontWeight: '900' },
  periodMeta: { color: MUTED_TEXT, fontSize: 9, lineHeight: 13, marginTop: 3 },
  periodChevron: { color: '#9A6A13', fontSize: 20, marginLeft: 7 },
  periodContent: { borderTopWidth: 1, borderTopColor: '#E1E7EB', backgroundColor: '#F3F6F8', padding: 8 },
  uploadPeriodButton: { minHeight: 44, borderRadius: 11, backgroundColor: GOLD, borderWidth: 1, borderColor: '#C99737', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  uploadPeriodButtonComplete: { backgroundColor: '#EAF6EE', borderColor: '#BFDCC8' },
  uploadPeriodButtonText: { color: NAVY, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.5 },
  uploadPeriodButtonTextComplete: { color: GREEN },
  sessionCard: { borderRadius: 13, borderWidth: 1, borderColor: '#D5DEE4', backgroundColor: WHITE, overflow: 'hidden', marginBottom: 8 },
  sessionMain: { minHeight: 80, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11 },
  sessionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#EEF2F4', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sessionIconUploaded: { backgroundColor: '#DFF3E6' },
  sessionIconText: { color: '#526879', fontSize: 16, fontWeight: '900' },
  sessionIconTextUploaded: { color: GREEN },
  sessionCopy: { flex: 1 },
  sessionTitle: { color: NAVY, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  sessionMeta: { color: MUTED_TEXT, fontSize: 10, marginTop: 3 },
  sessionArrow: { color: GREEN, fontSize: 25, marginLeft: 6 },
  uploadState: { fontSize: 8, fontWeight: '900', letterSpacing: 0.45, marginTop: 4 },
  uploadStatePending: { color: '#9A6A13' },
  uploadStateComplete: { color: GREEN },
  sessionActions: { minHeight: 42, borderTopWidth: 1, borderTopColor: '#E4E9ED', flexDirection: 'row' },
  restoreButton: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF8F1' },
  restoreButtonText: { color: GREEN, fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  deleteButton: { flex: 1, borderLeftWidth: 1, borderLeftColor: '#E8D4D2', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5F4' },
  deleteButtonText: { color: '#B42318', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
});
