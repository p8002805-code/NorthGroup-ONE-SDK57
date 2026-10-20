import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import NorthGroupBrandButton from '../../../components/NorthGroupBrandButton';
import AssignedTeamModal from '../../../components/AssignedTeamModal';
import AppActionCard from '../../../components/AppActionCard';
import AppStatusPill from '../../../components/AppStatusPill';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  dashboardHeroHeightForWindow,
  JOB_SHELL_HORIZONTAL_PADDING,
  JOB_SHELL_TOP_OFFSET,
  workspaceHeroHeightForWindow,
} from '../../../theme/jobShellLayout';
import {
  workspaceContentTransitionStyles,
  workspaceHeroTransitionStyles,
} from '../jobWorkspaceTransition';
import { reportDevelopmentError } from '../../../services/security/securityLogger';
import { loadSharedJobBrief } from '../../jobFiles/jobFilesService';
import {
  loadSharedJobAccommodation,
  saveSharedJobAccommodation,
} from '../jobAccommodationService';
import {
  loadSharedJobWorkspaceMeta,
  saveSharedJobWorkspaceMeta,
} from '../jobWorkspaceMetaService';
import {
  progressSectionsForJob,
  scopeProgressSectionsToJob,
} from '../jobProgressRules';
import { jobTaskNamesFromText } from '../jobTaskRules';
import JobDetailsPage, { JobDetailsLaunchCard } from '../components/JobDetailsPage';
import JobProgressSection from '../components/JobProgressSection';
import ProgressCompletionCelebration from '../components/ProgressCompletionCelebration';
import JobWorkspaceDock, { useJobDirections } from '../components/JobWorkspaceDock';
import WorkspaceInfoPanel from '../components/WorkspaceInfoPanel';
import { useAssignedTeam } from '../hooks/useAssignedTeam';
import { useProgressCelebrationFocus } from '../hooks/useProgressCelebrationFocus';
import { useJobDetailsHubDisclosure } from '../hooks/useJobDetailsHubDisclosure';

