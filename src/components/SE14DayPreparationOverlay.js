import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GOLD, NAVY, WHITE } from '../styles/styles';

const clampProgress = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export default function SE14DayPreparationOverlay({ preparation }) {
  const styles = useMemo(() => createStyles(), []);
  const visible = Boolean(preparation?.visible);
  const progress = clampProgress(preparation?.progress);
  const percent = Math.round(progress * 100);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => undefined}
    >
      <View
        style={styles.shade}
        accessibilityViewIsModal
        accessibilityLiveRegion="polite"
      >
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.spinnerShell}>
              <ActivityIndicator size="small" color={NAVY} />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>PREPARING SHAREPOINT UPLOAD</Text>
              <Text style={styles.title}>Building session PDFs</Text>
            </View>
          </View>

          <View style={styles.dayChip}>
            <Text style={styles.dayChipText}>
              {preparation?.folderName || 'GNSS saved batch'}
            </Text>
          </View>

          <Text style={styles.status}>
            {preparation?.status || 'Checking saved sessions…'}
          </Text>
          <Text style={styles.detail} numberOfLines={2}>
            {preparation?.detail || 'Please keep NorthGroup ONE open while the PDFs are prepared.'}
          </Text>

          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>PREPARATION</Text>
            <Text style={styles.progressValue}>{percent}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, percent)}%` }]} />
          </View>

          <View style={styles.nextStep}>
            <View style={styles.nextNumber}>
              <Text style={styles.nextNumberText}>2</Text>
            </View>
            <View style={styles.nextCopy}>
              <Text style={styles.nextTitle}>Next: choose where to save</Text>
              <Text style={styles.nextBody}>
                When preparation finishes, SharePoint Job Files will open so you can select the destination folder.
              </Text>
            </View>
          </View>

          <Text style={styles.safetyNote}>
            Nothing is uploading yet. Your saved sessions remain safely queued on this phone.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = () => StyleSheet.create({
  shade: {
    flex: 1,
    backgroundColor: 'rgba(2,18,31,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.62)',
    backgroundColor: WHITE,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinnerShell: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerCopy: { flex: 1 },
  eyebrow: {
    color: '#9A6A13',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  title: {
    color: NAVY,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '900',
    marginTop: 2,
  },
  dayChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E4C77F',
    backgroundColor: '#FFF5D9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 16,
  },
  dayChipText: {
    color: '#7A5412',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  status: {
    color: NAVY,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '900',
    marginTop: 15,
  },
  detail: {
    color: '#526273',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    minHeight: 34,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  progressLabel: {
    color: '#64748B',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  progressValue: {
    color: NAVY,
    fontSize: 11,
    fontWeight: '900',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E3E9ED',
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: GOLD,
  },
  nextStep: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D6E1E8',
    backgroundColor: '#F4F8FA',
    flexDirection: 'row',
    padding: 12,
    marginTop: 18,
  },
  nextNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  nextNumberText: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
  },
  nextCopy: { flex: 1 },
  nextTitle: {
    color: NAVY,
    fontSize: 11,
    fontWeight: '900',
  },
  nextBody: {
    color: '#526273',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 3,
  },
  safetyNote: {
    color: '#64748B',
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 13,
  },
});
