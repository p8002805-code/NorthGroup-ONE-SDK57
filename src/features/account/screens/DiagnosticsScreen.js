import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppHeader from '../../../components/AppHeader';
import { BUILD_INFO } from '../../../config/buildInfo';
import { readJobChatOutbox } from '../../chat/jobChatOutbox';
import { resolveJobFilesLocation } from '../../jobFiles/jobFilesService';
import { useTheme } from '../../../theme/ThemeContext';
import {
  loadDiagnosticsState,
  saveDiagnosticsState,
} from '../diagnosticsState';
import {
  loadSyncState,
  subscribeSyncState,
} from '../../../services/sync/syncState';

const SYNC_FEATURE_LABELS = {
  microsoftProfile: 'Microsoft profile',
  jobFiles: 'Job Files & SharePoint uploads',
  progress: 'Job Progress',
  kml: 'Shared KML',
  teamsShifts: 'Teams Shifts',
  jobChat: 'Job Chat',
  chatAttachments: 'Job Chat attachments',
  teamsChannels: 'NorthGroup Teams channels',
  microsoft: 'Microsoft services',
};

const formatDateTime = (value, fallback = 'Not recorded yet') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const clean = (value) => String(value || '').trim();

const connectionLabel = (status) => {
  if (status === 'checking') return 'Checking';
  if (status === 'ready') return 'Connected';
  if (status === 'warning') return 'Not checked';
  if (status === 'error') return 'Needs attention';
  return 'Waiting';
};

const syncHealth = (syncState) => {
  if (syncState?.activeCount) return { label: 'Syncing', tone: 'checking' };
  const success = new Date(syncState?.lastSuccessAt || 0).getTime();
  const failure = new Date(syncState?.lastFailureAt || 0).getTime();
  if (failure > success) return { label: 'Needs attention', tone: 'error' };
  if (success > 0) return { label: 'Ready', tone: 'ready' };
  return { label: 'Waiting', tone: 'warning' };
};

const featureStatusText = (feature) => {
  if (!feature) return 'Not used in this build session yet';
  const success = new Date(feature.lastSuccessAt || 0).getTime();
  const failure = new Date(feature.lastFailureAt || 0).getTime();
  if (failure > success) {
    return `Needs attention · ${feature.lastError || feature.lastErrorCode || 'last request failed'}`;
  }
  if (success > 0) return `Synced ${formatDateTime(feature.lastSuccessAt)}`;
  return 'Waiting for first sync';
};

function InfoRow({ label, value, mono = false, styles, last = false }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[styles.infoValue, mono && styles.infoValueMono]}
        selectable
        numberOfLines={3}
      >
        {value || 'Not available'}
      </Text>
    </View>
  );
}

