import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppCard from '../../../components/AppCard';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import { reportDevelopmentError } from '../../../services/security/securityLogger';
import {
  listFolderItems,
  listJobFiles,
  uploadJobFile,
} from '../../jobFiles/jobFilesService';
import { isTrustedJobFileWebUrl } from '../../jobFiles/jobFilesRules';
import { BriefDisplay, BriefEditor } from './DailyBriefSection';
import { HubBubble, SectionBlock } from './JobDetailsHubCards';
import JobDetailsHubHeader from './JobDetailsHubHeader';
import {
  loadSharedJobDetailsHub,
  loadSharedJobDetailsSection,
  saveSharedJobDetailsHub,
  saveSharedJobDetailsSection,
} from '../jobDetailsHubService';
import {
  buildActiveJobDetailsSections,
  createJobDetailsSection,
  isTmrJob,
  jobDetailsSectionHasContent,
  normaliseJobDetailsFileReference,
  normaliseJobDetailsManifest,
  renameJobDetailsSection,
} from '../jobDetailsHubRules';
import { useJobDetailsSectionHighlight } from '../hooks/useJobDetailsSectionHighlight';

const formatUpdated = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatFileSize = (value) => {
  const bytes = Number(value) || 0;
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
};

const emptyDraft = () => ({
  title: '',
  brief: '',
  requirements: '',
  procedures: '',
  files: [],
});

