import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppButton from '../../../components/AppButton';
import AppCard from '../../../components/AppCard';
import AppHeader from '../../../components/AppHeader';
import AppSectionHeader from '../../../components/AppSectionHeader';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  getFeatureScannerCapabilities,
  getScannerAvailabilityMessage,
  launchFeatureScanner,
  previewFeatureModel,
} from '../services/featureScannerService';
import {
  loadFeatureScans,
  saveFeatureScan,
} from '../services/featureScanStorage';

const bytesLabel = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'USDZ';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB · USDZ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB · USDZ`;
};

const availabilityLabel = (capabilities) => {
  if (capabilities?.available) return 'SCANNER READY';
  if (capabilities?.reason === 'development-build-required') return 'DEV BUILD REQUIRED';
  return 'DEVICE CHECK';
};

export default function FeatureScannerScreen({
  activeJob,
  accountProfile,
  goBack,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const capabilities = useMemo(() => getFeatureScannerCapabilities(), []);
  const [featureId, setFeatureId] = useState('');
  const [notes, setNotes] = useState('');
  const [scans, setScans] = useState([]);
  const [starting, setStarting] = useState(false);

  const refreshScans = useCallback(async () => {
    try {
      setScans(await loadFeatureScans(activeJob));
    } catch {
      setScans([]);
    }
  }, [activeJob]);

  useEffect(() => {
    refreshScans();
  }, [refreshScans]);

  const startScan = useCallback(async () => {
    const cleanFeatureId = featureId.trim().toUpperCase();
    if (!activeJob?.number) {
      Alert.alert('Choose a job', 'Select an active job before starting a 3D scan.');
      return;
    }
    if (!cleanFeatureId) {
      Alert.alert('Feature ID required', 'Enter a short feature or scan ID.');
      return;
    }
    if (!capabilities?.available) {
      Alert.alert(
        '3D scanner unavailable',
        getScannerAvailabilityMessage(capabilities),
      );
      return;
    }

    setStarting(true);
    try {
      const result = await launchFeatureScanner({
        jobNumber: activeJob.number,
        featureId: cleanFeatureId,
        notes,
      });
      if (!result || result.cancelled) return;

      await saveFeatureScan(activeJob, {
        id: `${activeJob.number}-${cleanFeatureId}-${Date.now()}`,
        jobNumber: activeJob.number,
        featureId: cleanFeatureId,
        notes,
        operator: accountProfile?.name || accountProfile?.displayName || '',
        modelUri: result.modelUri,
        scanDirectoryUri: result.scanDirectoryUri,
        createdAt: new Date().toISOString(),
      });
      setFeatureId('');
      setNotes('');
      await refreshScans();
      Alert.alert(
        '3D scan saved',
        `${cleanFeatureId} has been saved against Job ${activeJob.number}.`,
      );
    } catch (error) {
      Alert.alert(
        '3D scan could not be completed',
        error?.message || 'NorthGroup One could not complete this scan.',
      );
    } finally {
      setStarting(false);
    }
  }, [
    accountProfile,
    activeJob,
    capabilities,
    featureId,
    notes,
    refreshScans,
  ]);

  const previewScan = useCallback(async (scan) => {
    try {
      await previewFeatureModel(scan.modelUri);
    } catch (error) {
      Alert.alert('Preview unavailable', error?.message || 'The model could not be opened.');
    }
  }, []);

  const shareScan = useCallback(async (scan) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', 'This iPhone cannot share the saved model.');
        return;
      }
      await Sharing.shareAsync(scan.modelUri, {
        dialogTitle: `Share ${scan.featureId} 3D scan`,
        mimeType: 'model/vnd.usdz+zip',
        UTI: 'com.pixar.universal-scene-description-mobile',
      });
    } catch (error) {
      Alert.alert('Share failed', error?.message || 'The model could not be shared.');
    }
  }, []);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="FIELD CAPTURE"
        title="3D Feature Scanner"
        subtitle="Create a textured USDZ model against the active job."
        onBack={goBack}
        backLabel="Field Tools"
        showTopo
        compact
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + SPACING.xxxl },
        ]}
      >
        <AppCard style={styles.jobCard} padding="compact">
          <View style={styles.jobIcon}>
            <Text style={styles.jobIconText}>3D</Text>
          </View>
          <View style={styles.jobCopy}>
            <Text style={styles.eyebrow}>ACTIVE JOB</Text>
            <Text style={styles.jobNumber}>
              {activeJob?.number || 'No active job'}
            </Text>
            <Text style={styles.jobLocation} numberOfLines={2}>
              {activeJob?.location || 'Choose a job before scanning.'}
            </Text>
          </View>
          <View
            style={[
              styles.statusPill,
              capabilities?.available
                ? styles.statusPillReady
                : styles.statusPillPending,
            ]}
          >
            <Text
              style={[
                styles.statusText,
                capabilities?.available
                  ? styles.statusTextReady
                  : styles.statusTextPending,
              ]}
            >
              {availabilityLabel(capabilities)}
            </Text>
          </View>
        </AppCard>

        {!capabilities?.available ? (
          <AppCard style={styles.availabilityCard} padding="compact">
            <Text style={styles.availabilityTitle}>Native iPhone feature</Text>
            <Text style={styles.availabilityText}>
              {getScannerAvailabilityMessage(capabilities)}
            </Text>
          </AppCard>
        ) : null}

        <AppSectionHeader
          title="New scan"
          subtitle="Use a short ID that office staff will recognise."
        />

        <AppCard style={styles.formCard}>
          <Text style={styles.label}>FEATURE / SCAN ID</Text>
          <TextInput
            value={featureId}
            onChangeText={(value) => setFeatureId(value.toUpperCase())}
            placeholder="E.g. PIT-04 or CULVERT-A"
            placeholderTextColor={colors.placeholderText}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={32}
            style={styles.input}
          />

          <Text style={[styles.label, styles.notesLabel]}>NOTES (OPTIONAL)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Condition, purpose or area being captured"
            placeholderTextColor={colors.placeholderText}
            multiline
            maxLength={240}
            style={[styles.input, styles.notesInput]}
          />

          <View style={styles.guidance}>
            <Text style={styles.guidanceTitle}>For the cleanest model</Text>
            <Text style={styles.guidanceText}>
              Move slowly in overlapping rows, use even light, and keep people
              and vehicles out of the capture. Best quality is achieved on
              features up to roughly 1.8 m.
            </Text>
          </View>

          <AppButton
            title={capabilities?.available ? 'START 3D SCAN' : 'SCANNER NEEDS BUILD'}
            icon="◈"
            onPress={startScan}
            loading={starting}
            disabled={!activeJob?.number}
          />
        </AppCard>

        <AppSectionHeader
          title="Saved scans"
          subtitle={
            scans.length
              ? `${scans.length} model${scans.length === 1 ? '' : 's'} for this job.`
              : 'Completed models will appear here.'
          }
        />

        {scans.length ? scans.map((scan) => (
          <AppCard key={scan.id} style={styles.scanCard} padding="compact">
            <View style={styles.scanTopRow}>
              <View style={styles.scanBadge}>
                <Text style={styles.scanBadgeText}>3D</Text>
              </View>
              <View style={styles.scanCopy}>
                <Text style={styles.scanTitle}>{scan.featureId}</Text>
                <Text style={styles.scanMeta}>
                  {new Date(scan.createdAt).toLocaleString('en-AU')} · {bytesLabel(scan.size)}
                </Text>
                {scan.notes ? (
                  <Text style={styles.scanNotes} numberOfLines={2}>
                    {scan.notes}
                  </Text>
                ) : null}
              </View>
            </View>
            <View style={styles.scanActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => previewScan(scan)}
                style={({ pressed }) => [
                  styles.scanAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.scanActionText}>VIEW 3D</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => shareScan(scan)}
                style={({ pressed }) => [
                  styles.scanAction,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.scanActionText}>SHARE</Text>
              </Pressable>
            </View>
          </AppCard>
        )) : (
          <AppCard style={styles.emptyCard} padding="compact">
            <Text style={styles.emptyIcon}>◇</Text>
            <Text style={styles.emptyTitle}>No 3D scans saved yet</Text>
            <Text style={styles.emptyText}>
              Your first completed model will be stored against Job {activeJob?.number || '—'}.
            </Text>
          </AppCard>
        )}

        <Text style={styles.disclaimer}>
          3D models and measurements are for field documentation and context.
          They are not certified or survey-grade observations.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  jobCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    borderColor: colors.divider,
  },
  jobIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  jobIconText: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  jobCopy: {
    flex: 1,
    marginHorizontal: SPACING.md,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  jobNumber: {
    color: colors.bodyText,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  jobLocation: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  statusPill: {
    maxWidth: 92,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  statusPillReady: {
    backgroundColor: colors.successBackground,
  },
  statusPillPending: {
    backgroundColor: colors.warningBackground,
  },
  statusText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  statusTextReady: {
    color: colors.statusSuccessText,
  },
  statusTextPending: {
    color: colors.statusWarningText,
  },
  availabilityCard: {
    marginBottom: SPACING.lg,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  availabilityTitle: {
    color: colors.bodyText,
    fontSize: 13,
    fontWeight: '900',
  },
  availabilityText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  formCard: {
    marginBottom: SPACING.xl,
  },
  label: {
    color: colors.supportingText,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 7,
  },
  notesLabel: {
    marginTop: SPACING.lg,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 15,
    fontWeight: '700',
  },
  notesInput: {
    minHeight: 88,
    textAlignVertical: 'top',
    fontWeight: '500',
  },
  guidance: {
    marginVertical: SPACING.lg,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: colors.infoBackground,
  },
  guidanceTitle: {
    color: colors.statusInfoText,
    fontSize: 12,
    fontWeight: '900',
  },
  guidanceText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  scanCard: {
    marginBottom: SPACING.md,
  },
  scanTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  scanBadge: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.navy,
  },
  scanBadgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '900',
  },
  scanCopy: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  scanTitle: {
    color: colors.bodyText,
    fontSize: 15,
    fontWeight: '900',
  },
  scanMeta: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  scanNotes: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },
  scanActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  scanAction: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: RADIUS.md,
    backgroundColor: colors.warningBackground,
  },
  scanActionText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  pressed: {
    opacity: 0.76,
  },
  emptyCard: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyIcon: {
    color: colors.accent,
    fontSize: 29,
    fontWeight: '900',
  },
  emptyTitle: {
    color: colors.bodyText,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
  },
  emptyText: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
  },
  disclaimer: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});