function StatusRow({ icon, title, detail, status, styles, colors, last = false }) {
  const toneStyle = status === 'ready'
    ? styles.statusReady
    : status === 'error'
      ? styles.statusError
      : status === 'warning'
        ? styles.statusWarning
        : styles.statusChecking;
  const iconColor = status === 'ready'
    ? colors.success
    : status === 'error'
      ? colors.danger
      : status === 'warning'
        ? colors.warning
        : colors.info;

  return (
    <View style={[styles.statusRow, last && styles.infoRowLast]}>
      <View style={[styles.statusIcon, { backgroundColor: `${iconColor}20` }]}>
        {status === 'checking' ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Ionicons name={icon} size={20} color={iconColor} />
        )}
      </View>
      <View style={styles.statusCopy}>
        <View style={styles.statusHeading}>
          <Text style={styles.statusTitle}>{title}</Text>
          <View style={[styles.statusPill, toneStyle]}>
            <Text
              style={[
                styles.statusPillText,
                status === 'ready'
                  ? styles.statusReadyText
                  : status === 'error'
                    ? styles.statusErrorText
                    : status === 'warning'
                      ? styles.statusWarningText
                      : styles.statusCheckingText,
              ]}
            >
              {connectionLabel(status)}
            </Text>
          </View>
        </View>
        <Text style={styles.statusDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export default function DiagnosticsScreen({
  profile,
  microsoftAccount,
  activeJob,
  getAccessToken,
  goBack,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const checkedKeyRef = useRef('');
  const [history, setHistory] = useState({});
  const [pendingChatCount, setPendingChatCount] = useState(0);
  const [syncState, setSyncState] = useState({
    active: [],
    activeCount: 0,
    totals: { succeeded: 0, failed: 0, retried: 0 },
    features: {},
  });
  const [connection, setConnection] = useState({
    checking: false,
    microsoft: 'idle',
    sharePoint: activeJob?.number ? 'idle' : 'warning',
    microsoftDetail: 'Run a check to refresh the Microsoft session.',
    sharePointDetail: activeJob?.number
      ? 'Run a check to confirm the active job folder.'
      : 'Choose an active job before checking SharePoint.',
  });

  const accountName = clean(
    microsoftAccount?.displayName
      || `${profile?.firstName || ''} ${profile?.lastName || ''}`,
  ) || 'NorthGroup employee';
  const accountEmail = clean(microsoftAccount?.email || profile?.email);
  const activeJobLabel = activeJob?.number
    ? `${activeJob.number}${activeJob.name ? ` · ${activeJob.name}` : ''}`
    : 'No active job selected';
  const buildNumberLabel = BUILD_INFO.buildNumber === BUILD_INFO.sourceBuildNumber
    ? BUILD_INFO.buildNumber
    : `${BUILD_INFO.buildNumber} · source ${BUILD_INFO.sourceBuildNumber}`;

  const refreshLocalStatus = useCallback(async () => {
    const [savedHistory, outbox] = await Promise.all([
      loadDiagnosticsState(),
      microsoftAccount?.id && activeJob?.number
        ? readJobChatOutbox({ accountId: microsoftAccount.id, job: activeJob })
        : Promise.resolve([]),
    ]);
    setHistory(savedHistory);
    setPendingChatCount(outbox.filter((item) => item?.status !== 'sent').length);
  }, [activeJob, microsoftAccount?.id]);

  const runConnectionCheck = useCallback(async () => {
    if (!getAccessToken) return;
    const checkedAt = new Date().toISOString();
    setConnection((current) => ({
      ...current,
      checking: true,
      microsoft: 'checking',
      sharePoint: activeJob?.number ? 'checking' : 'warning',
      microsoftDetail: 'Refreshing the secure Microsoft session…',
      sharePointDetail: activeJob?.number
        ? 'Locating the active job folder…'
        : 'Choose an active job before checking SharePoint.',
    }));

    try {
      const accessToken = await getAccessToken();
      const microsoftAt = new Date().toISOString();
      setConnection((current) => ({
        ...current,
        microsoft: 'ready',
        microsoftDetail: `Signed in as ${accountEmail || accountName}.`,
      }));

      if (!activeJob?.number) {
        const nextHistory = await saveDiagnosticsState({
          lastCheckedAt: checkedAt,
          lastSuccessfulMicrosoftAt: microsoftAt,
        });
        setHistory(nextHistory);
        setConnection((current) => ({ ...current, checking: false }));
        return;
      }

      try {
        const location = await resolveJobFilesLocation({ accessToken, job: activeJob });
        const sharePointAt = new Date().toISOString();
        const nextHistory = await saveDiagnosticsState({
          lastCheckedAt: checkedAt,
          lastSuccessfulMicrosoftAt: microsoftAt,
          lastSuccessfulSharePointAt: sharePointAt,
          lastSharePointFolder: location.folder?.name || '',
        });
        setHistory(nextHistory);
        setConnection((current) => ({
          ...current,
          checking: false,
          sharePoint: 'ready',
          sharePointDetail: location.folder?.name
            ? `Job folder found: ${location.folder.name}`
            : 'The active job folder is available.',
        }));
      } catch (error) {
        const nextHistory = await saveDiagnosticsState({
          lastCheckedAt: checkedAt,
          lastSuccessfulMicrosoftAt: microsoftAt,
        });
        setHistory(nextHistory);
        setConnection((current) => ({
          ...current,
          checking: false,
          sharePoint: 'error',
          sharePointDetail: error?.message || 'The active job folder could not be checked.',
        }));
      }
    } catch (error) {
      const nextHistory = await saveDiagnosticsState({ lastCheckedAt: checkedAt });
      setHistory(nextHistory);
      setConnection({
        checking: false,
        microsoft: 'error',
        sharePoint: activeJob?.number ? 'error' : 'warning',
        microsoftDetail: error?.message || 'The Microsoft session could not be refreshed.',
        sharePointDetail: activeJob?.number
          ? 'SharePoint cannot be checked until Microsoft sign-in is ready.'
          : 'Choose an active job before checking SharePoint.',
      });
    }
  }, [accountEmail, accountName, activeJob, getAccessToken]);

  useEffect(() => {
    refreshLocalStatus();
  }, [refreshLocalStatus]);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = subscribeSyncState((next) => {
      if (mounted) setSyncState(next);
    });
    loadSyncState().then((next) => {
      if (mounted) setSyncState(next);
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [microsoftAccount?.id]);

  useEffect(() => {
    const checkKey = `${microsoftAccount?.id || 'account'}:${activeJob?.number || 'no-job'}`;
    if (checkedKeyRef.current === checkKey) return;
    checkedKeyRef.current = checkKey;
    runConnectionCheck();
  }, [activeJob?.number, microsoftAccount?.id, runConnectionCheck]);

  const shareDiagnostics = async () => {
    const health = syncHealth(syncState);
    const report = [
      'NorthGroup ONE diagnostics',
      `Release: ${BUILD_INFO.releaseId}`,
      `Version: ${BUILD_INFO.version}`,
      `Build: ${buildNumberLabel}`,
      `Revision: ${BUILD_INFO.revision}`,
      `Runtime: ${BUILD_INFO.runtime}`,
      `Channel: ${BUILD_INFO.channel}`,
      `Released: ${formatDateTime(BUILD_INFO.releasedAt)}`,
      `Account: ${accountName}${accountEmail ? ` <${accountEmail}>` : ''}`,
      `Active job: ${activeJobLabel}`,
      `Microsoft: ${connectionLabel(connection.microsoft)} — ${connection.microsoftDetail}`,
      `SharePoint: ${connectionLabel(connection.sharePoint)} — ${connection.sharePointDetail}`,
      `Pending Job Chat items: ${pendingChatCount}`,
      `Shared sync state: ${health.label}`,
      `Active sync operations: ${syncState.activeCount || 0}`,
      `Last successful shared sync: ${formatDateTime(syncState.lastSuccessAt)}`,
      `Last shared sync failure: ${formatDateTime(syncState.lastFailureAt)}`,
      `Shared sync retries: ${syncState.totals?.retried || 0}`,
      `Last shared sync issue: ${syncState.lastError || 'None recorded'}`,
      `Last successful SharePoint check: ${formatDateTime(history.lastSuccessfulSharePointAt)}`,
      `Report created: ${formatDateTime(new Date().toISOString())}`,
    ].join('\n');

    try {
      await Share.share({
        title: 'NorthGroup ONE diagnostics',
        message: report,
      });
    } catch (error) {
      Alert.alert(
        'Unable to share diagnostics',
        error?.message || 'Please try again.',
      );
    }
  };

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="ACCOUNT"
        title="App Diagnostics"
        onBack={goBack}
        backOnly
        backCompact
        compact
        centred
        showTopo
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark" size={28} color={colors.navy} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>CURRENT RELEASE</Text>
              <Text style={styles.heroTitle}>{BUILD_INFO.releaseId}</Text>
              <Text style={styles.heroSubtitle}>{BUILD_INFO.summary}</Text>
            </View>
          </View>
          <View style={styles.heroPills}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{BUILD_INFO.runtime}</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>v{BUILD_INFO.version} ({BUILD_INFO.buildNumber})</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionEyebrow}>BUILD IDENTITY</Text>
        <View style={styles.card}>
          <InfoRow label="Release ID" value={BUILD_INFO.releaseId} mono styles={styles} />
          <InfoRow label="App version" value={BUILD_INFO.version} styles={styles} />
          <InfoRow label="Installed build" value={buildNumberLabel} styles={styles} />
          <InfoRow label="Revision" value={BUILD_INFO.revision} mono styles={styles} />
          <InfoRow label="Release channel" value={BUILD_INFO.channel} styles={styles} />
          <InfoRow label="Release date" value={formatDateTime(BUILD_INFO.releasedAt)} styles={styles} />
          <InfoRow label="Runtime" value={BUILD_INFO.runtime} styles={styles} last />
        </View>

        <Text style={styles.sectionEyebrow}>FIELD CONTEXT</Text>
        <View style={styles.card}>
          <InfoRow label="Signed-in user" value={accountName} styles={styles} />
          <InfoRow label="Microsoft email" value={accountEmail || 'Unavailable'} styles={styles} />
          <InfoRow label="Active job" value={activeJobLabel} styles={styles} last />
        </View>

        <Text style={styles.sectionEyebrow}>CONNECTIONS</Text>
        <View style={styles.card}>
          <StatusRow
            icon="person-circle-outline"
            title="Microsoft session"
            detail={connection.microsoftDetail}
            status={connection.microsoft}
            styles={styles}
            colors={colors}
          />
          <StatusRow
            icon="cloud-outline"
            title="SharePoint job files"
            detail={connection.sharePointDetail}
            status={connection.sharePoint}
            styles={styles}
            colors={colors}
            last
          />
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
            connection.checking && styles.buttonDisabled,
          ]}
          onPress={runConnectionCheck}
          disabled={connection.checking}
          accessibilityRole="button"
          accessibilityLabel="Run Microsoft and SharePoint connection check"
        >
          {connection.checking ? (
            <ActivityIndicator size="small" color={colors.navy} />
          ) : (
            <Ionicons name="refresh" size={18} color={colors.navy} />
          )}
          <Text style={styles.primaryButtonText}>
            {connection.checking ? 'Checking connections…' : 'Run connection check'}
          </Text>
        </Pressable>

        <Text style={styles.sectionEyebrow}>SYNC VISIBILITY</Text>
        <View style={styles.card}>
          <StatusRow
            icon="sync-outline"
            title="Shared synchronisation system"
            detail={syncState.activeCount
              ? `${syncState.activeCount} Microsoft operation${syncState.activeCount === 1 ? '' : 's'} active.`
              : syncState.lastError && syncHealth(syncState).tone === 'error'
                ? syncState.lastError
                : 'Microsoft requests now share one timeout, retry and status system.'}
            status={syncHealth(syncState).tone}
            styles={styles}
            colors={colors}
          />
          <InfoRow
            label="Pending Job Chat items"
            value={String(pendingChatCount)}
            styles={styles}
          />
          <InfoRow
            label="Last successful shared sync"
            value={formatDateTime(syncState.lastSuccessAt)}
            styles={styles}
          />
          <InfoRow
            label="Last shared sync failure"
            value={formatDateTime(syncState.lastFailureAt)}
            styles={styles}
          />
          <InfoRow
            label="Automatic retries completed"
            value={String(syncState.totals?.retried || 0)}
            styles={styles}
          />
          <InfoRow
            label="Tracked operations"
            value={`${syncState.totals?.succeeded || 0} succeeded · ${syncState.totals?.failed || 0} failed`}
            styles={styles}
            last
          />
        </View>

        <Text style={styles.sectionEyebrow}>FEATURE SYNC HISTORY</Text>
        <View style={styles.card}>
          {Object.entries(SYNC_FEATURE_LABELS).map(([key, label], index, entries) => (
            <InfoRow
              key={key}
              label={label}
              value={featureStatusText(syncState.features?.[key])}
              styles={styles}
              last={index === entries.length - 1}
            />
          ))}
        </View>
        <View style={styles.noticeCard}>
          <Ionicons name="information-circle-outline" size={21} color={colors.statusInfoText} />
          <Text style={styles.noticeText}>
            Job Chat keeps its existing offline outbox. A shared offline queue for files, forms, photos, Progress and KML is deliberately reserved for the next reliability phase.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}
          onPress={shareDiagnostics}
          accessibilityRole="button"
          accessibilityLabel="Share app diagnostics report"
        >
          <Ionicons name="share-outline" size={18} color={colors.accentDark} />
          <Text style={styles.secondaryButtonText}>Share diagnostics report</Text>
        </Pressable>

        <Text style={styles.footerText}>
          Use Copy in the share sheet, or send the report with screenshots or recordings so the exact running build can be identified immediately.
        </Text>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  content: { padding: 16, paddingBottom: 38, gap: 13 },
  heroCard: {
    backgroundColor: colors.headerSurface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.accent,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginRight: 14,
  },
  heroCopy: { flex: 1 },
  heroEyebrow: { color: colors.accent, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { color: colors.white, fontSize: 21, lineHeight: 26, fontWeight: '900', marginTop: 4 },
  heroSubtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 11, lineHeight: 16, marginTop: 4 },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  heroPill: { backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  heroPillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  sectionEyebrow: { color: colors.textMuted, fontSize: 10, fontWeight: '900', letterSpacing: 1.35, marginTop: 3, marginLeft: 3 },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 17,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  infoRow: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoRowLast: { borderBottomWidth: 0 },
  infoLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 0.85, textTransform: 'uppercase' },
  infoValue: { color: colors.bodyText, fontSize: 14, lineHeight: 19, fontWeight: '800', marginTop: 4 },
  infoValueMono: { fontFamily: 'Courier', fontSize: 13, letterSpacing: 0.15 },
  statusRow: { flexDirection: 'row', paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  statusIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  statusCopy: { flex: 1 },
  statusHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  statusTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', flex: 1 },
  statusDetail: { color: colors.supportingText, fontSize: 11, lineHeight: 16, marginTop: 5 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, overflow: 'hidden' },
  statusPillText: { fontSize: 9, fontWeight: '900' },
  statusReady: { backgroundColor: colors.successBackground },
  statusError: { backgroundColor: colors.dangerBackground },
  statusWarning: { backgroundColor: colors.warningBackground },
  statusChecking: { backgroundColor: colors.infoBackground },
  statusReadyText: { color: colors.statusSuccessText },
  statusErrorText: { color: colors.statusDangerText },
  statusWarningText: { color: colors.statusWarningText },
  statusCheckingText: { color: colors.statusInfoText },
  primaryButton: {
    minHeight: 49,
    borderRadius: 14,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  primaryButtonPressed: { opacity: 0.84, transform: [{ scale: 0.995 }] },
  primaryButtonText: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  buttonDisabled: { opacity: 0.68 },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    padding: 13,
    backgroundColor: colors.infoBackground,
    borderWidth: 1,
    borderColor: `${colors.info}42`,
  },
  noticeText: { color: colors.statusInfoText, fontSize: 11, lineHeight: 17, flex: 1 },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.cardBackground,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  secondaryButtonPressed: { opacity: 0.72 },
  secondaryButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: '900' },
  footerText: { color: colors.supportingText, fontSize: 10, lineHeight: 15, textAlign: 'center', paddingHorizontal: 18, marginTop: 1 },
});