function TmrFeatureLibraryAction({ onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [styles.featureLibraryButton, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open the TMR Feature Library"
    >
      <View style={styles.featureLibraryIcon}>
        <Ionicons name="library-outline" size={20} color={colors.accentDark} />
      </View>
      <View style={styles.featureLibraryCopy}>
        <Text style={styles.featureLibraryEyebrow}>TMR FIELD REFERENCE</Text>
        <Text style={styles.featureLibraryTitle}>Feature Library</Text>
        <Text style={styles.featureLibraryDetail}>Search codes, pickup methods and example photos.</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={colors.accentDark} />
    </Pressable>
  );
}

function LinkedFile({ file, editable = false, onOpen, onRemove }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const subtitle = [file.parentPath, formatFileSize(file.size)].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ pressed }) => [styles.fileRow, pressed && styles.pressed]}
      onPress={() => onOpen?.(file)}
      disabled={editable}
      accessibilityRole={editable ? undefined : 'button'}
    >
      <View style={styles.fileIcon}>
        <Ionicons name="document-text-outline" size={18} color={colors.accentDark} />
      </View>
      <View style={styles.fileCopy}>
        <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
        {subtitle ? <Text style={styles.fileMeta} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {editable ? (
        <Pressable
          style={styles.removeFileButton}
          onPress={() => onRemove?.(file)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${file.name}`}
        >
          <Ionicons name="close" size={17} color={colors.danger} />
        </Pressable>
      ) : (
        <Ionicons name="open-outline" size={17} color={colors.accentDark} />
      )}
    </Pressable>
  );
}

function FullScreenHeader({ eyebrow, title, onBack, actionLabel, onAction, actionDisabled }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.screenHeader}>
      <Pressable
        style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={22} color={colors.bodyText} />
      </Pressable>
      <View style={styles.screenHeaderCopy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.screenTitle} numberOfLines={1}>{title}</Text>
      </View>
      {actionLabel ? (
        <Pressable
          style={({ pressed }) => [
            styles.headerAction,
            pressed && !actionDisabled && styles.pressed,
            actionDisabled && styles.disabled,
          ]}
          onPress={onAction}
          disabled={actionDisabled}
          accessibilityRole="button"
        >
          <Text style={styles.headerActionText}>{actionLabel}</Text>
        </Pressable>
      ) : <View style={styles.headerButton} />}
    </View>
  );
}

export default function JobDetailsHub({
  job,
  active = true,
  expanded = false,
  standalone = false,
  onToggle,
  focusRequest = null,
  getAccessToken,
  updatedBy,
  legacyBrief,
  legacyBriefLoading = false,
  legacyBriefError = '',
  taskNames = [],
  sourceLabel = '',
  onBriefSaved,
  onProgressSectionsChange,
  openJobFiles,
  openTmrFeatureGuide,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const manifestRequestRef = useRef(0);
  const sectionRequestRef = useRef(0);
  const editorScrollRef = useRef(null);
  const defaultManifest = useMemo(
    () => normaliseJobDetailsManifest({ jobNumber: job?.number }),
    [job?.number],
  );
  const [manifest, setManifest] = useState(defaultManifest);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [manifestReady, setManifestReady] = useState(false);
  const [manifestJobNumber, setManifestJobNumber] = useState('');
  const [manifestError, setManifestError] = useState('');
  const [manifestSaving, setManifestSaving] = useState(false);
  const [overviewDocument, setOverviewDocument] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);
  const [sectionDocument, setSectionDocument] = useState(null);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionError, setSectionError] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addSectionError, setAddSectionError] = useState('');
  const [filePickerOpen, setFilePickerOpen] = useState(false);
  const [fileLocation, setFileLocation] = useState(null);
  const [fileItems, setFileItems] = useState([]);
  const [fileTrail, setFileTrail] = useState([]);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileUploading, setFileUploading] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [focusFilesOnEdit, setFocusFilesOnEdit] = useState(false);

  const overviewBriefText = String(
    overviewDocument?.brief
    || overviewDocument?.dailyBriefs?.[0]?.text
    || legacyBrief?.details
    || job?.details
    || '',
  ).trim();
  const activeSections = useMemo(() => buildActiveJobDetailsSections({
    sections: manifest.sections,
    taskNames,
    taskNotes: [job?.details, overviewBriefText].filter(Boolean).join('\n'),
  }), [job?.details, manifest.sections, overviewBriefText, taskNames]);
  const archivedSections = useMemo(
    () => manifest.sections.filter((section) => section.archived && !section.builtIn),
    [manifest.sections],
  );
  const currentFileFolder = fileTrail[fileTrail.length - 1] || fileLocation?.folder || null;

  const highlightedSectionId = useJobDetailsSectionHighlight({
    active,
    expanded,
    focusRequest,
    manifestReady,
    activeSections,
    jobNumber: job?.number,
  });

  useEffect(() => {
    if (
      !manifestReady
      || manifestJobNumber !== String(job?.number || '')
      || typeof onProgressSectionsChange !== 'function'
    ) return;
    onProgressSectionsChange(activeSections
      .filter((section) => section.id !== 'overview')
      .map((section) => ({ id: section.id, title: section.title, order: section.order })));
  }, [activeSections, job?.number, manifestJobNumber, manifestReady, onProgressSectionsChange]);

  const loadManifest = useCallback(async () => {
    const requestId = manifestRequestRef.current + 1;
    manifestRequestRef.current = requestId;
    setManifestError('');
    if (!job?.number || typeof getAccessToken !== 'function') {
      setManifest(defaultManifest);
      setOverviewDocument(null);
      setManifestReady(true);
      setManifestJobNumber(String(job?.number || ''));
      setManifestLoading(false);
      return;
    }

    setManifestLoading(true);
    try {
      const accessToken = await getAccessToken();
      const [remote, remoteOverview] = await Promise.all([
        loadSharedJobDetailsHub({ accessToken, job }),
        loadSharedJobDetailsSection({
          accessToken,
          job,
          section: defaultManifest.sections[0],
        }).catch(() => null),
      ]);
      if (manifestRequestRef.current !== requestId) return;
      setManifest(remote);
      setOverviewDocument(remoteOverview);
      setManifestReady(true);
      setManifestJobNumber(String(job?.number || ''));
    } catch (error) {
      if (manifestRequestRef.current !== requestId) return;
      setManifest(defaultManifest);
      setOverviewDocument(null);
      setManifestReady(false);
      setManifestJobNumber('');
      setManifestError(error?.message || 'The shared Job Details Hub could not be loaded.');
    } finally {
      if (manifestRequestRef.current === requestId) setManifestLoading(false);
    }
  }, [defaultManifest, getAccessToken, job]);

  useEffect(() => {
    if (!active) return;
    setSelectedSection(null);
    setOverviewDocument(null);
    setManifest(defaultManifest);
    setManifestReady(false);
    setManifestJobNumber('');
    setEditing(false);
    setAddSectionOpen(false);
    loadManifest();
  }, [active, defaultManifest, job?.number, loadManifest]);

  const overviewFallback = useCallback((document, section) => {
    if (
      section?.id !== 'overview'
      || document?.itemId
      || document?.brief
      || document?.dailyBriefs?.length
    ) return document;
    const brief = String(legacyBrief?.details || job?.details || '').trim();
    return {
      ...document,
      brief,
      legacyFallback: true,
    };
  }, [job?.details, legacyBrief?.details]);

  const openSection = useCallback(async (section) => {
    const requestId = sectionRequestRef.current + 1;
    sectionRequestRef.current = requestId;
    setSelectedSection(section);
    setSectionDocument(null);
    setSectionError('');
    setEditing(false);

    if (typeof getAccessToken !== 'function') {
      setSectionError('Sign in with Microsoft to load this shared section.');
      return;
    }

    setSectionLoading(true);
    try {
      const accessToken = await getAccessToken();
      const remote = await loadSharedJobDetailsSection({ accessToken, job, section });
      if (sectionRequestRef.current !== requestId) return;
      const nextDocument = overviewFallback(remote, section);
      setSectionDocument(nextDocument);
      if (section.id === 'overview') setOverviewDocument(nextDocument);
    } catch (error) {
      if (sectionRequestRef.current !== requestId) return;
      setSectionError(error?.message || `${section.title} could not be loaded.`);
    } finally {
      if (sectionRequestRef.current === requestId) setSectionLoading(false);
    }
  }, [getAccessToken, job, overviewFallback]);

  const closeSection = useCallback(() => {
    if (saving || fileUploading) return;
    sectionRequestRef.current += 1;
    setSelectedSection(null);
    setSectionDocument(null);
    setSectionError('');
    setEditing(false);
    setFilePickerOpen(false);
    setFocusFilesOnEdit(false);
  }, [fileUploading, saving]);

  const saveManifestSections = useCallback(async (sections) => {
    if (manifestSaving || typeof getAccessToken !== 'function') return null;
    setManifestSaving(true);
    try {
      const accessToken = await getAccessToken();
      const saved = await saveSharedJobDetailsHub({
        accessToken,
        job,
        sections,
        updatedBy,
        itemId: manifest.itemId,
        eTag: manifest.eTag,
        storageScope: manifest.storageScope,
      });
      setManifest(saved);
      setManifestError('');
      return saved;
    } catch (error) {
      if (error?.code === 'JOB_DETAILS_HUB_CONFLICT' && error.latest) {
        setManifest(error.latest);
      }
      throw error;
    } finally {
      setManifestSaving(false);
    }
  }, [
    getAccessToken,
    job,
    manifest.eTag,
    manifest.itemId,
    manifest.storageScope,
    manifestSaving,
    updatedBy,
  ]);

  const beginEditing = useCallback(() => {
    const source = sectionDocument || {};
    setDraft({
      title: String(selectedSection?.title || ''),
      brief: String(source.brief || source.dailyBriefs?.[0]?.text || ''),
      requirements: String(source.requirements || ''),
      procedures: String(source.procedures || ''),
      files: Array.isArray(source.files) ? source.files : [],
    });
    setSectionError('');
    setFocusFilesOnEdit(false);
    setEditing(true);
  }, [sectionDocument, selectedSection?.title]);

  const saveSection = useCallback(async () => {
    if (
      !selectedSection
      || saving
      || manifestSaving
      || typeof getAccessToken !== 'function'
    ) return;
    setSaving(true);
    setSectionError('');
    let sectionToSave = selectedSection;
    try {
      if (selectedSection.id !== 'overview') {
        const sectionExists = manifest.sections.some((section) => section.id === selectedSection.id);
        const editableSections = sectionExists
          ? manifest.sections
          : [...manifest.sections, {
            ...selectedSection,
            builtIn: false,
            derivedFromOverview: false,
            archived: false,
            order: manifest.sections.length,
          }];
        const renamedSections = renameJobDetailsSection({
          sectionId: selectedSection.id,
          title: draft.title,
          sections: editableSections,
        });
        const renamedSection = renamedSections.find((section) => section.id === selectedSection.id);
        if (!sectionExists || renamedSection.title !== selectedSection.title) {
          const savedManifest = await saveManifestSections(renamedSections);
          sectionToSave = savedManifest?.sections?.find(
            (section) => section.id === selectedSection.id,
          ) || renamedSection;
        } else {
          sectionToSave = renamedSection;
        }
        setSelectedSection(sectionToSave);
      }

      const accessToken = await getAccessToken();
      const saved = await saveSharedJobDetailsSection({
        accessToken,
        job,
        section: sectionToSave,
        brief: draft.brief,
        requirements: draft.requirements,
        procedures: draft.procedures,
        files: draft.files,
        updatedBy,
        itemId: sectionDocument?.itemId,
        eTag: sectionDocument?.eTag,
        storageScope: sectionDocument?.storageScope,
      });
      setSectionDocument(saved);
      setFocusFilesOnEdit(false);
      setEditing(false);

      if (selectedSection.id === 'overview') {
        setOverviewDocument(saved);
        try {
          await onBriefSaved?.({
            workType: String(legacyBrief?.workType || job?.workType || ''),
            details: saved.brief,
            updatedAt: saved.updatedAt,
            updatedBy: saved.updatedBy,
          });
        } catch (cacheError) {
          reportDevelopmentError('Could not cache the migrated Overview brief', cacheError);
        }
      }
    } catch (error) {
      if (error?.code === 'JOB_DETAILS_SECTION_CONFLICT' && error.latest) {
        setSectionDocument(error.latest);
        if (selectedSection.id === 'overview') setOverviewDocument(error.latest);
        setDraft({
          title: sectionToSave.title,
          brief: error.latest.brief || error.latest.dailyBriefs?.[0]?.text || '',
          requirements: error.latest.requirements || '',
          procedures: error.latest.procedures || '',
          files: error.latest.files || [],
        });
      }
      setSectionError(error?.message || `${selectedSection.title} could not be saved.`);
    } finally {
      setSaving(false);
    }
  }, [
    draft,
    getAccessToken,
    job,
    legacyBrief?.workType,
    manifest.sections,
    manifestSaving,
    onBriefSaved,
    saveManifestSections,
    saving,
    sectionDocument,
    selectedSection,
    updatedBy,
  ]);

  const addSection = useCallback(async () => {
    if (manifestSaving) return;
    setAddSectionError('');
    let created;
    try {
      created = createJobDetailsSection({
        title: newSectionTitle,
        existingSections: activeSections,
      });
      await saveManifestSections([...manifest.sections, created]);
      setAddSectionOpen(false);
      setNewSectionTitle('');
      await openSection(created);
    } catch (error) {
      setAddSectionError(error?.message || 'The section could not be added.');
    }
  }, [
    activeSections,
    manifest.sections,
    manifestSaving,
    newSectionTitle,
    openSection,
    saveManifestSections,
  ]);

  const requestArchive = useCallback(() => {
    if (!selectedSection || selectedSection.builtIn || manifestSaving) return;
    Alert.alert(
      'Archive section?',
      `“${selectedSection.title}” will leave the active hub but can be restored later. Its shared content and linked files will be kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              const sections = manifest.sections.map((section) => (
                section.id === selectedSection.id ? { ...section, archived: true } : section
              ));
              await saveManifestSections(sections);
              closeSection();
            } catch (error) {
              setSectionError(error?.message || 'The section could not be archived.');
            }
          },
        },
      ],
    );
  }, [closeSection, manifest.sections, manifestSaving, saveManifestSections, selectedSection]);

  const restoreSection = useCallback(async (sectionToRestore) => {
    if (manifestSaving) return;
    setManifestError('');
    try {
      const sections = manifest.sections.map((section) => (
        section.id === sectionToRestore.id ? { ...section, archived: false } : section
      ));
      await saveManifestSections(sections);
    } catch (error) {
      setManifestError(error?.message || 'The section could not be restored.');
    }
  }, [manifest.sections, manifestSaving, saveManifestSections]);

  const openFilePicker = useCallback(async () => {
    if (typeof getAccessToken !== 'function') {
      setSectionError('Sign in with Microsoft before linking a job file.');
      return;
    }
    setFilePickerOpen(true);
    setFileLoading(true);
    setFileError('');
    setFileTrail([]);
    try {
      const accessToken = await getAccessToken();
      const result = await listJobFiles({ accessToken, job });
      setFileLocation(result);
      setFileItems(result.items);
    } catch (error) {
      setFileError(error?.message || 'Job Files could not be loaded.');
    } finally {
      setFileLoading(false);
    }
  }, [getAccessToken, job]);

  const openFileFolder = useCallback(async (folder) => {
    if (!fileLocation?.drive?.id) return;
    setFileLoading(true);
    setFileError('');
    try {
      const accessToken = await getAccessToken();
      const items = await listFolderItems({
        accessToken,
        driveId: fileLocation.drive.id,
        folderId: folder.id,
      });
      setFileTrail((current) => [...current, folder]);
      setFileItems(items);
    } catch (error) {
      setFileError(error?.message || 'The folder could not be opened.');
    } finally {
      setFileLoading(false);
    }
  }, [fileLocation?.drive?.id, getAccessToken]);

  const goUpFileFolder = useCallback(async () => {
    if (!fileLocation?.drive?.id || !fileTrail.length || fileLoading) return;
    const nextTrail = fileTrail.slice(0, -1);
    const parent = nextTrail[nextTrail.length - 1] || fileLocation.folder;
    setFileLoading(true);
    setFileError('');
    try {
      const accessToken = await getAccessToken();
      const items = await listFolderItems({
        accessToken,
        driveId: fileLocation.drive.id,
        folderId: parent.id,
      });
      setFileTrail(nextTrail);
      setFileItems(items);
    } catch (error) {
      setFileError(error?.message || 'The parent folder could not be opened.');
    } finally {
      setFileLoading(false);
    }
  }, [fileLoading, fileLocation, fileTrail, getAccessToken]);

  const chooseFile = useCallback((item) => {
    const parentPath = [
      fileLocation?.folder?.name,
      ...fileTrail.map((folder) => folder.name),
    ].filter(Boolean).join(' / ');
    const reference = normaliseJobDetailsFileReference({ ...item, parentPath });
    if (!reference) return;
    setDraft((current) => ({
      ...current,
      files: current.files.some((file) => file.id === reference.id)
        ? current.files
        : [...current.files, reference],
    }));
    setFilePickerOpen(false);
  }, [fileLocation?.folder?.name, fileTrail]);

  const uploadPhoneFile = useCallback(async () => {
    if (
      fileUploading
      || !fileLocation?.drive?.id
      || !currentFileFolder?.id
      || typeof getAccessToken !== 'function'
    ) return;

    setFileError('');
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setFileUploading(true);
      setFileUploadProgress(0);
      const accessToken = await getAccessToken();
      const uploaded = await uploadJobFile({
        accessToken,
        driveId: fileLocation.drive.id,
        folderId: currentFileFolder.id,
        jobNumber: job?.number,
        asset: {
          uri: asset.uri,
          name: asset.name || 'Uploaded file',
          mimeType: asset.mimeType || 'application/octet-stream',
          size: asset.size,
        },
        onProgress: setFileUploadProgress,
      });
      chooseFile(uploaded);
      Alert.alert(
        'File uploaded and linked',
        `“${uploaded?.name || asset.name || 'The file'}” is now in SharePoint. Tap SAVE to share this section link with the job team.`,
      );
    } catch (error) {
      setFileError(error?.message || 'The iPhone file could not be uploaded.');
    } finally {
      setFileUploading(false);
      setFileUploadProgress(0);
    }
  }, [
    chooseFile,
    currentFileFolder?.id,
    fileLocation?.drive?.id,
    fileUploading,
    getAccessToken,
    job?.number,
  ]);

  const beginFileEditing = useCallback(() => {
    beginEditing();
    setFocusFilesOnEdit(true);
    requestAnimationFrame(() => openFilePicker());
  }, [beginEditing, openFilePicker]);

  const removeFile = useCallback((fileToRemove) => {
    setDraft((current) => ({
      ...current,
      files: current.files.filter((file) => file.id !== fileToRemove.id),
    }));
  }, []);

  const openLinkedFile = useCallback(async (file) => {
    if (!file?.webUrl) {
      Alert.alert(
        'Open through Job Files',
        'This saved reference does not include a SharePoint link. Open Job Files to locate it.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Job Files', onPress: () => { closeSection(); openJobFiles?.(); } },
        ],
      );
      return;
    }
    if (!isTrustedJobFileWebUrl(file.webUrl)) {
      Alert.alert(
        'Untrusted file link blocked',
        'This saved reference is not a secure NorthGroup SharePoint link. Open Job Files to locate the file safely.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Job Files', onPress: () => { closeSection(); openJobFiles?.(); } },
        ],
      );
      return;
    }
    try {
      await Linking.openURL(file.webUrl);
    } catch {
      Alert.alert('Could not open file', 'The SharePoint file link could not be opened.');
    }
  }, [closeSection, openJobFiles]);

  const hasSectionContent = jobDetailsSectionHasContent(sectionDocument || {});
  const hubStatus = manifestError ? 'SYNC ISSUE' : 'SHARED';
  const hubTone = manifestError ? 'warning' : 'success';
  const visibleFileItems = fileItems.filter((item) => item.folder || item.file);
  const tmrJob = isTmrJob(job);
  const openFeatureLibrary = useCallback(() => {
    closeSection();
    requestAnimationFrame(() => openTmrFeatureGuide?.());
  }, [closeSection, openTmrFeatureGuide]);

  return (
    <>
      <AppCard style={[styles.hubCard, standalone && styles.hubCardStandalone]} padding="none">
        {!standalone ? (
          <JobDetailsHubHeader
            expanded={expanded}
            onToggle={onToggle}
            loading={manifestLoading || legacyBriefLoading}
            status={hubStatus}
            tone={hubTone}
          />
        ) : null}

        {expanded || standalone ? (
          <>
            {!standalone ? (
              <Text style={styles.hubIntro}>
                Open a section for its brief, requirements, procedures and linked job files.
              </Text>
            ) : null}

            <View style={styles.hubGrid}>
              {activeSections.map((section) => (
                <HubBubble
                  key={section.id}
                  section={section}
                  onPress={openSection}
                  highlighted={section.id === highlightedSectionId}
                />
              ))}
              <Pressable
                style={({ pressed }) => [styles.addBubble, pressed && styles.pressed]}
                onPress={() => {
                  setAddSectionError('');
                  setNewSectionTitle('');
                  setAddSectionOpen(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Add a Job Details section"
              >
                <View style={styles.addBubbleIcon}>
                  <Ionicons name="add" size={24} color={colors.accentDark} />
                </View>
                <Text style={styles.addBubbleTitle}>Add section</Text>
                <Text style={styles.addBubbleHint}>SHARED WITH JOB</Text>
              </Pressable>
            </View>

            {archivedSections.length ? (
              <View style={styles.archivedArea}>
                <Text style={styles.archivedTitle}>ARCHIVED SECTIONS</Text>
                {archivedSections.map((section) => (
                  <View key={section.id} style={styles.archivedRow}>
                    <Ionicons name="archive-outline" size={16} color={colors.placeholderText} />
                    <Text style={styles.archivedName} numberOfLines={1}>{section.title}</Text>
                    <Pressable
                      style={({ pressed }) => [styles.restoreButton, pressed && styles.pressed]}
                      onPress={() => restoreSection(section)}
                      disabled={manifestSaving}
                    >
                      <Text style={styles.restoreButtonText}>RESTORE</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {manifestError ? <Text style={styles.inlineError}>{manifestError}</Text> : null}
          </>
        ) : null}
      </AppCard>

      <Modal
        visible={Boolean(selectedSection)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={filePickerOpen
          ? () => !fileUploading && setFilePickerOpen(false)
          : editing
            ? () => setEditing(false)
            : closeSection}
      >
        <KeyboardAvoidingView
          style={[styles.screen, { backgroundColor: colors.pageBackground }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <StatusBar
            barStyle={colors.isDark ? 'light-content' : 'dark-content'}
            backgroundColor={colors.pageBackground}
          />
          <View style={{ paddingTop: insets.top }}>
            <FullScreenHeader
              eyebrow={editing ? 'EDIT SHARED SECTION' : 'JOB DETAILS'}
              title={selectedSection?.title || 'Section'}
              onBack={editing ? () => setEditing(false) : closeSection}
              actionLabel={editing ? 'SAVE' : 'EDIT'}
              onAction={editing ? saveSection : beginEditing}
              actionDisabled={saving || manifestSaving || sectionLoading || !sectionDocument}
            />
          </View>

          {editing ? (
            <ScrollView
              ref={editorScrollRef}
              contentContainerStyle={[styles.editorContent, { paddingBottom: insets.bottom + SPACING.xxxl }]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.editorIntro}>
                Changes are shared with every member of job {job?.number || ''}.
              </Text>

              {selectedSection?.id !== 'overview' ? (
                <>
                  <Text style={styles.inputLabel}>SECTION TITLE</Text>
                  <TextInput
                    value={draft.title}
                    onChangeText={(title) => setDraft((current) => ({ ...current, title }))}
                    editable={!saving && !manifestSaving}
                    style={styles.input}
                    placeholder="e.g. Install Control / Long Static"
                    placeholderTextColor={colors.placeholderText}
                    maxLength={60}
                    returnKeyType="next"
                  />
                  <Text style={styles.inputHelp}>
                    This title also becomes the matching Progress task for this job.
                  </Text>
                </>
              ) : null}

              {selectedSection?.id === 'overview' ? (
                <BriefEditor
                  value={draft.brief}
                  saving={saving}
                  onChange={(brief) => setDraft((current) => ({ ...current, brief }))}
                />
              ) : (
                <>
                  <Text style={styles.inputLabel}>BRIEF</Text>
                  <TextInput
                    value={draft.brief}
                    onChangeText={(brief) => setDraft((current) => ({ ...current, brief }))}
                    editable={!saving}
                    multiline
                    textAlignVertical="top"
                    style={[styles.input, styles.textArea]}
                    placeholder="Scope, purpose or general information…"
                    placeholderTextColor={colors.placeholderText}
                  />
                </>
              )}

              <Text style={styles.inputLabel}>REQUIREMENTS</Text>
              <TextInput
                value={draft.requirements}
                onChangeText={(requirements) => setDraft((current) => ({ ...current, requirements }))}
                editable={!saving}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textArea]}
                placeholder="Standards, deliverables, training or job requirements…"
                placeholderTextColor={colors.placeholderText}
              />

              <Text style={styles.inputLabel}>PROCEDURES</Text>
              <TextInput
                value={draft.procedures}
                onChangeText={(procedures) => setDraft((current) => ({ ...current, procedures }))}
                editable={!saving}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textArea]}
                placeholder="Workflows, instructions, checks or safety procedures…"
                placeholderTextColor={colors.placeholderText}
              />

              <View
                onLayout={(event) => {
                  if (!focusFilesOnEdit) return;
                  const y = Math.max(0, event.nativeEvent.layout.y - SPACING.md);
                  requestAnimationFrame(() => editorScrollRef.current?.scrollTo({ y, animated: false }));
                  setFocusFilesOnEdit(false);
                }}
              >
                <View style={styles.editorFilesHeader}>
                  <View style={styles.editorFilesCopy}>
                    <Text style={styles.inputLabel}>FILES</Text>
                    <Text style={styles.inputHelp}>
                      Link a SharePoint file or upload one from the iPhone Files app.
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.addFileButton, pressed && styles.pressed]}
                    onPress={openFilePicker}
                    disabled={saving || fileUploading}
                  >
                    <Ionicons name="add" size={17} color={colors.navy} />
                    <Text style={styles.addFileButtonText}>ADD FILE</Text>
                  </Pressable>
                </View>
                {draft.files.length ? draft.files.map((file) => (
                  <LinkedFile
                    key={file.id}
                    file={file}
                    editable
                    onRemove={removeFile}
                  />
                )) : (
                  <Text style={styles.emptyFiles}>No files linked to this section.</Text>
                )}
                <Text style={styles.fileSaveHint}>
                  Removing a link does not delete the original SharePoint file.
                </Text>
              </View>

              {sectionError ? <Text style={styles.inlineError}>{sectionError}</Text> : null}

              <Pressable
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && !saving && styles.pressed,
                  saving && styles.disabled,
                ]}
                onPress={saveSection}
                disabled={saving}
              >
                {saving ? <ActivityIndicator size="small" color={colors.navy} /> : null}
                <Text style={styles.saveButtonText}>{saving ? 'SAVING…' : 'SAVE SHARED SECTION'}</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={[styles.sectionContent, { paddingBottom: insets.bottom + SPACING.xxxl }]}
              showsVerticalScrollIndicator={false}
            >
              {sectionLoading ? (
                <View style={styles.loadingArea}>
                  <ActivityIndicator size="large" color={colors.accentDark} />
                  <Text style={styles.loadingText}>Loading shared section…</Text>
                </View>
              ) : (
                <>
                  <View style={styles.sectionStatusCard}>
                    <View style={styles.sectionStatusIcon}>
                      <Ionicons
                        name={selectedSection?.icon || 'folder-open-outline'}
                        size={23}
                        color={colors.accentDark}
                      />
                    </View>
                    <View style={styles.sectionStatusCopy}>
                      <Text style={styles.sectionStatusTitle}>
                        {hasSectionContent ? 'Shared section' : 'Ready for content'}
                      </Text>
                      <Text style={styles.sectionStatusText}>
                        {sectionDocument?.updatedAt
                          ? `Updated ${formatUpdated(sectionDocument.updatedAt)}${sectionDocument.updatedBy ? ` by ${sectionDocument.updatedBy}` : ''}`
                          : selectedSection?.id === 'overview' && legacyBrief
                            ? `Existing job brief${sourceLabel ? ` · ${sourceLabel}` : ''}`
                            : 'Nothing has been added yet.'}
                      </Text>
                    </View>
                    <Ionicons name="cloud-done-outline" size={20} color={colors.success} />
                  </View>

                  {sectionError || (selectedSection?.id === 'overview' && legacyBriefError) ? (
                    <Text style={styles.inlineError}>{sectionError || legacyBriefError}</Text>
                  ) : null}

                  {selectedSection?.id === 'overview' ? (
                    <SectionBlock icon="reader-outline" title="Brief" hideValue>
                      <BriefDisplay value={sectionDocument?.brief} />
                    </SectionBlock>
                  ) : (
                    <SectionBlock
                      icon="reader-outline"
                      title="Brief"
                      value={sectionDocument?.brief}
                      emptyText="No brief has been added to this section."
                    />
                  )}
                  <SectionBlock
                    icon="checkmark-done-outline"
                    title="Requirements"
                    value={sectionDocument?.requirements}
                    emptyText="No requirements have been added."
                  />
                  <SectionBlock
                    icon="list-outline"
                    title="Procedures"
                    value={sectionDocument?.procedures}
                    emptyText="No procedures have been added."
                  >
                    {tmrJob ? <TmrFeatureLibraryAction onPress={openFeatureLibrary} /> : null}
                  </SectionBlock>

                  <SectionBlock
                    icon="attach-outline"
                    title="Files"
                    hideValue
                    accessory={(
                      <Text style={styles.fileCount}>{sectionDocument?.files?.length || 0}</Text>
                    )}
                  >
                    {sectionDocument?.files?.length ? sectionDocument.files.map((file) => (
                      <LinkedFile key={file.id} file={file} onOpen={openLinkedFile} />
                    )) : (
                      <Text style={styles.emptyFiles}>
                        No job files are linked to this section.
                      </Text>
                    )}
                    <Pressable
                      style={({ pressed }) => [
                        styles.manageSectionFilesButton,
                        pressed && styles.pressed,
                      ]}
                      onPress={beginFileEditing}
                      disabled={saving || sectionLoading || !sectionDocument}
                      accessibilityRole="button"
                      accessibilityLabel="Edit linked files or add a file"
                    >
                      <Ionicons name="create-outline" size={17} color={colors.navy} />
                      <Text style={styles.manageSectionFilesText}>EDIT / ADD FILES</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.openJobFilesButton, pressed && styles.pressed]}
                      onPress={() => {
                        closeSection();
                        openJobFiles?.();
                      }}
                    >
                      <Ionicons name="folder-open-outline" size={17} color={colors.accentDark} />
                      <Text style={styles.openJobFilesText}>OPEN JOB FILES</Text>
                    </Pressable>
                  </SectionBlock>

                  {!selectedSection?.builtIn ? (
                    <Pressable
                      style={({ pressed }) => [styles.archiveButton, pressed && styles.pressed]}
                      onPress={requestArchive}
                      disabled={manifestSaving}
                    >
                      <Ionicons name="archive-outline" size={17} color={colors.danger} />
                      <Text style={styles.archiveButtonText}>ARCHIVE SECTION</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </ScrollView>
          )}

          {filePickerOpen ? (
            <View style={[styles.filePickerOverlay, { paddingTop: insets.top }]}>
              <FullScreenHeader
                eyebrow="ADD SECTION FILE"
                title={currentFileFolder?.name || 'Job Files'}
                onBack={() => !fileUploading && setFilePickerOpen(false)}
              />
              <View style={styles.filePickerTrail}>
                <View style={styles.filePickerTrailCopy}>
                  {fileTrail.length ? (
                    <Pressable
                      style={styles.goUpButton}
                      onPress={goUpFileFolder}
                      disabled={fileLoading || fileUploading}
                    >
                      <Ionicons name="arrow-up" size={16} color={colors.accentDark} />
                      <Text style={styles.goUpText}>UP ONE FOLDER</Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.filePickerHelp}>
                      Select a SharePoint file, or upload into this folder.
                    </Text>
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.uploadPhoneButton,
                    pressed && !fileUploading && styles.pressed,
                    fileUploading && styles.disabled,
                  ]}
                  onPress={uploadPhoneFile}
                  disabled={fileLoading || fileUploading || !currentFileFolder?.id}
                  accessibilityRole="button"
                  accessibilityLabel="Upload a file from this iPhone"
                >
                  {fileUploading ? (
                    <ActivityIndicator size="small" color={colors.navy} />
                  ) : (
                    <Ionicons name="phone-portrait-outline" size={16} color={colors.navy} />
                  )}
                  <Text style={styles.uploadPhoneButtonText}>
                    {fileUploading ? `${Math.round(fileUploadProgress * 100)}%` : 'IPHONE FILES'}
                  </Text>
                </Pressable>
              </View>
              {fileUploading ? (
                <View style={styles.fileUploadProgressTrack}>
                  <View
                    style={[
                      styles.fileUploadProgressFill,
                      { width: `${Math.max(4, Math.round(fileUploadProgress * 100))}%` },
                    ]}
                  />
                </View>
              ) : null}
              {fileLoading ? (
                <View style={styles.loadingArea}>
                  <ActivityIndicator size="large" color={colors.accentDark} />
                </View>
              ) : (
                <ScrollView contentContainerStyle={[styles.filePickerList, { paddingBottom: insets.bottom + SPACING.xxl }]}>
                  {fileError ? <Text style={styles.inlineError}>{fileError}</Text> : null}
                  {visibleFileItems.map((item) => (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [styles.pickerItem, pressed && styles.pressed]}
                      onPress={() => (item.folder ? openFileFolder(item) : chooseFile(item))}
                      disabled={fileUploading}
                    >
                      <View style={styles.fileIcon}>
                        <Ionicons
                          name={item.folder ? 'folder-outline' : 'document-text-outline'}
                          size={19}
                          color={colors.accentDark}
                        />
                      </View>
                      <Text style={styles.pickerItemName} numberOfLines={2}>{item.name}</Text>
                      <Ionicons
                        name={item.folder ? 'chevron-forward' : 'add-circle-outline'}
                        size={20}
                        color={colors.accentDark}
                      />
                    </Pressable>
                  ))}
                  {!visibleFileItems.length && !fileError ? (
                    <Text style={styles.emptyFiles}>No files are available in this folder.</Text>
                  ) : null}
                </ScrollView>
              )}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={addSectionOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !manifestSaving && setAddSectionOpen(false)}
      >
        <KeyboardAvoidingView
          style={styles.addModalKeyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.addModalShade} onPress={() => !manifestSaving && setAddSectionOpen(false)} />
          <View style={[styles.addModalCard, { paddingBottom: insets.bottom + SPACING.lg }]}>
            <View style={styles.addModalHandle} />
            <Text style={styles.eyebrow}>SHARED JOB HUB</Text>
            <Text style={styles.addModalTitle}>Add a section</Text>
            <Text style={styles.addModalIntro}>
              Every member of this job will see the new section and can update its content.
            </Text>
            <Text style={styles.inputLabel}>SECTION NAME</Text>
            <TextInput
              value={newSectionTitle}
              onChangeText={setNewSectionTitle}
              editable={!manifestSaving}
              style={styles.input}
              placeholder="e.g. Traffic Management"
              placeholderTextColor={colors.placeholderText}
              autoFocus
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={addSection}
            />
            {addSectionError ? <Text style={styles.inlineError}>{addSectionError}</Text> : null}
            <View style={styles.addModalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setAddSectionOpen(false)}
                disabled={manifestSaving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, styles.addModalSave, manifestSaving && styles.disabled]}
                onPress={addSection}
                disabled={manifestSaving}
              >
                {manifestSaving ? <ActivityIndicator size="small" color={colors.navy} /> : null}
                <Text style={styles.saveButtonText}>{manifestSaving ? 'ADDING…' : 'ADD SECTION'}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const createStyles = (colors) => StyleSheet.create({
  hubCard: {
    borderColor: colors.accent,
    borderWidth: 1.5,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  hubCardStandalone: {
    marginBottom: 0,
  },
  eyebrow: {
    color: colors.accentDark,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1.25,
  },
  hubTitle: {
    color: colors.bodyText,
    fontSize: 23,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  hubIntro: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  hubGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    padding: SPACING.lg,
  },
  addBubble: {
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 126,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardBackground,
  },
  addBubbleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
  },
  addBubbleTitle: {
    color: colors.bodyText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: SPACING.sm,
  },
  addBubbleHint: {
    color: colors.placeholderText,
    fontSize: 7,
    lineHeight: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  archivedArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: SPACING.lg,
    paddingTop: SPACING.md,
  },
  archivedTitle: {
    color: colors.placeholderText,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  archivedRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
  },
  archivedName: {
    flex: 1,
    color: colors.supportingText,
    fontSize: 12,
    fontWeight: '700',
  },
  restoreButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.successBackground,
  },
  restoreButtonText: {
    color: colors.success,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  screen: {
    flex: 1,
  },
  screenHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
  screenHeaderCopy: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: SPACING.sm,
  },
  screenTitle: {
    color: colors.bodyText,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    letterSpacing: -0.35,
  },
  headerAction: {
    minWidth: 58,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.accent,
  },
  headerActionText: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sectionContent: {
    padding: SPACING.lg,
  },
  sectionStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successBackground,
    marginBottom: SPACING.lg,
  },
  sectionStatusIcon: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBackground,
    marginRight: SPACING.md,
  },
  sectionStatusCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionStatusTitle: {
    color: colors.statusSuccessText,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  sectionStatusText: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  featureLibraryButton: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    marginTop: SPACING.md,
  },
  featureLibraryIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    backgroundColor: colors.cardBackground,
    marginRight: SPACING.sm,
  },
  featureLibraryCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.sm,
  },
  featureLibraryEyebrow: {
    color: colors.accentDark,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  featureLibraryTitle: {
    color: colors.bodyText,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  featureLibraryDetail: {
    color: colors.supportingText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  fileCount: {
    minWidth: 27,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
    textAlign: 'center',
    color: colors.accentDark,
    backgroundColor: colors.accentSoft,
    fontSize: 9,
    fontWeight: '900',
  },
  fileRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  fileIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentSoft,
    marginRight: SPACING.sm,
  },
  fileCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: SPACING.sm,
  },
  fileName: {
    color: colors.bodyText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  fileMeta: {
    color: colors.placeholderText,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 2,
  },
  removeFileButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.dangerBackground,
  },
  openJobFilesButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: colors.accent,
    marginTop: SPACING.md,
  },
  openJobFilesText: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  manageSectionFilesButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.accent,
    marginTop: SPACING.md,
  },
  manageSectionFilesText: {
    color: colors.navy,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  archiveButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: colors.danger,
    marginTop: SPACING.sm,
  },
  archiveButtonText: {
    color: colors.danger,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  editorContent: {
    padding: SPACING.lg,
  },
  editorIntro: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: SPACING.lg,
  },
  inputLabel: {
    color: colors.accentDark,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  inputHelp: {
    color: colors.placeholderText,
    fontSize: 9,
    lineHeight: 13,
  },
  input: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    color: colors.inputText,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  textArea: {
    minHeight: 116,
    marginBottom: SPACING.md,
  },
  editorFilesHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    columnGap: SPACING.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  editorFilesCopy: { flex: 1, minWidth: 0 },
  addFileButton: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 4,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.accent,
  },
  addFileButtonText: {
    color: colors.navy,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  emptyFiles: {
    color: colors.placeholderText,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    paddingVertical: SPACING.lg,
    textAlign: 'center',
  },
  fileSaveHint: {
    color: colors.placeholderText,
    fontSize: 9,
    lineHeight: 13,
    marginTop: SPACING.sm,
  },
  saveButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.accent,
    marginTop: SPACING.xl,
  },
  saveButtonText: {
    color: colors.navy,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.9,
  },
  loadingArea: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: SPACING.md,
  },
  loadingText: {
    color: colors.supportingText,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineError: {
    color: colors.statusDangerText,
    backgroundColor: colors.dangerBackground,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  filePickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.pageBackground,
    zIndex: 20,
  },
  filePickerTrail: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  filePickerTrailCopy: { flex: 1, minWidth: 0 },
  filePickerHelp: {
    color: colors.supportingText,
    fontSize: 11,
    lineHeight: 16,
  },
  goUpButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: SPACING.sm,
  },
  goUpText: {
    color: colors.accentDark,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  uploadPhoneButton: {
    minWidth: 116,
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    columnGap: 5,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.pill,
    backgroundColor: colors.accent,
  },
  uploadPhoneButtonText: {
    color: colors.navy,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.55,
  },
  fileUploadProgressTrack: {
    height: 4,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  fileUploadProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  filePickerList: {
    padding: SPACING.lg,
  },
  pickerItem: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardBackground,
    marginBottom: SPACING.sm,
  },
  pickerItemName: {
    flex: 1,
    color: colors.bodyText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    marginRight: SPACING.sm,
  },
  addModalKeyboard: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  addModalShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.scrim,
  },
  addModalCard: {
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    backgroundColor: colors.cardBackground,
    padding: SPACING.xl,
  },
  addModalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: SPACING.lg,
  },
  addModalTitle: {
    color: colors.bodyText,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '900',
    marginTop: 2,
  },
  addModalIntro: {
    color: colors.supportingText,
    fontSize: 12,
    lineHeight: 18,
    marginVertical: SPACING.md,
  },
  addModalActions: {
    flexDirection: 'row',
    columnGap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  cancelButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    color: colors.supportingText,
    fontSize: 10,
    fontWeight: '900',
  },
  addModalSave: {
    flex: 1.25,
    marginTop: 0,
  },
  pressed: {
    opacity: 0.76,
  },
  disabled: {
    opacity: 0.48,
  },
});
