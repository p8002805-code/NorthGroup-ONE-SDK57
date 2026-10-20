import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SE14ArchiveDayGroup from '../components/SE14ArchiveDayGroup';
import SE14BulkSessionNumberEditor from '../components/SE14BulkSessionNumberEditor';
import SE14DayPreparationOverlay from '../components/SE14DayPreparationOverlay';
import SE14RoundStatusCard from '../components/SE14RoundStatusCard';
import SE14WorkflowDock from '../components/SE14WorkflowDock';
import SE14WorkspaceHeader from '../components/SE14WorkspaceHeader';

import {
  GOLD,
  NAVY,
  WHITE,
} from '../styles/styles';
import {
  getSE14CompletedDate,
  getSE14RequirementProgress,
  groupSE14ArchivedRecords,
  SE14_END_REQUIREMENTS,
} from '../utils/se14Records';
import {
  collectSE14Photos,
  exportSE14PhotoZip,
  groupSE14Photos,
  getSE14PhotoDateKey,
} from '../utils/se14PhotoStorage';
import { profileInitials } from '../features/account/accountProfile';
import { useSE14DayPreparation } from '../features/gnss/hooks/useSE14DayPreparation';
import { getSE14CurrentRound } from '../features/gnss/se14Rounds';

const MUTED_TEXT = '#64748B';
const PAGE = '#F2F5F7';
const GREEN = '#219653';
const BLUE = '#157AA8';

const dateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateHeading = (date) => {
  const today = new Date();
  const prefix = dateKey(date) === dateKey(today) ? 'TODAY · ' : '';

  return `${prefix}${date
    .toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    .toUpperCase()}`;
};

const sessionNumberValue = (record) => {
  const value = Number.parseInt(record?.data?.sessionNumber, 10);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

const groupCompletedByDate = (records, sortMode = 'newest') => {
  const grouped = new Map();

  records.forEach((record) => {
    const date = getSE14CompletedDate(record);
    const key = dateKey(date);

    if (!grouped.has(key)) {
      grouped.set(key, {
        key,
        date,
        label: dateHeading(date),
        records: [],
      });
    }

    grouped.get(key).records.push(record);
  });

  const dateDirection = sortMode === 'oldest' ? 1 : -1;
  const groups = [...grouped.values()].sort(
    (left, right) =>
      dateDirection * (left.date.getTime() - right.date.getTime())
  );

  groups.forEach((group) => {
    group.records.sort((left, right) => {
      if (sortMode === 'session') {
        const sessionComparison =
          sessionNumberValue(left) - sessionNumberValue(right);

        if (sessionComparison !== 0) return sessionComparison;

        return String(left?.data?.markId || '').localeCompare(
          String(right?.data?.markId || ''),
          'en-AU',
          { numeric: true, sensitivity: 'base' }
        );
      }

      const timeComparison =
        getSE14CompletedDate(left).getTime() -
        getSE14CompletedDate(right).getTime();

      return sortMode === 'oldest' ? timeComparison : -timeComparison;
    });
  });

  return groups;
};

const pmLabel = (value) => {
  const cleaned = String(value || '').trim();

  if (!cleaned) return 'PM —';
  const compact = cleaned.replace(/[\s_-]+/g, '');

  if (/^\d+$/.test(compact)) return `PM${compact}`;

  const pmMatch = compact.match(/^PM(\d+)$/i);
  return pmMatch ? `PM${pmMatch[1]}` : cleaned.toUpperCase();
};

const recordTitle = (record) => {
  const form = record?.data || {};
  const session = String(form.sessionNumber || '—').trim();
  return `${pmLabel(form.markId)} · SESSION ${session}`;
};

const formatArchiveDate = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return 'Archive date unavailable';

  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

function StaticRunningIndicator() {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.48, 1],
  });
  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.18],
  });

  return (
    <Animated.View
      style={[
        styles.staticRunningIndicator,
        { opacity },
      ]}
    >
      <Animated.View
        style={[
          styles.staticRunningDot,
          { transform: [{ scale }] },
        ]}
      />
      <Text
        style={[
          styles.firstStepEyebrow,
          styles.staticRunningText,
        ]}
        numberOfLines={1}
      >
        STATIC CURRENTLY RUNNING
      </Text>
    </Animated.View>
  );
}

const WORKFLOW_PAGES = {
  start: {
    eyebrow: 'FIELD SETUP',
    title: '1 · Start New Session',
    subtitle: 'Create the booking record, checks and start photos.',
    icon: 'play-circle-outline',
    color: '#9A6A13',
    background: '#FFF3D9',
  },
  end: {
    eyebrow: 'ACTIVE FIELD SESSIONS',
    title: '2 · Ready to End',
    subtitle: 'Finish sessions after the static observation is complete.',
    icon: 'stop-circle-outline',
    color: '#9A6A13',
    background: '#FFF3D9',
  },
  review: {
    eyebrow: 'OFFICE REVIEW',
    title: '3 · Review and Complete',
    subtitle: 'Check filenames, correct details and generate the final PDF.',
    icon: 'checkmark-circle-outline',
    color: GREEN,
    background: '#DFF3E6',
  },
  archive: {
    eyebrow: 'FINISHED RECORDS',
    title: '4 · Saved Days',
    subtitle: 'Local daily folders ready to review or upload.',
    icon: 'folder-outline',
    color: '#9A6A13',
    background: '#FFF3D9',
  },
  photos: {
    eyebrow: 'FIELD PHOTO ARCHIVE',
    title: '5 · Photo Storage',
    subtitle: 'Booking photos, session stamps and metadata.',
    icon: 'images-outline',
    color: BLUE,
    background: '#DCEFF7',
  },
};

