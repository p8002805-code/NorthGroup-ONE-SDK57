import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppBackButton from '../components/AppBackButton';

import {
  GOLD,
  NAVY,
  WHITE,
} from '../styles/styles';
import {
  getSE14CompletedDate,
  getSE14RequirementProgress,
  SE14_END_REQUIREMENTS,
} from '../utils/se14Records';
import {
  collectSE14Photos,
  exportSE14PhotoZip,
  groupSE14Photos,
  getSE14PhotoDateKey,
} from '../utils/se14PhotoStorage';

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

const groupCompletedByDate = (records) => {
  const groups = [];

  [...records]
    .sort(
      (left, right) =>
        getSE14CompletedDate(right).getTime() -
        getSE14CompletedDate(left).getTime()
    )
    .forEach((record) => {
      const date = getSE14CompletedDate(record);
      const key = dateKey(date);
      let group = groups.find((item) => item.key === key);

      if (!group) {
        group = {
          key,
          label: dateHeading(date),
          records: [],
        };
        groups.push(group);
      }

      group.records.push(record);
    });

  return groups;
};

const pmLabel = (value) => {
  const cleaned = String(value || '').trim();

  if (!cleaned) return 'PM —';
  return /^pm\s*/i.test(cleaned)
    ? cleaned.toUpperCase()
    : `PM ${cleaned}`;
};

const recordTitle = (record) => {
  const form = record?.data || {};
  const job = String(form.projectNumber || 'JOB —').trim();
  const session = String(form.sessionNumber || '—').trim();
  return `${job} · ${pmLabel(form.markId)} · SESSION ${session}`;
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

function FolderHeader({
  eyebrow,
  title,
  subtitle,
  count,
  open,
  onPress,
  tone = 'gold',
  compact = false,
}) {
  const completeTone = tone === 'green';
  const photoTone = tone === 'blue';

  return (
    <TouchableOpacity
      style={[
        styles.folderHeader,
        completeTone && styles.folderHeaderComplete,
        photoTone && styles.folderHeaderPhoto,
        compact && styles.folderHeaderCompact,
      ]}
      activeOpacity={0.84}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
    >
      <View
        style={[
          styles.folderGlyph,
          completeTone && styles.folderGlyphComplete,
          photoTone && styles.folderGlyphPhoto,
          compact && styles.folderGlyphCompact,
        ]}
      >
        <View
          style={[
            styles.folderTab,
            photoTone && styles.folderTabPhoto,
            compact && styles.folderTabCompact,
          ]}
        />
        <View
          style={[
            styles.folderBody,
            photoTone && styles.folderBodyPhoto,
            compact && styles.folderBodyCompact,
          ]}
        />
      </View>

      <View style={styles.folderCopy}>
        {eyebrow ? (
          <Text
            style={[
              styles.folderEyebrow,
              completeTone && styles.greenText,
              photoTone && styles.blueText,
              compact && styles.folderEyebrowCompact,
            ]}
          >
            {eyebrow}
          </Text>
        ) : null}

        <Text
          style={[
            styles.folderTitle,
            compact && styles.folderTitleCompact,
          ]}
          numberOfLines={compact ? 3 : undefined}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.folderSubtitle,
            compact && styles.folderSubtitleCompact,
          ]}
          numberOfLines={compact ? 1 : undefined}
          adjustsFontSizeToFit={compact}
          minimumFontScale={0.72}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={[
          styles.countBadge,
          completeTone && styles.countBadgeComplete,
          photoTone && styles.countBadgePhoto,
          compact && styles.countBadgeCompact,
        ]}
      >
        <Text
          style={[
            styles.countText,
            completeTone && styles.countTextComplete,
            photoTone && styles.countTextPhoto,
            compact && styles.countTextCompact,
          ]}
        >
          {count}
        </Text>
      </View>

      <Text
        style={[
          styles.folderChevron,
          compact && styles.folderChevronCompact,
        ]}
      >
        {open ? '⌄' : '›'}
      </Text>
    </TouchableOpacity>
  );
}