const parseDate = (value) => {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateInput = (value) => {
  const date = parseDate(value);
  if (!date) return '';
  const pad = (part) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const parseDateInput = (value) => {
  const cleanValue = String(value || '').trim();
  if (!cleanValue) return '';
  const date = new Date(cleanValue.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) {
    throw new Error('Use YYYY-MM-DD HH:MM, for example 2026-08-04 07:00.');
  }
  return date.toISOString();
};

const getSourceLabel = (job) => {
  if (Array.isArray(job?.microsoftTeamNames)) {
    return job.microsoftTeamNames.filter(Boolean).join(', ');
  }

  return String(job?.microsoftTeamNames || '').trim();
};

function WorkspaceTeamControl({
  hasJob,
  hasTeamsJob,
  assignedTeam,
  compact = false,
  onPress,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!hasTeamsJob) {
    return (
      <View style={compact ? styles.stickySideRight : styles.heroSideRight}>
        <AppStatusPill
          label={hasJob ? 'ACTIVE JOB' : 'NO JOB'}
          tone={hasJob ? 'success' : 'warning'}
          dot
          style={compact ? styles.stickyStatus : styles.heroStatus}
        />
      </View>
    );
  }

  const assignedCount = Number.isFinite(Number(assignedTeam?.count))
    ? Math.max(0, Number(assignedTeam.count))
    : 0;
  const assignedLabel = assignedTeam?.loading && !assignedTeam?.loaded
    ? 'LOADING TEAM'
    : `${assignedCount} ASSIGNED`;
  const statusLabel = assignedTeam?.error && !assignedTeam?.members?.length
    ? 'TEAM ISSUE'
    : 'ACTIVE JOB';

  return (
    <Pressable
      style={({ pressed }) => [
        styles.teamControl,
        compact && styles.teamControlCompact,
        pressed && styles.teamControlPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${assignedLabel}. Show assigned team`}
    >
      <View style={styles.teamStatusRow}>
        <View
          style={[
            styles.teamStatusDot,
            statusLabel === 'TEAM ISSUE' && styles.teamStatusDotWarning,
          ]}
        />
        <Text
          style={[
            styles.teamStatusText,
            statusLabel === 'TEAM ISSUE' && styles.teamStatusTextWarning,
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      <View style={styles.teamAssignedRow}>
        {assignedTeam?.loading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : (
          <Ionicons name="people-outline" size={11} color={colors.accent} />
        )}
        <Text style={styles.teamAssignedText} numberOfLines={1}>
          {assignedLabel}
        </Text>
        <Ionicons name="chevron-forward" size={10} color={colors.accent} />
      </View>
    </Pressable>
  );
}

function WorkspaceHero({
  job,
  hasJob,
  hasTeamsJob,
  assignedTeam,
  goBack,
  sourceLabel,
  insets,
  height,
  expandedHeight,
  transitionProgress,
  onOpenAssignedTeam,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    heroHeightStyle,
    heroRevealStyle,
    controlRevealStyle,
  } = workspaceHeroTransitionStyles({
    progress: transitionProgress,
    expandedHeight,
    height,
  });

  return (
    <Animated.View style={[styles.hero, heroHeightStyle]}>
      <ImageBackground
        source={require('../../../../assets/topo-bg.png')}
        resizeMode="cover"
        style={styles.heroBackground}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroShade} />
        <View style={styles.heroOverlay}>
          <View style={[styles.heroTopRow, { paddingTop: insets.top + JOB_SHELL_TOP_OFFSET }]}>
            <NorthGroupBrandButton
              onPress={goBack}
              style={styles.heroBack}
              accessibilityLabel="NorthGroup One, return to dashboard"
              accessibilityHint="Returns to the dashboard"
            />
            <Animated.View style={controlRevealStyle}>
              <WorkspaceTeamControl
                hasJob={hasJob}
                hasTeamsJob={hasTeamsJob}
                assignedTeam={assignedTeam}
                onPress={onOpenAssignedTeam}
              />
            </Animated.View>
          </View>

          <Animated.View style={[styles.heroBody, heroRevealStyle]}>
            <Text style={styles.heroEyebrow}>JOB WORKSPACE</Text>
            <Text style={styles.heroNumber} numberOfLines={1} allowFontScaling={false}>
              {hasJob ? job.number : 'No job selected'}
            </Text>
            <Text style={styles.heroName} numberOfLines={1}>
              {job?.name || 'Choose a job to open its field workspace.'}
            </Text>
          </Animated.View>

          <Animated.View style={[styles.heroMetaRow, heroRevealStyle]}>
            <View style={styles.heroMetaItem}>
              <Ionicons name="briefcase-outline" size={14} color={colors.white} />
              <Text style={styles.heroMetaText} numberOfLines={1}>
                {job?.workType || 'FIELD WORKSPACE'}
              </Text>
            </View>
            {sourceLabel ? (
              <View style={[styles.heroMetaItem, styles.heroMetaItemLast]}>
                <Ionicons name="cloud-done-outline" size={14} color={colors.white} />
                <Text style={styles.heroMetaText} numberOfLines={1}>
                  TEAMS CONNECTED
                </Text>
              </View>
            ) : null}
          </Animated.View>
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

function WorkspaceStickyHeader({
  job,
  hasJob,
  hasTeamsJob,
  assignedTeam,
  goBack,
  insets,
  visible,
  opacity,
  translateY,
  onReturnToTop,
  onOpenAssignedTeam,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Animated.View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={[
        styles.stickyHeader,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <ImageBackground
        source={require('../../../../assets/topo-bg.png')}
        style={[styles.stickyBackground, { paddingTop: insets.top }]}
        imageStyle={styles.stickyBackgroundImage}
      >
        <View style={styles.stickyShade} />
        <View style={styles.stickyRow}>
          <Pressable
            style={({ pressed }) => [
              styles.stickyBrandRow,
              pressed && styles.stickyControlPressed,
            ]}
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="NorthGroup One, return to dashboard"
            accessibilityHint="Returns to the dashboard"
            hitSlop={6}
          >
            <Image
              source={require('../../../../assets/logo-transparent.png')}
              style={styles.stickyLogo}
              resizeMode="contain"
            />
            <View>
              <Text style={styles.stickyBrand}>NORTHGROUP</Text>
              <Text style={styles.stickyOne}>ONE</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.stickyJob,
              pressed && styles.stickyControlPressed,
            ]}
            onPress={onReturnToTop}
            accessibilityRole="button"
            accessibilityLabel={`Active job ${job?.number || 'not selected'}, return to top`}
            accessibilityHint="Expands the full job workspace banner"
          >
            <Text style={styles.stickyJobLabel}>JOB WORKSPACE</Text>
            <Text
              style={styles.stickyJobNumber}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {hasJob ? job.number : 'No job selected'}
            </Text>
            <Text style={styles.stickyJobName} numberOfLines={1}>
              {job?.name || 'Choose an active job'}
            </Text>
          </Pressable>

          <WorkspaceTeamControl
            hasJob={hasJob}
            hasTeamsJob={hasTeamsJob}
            assignedTeam={assignedTeam}
            compact
            onPress={onOpenAssignedTeam}
          />
        </View>
      </ImageBackground>
    </Animated.View>
  );
}

function WorkspaceActions({ disabled, onOpenKml }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.workspaceActions}>
      <View style={styles.overviewLabelRow}>
        <Text style={styles.overviewLabel}>ACTIVE SURVEY MAP</Text>
        <Text style={styles.overviewHint}>Live job data</Text>
      </View>
      <AppActionCard
        icon="⌖"
        title="KML"
        status="LIVE"
        statusTone="success"
        onPress={onOpenKml}
        disabled={disabled}
        style={styles.kmlActionCard}
      />
    </View>
  );
}

function JobMetaEditor({
  visible,
  type,
  draft,
  saving,
  error,
  insets,
  onChange,
  onClose,
  onSave,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const editingSchedule = type === 'schedule';
  const editingAccommodation = type === 'accommodation';
  const editorTitle = editingSchedule
    ? 'Edit shift'
    : editingAccommodation
      ? 'Edit accommodation'
      : 'Edit site location';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.editorKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.editorShade}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
          <View style={[styles.editorSheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={styles.editorHandle} />
            <View style={styles.editorHeader}>
              <View style={styles.editorTitleCopy}>
                <Text style={styles.cardEyebrow}>JOB WORKSPACE</Text>
                <Text style={styles.editorTitle}>{editorTitle}</Text>
              </View>
              <Pressable
                style={styles.editorClose}
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Cancel editing job details"
              >
                <Ionicons name="close" size={22} color={colors.bodyText} />
              </Pressable>
            </View>

            <Text style={styles.editorIntro}>
              {editingSchedule
                ? 'Use local time in the format YYYY-MM-DD HH:MM.'
                : editingAccommodation
                  ? 'Saved accommodation is shared through this job’s workspace so every job member can view and update it.'
                  : 'This location is used throughout the active job. Tap the site card afterwards for directions.'}
            </Text>

            {editingSchedule ? (
              <>
                <Text style={styles.editorLabel}>START</Text>
                <TextInput
                  value={draft.start || ''}
                  onChangeText={(start) => onChange((current) => ({ ...current, start }))}
                  editable={!saving}
                  style={styles.editorInput}
                  placeholder="2026-08-04 07:00"
                  placeholderTextColor={colors.placeholderText}
                  autoCorrect={false}
                />
                <Text style={styles.editorLabel}>END</Text>
                <TextInput
                  value={draft.end || ''}
                  onChangeText={(end) => onChange((current) => ({ ...current, end }))}
                  editable={!saving}
                  style={styles.editorInput}
                  placeholder="2026-08-04 15:30"
                  placeholderTextColor={colors.placeholderText}
                  autoCorrect={false}
                />
              </>
            ) : editingAccommodation ? (
              <>
                <Text style={styles.editorLabel}>ACCOMMODATION DETAILS</Text>
                <TextInput
                  value={draft.accommodation || ''}
                  onChangeText={(accommodation) => (
                    onChange((current) => ({ ...current, accommodation }))
                  )}
                  editable={!saving}
                  style={[styles.editorInput, styles.editorTextArea]}
                  placeholder="Hotel, address, booking reference or access notes"
                  placeholderTextColor={colors.placeholderText}
                  multiline
                  textAlignVertical="top"
                />
              </>
            ) : (
              <>
                <Text style={styles.editorLabel}>SITE LOCATION</Text>
                <TextInput
                  value={draft.location || ''}
                  onChangeText={(location) => onChange((current) => ({ ...current, location }))}
                  editable={!saving}
                  style={styles.editorInput}
                  placeholder="Rockhampton, QLD"
                  placeholderTextColor={colors.placeholderText}
                  autoCorrect={false}
                />
              </>
            )}

            {error ? <Text style={styles.editorError}>{error}</Text> : null}

            <View style={styles.editorActions}>
              <Pressable style={styles.editorCancel} onPress={onClose} disabled={saving}>
                <Text style={styles.editorCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.editorSave, saving && styles.editorSaveDisabled]}
                onPress={onSave}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color={colors.navy} /> : null}
                <Text style={styles.editorSaveText}>{saving ? 'Saving…' : 'Save changes'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function JobWorkspaceScreen({
  job,
  active = true,
  goBack,
  transitionProgress = null,
  openForms,
  openJobFiles,
  openCapture,
  openKml,
  openTmrFeatureGuide,
  getAccessToken,
  updatedBy,
  progressRefreshRequest = null,
  progressFocusRequest = null,
  jobDetailsFocusRequest = null,
  onProgressNotificationsAdded,
  onBriefSaved,
  onUpdateJob,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const scrollOffsetRef = useRef(0);
  const stickyVisibleRef = useRef(false);
  const progressExpandedRef = useRef(false);
  const progressLayoutYRef = useRef(0);
  const [stickyVisible, setStickyVisible] = useState(false);
  const [progressExpanded, setProgressExpanded] = useState(false);
  const [progressSectionSource, setProgressSectionSource] = useState(() => (
    scopeProgressSectionsToJob('', null)
  ));
  const [sharedBrief, setSharedBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefLoadError, setBriefLoadError] = useState('');
  const [sharedAccommodation, setSharedAccommodation] = useState(null);
  const [accommodationLoading, setAccommodationLoading] = useState(false);
  const [accommodationLoadError, setAccommodationLoadError] = useState('');
  const [sharedWorkspaceMeta, setSharedWorkspaceMeta] = useState(null);
  const [workspaceMetaLoading, setWorkspaceMetaLoading] = useState(false);
  const [workspaceMetaError, setWorkspaceMetaError] = useState('');
  const [metaEditor, setMetaEditor] = useState(null);
  const [metaDraft, setMetaDraft] = useState({});
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [assignedTeamVisible, setAssignedTeamVisible] = useState(false);
  const hasJob = Boolean(job?.number);
  const {
    assignedTeam,
    hasTeamsJob,
    refreshAssignedTeam,
  } = useAssignedTeam({ active, job, getAccessToken });
  const effectiveJob = useMemo(() => ({
    ...job,
    scheduleStart: sharedWorkspaceMeta?.itemId
      ? sharedWorkspaceMeta.scheduleStart
      : job?.scheduleStart,
    scheduleEnd: sharedWorkspaceMeta?.itemId
      ? sharedWorkspaceMeta.scheduleEnd
      : job?.scheduleEnd,
    location: sharedWorkspaceMeta?.itemId
      ? sharedWorkspaceMeta.location
      : job?.location,
  }), [job, sharedWorkspaceMeta]);
  const { mapLinks, openDirections } = useJobDirections(effectiveJob);
  const sourceLabel = useMemo(() => getSourceLabel(job), [job]);
  const cachedBrief = useMemo(() => (
    job?.fieldDetailsUpdatedAt
      ? {
        workType: String(job.fieldWorkType || ''),
        details: String(job.fieldDetails || ''),
        updatedAt: String(job.fieldDetailsUpdatedAt || ''),
        updatedBy: String(job.fieldDetailsUpdatedBy || ''),
        source: 'cache',
      }
      : null
  ), [
    job?.fieldDetails,
    job?.fieldDetailsUpdatedAt,
    job?.fieldDetailsUpdatedBy,
    job?.fieldWorkType,
  ]);
  const effectiveBrief = sharedBrief || cachedBrief;
  const progressSections = useMemo(() => (
    progressSectionsForJob(progressSectionSource, job?.number)
  ), [job?.number, progressSectionSource]);
  const taskNames = useMemo(() => jobTaskNamesFromText([
    job?.workType,
    job?.details,
    effectiveBrief?.details,
  ].filter(Boolean).join('\n')), [effectiveBrief?.details, job?.details, job?.workType]);
  const handleBriefSaved = useCallback(async (brief) => {
    setSharedBrief({ ...brief, source: 'job-details' });
    await onBriefSaved?.(brief);
  }, [onBriefSaved]);
  const handleProgressSectionsChange = useCallback((sections) => {
    setProgressSectionSource(scopeProgressSectionsToJob(job?.number, sections));
  }, [job?.number]);
  const expandProgress = useCallback(() => {
    if (progressExpandedRef.current) return;
    progressExpandedRef.current = true;
    setProgressExpanded(true);
  }, []);
  const effectiveAccommodation = sharedAccommodation?.itemId
    ? sharedAccommodation.accommodation
    : String(job?.accommodation || '');
  const dashboardHeroHeight = dashboardHeroHeightForWindow(windowHeight);
  const heroHeight = workspaceHeroHeightForWindow(windowHeight);
  const jobDetailsDisclosure = useJobDetailsHubDisclosure({
    active,
    jobNumber: job?.number,
    focusRequest: jobDetailsFocusRequest,
    heroHeight,
    topInset: insets.top + 56,
    scrollRef,
  });
  const { activeCelebration, finishProgressCelebration, handleProgressFocusReady,
    progressFocus, requestProgressFocus } = useProgressCelebrationFocus({
    active, jobNumber: job?.number, routeRequest: progressFocusRequest, scrollRef,
    layoutYRef: progressLayoutYRef, topInset: insets.top + 58, onExpand: expandProgress,
  });
  const {
    contentTransitionStyle,
    dockTransitionStyle,
  } = workspaceContentTransitionStyles(transitionProgress);
  const stickyOpacity = scrollY.interpolate({
    inputRange: [95, 160],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const stickyTranslateY = scrollY.interpolate({
    inputRange: [95, 160],
    outputRange: [-18, 0],
    extrapolate: 'clamp',
  });
  const routedStickyOpacity = transitionProgress
    ? Animated.multiply(stickyOpacity, transitionProgress)
    : stickyOpacity;

  useEffect(() => {
    setAssignedTeamVisible(false);
    setProgressSectionSource(scopeProgressSectionsToJob(job?.number, null));
  }, [job?.number]);
  const handleScroll = useCallback((event) => {
    const nativeEvent = event?.nativeEvent || {};
    const rawOffset = Number(nativeEvent.contentOffset?.y) || 0;
    const contentHeight = Number(nativeEvent.contentSize?.height) || 0;
    const viewportHeight = Number(nativeEvent.layoutMeasurement?.height) || 0;
    const hasScrollMetrics = contentHeight > 0 && viewportHeight > 0;
    const maxOffset = hasScrollMetrics
      ? Math.max(0, contentHeight - viewportHeight)
      : Math.max(0, rawOffset);
    const nextOffset = Math.min(Math.max(0, rawOffset), maxOffset);

    scrollOffsetRef.current = nextOffset;
    scrollY.setValue(nextOffset);

    if (hasScrollMetrics && rawOffset > maxOffset + 1) {
      scrollRef.current?.scrollTo({ y: maxOffset, animated: false });
    }

    const nextVisible = nextOffset > 120;
    if (stickyVisibleRef.current === nextVisible) return;

    stickyVisibleRef.current = nextVisible;
    setStickyVisible(nextVisible);
  }, [scrollY]);

  const toggleProgress = useCallback(() => {
    setProgressExpanded((current) => {
      const nextExpanded = !current;
      progressExpandedRef.current = nextExpanded;
      return nextExpanded;
    });
  }, []);

  useEffect(() => {
    if (active) return;
    progressExpandedRef.current = false;
    setProgressExpanded(false);
  }, [active]);

  useEffect(() => {
    let active = true;
    setSharedBrief(cachedBrief);
    setBriefLoadError('');

    if (!hasJob || typeof getAccessToken !== 'function') {
      setBriefLoading(false);
      return undefined;
    }

    setBriefLoading(true);
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const remoteBrief = await loadSharedJobBrief({ accessToken, job });
        if (active && remoteBrief) {
          setSharedBrief(remoteBrief);
          setBriefLoadError('');
        }
      } catch (error) {
        if (active) {
          setBriefLoadError(error?.message || 'Shared job details could not be loaded.');
        }
      } finally {
        if (active) setBriefLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [cachedBrief, getAccessToken, hasJob, job?.number]);

  useEffect(() => {
    let current = true;
    if (!active) return undefined;

    setSharedAccommodation(null);
    setAccommodationLoadError('');
    if (!hasJob || typeof getAccessToken !== 'function') {
      setAccommodationLoading(false);
      return undefined;
    }

    setAccommodationLoading(true);
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const remoteAccommodation = await loadSharedJobAccommodation({ accessToken, job });
        if (!current) return;
        setSharedAccommodation(remoteAccommodation?.itemId ? remoteAccommodation : null);
        setAccommodationLoadError('');
      } catch (error) {
        if (current) {
          setAccommodationLoadError(
            error?.message || 'Shared accommodation could not be loaded.',
          );
        }
      } finally {
        if (current) setAccommodationLoading(false);
      }
    })();

    return () => {
      current = false;
    };
  }, [active, getAccessToken, hasJob, job?.number]);

  useEffect(() => {
    let current = true;
    if (!active) return undefined;

    setSharedWorkspaceMeta(null);
    setWorkspaceMetaError('');
    if (!hasJob || typeof getAccessToken !== 'function') {
      setWorkspaceMetaLoading(false);
      return undefined;
    }

    setWorkspaceMetaLoading(true);
    (async () => {
      try {
        const accessToken = await getAccessToken();
        const remoteMeta = await loadSharedJobWorkspaceMeta({ accessToken, job });
        if (!current) return;
        setSharedWorkspaceMeta(remoteMeta?.itemId ? remoteMeta : null);
        setWorkspaceMetaError('');
      } catch (error) {
        if (current) {
          setWorkspaceMetaError(error?.message || 'Shared shift and site details could not be loaded.');
        }
      } finally {
        if (current) setWorkspaceMetaLoading(false);
      }
    })();

    return () => {
      current = false;
    };
  }, [active, getAccessToken, hasJob, job?.number]);

  useEffect(() => {
    scrollOffsetRef.current = 0;
    stickyVisibleRef.current = false;
    progressExpandedRef.current = false;
    setStickyVisible(false);
    setProgressExpanded(false);
    scrollY.setValue(0);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [job?.number, scrollY]);

  const openScheduleEditor = useCallback(() => {
    setMetaError('');
    setMetaDraft({
      start: formatDateInput(effectiveJob?.scheduleStart),
      end: formatDateInput(effectiveJob?.scheduleEnd),
    });
    setMetaEditor('schedule');
  }, [effectiveJob?.scheduleEnd, effectiveJob?.scheduleStart]);

  const openLocationEditor = useCallback(() => {
    setMetaError('');
    setMetaDraft({ location: String(effectiveJob?.location || '') });
    setMetaEditor('location');
  }, [effectiveJob?.location]);

  const openAccommodationEditor = useCallback(() => {
    setMetaError('');
    setMetaDraft({ accommodation: String(effectiveAccommodation || '') });
    setMetaEditor('accommodation');
  }, [effectiveAccommodation]);

  const closeMetaEditor = useCallback(() => {
    if (metaSaving) return;
    Keyboard.dismiss();
    setMetaEditor(null);
    setMetaError('');
  }, [metaSaving]);

  const saveMeta = useCallback(async () => {
    if (!metaEditor || metaSaving || typeof onUpdateJob !== 'function') return;
    setMetaSaving(true);
    setMetaError('');
    try {
      if (metaEditor === 'schedule') {
        if (typeof getAccessToken !== 'function') {
          throw new Error('Sign in with Microsoft before editing the shared shift.');
        }
        const scheduleStart = parseDateInput(metaDraft.start);
        const scheduleEnd = parseDateInput(metaDraft.end);
        const accessToken = await getAccessToken();
        const savedMeta = await saveSharedJobWorkspaceMeta({
          accessToken,
          job,
          scheduleStart,
          scheduleEnd,
          location: effectiveJob?.location,
          updatedBy,
          itemId: sharedWorkspaceMeta?.itemId,
          eTag: sharedWorkspaceMeta?.eTag,
        });
        setSharedWorkspaceMeta(savedMeta);
        setWorkspaceMetaError('');
        await onUpdateJob({ scheduleStart, scheduleEnd });
      } else if (metaEditor === 'location') {
        const location = String(metaDraft.location || '').trim();
        if (!location) throw new Error('Enter the site location.');
        if (typeof getAccessToken !== 'function') {
          throw new Error('Sign in with Microsoft before editing the shared site.');
        }
        const locationChanged = location !== String(effectiveJob?.location || '').trim();
        const accessToken = await getAccessToken();
        const savedMeta = await saveSharedJobWorkspaceMeta({
          accessToken,
          job,
          scheduleStart: effectiveJob?.scheduleStart,
          scheduleEnd: effectiveJob?.scheduleEnd,
          location,
          updatedBy,
          itemId: sharedWorkspaceMeta?.itemId,
          eTag: sharedWorkspaceMeta?.eTag,
        });
        setSharedWorkspaceMeta(savedMeta);
        setWorkspaceMetaError('');
        await onUpdateJob({
          location,
          ...(locationChanged ? { latitude: null, longitude: null } : {}),
        });
      } else {
        if (typeof getAccessToken !== 'function') {
          throw new Error('Sign in with Microsoft before editing shared accommodation.');
        }
        const accommodation = String(metaDraft.accommodation || '').trim();
        const accessToken = await getAccessToken();
        const savedAccommodation = await saveSharedJobAccommodation({
          accessToken,
          job,
          accommodation,
          updatedBy,
          itemId: sharedAccommodation?.itemId,
          eTag: sharedAccommodation?.eTag,
          storageScope: sharedAccommodation?.storageScope,
        });
        setSharedAccommodation(savedAccommodation);
        setAccommodationLoadError('');
        try {
          await onUpdateJob({ accommodation: savedAccommodation.accommodation });
        } catch (cacheError) {
          reportDevelopmentError('Could not cache shared accommodation', cacheError);
        }
      }
      Keyboard.dismiss();
      setMetaEditor(null);
    } catch (error) {
      if (error?.code === 'JOB_WORKSPACE_META_CONFLICT' && error.latest) {
        setSharedWorkspaceMeta(error.latest);
        setWorkspaceMetaError('');
        setMetaDraft(metaEditor === 'schedule'
          ? {
            start: formatDateInput(error.latest.scheduleStart),
            end: formatDateInput(error.latest.scheduleEnd),
          }
          : { location: String(error.latest.location || '') });
      }
      if (error?.code === 'JOB_ACCOMMODATION_CONFLICT' && error.latest) {
        setSharedAccommodation(error.latest);
        setAccommodationLoadError('');
        setMetaDraft({ accommodation: error.latest.accommodation || '' });
        try {
          await onUpdateJob({ accommodation: error.latest.accommodation || '' });
        } catch (cacheError) {
          reportDevelopmentError('Could not cache latest shared accommodation', cacheError);
        }
      }
      setMetaError(error?.message || 'The job details could not be saved.');
    } finally {
      setMetaSaving(false);
    }
  }, [
    effectiveJob,
    getAccessToken,
    job,
    metaDraft,
    metaEditor,
    metaSaving,
    onUpdateJob,
    sharedAccommodation,
    sharedWorkspaceMeta,
    updatedBy,
  ]);

  const scrollToWorkspace = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
      >
        <WorkspaceHero
          job={job}
          hasJob={hasJob}
          hasTeamsJob={hasTeamsJob}
          assignedTeam={assignedTeam}
          goBack={goBack}
          sourceLabel={sourceLabel}
          insets={insets}
          height={heroHeight}
          expandedHeight={dashboardHeroHeight}
          transitionProgress={transitionProgress}
          onOpenAssignedTeam={() => setAssignedTeamVisible(true)}
        />

        <Animated.View style={[styles.content, contentTransitionStyle]}>
          <View style={styles.sectionLead}>
            <View>
              <Text style={styles.sectionEyebrow}>SHARED JOB WORKSPACE</Text>
              <Text style={styles.sectionTitle}>Today’s field hub</Text>
            </View>
            <View style={styles.sharedPill}>
              <Ionicons name="people-outline" size={13} color={colors.success} />
              <Text style={styles.sharedPillText}>TEAM EDITABLE</Text>
            </View>
          </View>

          <JobDetailsLaunchCard onOpen={jobDetailsDisclosure.toggle} />

          <View
            onLayout={({ nativeEvent }) => {
              progressLayoutYRef.current = heroHeight + Number(nativeEvent.layout?.y || 0);
            }}
          >
            <JobProgressSection
              key={job?.number || 'no-job'}
              job={job}
              active={active}
              expanded={progressExpanded}
              getAccessToken={getAccessToken}
              updatedBy={updatedBy}
              sourceSections={progressSections}
              refreshRequest={progressRefreshRequest}
              celebrationFocus={progressFocus}
              onCelebrationReady={handleProgressFocusReady}
              onNotificationsAdded={onProgressNotificationsAdded}
              onTaskCompleted={requestProgressFocus}
              onToggle={toggleProgress}
            />
          </View>

          <WorkspaceActions disabled={!hasJob} onOpenKml={openKml} />

          <View style={styles.overviewLabelRow}>
            <Text style={styles.overviewLabel}>FIELD DETAILS</Text>
            <Text style={[
              styles.overviewHint,
              workspaceMetaError && styles.overviewHintWarning,
            ]}>
              {workspaceMetaLoading
                ? 'Syncing…'
                : workspaceMetaError
                  ? 'Saved copy shown'
                  : 'Shared with this job'}
            </Text>
          </View>

          <WorkspaceInfoPanel
            job={effectiveJob}
            mapLinks={mapLinks}
            openDirections={openDirections}
            accommodation={effectiveAccommodation}
            sharedAccommodation={sharedAccommodation}
            accommodationLoading={accommodationLoading}
            accommodationError={accommodationLoadError}
            onEditSchedule={openScheduleEditor}
            onEditLocation={openLocationEditor}
            onEditAccommodation={openAccommodationEditor}
          />
        </Animated.View>
      </Animated.ScrollView>

      <WorkspaceStickyHeader
        job={job}
        hasJob={hasJob}
        hasTeamsJob={hasTeamsJob}
        assignedTeam={assignedTeam}
        goBack={goBack}
        insets={insets}
        visible={stickyVisible}
        opacity={routedStickyOpacity}
        translateY={stickyTranslateY}
        onReturnToTop={scrollToWorkspace}
        onOpenAssignedTeam={() => setAssignedTeamVisible(true)}
      />

      <Animated.View
        pointerEvents="box-none"
        style={[styles.dockTransitionLayer, dockTransitionStyle]}
      >
        <JobWorkspaceDock
          job={job}
          activeTab="workspace"
          onWorkspace={scrollToWorkspace}
          onForms={openForms}
          onJobFiles={openJobFiles}
          onCapture={openCapture}
        />
      </Animated.View>

      <JobDetailsPage
        visible={jobDetailsDisclosure.expanded}
        active={active}
        onClose={jobDetailsDisclosure.toggle}
        job={job}
        focusRequest={jobDetailsFocusRequest}
        getAccessToken={getAccessToken}
        updatedBy={updatedBy}
        legacyBrief={effectiveBrief}
        legacyBriefLoading={briefLoading}
        legacyBriefError={briefLoadError}
        taskNames={taskNames}
        sourceLabel={sourceLabel}
        onBriefSaved={handleBriefSaved}
        onProgressSectionsChange={handleProgressSectionsChange}
        openJobFiles={openJobFiles}
        openTmrFeatureGuide={openTmrFeatureGuide}
      />

      <JobMetaEditor
        visible={Boolean(metaEditor)}
        type={metaEditor}
        draft={metaDraft}
        saving={metaSaving}
        error={metaError}
        insets={insets}
        onChange={setMetaDraft}
        onClose={closeMetaEditor}
        onSave={saveMeta}
      />

      <AssignedTeamModal
        visible={assignedTeamVisible}
        job={job}
        members={assignedTeam.members}
        assignedCount={assignedTeam.count}
        loading={assignedTeam.loading}
        resolved={assignedTeam.resolved}
        error={assignedTeam.error}
        bottomInset={insets.bottom}
        onClose={() => setAssignedTeamVisible(false)}
        onRefresh={refreshAssignedTeam}
      />

      <ProgressCompletionCelebration celebration={activeCelebration} onDone={finishProgressCelebration} />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBackground,
  },
  dockTransitionLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  hero: {
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.navy,
  },
  heroBackground: {
    flex: 1,
  },
  heroImage: {
    opacity: 0.58,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 20, 35, 0.42)',
  },
  heroOverlay: {
    flex: 1,
    paddingHorizontal: JOB_SHELL_HORIZONTAL_PADDING,
    paddingBottom: 12,
  },
  heroTopRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBack: {
    width: 136,
    minWidth: 136,
    height: 44,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  heroStatus: {
    backgroundColor: 'rgba(6, 26, 45, 0.72)',
  },
  heroSideRight: {
    minWidth: 104,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  teamControl: {
    width: 104,
    minHeight: 46,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(214,168,79,0.42)',
    backgroundColor: 'rgba(6, 26, 45, 0.76)',
  },
  teamControlCompact: {
    width: 94,
    minHeight: 44,
    paddingHorizontal: 7,
    borderRadius: 14,
  },
  teamControlPressed: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  teamStatusRow: {
    minHeight: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 4,
  },
  teamStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  teamStatusDotWarning: {
    backgroundColor: colors.warning,
  },
  teamStatusText: {
    color: colors.success,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  teamStatusTextWarning: {
    color: colors.warning,
  },
  teamAssignedRow: {
    minHeight: 17,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    columnGap: 3,
  },
  teamAssignedText: {
    flexShrink: 1,
    color: 'rgba(255,255,255,0.76)',
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  heroBody: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginBottom: 2,
  },
  heroNumber: {
    color: colors.white,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.7,
  },
  heroName: {
    color: 'rgba(255, 255, 255, 0.76)',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    marginTop: 1,
  },
  heroMetaRow: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroMetaItem: {
    maxWidth: '54%',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.lg,
  },
  heroMetaItemLast: {
    flex: 1,
    maxWidth: '46%',
    marginRight: 0,
  },
  heroMetaText: {
    flexShrink: 1,
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.55,
    marginLeft: 6,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    elevation: 30,
    overflow: 'hidden',
    backgroundColor: colors.headerBackground,
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  stickyBackground: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  stickyBackgroundImage: {
    opacity: 0.58,
  },
  stickyShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 20, 35, 0.56)',
  },
  stickyRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stickyBrandRow: {
    width: 94,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    paddingRight: 4,
  },
  stickyLogo: {
    width: 30,
    height: 30,
    marginRight: 6,
  },
  stickyBrand: {
    color: colors.white,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  stickyOne: {
    color: colors.accent,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 2,
  },
  stickySideRight: {
    width: 94,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  stickyStatus: {
    backgroundColor: 'rgba(6, 26, 45, 0.72)',
  },
  stickyControlPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  stickyJob: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  stickyJobLabel: {
    color: colors.accent,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  stickyJobNumber: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 1,
    textAlign: 'center',
  },
  stickyJobName: {
    maxWidth: '100%',
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
  },
  sectionLead: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
    marginBottom: SPACING.md,
  },
  sectionEyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  sectionTitle: {
    color: colors.bodyText,
    fontSize: 21,
    lineHeight: 25,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  sharedPill: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 5,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.success,
    backgroundColor: colors.successBackground,
  },
  sharedPillText: {
    color: colors.success,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  workspaceActions: {
    marginTop: SPACING.xs,
  },
  kmlActionCard: {
    minHeight: 96,
    marginBottom: 0,
    borderColor: colors.success,
    borderLeftWidth: 4,
    backgroundColor: colors.successBackground,
  },
  overviewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingHorizontal: 2,
  },
  overviewLabel: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  overviewHint: {
    color: colors.supportingText,
    fontSize: 9,
    fontWeight: '700',
  },
  overviewHintWarning: {
    color: colors.warning,
  },
  cardEyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  editorKeyboard: {
    flex: 1,
  },
  editorShade: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  editorSheet: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    backgroundColor: colors.surface,
  },
  editorHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    marginBottom: SPACING.lg,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  editorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editorTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  editorTitle: {
    color: colors.bodyText,
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '900',
    marginTop: 3,
  },
  editorClose: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.raisedSurface,
  },
  editorIntro: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 17,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  editorLabel: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  editorInput: {
    minHeight: 48,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
    color: colors.bodyText,
    fontSize: 14,
  },
  editorTextArea: {
    minHeight: 132,
    maxHeight: 220,
  },
  editorError: {
    color: colors.danger,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  editorActions: {
    flexDirection: 'row',
    columnGap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  editorCancel: {
    minHeight: 50,
    flex: 0.42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
  },
  editorCancelText: {
    color: colors.supportingText,
    fontSize: 11,
    fontWeight: '900',
  },
  editorSave: {
    minHeight: 50,
    flex: 0.58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    borderRadius: RADIUS.md,
    backgroundColor: colors.accent,
  },
  editorSaveDisabled: {
    opacity: 0.62,
  },
  editorSaveText: {
    color: colors.navy,
    fontSize: 11,
    fontWeight: '900',
  },
});