function WorkflowPageHeader({ tab, count }) {
  const page = WORKFLOW_PAGES[tab];

  return (
    <View style={styles.pageHeader}>
      <View
        style={[styles.pageHeaderIcon, { backgroundColor: page.background }]}
      >
        <Ionicons name={page.icon} size={25} color={page.color} />
      </View>

      <View style={styles.pageHeaderCopy}>
        <Text style={[styles.pageHeaderEyebrow, { color: page.color }]}>
          {page.eyebrow}
        </Text>
        <Text style={styles.pageHeaderTitle}>{page.title}</Text>
        <Text style={styles.pageHeaderSubtitle}>
          {page.subtitle}
        </Text>
      </View>

      {typeof count === 'number' ? (
        <View
          style={[
            styles.pageHeaderCount,
            { backgroundColor: page.background },
          ]}
        >
          <Text style={[styles.pageHeaderCountText, { color: page.color }]}>
            {count}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function DateGroupHeader({ group, open, onPress }) {
  return (
    <TouchableOpacity
      style={styles.dateGroupHeader}
      activeOpacity={0.82}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View style={styles.dateGroupCopy}>
        <Text style={styles.dateHeading}>{group.label}</Text>
        <Text style={styles.dateGroupCount}>
          {group.records.length} session{group.records.length === 1 ? '' : 's'}
        </Text>
      </View>
      <Text style={styles.dateGroupChevron}>{open ? '⌃' : '⌄'}</Text>
    </TouchableOpacity>
  );
}

export default function SE14InProgressScreen({
  records = [],
  activeJob,
  startSession,
  openRecord,
  archiveRecord,
  restoreRecord,
  deleteRecord,
  editSessionNumbers,
  uploadDay,
  goBack,
  accountProfile,
  backLabel = 'Forms',
}) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  const tabScrollOffsets = useRef({});
  const [reviewSort, setReviewSort] = useState('newest');
  const [openCompletedGroups, setOpenCompletedGroups] = useState({});
  const [openArchivedGroups, setOpenArchivedGroups] = useState({});
  const [photoGrouping, setPhotoGrouping] = useState('pm');
  const [openPhotoGroups, setOpenPhotoGroups] = useState({});
  const [exportingKey, setExportingKey] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletingRecord, setDeletingRecord] = useState(false);
  const [sessionNumberGroup, setSessionNumberGroup] = useState(null);
  const [activeWorkflowTab, setActiveWorkflowTab] = useState('start');
  const {
    preparation: dayPreparation,
    uploadingDayKey,
    uploadArchivedDay,
  } = useSE14DayPreparation({
    initials: profileInitials(accountProfile),
    onReady: uploadDay,
    recordTitle,
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: tabScrollOffsets.current[activeWorkflowTab] || 0,
        animated: false,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [activeWorkflowTab]);

  const endSessions = useMemo(
    () => records.filter((record) => record.status === 'in_progress'),
    [records]
  );

  const completedSessions = useMemo(
    () =>
      records.filter(
        (record) =>
          record.status === 'review' ||
          record.status === 'complete'
      ),
    [records]
  );

  const completedGroups = useMemo(
    () => groupCompletedByDate(completedSessions, reviewSort),
    [completedSessions, reviewSort]
  );

  const archivedSessions = useMemo(
    () =>
      records
        .filter((record) => record.status === 'archived')
        .sort(
          (left, right) =>
            new Date(right.archivedAt || 0).getTime() -
            new Date(left.archivedAt || 0).getTime()
        ),
    [records]
  );

  const archivedGroups = useMemo(
    () => groupSE14ArchivedRecords(archivedSessions),
    [archivedSessions]
  );
  const currentRound = useMemo(
    () => getSE14CurrentRound(records),
    [records]
  );

  useEffect(() => {
    setOpenCompletedGroups((current) => {
      const validKeys = new Set(completedGroups.map((group) => group.key));
      const next = Object.fromEntries(
        Object.entries(current).filter(([key]) => validKeys.has(key))
      );

      if (!Object.keys(next).length && completedGroups[0]) {
        next[completedGroups[0].key] = true;
      }

      return next;
    });
  }, [completedGroups]);

  const storedPhotos = useMemo(
    () => collectSE14Photos(records),
    [records]
  );

  const photoGroups = useMemo(
    () => groupSE14Photos(storedPhotos, photoGrouping),
    [photoGrouping, storedPhotos]
  );

  const togglePhotoGroup = (key) => {
    setOpenPhotoGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleCompletedGroup = (key) => {
    setOpenCompletedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleArchivedGroup = (key) => {
    setOpenArchivedGroups((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const requestPermanentDelete = (record) => {
    setDeleteCandidate(record);
    setDeleteConfirmation('');
  };

  const closePermanentDelete = () => {
    if (deletingRecord) return;
    setDeleteCandidate(null);
    setDeleteConfirmation('');
  };

  const confirmPermanentDelete = async () => {
    if (
      !deleteCandidate ||
      deleteConfirmation.trim() !== 'DELETE' ||
      deletingRecord
    ) {
      return;
    }

    setDeletingRecord(true);

    try {
      const deleted = await deleteRecord?.(deleteCandidate.id);
      if (deleted) {
        setDeleteCandidate(null);
        setDeleteConfirmation('');
      }
    } finally {
      setDeletingRecord(false);
    }
  };

  const openSessionRecord = (recordId) => {
    openRecord(recordId);
  };

  const openWorkflowTab = (key) => {
    setActiveWorkflowTab(key);
  };

  const beginSession = () => {
    if (!currentRound.shouldSuggestNext) {
      startSession?.({ roundMode: 'current' });
      return;
    }

    Alert.alert(
      'Continue this field round?',
      `Round ${currentRound.sequence} · ${currentRound.label} began several hours ago. Choose where the new session belongs.`,
      [
        { text: `Continue Round ${currentRound.sequence}`, onPress: () => startSession?.({ roundMode: 'current' }) },
        { text: `Start Round ${currentRound.sequence + 1}`, onPress: () => startSession?.({ roundMode: 'next' }) },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const exportPhotos = async (photos, scopeLabel, key) => {
    if (exportingKey) return;

    setExportingKey(key);

    try {
      await exportSE14PhotoZip({
        photos,
        jobNumber: activeJob?.number,
        scopeLabel,
        initials: profileInitials(accountProfile),
      });
    } catch (error) {
      Alert.alert(
        'Photo export unavailable',
        String(error?.message || error)
      );
    } finally {
      setExportingKey(null);
    }
  };

  const jobNumber = activeJob?.number || 'No active job';
  const jobName =
    activeJob?.name || 'Select a job before starting GNSS';
  const activeWorkflowCount = {
    end: endSessions.length,
    review: completedSessions.length,
    archive: archivedSessions.length,
    photos: storedPhotos.length,
  }[activeWorkflowTab];

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <SE14WorkspaceHeader
        topInset={insets.top}
        jobNumber={jobNumber}
        jobName={jobName}
        onBack={goBack}
        backLabel={backLabel}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 28 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={(event) => {
          tabScrollOffsets.current[activeWorkflowTab] =
            event.nativeEvent.contentOffset.y;
        }}
      >
        <WorkflowPageHeader
          tab={activeWorkflowTab}
          count={activeWorkflowCount}
        />
        {activeWorkflowTab === 'start' ? (
          <View style={styles.tabBody}>
            <SE14RoundStatusCard
              round={currentRound}
              onStartNext={() => startSession?.({ roundMode: 'next' })}
            />
            <TouchableOpacity
              style={[styles.startCard, styles.startTabCard]}
              activeOpacity={0.86}
              onPress={beginSession}
              disabled={!activeJob}
            >
              <View style={styles.startIcon}>
                <Text style={styles.startIconText}>＋</Text>
              </View>

              <View style={styles.startCopy}>
                <Text style={styles.startEyebrow}>NEW SE-14 RECORD</Text>
                <Text style={styles.startTitle}>Begin Session</Text>
                <Text style={styles.startSubtitle}>
                  Enter the setup, checks and start photos.
                </Text>
              </View>

              <Text style={styles.startArrow}>›</Text>
            </TouchableOpacity>

            {endSessions.length > 0 ? (
              <TouchableOpacity
                style={styles.activeSessionCallout}
                activeOpacity={0.84}
                onPress={() => openWorkflowTab('end')}
              >
                <View style={styles.activeSessionCopy}>
                  <StaticRunningIndicator />
                  <Text style={styles.activeSessionTitle}>
                    {endSessions.length} session
                    {endSessions.length === 1 ? '' : 's'} ready for later
                  </Text>
                  <Text style={styles.activeSessionText}>
                    Open End when the static observation is finished.
                  </Text>
                </View>
                <Text style={styles.activeSessionArrow}>›</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.startGuidance}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color={GREEN}
                />
                <View style={styles.startGuidanceCopy}>
                  <Text style={styles.startGuidanceTitle}>
                    Ready for field work
                  </Text>
                  <Text style={styles.startGuidanceText}>
                    Your active job is applied automatically to the new form.
                  </Text>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {activeWorkflowTab === 'end' ? (
          <View style={styles.tabBody}>
            {endSessions.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No sessions waiting</Text>
                <Text style={styles.emptyText}>
                  Complete Start Session and it will appear here automatically.
                </Text>
              </View>
            ) : (
              endSessions.map((record) => {
                const progress = getSE14RequirementProgress(
                  record.data,
                  SE14_END_REQUIREMENTS
                );
                const percent = progress.total
                  ? progress.complete / progress.total
                  : 0;

                return (
                  <TouchableOpacity
                    key={record.id}
                    style={styles.sessionCard}
                    activeOpacity={0.82}
                    onPress={() => openSessionRecord(record.id)}
                  >
                    <View style={styles.sessionIdentityRow}>
                      <View style={styles.sessionIdentityCell}>
                        <Text style={styles.sessionIdentityLabel}>PM / MARK</Text>
                        <Text style={styles.sessionIdentityValue}>
                          {pmLabel(record.data.markId)}
                        </Text>
                      </View>

                      <View style={styles.sessionIdentityCellSmall}>
                        <Text style={styles.sessionIdentityLabel}>SESSION</Text>
                        <Text style={styles.sessionIdentityValue}>
                          {record.data.sessionNumber || '—'}
                        </Text>
                      </View>

                      <Text style={styles.sessionChevron}>›</Text>
                    </View>

                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.round(percent * 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {progress.complete}/{progress.total}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        ) : null}

        {activeWorkflowTab === 'review' ? (
          <View style={styles.tabBody}>
              <View style={styles.reviewSortBar}>
                <Text style={styles.reviewSortLabel}>SORT</Text>
                {[
                  ['newest', 'NEWEST'],
                  ['oldest', 'OLDEST'],
                  ['session', 'SESSION #'],
                ].map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={[
                      styles.reviewSortButton,
                      reviewSort === value && styles.reviewSortButtonActive,
                    ]}
                    activeOpacity={0.82}
                    onPress={() => {
                      setReviewSort(value);
                      setOpenCompletedGroups({});
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: reviewSort === value }}
                  >
                    <Text
                      style={[
                        styles.reviewSortButtonText,
                        reviewSort === value && styles.reviewSortButtonTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {completedGroups.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>
                    No sessions ready for review
                  </Text>
                  <Text style={styles.emptyText}>
                    Completed field sessions will move here
                    automatically.
                  </Text>
                </View>
              ) : (
                completedGroups.map((group) => (
                  <View key={group.key} style={styles.dateGroupCard}>
                    <DateGroupHeader
                      group={group}
                      open={Boolean(openCompletedGroups[group.key])}
                      onPress={() => toggleCompletedGroup(group.key)}
                    />

                    {openCompletedGroups[group.key] ? (
                      <View style={styles.dateGroupContent}>
                        {group.records.map((record) => (
                          <View key={record.id} style={styles.completedCard}>
                            <TouchableOpacity
                              style={styles.completedCardMain}
                              activeOpacity={0.82}
                              onPress={() => openSessionRecord(record.id)}
                            >
                              <View style={styles.completedCheck}>
                                <Text style={styles.completedCheckText}>✓</Text>
                              </View>

                              <View style={styles.completedCopy}>
                                <Text style={styles.completedTitle}>
                                  {recordTitle(record)}
                                </Text>
                                <Text style={styles.completedMeta}>
                                  {record.status === 'complete'
                                    ? 'EXPORTED'
                                    : 'REVIEW REQUIRED'}{' '}
                                  · Ended {record.data.endDate || '—'} ·{' '}
                                  {record.data.endTime || '—'}
                                </Text>
                              </View>

                              <Text style={styles.completedArrow}>›</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.archiveInlineButton}
                              activeOpacity={0.82}
                              onPress={() => record.status === 'complete' ? archiveRecord?.(record.id) : openSessionRecord(record.id)}
                              accessibilityRole="button"
                              accessibilityLabel={record.status === 'complete' ? `Move ${recordTitle(record)} into its saved day` : `Finish ${recordTitle(record)}`}
                            >
                              <Text style={styles.archiveInlineButtonText}>
                                {record.status === 'complete' ? 'MOVE TO SAVED DAY' : 'OPEN TO FINISH'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))
              )}
          </View>
        ) : null}

        {activeWorkflowTab === 'archive' ? (
          <View style={styles.tabBody}>
              {archivedSessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No archived sessions</Text>
                  <Text style={styles.emptyText}>
                    Finish a reviewed session with Save to Day and it will be stored here on this phone, ready to upload when reception returns.
                  </Text>
                </View>
              ) : (
                archivedGroups.map((group) => (
                  <SE14ArchiveDayGroup
                    key={group.key}
                    group={group}
                    open={Boolean(openArchivedGroups[group.key])}
                    uploadingKey={uploadingDayKey}
                    onToggle={() => toggleArchivedGroup(group.key)}
                    onUpload={uploadArchivedDay}
                    onEditSessionNumbers={() => setSessionNumberGroup(group)}
                    onOpenRecord={openSessionRecord}
                    onRestore={(recordId) => restoreRecord?.(recordId)}
                    onDelete={requestPermanentDelete}
                    recordTitle={recordTitle}
                    formatArchiveDate={formatArchiveDate}
                  />
                ))
              )}
          </View>
        ) : null}

        {activeWorkflowTab === 'photos' ? (
          <View style={styles.tabBody}>
              {storedPhotos.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>
                    No GNSS photos yet
                  </Text>
                  <Text style={styles.emptyText}>
                    Photos accepted in Start and End Session will
                    appear here automatically.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.photoArchiveToolbar}>
                    <View style={styles.photoSegmentedControl}>
                      <TouchableOpacity
                        style={[
                          styles.photoSegmentButton,
                          photoGrouping === 'pm' &&
                            styles.photoSegmentButtonActive,
                        ]}
                        activeOpacity={0.82}
                        onPress={() => {
                          setPhotoGrouping('pm');
                          setOpenPhotoGroups({});
                        }}
                      >
                        <Text
                          style={[
                            styles.photoSegmentText,
                            photoGrouping === 'pm' &&
                              styles.photoSegmentTextActive,
                          ]}
                        >
                          BY PM
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.photoSegmentButton,
                          photoGrouping === 'day' &&
                            styles.photoSegmentButtonActive,
                        ]}
                        activeOpacity={0.82}
                        onPress={() => {
                          setPhotoGrouping('day');
                          setOpenPhotoGroups({});
                        }}
                      >
                        <Text
                          style={[
                            styles.photoSegmentText,
                            photoGrouping === 'day' &&
                              styles.photoSegmentTextActive,
                          ]}
                        >
                          BY DAY
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.exportAllPhotosButton}
                      activeOpacity={0.82}
                      disabled={Boolean(exportingKey)}
                      onPress={() =>
                        exportPhotos(
                          storedPhotos,
                          photoGrouping === 'pm'
                            ? 'All_by_PM'
                            : 'All_by_Day',
                          'all'
                        )
                      }
                    >
                      <Text style={styles.exportAllPhotosText}>
                        {exportingKey === 'all'
                          ? 'ZIPPING…'
                          : 'EXPORT ALL'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.photoArchiveHint}>
                    ZIP exports contain only the JPEG photos,
                    organised into one folder for each PM or Mark ID.
                  </Text>

                  {photoGroups.map((group) => {
                    const groupOpen = Boolean(
                      openPhotoGroups[group.key]
                    );

                    const groupExportKey = `group_${group.key}`;

                    const requiredPhotoCount = group.photos.filter(
                      (photo) => !photo.optional
                    ).length;

                    return (
                      <View
                        key={group.key}
                        style={styles.photoGroupCard}
                      >
                        <View style={styles.photoGroupHeader}>
                          <TouchableOpacity
                            style={styles.photoGroupHeaderMain}
                            activeOpacity={0.82}
                            onPress={() =>
                              togglePhotoGroup(group.key)
                            }
                            accessibilityRole="button"
                            accessibilityState={{
                              expanded: groupOpen,
                            }}
                          >
                            <View style={styles.photoGroupIcon}>
                              <Text
                                style={styles.photoGroupIconText}
                              >
                                ▧
                              </Text>
                            </View>

                            <View style={styles.photoGroupCopy}>
                              <Text
                                style={styles.photoGroupTitle}
                              >
                                {group.label}
                              </Text>

                              <Text style={styles.photoGroupMeta}>
                                {group.photos.length} photo
                                {group.photos.length === 1
                                  ? ''
                                  : 's'}{' '}
                                ·{' '}
                                {Math.min(requiredPhotoCount, 7)}/7
                                required
                              </Text>
                            </View>

                            <Text
                              style={styles.photoGroupChevron}
                            >
                              {groupOpen ? '⌄' : '›'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={
                              styles.exportGroupHeaderButton
                            }
                            activeOpacity={0.82}
                            disabled={Boolean(exportingKey)}
                            onPress={() =>
                              exportPhotos(
                                group.photos,
                                group.exportLabel,
                                groupExportKey
                              )
                            }
                            accessibilityRole="button"
                            accessibilityLabel={`Export ${group.label}`}
                          >
                            <Text
                              style={
                                styles.exportGroupHeaderButtonText
                              }
                            >
                              {exportingKey === groupExportKey
                                ? 'ZIPPING…'
                                : 'EXPORT'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {groupOpen ? (
                          <View style={styles.photoGroupContent}>
                            {group.photos.map((photo) => (
                              <View
                                key={photo.id}
                                style={styles.archivePhotoCard}
                              >
                                <View
                                  style={styles.archivePhotoFrame}
                                >
                                  <Image
                                    source={{ uri: photo.uri }}
                                    style={
                                      styles.archivePhotoImage
                                    }
                                    resizeMode="cover"
                                  />

                                  <View
                                    style={
                                      styles.archivePhotoStamp
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.archivePhotoStampText
                                      }
                                      numberOfLines={3}
                                    >
                                      {photo.stampText}
                                    </Text>
                                  </View>
                                </View>

                                <View
                                  style={styles.archivePhotoCopy}
                                >
                                  <Text
                                    style={styles.archivePhotoType}
                                  >
                                    {photo.fieldLabel}
                                  </Text>

                                  <Text
                                    style={
                                      styles.archivePhotoFilename
                                    }
                                    numberOfLines={2}
                                  >
                                    {photo.filename}
                                  </Text>

                                  <Text
                                    style={styles.archivePhotoMeta}
                                  >
                                    {photo.markId || 'PM —'} ·
                                    Session{' '}
                                    {photo.sessionNumber || '—'} ·{' '}
                                    {getSE14PhotoDateKey(photo)}
                                  </Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </>
              )}
          </View>
        ) : null}
      </ScrollView>

      <SE14WorkflowDock
        activeTab={activeWorkflowTab}
        bottomInset={insets.bottom}
        counts={{
          end: endSessions.length,
          review: completedSessions.length,
          archive: archivedSessions.length,
          photos: storedPhotos.length,
        }}
        onSelect={openWorkflowTab}
      />

      <SE14DayPreparationOverlay preparation={dayPreparation} />

      <SE14BulkSessionNumberEditor
        group={sessionNumberGroup}
        onClose={() => setSessionNumberGroup(null)}
        onApply={editSessionNumbers}
        recordTitle={recordTitle}
      />

      <Modal
        visible={Boolean(deleteCandidate)}
        transparent
        animationType="fade"
        onRequestClose={closePermanentDelete}
      >
        <KeyboardAvoidingView
          style={styles.deleteModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.deleteModalCard}>
            <View style={styles.deleteModalIcon}>
              <Text style={styles.deleteModalIconText}>!</Text>
            </View>
            <Text style={styles.deleteModalTitle}>
              Permanently delete session?
            </Text>
            <Text style={styles.deleteModalRecord}>
              {deleteCandidate ? recordTitle(deleteCandidate) : ''}
            </Text>
            <Text style={styles.deleteModalBody}>
              This removes the locally stored GNSS record, its editable values, and its app-managed Start and End photo files. Copies already saved to iPhone Photos and files already sent to SharePoint are not deleted.
            </Text>
            <Text style={styles.deleteModalInstruction}>
              Type DELETE to confirm permanent deletion.
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              value={deleteConfirmation}
              onChangeText={setDeleteConfirmation}
              placeholder="DELETE"
              placeholderTextColor="#94A3B8"
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!deletingRecord}
              returnKeyType="done"
              onSubmitEditing={confirmPermanentDelete}
            />
            <View style={styles.deleteModalActions}>
              <TouchableOpacity
                style={styles.deleteModalCancel}
                activeOpacity={0.82}
                disabled={deletingRecord}
                onPress={closePermanentDelete}
              >
                <Text style={styles.deleteModalCancelText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteModalConfirm,
                  deleteConfirmation.trim() !== 'DELETE' &&
                    styles.deleteModalConfirmDisabled,
                ]}
                activeOpacity={0.82}
                disabled={
                  deletingRecord ||
                  deleteConfirmation.trim() !== 'DELETE'
                }
                onPress={confirmPermanentDelete}
              >
                <Text style={styles.deleteModalConfirmText}>
                  {deletingRecord ? 'DELETING…' : 'DELETE FOREVER'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
  hero: {
    paddingHorizontal: 18,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  heroImage: {
    opacity: 0.34,
  },
  heroShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,28,48,0.66)',
  },
  topRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topAction: {
    width: 136,
    minHeight: 40,
    justifyContent: 'center',
  },
  formCode: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  eyebrow: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 8,
  },
  title: {
    color: WHITE,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 3,
  },
  heroIntro: {
    color: '#CFDBE5',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  lockedJob: {
    marginTop: 16,
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.48)',
    backgroundColor: 'rgba(5,34,56,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  lockIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  lockIconText: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '900',
  },
  lockedJobCopy: {
    flex: 1,
  },
  lockedLabel: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  lockedNumber: {
    color: WHITE,
    fontSize: 19,
    fontWeight: '900',
    marginTop: 2,
  },
  lockedName: {
    color: '#AFC2D2',
    fontSize: 11,
    marginTop: 1,
  },
  lockedStatus: {
    color: '#D7E1E9',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  scroll: {
    flex: 1,
    backgroundColor: PAGE,
  },
  content: {
    padding: 15,
    paddingBottom: 44,
  },
  pageHeader: {
    minHeight: 94,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  pageHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  pageHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  pageHeaderEyebrow: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  pageHeaderTitle: {
    color: NAVY,
    fontSize: 18,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: 2,
  },
  pageHeaderSubtitle: {
    color: MUTED_TEXT,
    fontSize: 10.5,
    lineHeight: 14,
    marginTop: 3,
  },
  pageHeaderCount: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    marginLeft: 8,
  },
  pageHeaderCountText: {
    fontSize: 11,
    fontWeight: '900',
  },
  tabBody: {
    marginTop: 13,
  },
  startTabCard: {
    flex: 0,
    minHeight: 108,
  },
  activeSessionCallout: {
    minHeight: 90,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CFE2D6',
    backgroundColor: '#F5FBF7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 13,
    marginTop: 13,
  },
  activeSessionCopy: {
    flex: 1,
    minWidth: 0,
  },
  activeSessionTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '900',
    marginTop: 7,
  },
  activeSessionText: {
    color: MUTED_TEXT,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  activeSessionArrow: {
    color: GREEN,
    fontSize: 28,
    marginLeft: 10,
  },
  startGuidance: {
    minHeight: 76,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginTop: 13,
  },
  startGuidanceCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: 11,
  },
  startGuidanceTitle: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '900',
  },
  startGuidanceText: {
    color: MUTED_TEXT,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  workflowCard: {
    backgroundColor: WHITE,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E0E6EA',
    paddingHorizontal: 22,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    alignItems: 'center',
  },
  stepNumber: {
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberComplete: {
    backgroundColor: '#E7F5EC',
  },
  stepNumberText: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '900',
  },
  stepNumberTextComplete: {
    color: GREEN,
  },
  stepLabel: {
    color: MUTED_TEXT,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#D7DEE3',
    marginHorizontal: 8,
    marginBottom: 14,
  },
  firstStepsSection: {
    marginTop: 12,
    marginBottom: 18,
  },
  firstStepsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  firstStepColumn: {
    flex: 1,
    minWidth: 0,
  },
  firstStepEyebrowSlot: {
    minHeight: 17,
    justifyContent: 'flex-end',
    marginBottom: 6,
  },
  firstStepEyebrow: {
    color: GOLD,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.85,
  },
  staticRunningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staticRunningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    borderWidth: 1,
    borderColor: '#13743A',
    marginRight: 5,
  },
  staticRunningText: {
    color: GREEN,
    letterSpacing: 0.65,
  },
  firstStepCard: {
    paddingHorizontal: 10,
    minHeight: 132,
    height: 132,
  },
  firstStepFolderShell: {
    marginBottom: 0,
  },
  firstStepsExpanded: {
    marginTop: -1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    backgroundColor: WHITE,
    overflow: 'hidden',
  },
  startCard: {
    flex: 1,
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  startIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  startIconText: {
    color: NAVY,
    fontSize: 25,
    lineHeight: 27,
    fontWeight: '500',
  },
  startCopy: {
    flex: 1,
  },
  startEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  startTitle: {
    color: WHITE,
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  startSubtitle: {
    color: '#AFC2D2',
    fontSize: 9.5,
    lineHeight: 11,
    marginTop: 3,
  },
  startArrow: {
    color: GOLD,
    fontSize: 32,
    marginLeft: 8,
  },
  sectionLabel: {
    color: MUTED_TEXT,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.3,
    marginTop: 23,
    marginBottom: 8,
    marginLeft: 2,
  },
  folderShell: {
    backgroundColor: WHITE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DCE3E8',
    marginBottom: 12,
    overflow: 'hidden',
  },
  folderHeader: {
    minHeight: 91,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: WHITE,
  },
  folderHeaderCompact: {
    minHeight: 132,
    height: 132,
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  folderHeaderComplete: {
    backgroundColor: '#F8FCF9',
  },
  folderHeaderPhoto: {
    backgroundColor: '#F7FBFD',
  },
  folderGlyph: {
    width: 43,
    height: 39,
    marginRight: 11,
    justifyContent: 'flex-end',
  },
  folderGlyphCompact: {
    width: 30,
    height: 30,
    marginRight: 7,
  },
  folderGlyphComplete: {
    opacity: 0.92,
  },
  folderGlyphPhoto: {
    opacity: 0.94,
  },
  folderTab: {
    width: 22,
    height: 9,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    backgroundColor: GOLD,
    marginLeft: 3,
  },
  folderTabCompact: {
    width: 16,
    height: 7,
    marginLeft: 2,
  },
  folderBody: {
    position: 'absolute',
    bottom: 0,
    width: 41,
    height: 31,
    borderRadius: 7,
    backgroundColor: GOLD,
  },
  folderBodyCompact: {
    width: 29,
    height: 24,
    borderRadius: 6,
  },
  folderTabPhoto: {
    backgroundColor: '#35A3D2',
  },
  folderBodyPhoto: {
    backgroundColor: '#238BB9',
  },
  folderCopy: {
    flex: 1,
  },
  folderEyebrow: {
    color: '#9A6A13',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  folderEyebrowCompact: {
    fontSize: 6.5,
    letterSpacing: 0.65,
  },
  greenText: {
    color: GREEN,
  },
  blueText: {
    color: BLUE,
  },
  folderTitle: {
    color: NAVY,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  folderTitleCompact: {
    fontSize: 17,
    lineHeight: 20,
  },
  folderSubtitle: {
    color: MUTED_TEXT,
    fontSize: 11,
    marginTop: 3,
  },
  folderSubtitleCompact: {
    fontSize: 9.5,
    lineHeight: 11,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: '#FFF3D9',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeCompact: {
    minWidth: 23,
    height: 23,
    borderRadius: 12,
    paddingHorizontal: 5,
  },
  countBadgeComplete: {
    backgroundColor: '#DFF3E6',
  },
  countBadgePhoto: {
    backgroundColor: '#DCEFF7',
  },
  countText: {
    color: '#8A5C08',
    fontSize: 12,
    fontWeight: '900',
  },
  countTextCompact: {
    fontSize: 10,
  },
  countTextComplete: {
    color: GREEN,
  },
  countTextPhoto: {
    color: BLUE,
  },
  folderChevron: {
    color: NAVY,
    fontSize: 27,
    marginLeft: 8,
  },
  folderChevronCompact: {
    fontSize: 21,
    marginLeft: 4,
  },
  folderContent: {
    borderTopWidth: 1,
    borderTopColor: '#E4E9ED',
    backgroundColor: '#F7F9FA',
    padding: 11,
  },
  emptyState: {
    borderRadius: 13,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CDD6DD',
    padding: 15,
    backgroundColor: WHITE,
  },
  emptyTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '900',
  },
  emptyText: {
    color: MUTED_TEXT,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sessionCard: {
    backgroundColor: WHITE,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#D9E0E5',
    padding: 14,
    marginBottom: 10,
  },
  sessionIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionIdentityCell: {
    flex: 1,
    minWidth: 0,
  },
  sessionIdentityCellSmall: {
    width: 52,
  },
  sessionIdentityLabel: {
    color: MUTED_TEXT,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  sessionIdentityValue: {
    color: NAVY,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
  },
  sessionTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  endPill: {
    backgroundColor: '#FFF1CF',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  endPillText: {
    color: '#8A5C08',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sessionChevron: {
    color: NAVY,
    fontSize: 25,
    lineHeight: 25,
  },
  sessionTitle: {
    color: NAVY,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '900',
    marginTop: 9,
  },
  sessionMeta: {
    color: MUTED_TEXT,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E1E7EB',
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: GOLD,
  },
  progressText: {
    color: MUTED_TEXT,
    fontSize: 9,
    fontWeight: '900',
    marginLeft: 9,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 13,
  },
  continueButton: {
    flex: 1,
    minHeight: 43,
    borderRadius: 11,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  continueButtonText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '900',
  },
  deleteButton: {
    minHeight: 43,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E2A5A1',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  deleteButtonText: {
    color: '#B7463E',
    fontSize: 11,
    fontWeight: '900',
  },
  reviewSortBar: {
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6DFE5',
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 3,
    marginBottom: 10,
  },
  reviewSortLabel: {
    color: MUTED_TEXT,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
    paddingHorizontal: 6,
  },
  reviewSortButton: {
    flex: 1,
    minHeight: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  reviewSortButtonActive: {
    backgroundColor: NAVY,
  },
  reviewSortButtonText: {
    color: MUTED_TEXT,
    fontSize: 8,
    fontWeight: '900',
  },
  reviewSortButtonTextActive: {
    color: GOLD,
  },
  dateGroupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E3E8',
    backgroundColor: WHITE,
    overflow: 'hidden',
    marginBottom: 9,
  },
  dateGroupHeader: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#F3F7F8',
  },
  dateGroupCopy: {
    flex: 1,
  },
  dateHeading: {
    color: NAVY,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  dateGroupCount: {
    color: MUTED_TEXT,
    fontSize: 9,
    marginTop: 3,
  },
  dateGroupChevron: {
    color: GREEN,
    fontSize: 21,
    marginLeft: 8,
  },
  dateGroupContent: {
    borderTopWidth: 1,
    borderTopColor: '#DFE7EB',
    backgroundColor: '#F8FAFB',
    padding: 8,
  },
  completedCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE6D7',
    backgroundColor: WHITE,
    overflow: 'hidden',
    marginBottom: 9,
  },
  completedCardMain: {
    minHeight: 69,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  completedCheck: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#DFF3E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  completedCheckText: {
    color: GREEN,
    fontSize: 16,
    fontWeight: '900',
  },
  completedCopy: {
    flex: 1,
  },
  completedTitle: {
    color: NAVY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  completedMeta: {
    color: MUTED_TEXT,
    fontSize: 10,
    marginTop: 3,
  },
  completedArrow: {
    color: GREEN,
    fontSize: 25,
    marginLeft: 6,
  },
  archiveInlineButton: {
    minHeight: 36,
    borderTopWidth: 1,
    borderTopColor: '#E1E9E4',
    backgroundColor: '#F4F8F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveInlineButtonText: {
    color: '#4A6475',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  photoArchiveToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 9,
  },
  photoSegmentedControl: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CAD8E0',
    backgroundColor: WHITE,
    flexDirection: 'row',
    padding: 3,
  },
  photoSegmentButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoSegmentButtonActive: {
    backgroundColor: NAVY,
  },
  photoSegmentText: {
    color: MUTED_TEXT,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  photoSegmentTextActive: {
    color: GOLD,
  },
  exportAllPhotosButton: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  exportAllPhotosText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  photoArchiveHint: {
    color: MUTED_TEXT,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  photoGroupCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFDCE3',
    backgroundColor: WHITE,
    overflow: 'hidden',
    marginBottom: 9,
  },
  photoGroupHeader: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 9,
    paddingVertical: 10,
  },
  photoGroupHeaderMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  photoGroupIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#DCEFF7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  photoGroupIconText: {
    color: BLUE,
    fontSize: 18,
    fontWeight: '900',
  },
  photoGroupCopy: {
    flex: 1,
  },
  photoGroupTitle: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '900',
  },
  photoGroupMeta: {
    color: MUTED_TEXT,
    fontSize: 10,
    marginTop: 3,
  },
  photoGroupChevron: {
    color: NAVY,
    fontSize: 25,
    marginLeft: 7,
  },
  exportGroupHeaderButton: {
    minHeight: 34,
    borderRadius: 9,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    marginLeft: 6,
  },
  exportGroupHeaderButtonText: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
  photoGroupContent: {
    borderTopWidth: 1,
    borderTopColor: '#E1E8EC',
    backgroundColor: '#F4F7F9',
    padding: 9,
  },
  archivePhotoCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8E0E5',
    backgroundColor: WHITE,
    overflow: 'hidden',
    marginBottom: 9,
  },
  archivePhotoFrame: {
    height: 185,
    backgroundColor: '#D9E2E8',
    overflow: 'hidden',
  },
  archivePhotoImage: {
    width: '100%',
    height: '100%',
  },
  archivePhotoStamp: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,28,48,0.82)',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  archivePhotoStampText: {
    color: WHITE,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '700',
  },
  archivePhotoCopy: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  archivePhotoType: {
    color: BLUE,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.45,
  },
  archivePhotoFilename: {
    color: NAVY,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  archivePhotoMeta: {
    color: MUTED_TEXT,
    fontSize: 9,
    marginTop: 4,
  },
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,18,31,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  deleteModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E6B7B3',
    backgroundColor: WHITE,
    padding: 18,
  },
  deleteModalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE4E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalIconText: {
    color: '#B42318',
    fontSize: 22,
    fontWeight: '900',
  },
  deleteModalTitle: {
    color: NAVY,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '900',
    marginTop: 12,
  },
  deleteModalRecord: {
    color: '#B42318',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
  deleteModalBody: {
    color: '#526273',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 12,
  },
  deleteModalInstruction: {
    color: NAVY,
    fontSize: 11,
    fontWeight: '900',
    marginTop: 14,
  },
  deleteModalInput: {
    minHeight: 48,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#D3DCE3',
    backgroundColor: '#F8FAFB',
    color: NAVY,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.2,
    paddingHorizontal: 12,
    marginTop: 7,
  },
  deleteModalActions: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 14,
  },
  deleteModalCancel: {
    flex: 1,
    minHeight: 45,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CAD4DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalCancelText: {
    color: '#526273',
    fontSize: 10,
    fontWeight: '900',
  },
  deleteModalConfirm: {
    flex: 1.35,
    minHeight: 45,
    borderRadius: 11,
    backgroundColor: '#B42318',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteModalConfirmDisabled: {
    opacity: 0.38,
  },
  deleteModalConfirmText: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.35,
  },
});