export default function SE14InProgressScreen({
  records = [],
  activeJob,
  startSession,
  openRecord,
  deleteRecord,
  goBack,
  backLabel = 'Forms',
}) {
  const insets = useSafeAreaInsets();
  const [endOpen, setEndOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [photoGrouping, setPhotoGrouping] = useState('pm');
  const [openPhotoGroups, setOpenPhotoGroups] = useState({});
  const [exportingKey, setExportingKey] = useState(null);

  useFocusEffect(
    useCallback(() => {
      setEndOpen(false);
      setCompleteOpen(false);
      setPhotosOpen(false);
      setOpenPhotoGroups({});
      setPhotoGrouping('pm');
    }, [])
  );

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
    () => groupCompletedByDate(completedSessions),
    [completedSessions]
  );

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

  const closePhotoStorage = () => {
    setPhotosOpen(false);
    setOpenPhotoGroups({});
  };

  const openSessionRecord = (recordId) => {
    closePhotoStorage();
    openRecord(recordId);
  };

  const leaveSessions = () => {
    closePhotoStorage();
    goBack();
  };

  const beginSession = () => {
    closePhotoStorage();
    startSession();
  };

  const exportPhotos = async (photos, scopeLabel, key) => {
    if (exportingKey) return;

    setExportingKey(key);

    try {
      await exportSE14PhotoZip({
        photos,
        jobNumber: activeJob?.number,
        scopeLabel,
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

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      <ImageBackground
        source={require('../../assets/topo-bg.png')}
        style={[styles.hero, { paddingTop: insets.top }]}
        imageStyle={styles.heroImage}
      >
        <View style={styles.heroShade} />

        <View style={styles.topRow}>
          <AppBackButton
            label={backLabel}
            onPress={leaveSessions}
            style={styles.topAction}
          />

          <Text style={styles.formCode}>SE-14 · GNSS</Text>

          <View style={styles.topAction} />
        </View>

        <Text style={styles.title}>GNSS Static Sessions</Text>

        <View style={styles.lockedJob}>
          <View style={styles.lockIcon}>
            <Text style={styles.lockIconText}>✓</Text>
          </View>

          <View style={styles.lockedJobCopy}>
            <Text style={styles.lockedLabel}>
              CURRENT JOB · LOCKED TO FORMS
            </Text>
            <Text style={styles.lockedNumber}>{jobNumber}</Text>
            <Text style={styles.lockedName} numberOfLines={1}>
              {jobName}
            </Text>
          </View>

          <Text style={styles.lockedStatus}>LOCKED</Text>
        </View>
      </ImageBackground>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 44 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.firstStepsSection}>
          <View style={styles.firstStepsRow}>
            <View style={styles.firstStepColumn}>
              <View style={styles.firstStepEyebrowSlot}>
                <Text
                  style={styles.firstStepEyebrow}
                  numberOfLines={1}
                >
                  ONE-TIME SETUP
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.startCard, styles.firstStepCard]}
                activeOpacity={0.86}
                onPress={beginSession}
                disabled={!activeJob}
              >
                <View style={styles.startIcon}>
                  <Text style={styles.startIconText}>＋</Text>
                </View>

                <View style={styles.startCopy}>
                  <Text style={styles.startTitle}>
                    1 · Start New Session
                  </Text>

                  <Text
                    style={styles.startSubtitle}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    Record setup, checks and start photos
                  </Text>
                </View>

                <Text style={styles.startArrow}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.firstStepColumn}>
              <View style={styles.firstStepEyebrowSlot}>
                {endSessions.length > 0 ? (
                  <StaticRunningIndicator />
                ) : null}
              </View>

              <View
                style={[
                  styles.folderShell,
                  styles.firstStepFolderShell,
                ]}
              >
                <FolderHeader
                  eyebrow={null}
                  title="2 · Ready to End Session"
                  subtitle="Open sessions waiting to be finished"
                  count={endSessions.length}
                  open={endOpen}
                  onPress={() =>
                    setEndOpen((current) => !current)
                  }
                  compact
                />
              </View>
            </View>
          </View>

          {endOpen ? (
            <View style={styles.firstStepsExpanded}>
              <View style={styles.folderContent}>
                {endSessions.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyTitle}>
                      No sessions waiting
                    </Text>
                    <Text style={styles.emptyText}>
                      Complete Start Session and it will move here
                      automatically.
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
                        onPress={() =>
                          openSessionRecord(record.id)
                        }
                      >
                        <View style={styles.sessionIdentityRow}>
                          <View style={styles.sessionIdentityCell}>
                            <Text style={styles.sessionIdentityLabel}>
                              JOB NUMBER
                            </Text>
                            <Text style={styles.sessionIdentityValue}>
                              {record.data.projectNumber || '—'}
                            </Text>
                          </View>

                          <View style={styles.sessionIdentityCell}>
                            <Text style={styles.sessionIdentityLabel}>
                              PM / MARK
                            </Text>
                            <Text style={styles.sessionIdentityValue}>
                              {pmLabel(record.data.markId)}
                            </Text>
                          </View>

                          <View
                            style={styles.sessionIdentityCellSmall}
                          >
                            <Text style={styles.sessionIdentityLabel}>
                              SESSION
                            </Text>
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
                                {
                                  width: `${Math.round(
                                    percent * 100
                                  )}%`,
                                },
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
            </View>
          ) : null}
        </View>

        <View style={styles.folderShell}>
          <FolderHeader
            eyebrow="OFFICE REVIEW"
            title="3 · Review and Complete"
            subtitle="Check, add data filenames, export or correct"
            count={completedSessions.length}
            open={completeOpen}
            onPress={() =>
              setCompleteOpen((current) => !current)
            }
            tone="green"
          />

          {completeOpen ? (
            <View style={styles.folderContent}>
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
                  <View key={group.key}>
                    <Text style={styles.dateHeading}>
                      {group.label}
                    </Text>

                    {group.records.map((record) => (
                      <TouchableOpacity
                        key={record.id}
                        style={styles.completedCard}
                        activeOpacity={0.82}
                        onPress={() =>
                          openSessionRecord(record.id)
                        }
                      >
                        <View style={styles.completedCheck}>
                          <Text style={styles.completedCheckText}>
                            ✓
                          </Text>
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
                    ))}
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.folderShell}>
          <FolderHeader
            eyebrow="FIELD PHOTO ARCHIVE"
            title="4 · Photo Storage"
            subtitle="Booking-sheet photos, stamps and metadata"
            count={storedPhotos.length}
            open={photosOpen}
            onPress={() => {
              if (photosOpen) {
                closePhotoStorage();
              } else {
                setPhotosOpen(true);
              }
            }}
            tone="blue"
          />

          {photosOpen ? (
            <View style={styles.folderContent}>
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
        </View>
      </ScrollView>
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
    width: 112,
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
  dateHeading: {
    color: MUTED_TEXT,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    marginTop: 5,
    marginBottom: 7,
    marginLeft: 2,
  },
  completedCard: {
    minHeight: 69,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CFE6D7',
    backgroundColor: WHITE,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 9,
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
});
