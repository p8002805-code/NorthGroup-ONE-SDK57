import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppCard from '../../../components/AppCard';
import AppStatusPill from '../../../components/AppStatusPill';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  loadSharedJobProgress,
  mergeJobTasksIntoProgress,
  normaliseProgressTask,
  progressLayerPathKey,
  saveSharedJobProgress,
  sortProgressTasks,
  syncSuggestedJobProgress,
  updateProgressTaskAmount,
} from '../jobProgressService';
import { reportDevelopmentError } from '../../../services/security/securityLogger';
import { loadSharedKml } from '../../kml/kmlService';
import { publishProgressCompletions } from '../progressCompletionService';
import ProgressTaskRow from './ProgressTaskRow';

const EMPTY_PROGRESS = {
  tasks: [],
  updatedAt: '',
  updatedBy: '',
  itemId: '',
  eTag: '',
  storageScope: 'app-data',
};

const formatAmount = (value) => Number(value || 0).toLocaleString('en-AU', {
  maximumFractionDigits: 2,
});

const formatUpdatedAt = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const taskComplete = (task) => Number(task?.completed || 0) >= Number(task?.target || 0);

const taskRatio = (task) => {
  const target = Number(task?.target || 0);
  if (!(target > 0)) return 0;
  return Math.min(1, Math.max(0, Number(task?.completed || 0) / target));
};

function ProgressTaskEditor({
  visible,
  draft,
  saving,
  error,
  kmlLayers,
  kmlLoading,
  kmlError,
  creating = false,
  manual = false,
  onChange,
  onClose,
  onDelete,
  onSave,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const completed = Number(draft.completed || 0);
  const target = Number(draft.target || 0);
  const previewComplete = target > 0 && completed >= target;
  const selectedLayerKey = progressLayerPathKey(draft.kmlLayerPath);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.editorKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.editorShade}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={Keyboard.dismiss} />
          <View style={[styles.editorSheet, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={styles.editorHandle} />
            <View style={styles.editorHeader}>
              <View style={styles.editorTitleCopy}>
                <Text style={styles.eyebrow}>SHARED JOB PROGRESS</Text>
                <Text style={styles.editorTitle}>{creating ? 'Add progress section' : 'Update progress'}</Text>
              </View>
              <Pressable
                style={styles.editorClose}
                onPress={onClose}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel="Close task editor"
              >
                <Ionicons name="close" size={22} color={colors.bodyText} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              bounces={false}
              showsVerticalScrollIndicator
              contentContainerStyle={styles.editorContent}
            >
              <Text style={styles.editorSectionLabel}>1 · TASK</Text>
              <Text style={styles.editorLabel}>TASK NAME</Text>
              {creating || manual ? (
                <>
                  <TextInput
                    value={draft.name || ''}
                    onChangeText={(name) => onChange((current) => ({ ...current, name }))}
                    editable={!saving}
                    style={styles.editorInput}
                    placeholder="e.g. Install control"
                    placeholderTextColor={colors.placeholderText}
                    autoCapitalize="sentences"
                    returnKeyType="done"
                  />
                  <Text style={styles.editorTaskNameHelp}>
                    This is a manual progress section and is shared with everyone on the job.
                  </Text>
                </>
              ) : (
                <View style={styles.editorTaskNameCard}>
                  <Text style={styles.editorTaskName} numberOfLines={2}>{draft.name}</Text>
                  <Text style={styles.editorTaskNameHelp}>
                    This title follows its Job Details section automatically.
                  </Text>
                </View>
              )}

              <Text style={styles.editorSectionLabel}>2 · COUNT</Text>
              <View style={styles.editorCountRow}>
                <View style={styles.editorCountField}>
                  <Text style={styles.editorLabel}>COMPLETED</Text>
                  <TextInput
                    value={String(draft.completed ?? '')}
                    onChangeText={(value) => onChange((current) => ({
                      ...current,
                      completed: value.replace(/[^0-9.]/g, ''),
                    }))}
                    editable={!saving}
                    style={styles.editorInput}
                    placeholder="0"
                    placeholderTextColor={colors.placeholderText}
                    keyboardType="decimal-pad"
                  />
                </View>
                <Text style={styles.editorCountDivider}>/</Text>
                <View style={styles.editorCountField}>
                  <Text style={styles.editorLabel}>TARGET</Text>
                  <TextInput
                    value={String(draft.target ?? '')}
                    onChangeText={(value) => onChange((current) => ({
                      ...current,
                      target: value.replace(/[^0-9.]/g, ''),
                    }))}
                    editable={!saving}
                    style={styles.editorInput}
                    placeholder="10"
                    placeholderTextColor={colors.placeholderText}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.editorLabel}>UNIT (OPTIONAL)</Text>
              <TextInput
                value={draft.unit || ''}
                onChangeText={(unit) => onChange((current) => ({ ...current, unit }))}
                editable={!saving}
                style={styles.editorInput}
                placeholder="km, sites, sessions, signs…"
                placeholderTextColor={colors.placeholderText}
                autoCapitalize="none"
              />

              <Text style={styles.editorSectionLabel}>3 · LINKED KML LAYER</Text>
              <Text style={styles.editorHelp}>
                Optional. When this task reaches its target, this entire KML layer is hidden for the crew. Reopening the task shows it again.
              </Text>
              <Pressable
                style={[
                  styles.layerChoice,
                  !selectedLayerKey && styles.layerChoiceSelected,
                ]}
                onPress={() => onChange((current) => ({
                  ...current,
                  kmlLayerPath: [],
                  kmlLayerName: '',
                }))}
                disabled={saving}
              >
                <Ionicons
                  name={!selectedLayerKey ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={!selectedLayerKey ? colors.accentDark : colors.supportingText}
                />
                <Text style={styles.layerChoiceText}>No linked layer</Text>
              </Pressable>
              {kmlLoading ? (
                <View style={styles.layerLoading}>
                  <ActivityIndicator size="small" color={colors.accentDark} />
                  <Text style={styles.layerLoadingText}>Reading the job’s KML folders…</Text>
                </View>
              ) : (kmlLayers || []).map((layer) => {
                const layerKey = progressLayerPathKey(layer.path);
                const selected = selectedLayerKey === layerKey;
                return (
                  <Pressable
                    key={layerKey || layer.id}
                    style={[styles.layerChoice, selected && styles.layerChoiceSelected]}
                    onPress={() => onChange((current) => ({
                      ...current,
                      kmlLayerPath: [...(layer.path || [])],
                      kmlLayerName: layer.name,
                    }))}
                    disabled={saving}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? colors.accentDark : colors.supportingText}
                    />
                    <View style={styles.layerChoiceCopy}>
                      <Text style={styles.layerChoiceText}>{layer.name}</Text>
                      <Text style={styles.layerChoicePath} numberOfLines={1}>
                        {(layer.path || []).join(' › ')} · {layer.featureCount || 0} features
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
              {!kmlLoading && kmlError ? <Text style={styles.layerError}>{kmlError}</Text> : null}

              <Text style={styles.editorSectionLabel}>4 · COMPLETION</Text>
              <View style={[
                styles.completionPreview,
                previewComplete && styles.completionPreviewComplete,
              ]}>
                <Ionicons
                  name={previewComplete ? 'checkmark-circle' : 'time-outline'}
                  size={22}
                  color={previewComplete ? colors.success : colors.accentDark}
                />
                <View style={styles.completionPreviewCopy}>
                  <Text style={styles.completionPreviewTitle}>
                    {previewComplete ? 'Task complete' : 'Completes automatically at target'}
                  </Text>
                  <Text style={styles.completionPreviewText}>
                    {formatAmount(completed)}/{formatAmount(target || 0)}
                    {draft.unit ? ` ${String(draft.unit).trim()}` : ''}
                  </Text>
                </View>
              </View>

              {error ? <Text style={styles.editorError}>{error}</Text> : null}

              {!creating && manual ? (
                <Pressable
                  style={({ pressed }) => [styles.editorDelete, pressed && styles.pressed]}
                  onPress={onDelete}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="Remove this progress section"
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                  <Text style={styles.editorDeleteText}>Remove progress section</Text>
                </Pressable>
              ) : null}

            </ScrollView>

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
                <Text style={styles.editorSaveText}>{saving ? 'Saving…' : creating ? 'Add to job' : 'Save for job'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function JobProgressSection({
  job,
  active = true,
  expanded = false,
  getAccessToken,
  updatedBy,
  sourceSections = null,
  refreshRequest = null,
  celebrationFocus = null,
  onCelebrationReady,
  onNotificationsAdded,
  onTaskCompleted,
  onToggle,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const requestRef = useRef(false);
  const kmlRequestRef = useRef(false);
  const celebrationHandledRef = useRef('');
  const [progress, setProgress] = useState(EMPTY_PROGRESS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState('');
  const [draft, setDraft] = useState({
    name: '', completed: '0', target: '1', unit: '', sourceSectionId: '', completedAt: '',
    kmlLayerPath: [], kmlLayerName: '', manual: false,
  });
  const [editorError, setEditorError] = useState('');
  const [kmlLayers, setKmlLayers] = useState([]);
  const [kmlLoading, setKmlLoading] = useState(false);
  const [kmlLoaded, setKmlLoaded] = useState(false);
  const [kmlError, setKmlError] = useState('');
  const hasJob = Boolean(job?.number);
  const sectionsReady = Array.isArray(sourceSections);

  const refresh = useCallback(async ({ quiet = false } = {}) => {
    if (
      !hasJob
      || !sectionsReady
      || typeof getAccessToken !== 'function'
      || requestRef.current
      || saving
      || editorOpen
    ) return;
    requestRef.current = true;
    if (!quiet) setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const shared = await loadSharedJobProgress({ accessToken, job });
      const nextProgress = await syncSuggestedJobProgress({
        accessToken,
        job,
        shared,
        suggestedTasks: sourceSections,
        authoritative: true,
        updatedBy,
      });
      setProgress(nextProgress);
      setError('');
    } catch (loadError) {
      if (!quiet) {
        setError(loadError?.message || 'Shared Job Progress could not be loaded.');
      }
    } finally {
      requestRef.current = false;
      if (!quiet) setLoading(false);
    }
  }, [editorOpen, getAccessToken, hasJob, job, saving, sectionsReady, sourceSections, updatedBy]);

  useEffect(() => {
    setProgress(EMPTY_PROGRESS);
    setError('');
    setKmlLayers([]);
    setKmlLoaded(false);
    setKmlError('');
    celebrationHandledRef.current = '';
    setEditorOpen(false);
    setEditingTaskId('');
  }, [job?.number]);

  useEffect(() => {
    if (!active) return undefined;
    refresh();
    const interval = setInterval(() => refresh({ quiet: true }), 45000);
    return () => clearInterval(interval);
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !refreshRequest?.requestId) return undefined;
    refresh();
    return undefined;
  }, [active, refresh, refreshRequest?.requestId]);

  const loadKmlLayers = useCallback(async () => {
    if (!hasJob || typeof getAccessToken !== 'function' || kmlRequestRef.current) return;
    kmlRequestRef.current = true;
    setKmlLoading(true);
    setKmlError('');
    try {
      const accessToken = await getAccessToken();
      const kml = await loadSharedKml({ accessToken, job });
      setKmlLayers((kml.layers || []).filter((layer) => !layer.isRoot && layer.featureCount > 0));
    } catch (loadError) {
      setKmlError(loadError?.message || 'KML layers could not be loaded.');
    } finally {
      kmlRequestRef.current = false;
      setKmlLoaded(true);
      setKmlLoading(false);
    }
  }, [getAccessToken, hasJob, job]);

  useEffect(() => {
    if (editorOpen && !kmlLoaded && !kmlLoading) loadKmlLayers();
  }, [editorOpen, kmlLoaded, kmlLoading, loadKmlLayers]);

  const commitTasks = useCallback(async (tasks) => {
    if (!hasJob || saving || typeof getAccessToken !== 'function') return false;
    const previousTasks = progress.tasks;
    setSaving(true);
    setError('');
    setEditorError('');
    try {
      const accessToken = await getAccessToken();
      const saved = await saveSharedJobProgress({
        accessToken,
        job,
        tasks: mergeJobTasksIntoProgress(tasks, sourceSections, { authoritative: true }),
        updatedBy,
        itemId: progress.itemId,
        eTag: progress.eTag,
        storageScope: progress.storageScope,
      });
      setProgress(saved);

      try {
        const published = await publishProgressCompletions({
          previousTasks,
          nextProgress: saved,
          job,
        });
        if (published.addedCount > 0) await onNotificationsAdded?.(published.addedCount);
        if (published.events.length) onTaskCompleted?.(published.events[0]);
      } catch (completionError) {
        reportDevelopmentError('Could not publish the progress completion celebration', completionError);
      }
      return true;
    } catch (saveError) {
      if (saveError?.latest) setProgress(saveError.latest);
      const message = saveError?.message || 'Shared Job Progress could not be saved.';
      setError(message);
      setEditorError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [
    getAccessToken,
    hasJob,
    job,
    onNotificationsAdded,
    onTaskCompleted,
    progress.eTag,
    progress.itemId,
    progress.storageScope,
    progress.tasks,
    saving,
    sourceSections,
    updatedBy,
  ]);

  const openEditTask = useCallback((task) => {
    setEditingTaskId(task.id);
    setDraft({
      name: task.name,
      completed: String(task.completed),
      target: String(task.target),
      unit: task.unit,
      sourceSectionId: task.sourceSectionId || '',
      completedAt: task.completedAt || '',
      kmlLayerPath: [...(task.kmlLayerPath || [])],
      kmlLayerName: task.kmlLayerName || '',
      manual: task.manual === true,
    });
    setEditorError('');
    setEditorOpen(true);
  }, []);

  const openAddTask = useCallback(() => {
    setEditingTaskId('');
    setDraft({
      name: '',
      completed: '0',
      target: '1',
      unit: '',
      sourceSectionId: '',
      completedAt: '',
      kmlLayerPath: [],
      kmlLayerName: '',
      manual: true,
    });
    setEditorError('');
    setEditorOpen(true);
  }, []);

  const closeEditor = useCallback(() => {
    if (saving) return;
    Keyboard.dismiss();
    setEditorOpen(false);
    setEditingTaskId('');
    setEditorError('');
  }, [saving]);

  const saveEditor = useCallback(async () => {
    const currentTask = editingTaskId
      ? progress.tasks.find((task) => task.id === editingTaskId)
      : null;
    const creating = !editingTaskId;
    const name = String(draft.name || '').replace(/\s+/g, ' ').trim();
    const target = Number(draft.target);
    const completed = Number(draft.completed || 0);

    if (!creating && !currentTask) {
      setEditorError('This progress section is no longer available.');
      return;
    }
    if ((creating || currentTask?.manual === true) && !name) {
      setEditorError('Enter a name for this progress section.');
      return;
    }
    if (!Number.isFinite(target) || target <= 0) {
      setEditorError('Enter a target greater than zero.');
      return;
    }
    if (!Number.isFinite(completed) || completed < 0) {
      setEditorError('Completed progress cannot be below zero.');
      return;
    }

    const duplicateName = progress.tasks.some((task) => (
      task.id !== editingTaskId
      && String(task.name || '').replace(/\s+/g, ' ').trim().toLowerCase() === name.toLowerCase()
    ));
    if ((creating || currentTask?.manual === true) && duplicateName) {
      setEditorError('A progress section with this name already exists.');
      return;
    }

    const configuredTask = normaliseProgressTask({
      ...(currentTask || {}),
      name: creating || currentTask?.manual === true ? name : currentTask?.name,
      target,
      unit: draft.unit,
      sourceSectionId: creating ? '' : draft.sourceSectionId,
      manual: creating || currentTask?.manual === true,
      completedAt: draft.completedAt,
      kmlLayerPath: draft.kmlLayerPath,
      kmlLayerName: draft.kmlLayerName,
    });
    const nextTask = updateProgressTaskAmount(configuredTask, completed);
    const nextTasks = creating
      ? [...progress.tasks, nextTask]
      : progress.tasks.map((task) => (task.id === editingTaskId ? nextTask : task));

    if (await commitTasks(nextTasks)) closeEditor();
  }, [closeEditor, commitTasks, draft, editingTaskId, progress.tasks]);

  const deleteManualTask = useCallback(() => {
    const currentTask = progress.tasks.find((task) => task.id === editingTaskId);
    if (!currentTask?.manual || saving) return;
    Alert.alert(
      'Remove progress section?',
      `${currentTask.name} will be removed from the shared Job Progress for everyone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (await commitTasks(progress.tasks.filter((task) => task.id !== editingTaskId))) {
              closeEditor();
            }
          },
        },
      ],
    );
  }, [closeEditor, commitTasks, editingTaskId, progress.tasks, saving]);

  const changeAmount = useCallback((task, delta) => {
    const completed = Math.min(
      task.target,
      Math.max(0, Math.round((Number(task.completed) + delta) * 100) / 100),
    );
    commitTasks(progress.tasks.map((item) => (
      item.id === task.id ? updateProgressTaskAmount(item, completed) : item
    )));
  }, [commitTasks, progress.tasks]);

  const toggleComplete = useCallback((task) => {
    const completed = taskComplete(task) ? 0 : task.target;
    commitTasks(progress.tasks.map((item) => (
      item.id === task.id ? updateProgressTaskAmount(item, completed) : item
    )));
  }, [commitTasks, progress.tasks]);

  useEffect(() => {
    const requestId = String(celebrationFocus?.requestId || '').trim();
    const taskId = String(celebrationFocus?.taskId || '').trim();
    if (!expanded || !requestId || !taskId || celebrationHandledRef.current === requestId) return;
    const task = progress.tasks.find((item) => item.id === taskId);
    if (!task || !taskComplete(task)) return;

    celebrationHandledRef.current = requestId;
    onCelebrationReady?.({
      ...celebrationFocus,
      task,
      taskId: task.id,
      taskName: celebrationFocus?.taskName || task.name,
      completed: celebrationFocus?.completed ?? task.completed,
      target: celebrationFocus?.target ?? task.target,
      unit: celebrationFocus?.unit || task.unit,
    });
  }, [celebrationFocus, expanded, onCelebrationReady, progress.tasks]);

  const completeCount = progress.tasks.filter(taskComplete).length;
  const overallRatio = progress.tasks.length
    ? progress.tasks.reduce((total, task) => total + taskRatio(task), 0) / progress.tasks.length
    : 0;
  const updatedAt = formatUpdatedAt(progress.updatedAt);
  const sortedTasks = useMemo(() => sortProgressTasks(progress.tasks), [progress.tasks]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionLabel}>JOB PROGRESS</Text>
        <View style={styles.sectionHeadingActions}>
          <Text style={styles.sectionHint}>Shared with this job</Text>
          <Pressable
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
            onPress={() => refresh()}
            disabled={loading || saving || !hasJob}
            accessibilityRole="button"
            accessibilityLabel="Refresh shared Job Progress"
          >
            <Ionicons name="refresh" size={15} color={colors.accentDark} />
          </Pressable>
        </View>
      </View>

      <AppCard style={styles.progressCard} padding="none">
        <Pressable
          style={({ pressed }) => [
            styles.progressHeader,
            pressed && styles.progressHeaderPressed,
          ]}
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${expanded ? 'Collapse' : 'Expand'} Job Progress`}
        >
          <View style={styles.progressIcon}>
            <Ionicons name="trending-up" size={21} color={colors.accentDark} />
          </View>
          <View style={styles.progressTitleCopy}>
            <Text style={styles.eyebrow}>LIVE JOB STATUS</Text>
            <Text style={styles.progressTitle}>Progress</Text>
          </View>
          {loading ? <ActivityIndicator size="small" color={colors.accentDark} /> : (
            <AppStatusPill
              label={progress.tasks.length ? `${completeCount}/${progress.tasks.length} COMPLETE` : 'SET UP'}
              tone={progress.tasks.length && completeCount === progress.tasks.length ? 'success' : 'accent'}
            />
          )}
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={17}
            color={colors.supportingText}
            style={styles.progressChevron}
          />
        </Pressable>

        {progress.tasks.length ? (
          <View style={styles.overallTrack}>
            <View style={[styles.overallFill, { width: `${Math.round(overallRatio * 100)}%` }]} />
          </View>
        ) : null}

        {expanded && progress.tasks.length ? (
          <>
            <View style={styles.taskList}>
              {sortedTasks.map((task) => (
                <ProgressTaskRow
                  key={task.id}
                  task={task}
                  disabled={saving}
                  celebration={celebrationFocus}
                  onChangeAmount={changeAmount}
                  onEdit={openEditTask}
                  onToggleComplete={toggleComplete}
                />
              ))}
            </View>
          </>
        ) : expanded ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-outline" size={26} color={colors.accentDark} />
            <Text style={styles.emptyTitle}>No progress sections yet</Text>
            <Text style={styles.emptyText}>
              Add one here, or create a Job Details section and it will appear automatically.
            </Text>
          </View>
        ) : null}

        {expanded ? (
          <View style={styles.addProgressWrap}>
            <Pressable
              style={({ pressed }) => [
                styles.addProgressButton,
                pressed && styles.addProgressButtonPressed,
                (saving || !hasJob) && styles.addProgressButtonDisabled,
              ]}
              onPress={openAddTask}
              disabled={saving || !hasJob}
              accessibilityRole="button"
              accessibilityLabel="Add another progress section"
            >
              <View style={styles.addProgressIcon}>
                <Ionicons name="add" size={20} color={colors.navy} />
              </View>
              <View style={styles.addProgressCopy}>
                <Text style={styles.addProgressTitle}>Add progress section</Text>
                <Text style={styles.addProgressText}>Track another activity for this job</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.accentDark} />
            </Pressable>
          </View>
        ) : null}

        {expanded && error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {expanded ? <View style={styles.progressFooter}>
          <Text style={styles.updatedText} numberOfLines={2}>
            {updatedAt
              ? `Updated ${updatedAt}${progress.updatedBy ? ` by ${progress.updatedBy}` : ''}`
              : 'No shared progress has been added yet.'}
          </Text>
          <Text style={styles.progressSourceText}>JOB DETAILS + MANUAL</Text>
        </View> : null}
      </AppCard>

      <ProgressTaskEditor
        visible={editorOpen}
        draft={draft}
        saving={saving}
        error={editorError}
        kmlLayers={kmlLayers}
        kmlLoading={kmlLoading}
        kmlError={kmlError}
        creating={!editingTaskId}
        manual={draft.manual === true}
        onChange={setDraft}
        onClose={closeEditor}
        onDelete={deleteManualTask}
        onSave={saveEditor}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  section: {
    marginTop: 0,
  },
  sectionHeading: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  sectionLabel: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  sectionHeadingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionHint: {
    color: colors.supportingText,
    fontSize: 9,
    fontWeight: '700',
  },
  refreshButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  progressCard: {
    overflow: 'hidden',
    borderColor: colors.divider,
  },
  progressHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  progressHeaderPressed: {
    opacity: 0.76,
  },
  progressChevron: {
    marginLeft: SPACING.sm,
  },
  progressIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  progressTitleCopy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
  },
  progressTitle: {
    color: colors.bodyText,
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    marginTop: 2,
  },
  overallTrack: {
    height: 4,
    marginHorizontal: SPACING.lg,
    overflow: 'hidden',
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  overallFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.success,
  },
  taskList: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xl,
  },
  emptyTitle: {
    color: colors.bodyText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
    textAlign: 'center',
  },
  addProgressWrap: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  addProgressButton: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.accentDark,
    backgroundColor: colors.warningBackground,
  },
  addProgressButtonPressed: {
    opacity: 0.76,
    transform: [{ scale: 0.995 }],
  },
  addProgressButtonDisabled: {
    opacity: 0.52,
  },
  addProgressIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.accent,
  },
  addProgressCopy: {
    flex: 1,
    minWidth: 0,
  },
  addProgressTitle: {
    color: colors.bodyText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  addProgressText: {
    color: colors.supportingText,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    backgroundColor: colors.dangerBackground,
  },
  errorText: {
    flex: 1,
    color: colors.statusDangerText,
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '700',
    marginLeft: 6,
  },
  progressFooter: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  updatedText: {
    flex: 1,
    color: colors.supportingText,
    fontSize: 8.5,
    lineHeight: 13,
    fontWeight: '700',
    paddingRight: SPACING.sm,
  },
  progressSourceText: {
    color: colors.accentDark,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  pressed: {
    opacity: 0.68,
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
    maxHeight: '88%',
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
  editorContent: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  editorSectionLabel: {
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  editorLabel: {
    color: colors.supportingText,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  editorHelp: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: SPACING.sm,
  },
  layerChoice: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    marginBottom: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
  },
  layerChoiceSelected: {
    borderColor: colors.accentDark,
    backgroundColor: colors.warningBackground,
  },
  layerChoiceCopy: {
    flex: 1,
    minWidth: 0,
  },
  layerChoiceText: {
    color: colors.bodyText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  layerChoicePath: {
    color: colors.supportingText,
    fontSize: 8.5,
    lineHeight: 12,
    marginTop: 2,
  },
  layerLoading: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  layerLoadingText: {
    color: colors.supportingText,
    fontSize: 10,
    fontWeight: '700',
  },
  layerError: {
    color: colors.statusDangerText,
    fontSize: 9,
    lineHeight: 14,
    marginTop: SPACING.xs,
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
  editorTaskNameCard: {
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raisedSurface,
  },
  editorTaskName: {
    color: colors.bodyText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
  },
  editorTaskNameHelp: {
    color: colors.supportingText,
    fontSize: 8.5,
    lineHeight: 12,
    fontWeight: '700',
    marginTop: 3,
  },
  editorCountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  editorCountField: {
    flex: 1,
  },
  editorCountDivider: {
    color: colors.supportingText,
    fontSize: 21,
    fontWeight: '800',
    paddingHorizontal: SPACING.sm,
    paddingBottom: 11,
  },
  completionPreview: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: colors.warningBackground,
  },
  completionPreviewComplete: {
    borderColor: colors.success,
    backgroundColor: colors.successBackground,
  },
  completionPreviewCopy: {
    flex: 1,
    minWidth: 0,
    marginLeft: SPACING.sm,
  },
  completionPreviewTitle: {
    color: colors.bodyText,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
  },
  completionPreviewText: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  editorError: {
    color: colors.danger,
    fontSize: 10,
    lineHeight: 15,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  editorDelete: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 7,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBackground,
  },
  editorDeleteText: {
    color: colors.danger,
    fontSize: 10,
    fontWeight: '900',
  },
  editorActions: {
    flexDirection: 'row',
    columnGap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
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
