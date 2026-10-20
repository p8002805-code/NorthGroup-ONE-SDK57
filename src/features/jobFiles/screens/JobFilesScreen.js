import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import { createRecentlyOpenedJobFile } from '../../../navigation/recentlyOpened';
import JobWorkspaceDock from '../../jobs/components/JobWorkspaceDock';
import JobFileActionsSheet from '../components/JobFileActionsSheet';
import JobCadViewerModal from '../components/JobCadViewerModal';
import JobFileMoveModal from '../components/JobFileMoveModal';
import JobFilePreviewModal from '../components/JobFilePreviewModal';
import JobFileUploadProgress from '../components/JobFileUploadProgress';
import JobFilesHeader from '../components/JobFilesHeader';
import JobPdfGallery from '../components/JobPdfGallery';
import JobWorkspaceCreateModal from '../components/JobWorkspaceCreateModal';
import PendingUploadDestination from '../components/PendingUploadDestination';
import { useQueuedJobFileUpload } from '../hooks/useQueuedJobFileUpload';
import { useJobFileMove } from '../hooks/useJobFileMove';
import { buildDxfPreviewHtml, MAX_DXF_PREVIEW_BYTES } from '../jobCadPreview';
import { formatJobFileText, MAX_TEXT_PREVIEW_BYTES } from '../jobFilePreview';
import {
  formatBytes,
  formatModified,
  getFileIcon,
  getFileKind,
  sortDisplayItems,
} from '../jobFilePresentation';
import { isTrustedJobFileWebUrl, jobFilesJobKey } from '../jobFilesRules';
import {
  createJobFolder,
  createJobFilesWorkspace,
  deleteJobItem,
  downloadAndShareJobFile,
  downloadJobFile,
  listFolderItems,
  listJobFiles,
  removeDownloadedJobFile,
  renameJobItem,
  updateJobTextFile,
  uploadJobFile,
} from '../jobFilesService';

export default function JobFilesScreen({
  job,
  getAccessToken,
  onRecentlyOpened,
  openWorkspace,
  openForms,
  openCapture,
  pendingUpload = null,
  formLabel = '',
  onPendingUploadHandled,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const jobKey = jobFilesJobKey(job);
  const activeJobKeyRef = useRef(jobKey);
  const navigationRequestRef = useRef(0);
  const mountedRef = useRef(false);
  activeJobKeyRef.current = jobKey;
  const [location, setLocation] = useState(null);
  const [items, setItems] = useState([]);
  const [folderTrail, setFolderTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [missingWorkspace, setMissingWorkspace] = useState(null);
  const [showWorkspaceCreator, setShowWorkspaceCreator] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [queuedUpload, setQueuedUpload] = useState(pendingUpload);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [preview, setPreview] = useState(null);
  const [cadPreview, setCadPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pdfGalleryItemId, setPdfGalleryItemId] = useState('');
  const [actionItem, setActionItem] = useState(null);
  const [managingItemId, setManagingItemId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fileFilter, setFileFilter] = useState('all');
  const [sortMode, setSortMode] = useState('name');
  const isActiveJobOperation = useCallback((operationJobKey) => (
    mountedRef.current && activeJobKeyRef.current === operationJobKey
  ), []);
  const currentFolder = folderTrail[folderTrail.length - 1] || location?.folder || null;
  const move = useJobFileMove({
    currentFolder,
    driveId: location?.drive?.id,
    getAccessToken,
    isActiveJobOperation,
    jobKey,
    rootFolder: location?.folder,
    setItems,
  });
  const queuedAssets = useMemo(() => {
    if (!queuedUpload) return [];
    if (Array.isArray(queuedUpload.assets)) {
      return queuedUpload.assets.filter((asset) => asset?.uri && asset?.name);
    }
    return queuedUpload?.uri && queuedUpload?.name ? [queuedUpload] : [];
  }, [queuedUpload]);
  const parentPathLabel = useMemo(() => {
    if (!folderTrail.length) return 'CURRENT FOLDER';
    return [location?.folder?.name, ...folderTrail.slice(0, -1).map((folder) => folder.name)]
      .filter(Boolean)
      .join(' / ');
  }, [folderTrail, location?.folder?.name]);

  const pdfItems = useMemo(
    () => sortDisplayItems(items.filter((item) => getFileKind(item) === 'pdf'), sortMode),
    [items, sortMode],
  );

  const displayedItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = items.filter((item) => {
      if (query && !String(item.name || '').toLowerCase().includes(query)) return false;
      const kind = getFileKind(item);
      if (fileFilter === 'all') return true;
      if (fileFilter === 'folders') return kind === 'folder';
      if (fileFilter === 'documents') return ['office', 'text', 'dxf', 'dwg', 'external'].includes(kind);
      return kind === fileFilter;
    });
    return sortDisplayItems(filtered, sortMode);
  }, [fileFilter, items, searchQuery, sortMode]);

  const recordOpenedItem = useCallback((item, folderPath = []) => {
    const recentItem = createRecentlyOpenedJobFile({
      item,
      driveId: location?.drive?.id,
      job,
      folderPath,
    });
    if (recentItem) onRecentlyOpened?.(recentItem);
  }, [job, location?.drive?.id, onRecentlyOpened]);

  const recordPdfOpened = useCallback((item) => {
    recordOpenedItem(item, [
      location?.folder?.name,
      ...folderTrail.map((folder) => folder.name),
    ]);
  }, [folderTrail, location?.folder?.name, recordOpenedItem]);

  useEffect(() => {
    setQueuedUpload(pendingUpload || null);
  }, [pendingUpload]);

  useEffect(() => {
    const localUri = preview?.localUri;
    return () => {
      if (localUri) removeDownloadedJobFile(localUri);
    };
  }, [preview?.localUri]);

  useEffect(() => {
    const localUri = cadPreview?.localUri;
    return () => {
      if (localUri) removeDownloadedJobFile(localUri);
    };
  }, [cadPreview?.localUri]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      navigationRequestRef.current += 1;
    };
  }, []);

  const load = useCallback(async ({ quiet = false, reset = false } = {}) => {
    const requestId = navigationRequestRef.current + 1;
    navigationRequestRef.current = requestId;
    const requestJobKey = jobKey;
    const requestLocation = reset ? null : location;
    const requestFolder = reset ? null : currentFolder;
    const requestIsActive = () => (
      mountedRef.current
      && navigationRequestRef.current === requestId
      && activeJobKeyRef.current === requestJobKey
    );

    if (reset) {
      setLocation(null);
      setItems([]);
      setFolderTrail([]);
      setSearchQuery('');
      setFileFilter('all');
      setError('');
      setMissingWorkspace(null);
      setShowWorkspaceCreator(false);
      setRefreshing(false);
      setPreview(null);
      setCadPreview(null);
      setPdfGalleryItemId('');
      setActionItem(null);
      setShowFolderPicker(false);
      setShowCreateFolder(false);
      setFolderName('');
      setManagingItemId('');
      setUploading(false);
      setUploadProgress(0);
      setUploadStatus(null);
    }
    if (!quiet) setLoading(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      if (!requestLocation) {
        const result = await listJobFiles({ accessToken, job });
        if (!requestIsActive()) return;
        setLocation(result);
        setItems(result.items);
        setFolderTrail([]);
        setMissingWorkspace(null);
      } else {
        const folder = requestFolder || requestLocation.folder;
        const nextItems = await listFolderItems({
          accessToken,
          driveId: requestLocation.drive.id,
          folderId: folder.id,
        });
        if (!requestIsActive()) return;
        setItems(nextItems);
      }
    } catch (loadError) {
      if (!requestIsActive()) return;
      if (loadError?.code === 'JOB_FILES_FOLDER_NOT_FOUND') {
        setMissingWorkspace({
          expectedName: loadError.expectedFolderName || '',
          message: loadError.message,
        });
      } else {
        setMissingWorkspace(null);
      }
      setError(loadError?.message || 'Job Files could not be loaded.');
    } finally {
      if (requestIsActive()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentFolder, getAccessToken, job, jobKey, location]);

  useEffect(() => {
    load({ reset: true });
    return () => {
      navigationRequestRef.current += 1;
    };
  }, [jobKey]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load({ quiet: true });
  }, [load]);

  const openFolder = useCallback(async (item) => {
    if (!location || loading || uploading) return;
    const requestId = navigationRequestRef.current + 1;
    navigationRequestRef.current = requestId;
    const requestJobKey = jobKey;
    const requestLocation = location;
    const requestTrail = folderTrail;
    const requestIsActive = () => (
      mountedRef.current
      && navigationRequestRef.current === requestId
      && activeJobKeyRef.current === requestJobKey
    );
    setLoading(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      const nextItems = await listFolderItems({
        accessToken,
        driveId: requestLocation.drive.id,
        folderId: item.id,
      });
      if (!requestIsActive()) return;
      setFolderTrail([...requestTrail, item]);
      setItems(nextItems);
      setSearchQuery('');
      recordOpenedItem(item, [
        requestLocation.folder?.name,
        ...requestTrail.map((folder) => folder.name),
        item.name,
      ]);
    } catch (folderError) {
      if (!requestIsActive()) return;
      setError(folderError?.message || 'This folder could not be opened.');
    } finally {
      if (requestIsActive()) setLoading(false);
    }
  }, [folderTrail, getAccessToken, jobKey, loading, location, recordOpenedItem, uploading]);

  const goUp = useCallback(async () => {
    if (!location || folderTrail.length === 0 || loading || uploading) return;
    const requestId = navigationRequestRef.current + 1;
    navigationRequestRef.current = requestId;
    const requestJobKey = jobKey;
    const requestLocation = location;
    const nextTrail = folderTrail.slice(0, -1);
    const parent = nextTrail[nextTrail.length - 1] || requestLocation.folder;
    const requestIsActive = () => (
      mountedRef.current
      && navigationRequestRef.current === requestId
      && activeJobKeyRef.current === requestJobKey
    );
    setLoading(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      const nextItems = await listFolderItems({
        accessToken,
        driveId: requestLocation.drive.id,
        folderId: parent.id,
      });
      if (!requestIsActive()) return;
      setFolderTrail(nextTrail);
      setItems(nextItems);
      setSearchQuery('');
    } catch (folderError) {
      if (!requestIsActive()) return;
      setError(folderError?.message || 'The parent folder could not be opened.');
    } finally {
      if (requestIsActive()) setLoading(false);
    }
  }, [folderTrail, getAccessToken, jobKey, loading, location, uploading]);

  const folderBackSwipe = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => (
      folderTrail.length > 0
      && !loading
      && !uploading
      && Math.abs(gesture.dx) > 18
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35
    ),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      folderTrail.length > 0
      && !loading
      && !uploading
      && Math.abs(gesture.dx) > 18
      && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.35
    ),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_event, gesture) => {
      if (
        (Math.abs(gesture.dx) > 64 || Math.abs(gesture.vx) > 0.55)
        && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.15
      ) goUp();
    },
  }), [folderTrail.length, goUp, loading, uploading]);

  const openCreateFolder = useCallback(() => {
    if (!currentFolder || uploading || creatingFolder) return;
    setFolderName('');
    setShowCreateFolder(true);
  }, [creatingFolder, currentFolder, uploading]);

  const createFolder = useCallback(async () => {
    const nextName = folderName.trim();
    if (!location?.drive?.id || !currentFolder?.id || !nextName || creatingFolder) return;
    const operationJobKey = jobKey;

    try {
      setCreatingFolder(true);
      const accessToken = await getAccessToken();
      const createdFolder = await createJobFolder({
        accessToken,
        driveId: location.drive.id,
        parentFolderId: currentFolder.id,
        name: nextName,
      });
      if (!isActiveJobOperation(operationJobKey)) return;
      setItems((current) => sortDisplayItems([
        ...current.filter((item) => item.id !== createdFolder.id),
        createdFolder,
      ]));
      setShowCreateFolder(false);
      setFolderName('');
      Alert.alert('Folder created', `“${createdFolder.name || nextName}” is ready to use.`);
    } catch (createError) {
      if (!isActiveJobOperation(operationJobKey)) return;
      Alert.alert('Could not create folder', createError?.message || 'The SharePoint folder could not be created.');
    } finally {
      if (isActiveJobOperation(operationJobKey)) setCreatingFolder(false);
    }
  }, [creatingFolder, currentFolder, folderName, getAccessToken, isActiveJobOperation, jobKey, location?.drive?.id]);

  const createMissingWorkspace = useCallback(async (name) => {
    const operationJobKey = jobKey;
    const accessToken = await getAccessToken();
    const createdLocation = await createJobFilesWorkspace({ accessToken, job, name });
    const nextItems = await listFolderItems({
      accessToken,
      driveId: createdLocation.drive.id,
      folderId: createdLocation.folder.id,
    });
    if (!isActiveJobOperation(operationJobKey)) return;
    setLocation(createdLocation);
    setItems(nextItems);
    setFolderTrail([]);
    setError('');
    setMissingWorkspace(null);
    setShowWorkspaceCreator(false);
    setFileFilter('all');
    Alert.alert(
      createdLocation.created ? 'Job folder created' : 'Job folder found',
      `“${createdLocation.folder.name}” is ready to use.`,
    );
  }, [getAccessToken, isActiveJobOperation, job, jobKey]);

  const uploadAssetToFolder = useCallback(async ({ asset, folder, isQueuedForm = false }) => {
    if (!location || !folder || !asset || uploading) return;
    const operationJobKey = jobKey;

    // A queued form belongs to one job. Never put it in another job's folder.
    const assetJob = String(asset.jobNumber || '').trim().toUpperCase();
    if (isQueuedForm && assetJob && assetJob !== String(job?.number || '').trim().toUpperCase()) {
      Alert.alert(
        'Wrong job',
        `This form belongs to job ${asset.jobNumber}. Open that job to upload it.`,
      );
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setUploadStatus({
        phase: 'connecting',
        current: 0,
        total: 1,
        fileName: asset.name || 'Selected file',
      });
      const accessToken = await getAccessToken();
      await uploadJobFile({
        accessToken,
        driveId: location.drive.id,
        folderId: folder.id,
        asset,
        jobNumber: job?.number,
        onProgress: (progress) => {
          if (isActiveJobOperation(operationJobKey)) {
            setUploadProgress(progress);
            setUploadStatus({
              phase: 'uploading',
              current: 1,
              total: 1,
              fileName: asset.name || 'Selected file',
            });
          }
        },
      });
      // The file is already in SharePoint. Record that FIRST, even if the user
      // has since left this screen, or the app would offer to upload it again.
      if (isQueuedForm) {
        try {
          await onPendingUploadHandled?.({ ...asset, jobNumber: asset.jobNumber || job?.number });
        } catch (_handlerError) {
          // The app reports its own bookkeeping errors; the upload itself worked.
        }
      }
      if (!isActiveJobOperation(operationJobKey)) return;

      if (isQueuedForm) setQueuedUpload(null);
      await load({ quiet: true });

      Alert.alert(
        isQueuedForm ? 'Form saved to SharePoint' : 'Upload complete',
        `${asset.name || 'The file'} is now available in ${folder.name || 'this folder'}.`,
      );
    } catch (uploadError) {
      if (!isActiveJobOperation(operationJobKey)) return;
      Alert.alert('Upload failed', uploadError?.message || 'The file could not be uploaded.');
    } finally {
      if (isActiveJobOperation(operationJobKey)) {
        setUploading(false);
        setUploadProgress(0);
        setUploadStatus(null);
      }
    }
  }, [getAccessToken, isActiveJobOperation, job?.number, jobKey, load, location, onPendingUploadHandled, uploading]);

  const uploadQueuedAssetsToFolder = useQueuedJobFileUpload({
    getAccessToken, isActiveJobOperation, jobKey, jobNumber: job?.number,
    load, location, onPendingUploadHandled, queuedAssets, queuedUpload,
    setQueuedUpload, setUploadProgress, setUploadStatus, setUploading, uploading,
  });

  const chooseAndUpload = useCallback(async () => {
    if (!location || !currentFolder || uploading) return;

    if (!folderTrail.length && items.some((item) => item.folder)) {
      setShowFolderPicker(true);
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      await uploadAssetToFolder({
        asset: result.assets[0],
        folder: currentFolder,
      });
    } catch (pickerError) {
      Alert.alert('Upload failed', pickerError?.message || 'The file could not be selected.');
    }
  }, [currentFolder, folderTrail.length, items, location, uploadAssetToFolder, uploading]);

  const saveQueuedUpload = useCallback((folder) => {
    if (!queuedUpload || !queuedAssets.length || !folder || uploading) return;

    Alert.alert(
      queuedAssets.length === 1 ? 'Save form here?' : 'Upload this GNSS batch here?',
      `${formLabel || (queuedAssets.length === 1 ? 'Form PDF' : `${queuedAssets.length} GNSS PDFs`)}\n\n${folder.name || 'Selected folder'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: queuedAssets.length === 1 ? 'Save PDF' : `Upload ${queuedAssets.length} PDFs`,
          onPress: () => uploadQueuedAssetsToFolder(folder),
        },
      ],
    );
  }, [formLabel, queuedAssets, queuedUpload, uploadQueuedAssetsToFolder, uploading]);

  const openInSharePoint = useCallback(async (item) => {
    if (!isTrustedJobFileWebUrl(item?.webUrl)) {
      Alert.alert(
        'SharePoint link blocked',
        'This link was not a secure NorthGroup SharePoint address. Refresh Job Files and try again.',
      );
      return;
    }
    try {
      await Linking.openURL(item.webUrl);
      recordOpenedItem(item, [
        location?.folder?.name,
        ...folderTrail.map((folder) => folder.name),
      ]);
    } catch {
      Alert.alert('Could not open SharePoint', 'The SharePoint page could not be opened.');
    }
  }, [folderTrail, location?.folder?.name, recordOpenedItem]);

  const openFile = useCallback(async (item) => {
    if (!location) return;
    const kind = getFileKind(item);

    if (kind === 'office') {
      await openInSharePoint(item);
      return;
    }

    if (kind === 'pdf') {
      setPdfGalleryItemId(item.id);
      return;
    }

    if (kind === 'dwg') {
      setCadPreview({ item, kind: 'dwg' });
      recordOpenedItem(item, [
        location.folder?.name,
        ...folderTrail.map((folder) => folder.name),
      ]);
      return;
    }

    if (kind === 'dxf' && Number(item?.size || 0) > MAX_DXF_PREVIEW_BYTES) {
      setCadPreview({
        item,
        kind: 'dxf',
        error: 'This DXF is larger than the 10 MB mobile preview limit. Open it in SharePoint or another CAD app.',
      });
      return;
    }

    if (kind === 'external') {
      const operationJobKey = jobKey;
      try {
        const accessToken = await getAccessToken();
        await downloadAndShareJobFile({
          accessToken,
          driveId: location.drive.id,
          item,
          jobNumber: job?.number,
        });
        if (!isActiveJobOperation(operationJobKey)) return;
        recordOpenedItem(item, [
          location.folder?.name,
          ...folderTrail.map((folder) => folder.name),
        ]);
      } catch (openError) {
        if (!isActiveJobOperation(operationJobKey)) return;
        Alert.alert('Could not open file', openError?.message || 'The file could not be opened.');
      }
      return;
    }

    if (kind === 'text' && Number(item?.size || 0) > MAX_TEXT_PREVIEW_BYTES) {
      Alert.alert(
        'File is too large to preview',
        'Text previews are limited to 2 MB to keep the app responsive. Use the Share button to open this file in another app.',
      );
      return;
    }

    const operationJobKey = jobKey;
    setPreviewLoading(true);
    try {
      const accessToken = await getAccessToken();
      const localUri = await downloadJobFile({
        accessToken,
        driveId: location.drive.id,
        item,
        jobNumber: job?.number,
      });
      if (!isActiveJobOperation(operationJobKey)) return;
      if (kind === 'dxf') {
        const content = await FileSystem.readAsStringAsync(localUri);
        let html = '';
        let cadError = '';
        try {
          html = buildDxfPreviewHtml(content);
        } catch (parseError) {
          cadError = parseError?.message || 'This DXF could not be rendered.';
        }
        if (!isActiveJobOperation(operationJobKey)) return;
        setCadPreview({ item, localUri, kind: 'dxf', html, error: cadError });
        recordOpenedItem(item, [
          location.folder?.name,
          ...folderTrail.map((folder) => folder.name),
        ]);
        return;
      }
      const content = kind === 'text'
        ? formatJobFileText(await FileSystem.readAsStringAsync(localUri), item.name)
        : '';
      if (!isActiveJobOperation(operationJobKey)) return;
      setPreview({ item, localUri, kind, content });
      recordOpenedItem(item, [
        location.folder?.name,
        ...folderTrail.map((folder) => folder.name),
      ]);
    } catch (openError) {
      if (!isActiveJobOperation(operationJobKey)) return;
      Alert.alert('Could not open file', openError?.message || 'The file could not be opened.');
    } finally {
      if (isActiveJobOperation(operationJobKey)) setPreviewLoading(false);
    }
  }, [folderTrail, getAccessToken, isActiveJobOperation, job?.number, jobKey, location, openInSharePoint, recordOpenedItem]);

  const shareFile = useCallback(async (item) => {
    if (!location) return;
    try {
      const accessToken = await getAccessToken();
      await downloadAndShareJobFile({
        accessToken,
        driveId: location.drive.id,
        item,
        jobNumber: job?.number,
      });
    } catch (shareError) {
      Alert.alert('Download failed', shareError?.message || 'The file could not be downloaded.');
    }
  }, [getAccessToken, job?.number, location]);

  const saveTextFile = useCallback(async (item, content) => {
    if (!location?.drive?.id || !item?.id) throw new Error('This text file could not be identified.');
    const operationJobKey = jobKey;
    const accessToken = await getAccessToken();
    const updated = await updateJobTextFile({
      accessToken,
      driveId: location.drive.id,
      itemId: item.id,
      content,
      eTag: item.eTag,
      mimeType: item?.file?.mimeType,
    });
    if (!isActiveJobOperation(operationJobKey)) return;
    const nextItem = { ...item, ...updated, eTag: updated?.eTag || item.eTag };
    setItems((current) => current.map((candidate) => candidate.id === item.id ? nextItem : candidate));
    setPreview((current) => current?.item?.id === item.id
      ? { ...current, item: nextItem, content }
      : current);
    Alert.alert('Changes saved', `“${item.name}” has been updated in SharePoint.`);
  }, [getAccessToken, isActiveJobOperation, jobKey, location?.drive?.id]);

  const renameItem = useCallback(async (item, name) => {
    if (!location?.drive?.id || !item?.id) {
      throw new Error('This SharePoint item could not be identified.');
    }

    const operationJobKey = jobKey;
    try {
      setManagingItemId(item.id);
      const accessToken = await getAccessToken();
      const updatedItem = await renameJobItem({
        accessToken,
        driveId: location.drive.id,
        itemId: item.id,
        name,
      });
      if (!isActiveJobOperation(operationJobKey)) return;
      setItems((current) => current.map((candidate) => (
        candidate.id === item.id
          ? { ...candidate, ...updatedItem, name: updatedItem?.name || name }
          : candidate
      )));
    } finally {
      if (isActiveJobOperation(operationJobKey)) setManagingItemId('');
    }
  }, [getAccessToken, isActiveJobOperation, jobKey, location?.drive?.id]);

  const requestDeleteItem = useCallback((item) => {
    if (!location?.drive?.id || !item?.id) return;
    const isFolder = Boolean(item.folder);
    const typeLabel = isFolder ? 'folder' : 'file';
    const consequence = isFolder
      ? `“${item.name}” and everything inside it will be moved to the SharePoint recycle bin.`
      : `“${item.name}” will be moved to the SharePoint recycle bin.`;

    Alert.alert(
      `Delete ${typeLabel}?`,
      `${consequence}\n\nThis cannot be undone inside NorthGroup One.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const operationJobKey = jobKey;
            try {
              setManagingItemId(item.id);
              const accessToken = await getAccessToken();
              await deleteJobItem({
                accessToken,
                driveId: location.drive.id,
                itemId: item.id,
              });
              if (!isActiveJobOperation(operationJobKey)) return;
              setItems((current) => current.filter((candidate) => candidate.id !== item.id));
            } catch (deleteError) {
              if (!isActiveJobOperation(operationJobKey)) return;
              Alert.alert(
                `Could not delete ${typeLabel}`,
                deleteError?.message || 'The SharePoint item could not be removed.',
              );
            } finally {
              if (isActiveJobOperation(operationJobKey)) setManagingItemId('');
            }
          },
        },
      ],
    );
  }, [getAccessToken, isActiveJobOperation, jobKey, location?.drive?.id]);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <JobFilesHeader
        creatingFolder={creatingFolder}
        currentFolder={currentFolder}
        fileFilter={fileFilter}
        itemCount={displayedItems.length}
        jobNumber={job?.number}
        loading={loading}
        onChangeFilter={setFileFilter}
        onChangeSearch={setSearchQuery}
        onCreateFolder={openCreateFolder}
        onGoUp={goUp}
        onSort={() => setSortMode((current) => current === 'name' ? 'recent' : 'name')}
        onUpload={queuedUpload ? () => saveQueuedUpload(currentFolder) : chooseAndUpload}
        parentPathLabel={parentPathLabel}
        queuedAssetsCount={queuedAssets.length}
        queuedUpload={queuedUpload}
        searchQuery={searchQuery}
        sortMode={sortMode}
        totalCount={items.length}
        uploading={uploading}
      />

      {queuedUpload ? (
        <PendingUploadDestination assets={queuedAssets} label={formLabel} upload={queuedUpload} />
      ) : null}

      {!queuedUpload && !folderTrail.length && items.some((item) => item.folder) ? (
        <View style={styles.hintStrip}>
          <Ionicons name="information-circle-outline" size={17} color={colors.accentDark} />
          <Text style={styles.hintText}>Choose a folder before uploading so files are saved in the right place.</Text>
        </View>
      ) : null}

      <JobFileUploadProgress visible={uploading} progress={uploadProgress} status={uploadStatus} />

      <View style={styles.fileListGestureSurface} {...folderBackSwipe.panHandlers}>
        <FlatList
        style={styles.fileList} data={!loading && !error ? displayedItems : []}
        keyExtractor={(item) => item.id}
        extraData={`${fileFilter}:${sortMode}:${searchQuery}:${displayedItems.length}`} removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={9}
        ListEmptyComponent={(
          loading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator color={colors.accentDark} />
              <Text style={styles.stateTitle}>
                {queuedUpload ? 'Loading SharePoint folders…' : 'Loading job files…'}
              </Text>
              {queuedUpload ? (
                <Text style={styles.stateBody}>
                  Your PDFs are ready. Loading this job so you can choose exactly where to save them.
                </Text>
              ) : null}
            </View>
          ) : error ? (
            <View style={styles.errorCard}>
              <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
              <Text style={styles.errorTitle}>{missingWorkspace ? 'No job folder yet' : 'SharePoint connection issue'}</Text>
              <Text style={styles.errorBody}>{error}</Text>
              <View style={styles.errorActions}>
                <Pressable onPress={() => load()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryText}>TRY AGAIN</Text>
                </Pressable>
                {missingWorkspace ? (
                  <Pressable onPress={() => setShowWorkspaceCreator(true)} style={({ pressed }) => [styles.createWorkspaceButton, pressed && styles.pressed]}>
                    <Ionicons name="add-circle-outline" size={17} color={colors.navy} />
                    <Text style={styles.createWorkspaceText}>CREATE JOB FOLDER</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons name="folder-open-outline" size={30} color={colors.supportingText} />
              <Text style={styles.stateTitle}>This folder is empty</Text>
              <Text style={styles.stateBody}>Upload the first meaningful file for this job.</Text>
            </View>
          ) : (
            <View style={styles.stateCard}>
              <Ionicons name="search-outline" size={28} color={colors.supportingText} />
              <Text style={styles.stateTitle}>No matching files</Text>
              <Text style={styles.stateBody}>Try another search or select All.</Text>
            </View>
          )
        )}
        renderItem={({ item }) => (
          item.folder ? (
            <View style={styles.folderCard}>
              <Pressable
                onPress={() => openFolder(item)}
                onLongPress={() => setActionItem(item)}
                delayLongPress={400}
                style={({ pressed }) => [styles.folderMain, pressed && styles.pressed]}
              >
                <View style={[styles.itemIcon, styles.folderIcon]}>
                  <Ionicons name="folder-outline" size={22} color={colors.accentDark} />
                </View>
                <View style={styles.itemCopy}>
                  <Text numberOfLines={1} style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.folder.childCount || 0} items</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
              </Pressable>
              {queuedUpload ? (
                <Pressable
                  onPress={() => saveQueuedUpload(item)}
                  disabled={uploading}
                  style={({ pressed }) => [styles.chooseFolderButton, pressed && styles.pressed, uploading && styles.disabled]}
                >
                  <Ionicons name="checkmark-circle-outline" size={16} color={colors.navy} />
                  <Text style={styles.chooseFolderText}>SAVE HERE</Text>
                </Pressable>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`More actions for ${item.name}`}
                  disabled={managingItemId === item.id}
                  onPress={() => setActionItem(item)}
                  style={({ pressed }) => [styles.itemMoreButton, pressed && styles.pressed, managingItemId === item.id && styles.disabled]}
                >
                  {managingItemId === item.id
                    ? <ActivityIndicator size="small" color={colors.accentDark} />
                    : <Ionicons name="ellipsis-horizontal" size={20} color={colors.supportingText} />}
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.fileRow}>
              <Pressable
                disabled={previewLoading}
                onPress={() => openFile(item)}
                onLongPress={() => setActionItem(item)}
                delayLongPress={400}
                style={({ pressed }) => [styles.fileMain, pressed && styles.pressed, previewLoading && styles.disabled]}
              >
                <View style={[styles.itemIcon, getFileKind(item) === 'pdf' && styles.pdfIcon]}>
                  <Ionicons name={getFileIcon(item)} size={22} color={getFileKind(item) === 'pdf' ? colors.danger : colors.accentDark} />
                </View>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text numberOfLines={1} style={styles.itemMeta}>
                    {formatBytes(item.size)}{item.lastModifiedDateTime ? ` · ${formatModified(item.lastModifiedDateTime)}` : ''}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Share ${item.name}`}
                onPress={() => shareFile(item)}
                style={({ pressed }) => [styles.compactActionButton, pressed && styles.pressed]}
              >
                <Ionicons name="share-outline" size={18} color={colors.accentDark} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`More actions for ${item.name}`}
                disabled={managingItemId === item.id}
                onPress={() => setActionItem(item)}
                style={({ pressed }) => [styles.compactActionButton, pressed && styles.pressed, managingItemId === item.id && styles.disabled]}
              >
                {managingItemId === item.id
                  ? <ActivityIndicator size="small" color={colors.supportingText} />
                  : <Ionicons name="ellipsis-horizontal" size={20} color={colors.supportingText} />}
              </Pressable>
            </View>
          )
        )}
        />
      </View>

      <JobWorkspaceDock
        job={job}
        activeTab="files"
        onWorkspace={openWorkspace}
        onForms={openForms}
        onJobFiles={undefined}
        onCapture={openCapture}
      />

      <JobFileActionsSheet
        item={actionItem}
        onClose={() => setActionItem(null)}
        onRename={renameItem}
        onRequestMove={move.open}
        onRequestDelete={requestDeleteItem}
        onOpenSharePoint={openInSharePoint}
      />

      <JobFileMoveModal move={move} />

      <JobPdfGallery
        visible={Boolean(pdfGalleryItemId)}
        items={pdfItems}
        initialItemId={pdfGalleryItemId}
        driveId={location?.drive?.id}
        jobNumber={job?.number}
        getAccessToken={getAccessToken}
        downloadFile={downloadJobFile}
        onOpened={recordPdfOpened}
        onShare={shareFile}
        onClose={() => setPdfGalleryItemId('')}
        colors={colors}
      />

      <Modal
        visible={showCreateFolder}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!creatingFolder) setShowCreateFolder(false);
        }}
      >
        <View style={styles.modalShade}>
          <KeyboardAvoidingView
            style={styles.createFolderKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.createFolderModal}>
              <View style={styles.modalHandle} />
              <Text style={styles.destinationEyebrow}>CURRENT SHAREPOINT FOLDER</Text>
              <Text numberOfLines={1} style={styles.createFolderLocation}>
                {currentFolder?.name || 'Job Files'}
              </Text>
              <Text style={styles.modalTitle}>Create a folder</Text>
              <Text style={styles.modalBody}>Add a clear destination for photos, forms or project documents.</Text>
              <Text style={styles.createFolderLabel}>FOLDER NAME</Text>
              <TextInput
                value={folderName}
                onChangeText={setFolderName}
                editable={!creatingFolder}
                autoFocus
                autoCorrect={false}
                maxLength={255}
                placeholder="For example: Field Photos"
                placeholderTextColor={colors.placeholderText}
                returnKeyType="done"
                onSubmitEditing={createFolder}
                style={styles.createFolderInput}
              />
              <View style={styles.createFolderActions}>
                <Pressable
                  disabled={creatingFolder}
                  onPress={() => {
                    setShowCreateFolder(false);
                    setFolderName('');
                  }}
                  style={({ pressed }) => [styles.createFolderCancel, pressed && styles.pressed, creatingFolder && styles.disabled]}
                >
                  <Text style={styles.createFolderCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  disabled={!folderName.trim() || creatingFolder}
                  onPress={createFolder}
                  style={({ pressed }) => [
                    styles.createFolderSave,
                    pressed && styles.pressed,
                    (!folderName.trim() || creatingFolder) && styles.disabled,
                  ]}
                >
                  {creatingFolder ? <ActivityIndicator size="small" color={colors.navy} /> : null}
                  <Text style={styles.createFolderSaveText}>{creatingFolder ? 'Creating' : 'Create folder'}</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={showFolderPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFolderPicker(false)}
      >
        <View style={styles.modalShade}>
          <View style={styles.destinationModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.destinationEyebrow}>UPLOAD DESTINATION</Text>
            <Text style={styles.modalTitle}>Choose a folder first</Text>
            <Text style={styles.modalBody}>
              Open the folder where this file belongs, then tap Upload again.
            </Text>
            {items.filter((item) => item.folder).map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setShowFolderPicker(false);
                  openFolder(item);
                }}
                style={({ pressed }) => [styles.modalFolderRow, pressed && styles.pressed]}
              >
                <View style={[styles.itemIcon, styles.folderIcon]}>
                  <Ionicons name="folder-outline" size={21} color={colors.accentDark} />
                </View>
                <View style={styles.itemCopy}>
                  <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.folder.childCount || 0} items</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
              </Pressable>
            ))}
            <Pressable
              onPress={() => setShowFolderPicker(false)}
              style={({ pressed }) => [styles.modalCancel, pressed && styles.pressed]}
            >
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <JobFilePreviewModal
        preview={preview}
        onClose={() => setPreview(null)}
        onSaveText={saveTextFile}
        onShare={shareFile}
      />

      <JobCadViewerModal
        preview={cadPreview}
        onClose={() => setCadPreview(null)}
        onOpenSharePoint={openInSharePoint}
        onShare={shareFile}
      />

      <JobWorkspaceCreateModal
        expectedName={missingWorkspace?.expectedName}
        onClose={() => setShowWorkspaceCreator(false)}
        onCreate={createMissingWorkspace}
        visible={showWorkspaceCreator}
      />
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  fileListGestureSurface: { flex: 1, minHeight: 0 }, fileList: { flex: 1 },
  destinationEyebrow: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1.05 },
  hintStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, backgroundColor: colors.warningBackground, borderBottomWidth: 1, borderBottomColor: colors.border },
  hintText: { flex: 1, color: colors.supportingText, fontSize: 10, lineHeight: 15 },
  content: { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingTop: 10 },
  folderCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingLeft: 10, paddingRight: 7, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  folderMain: { flex: 1, minWidth: 0, minHeight: 62, flexDirection: 'row', alignItems: 'center' },
  itemMoreButton: { width: 40, height: 44, marginLeft: 4, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  chooseFolderButton: { width: 80, minHeight: 44, marginLeft: 5, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  chooseFolderText: { color: colors.navy, fontSize: 8, fontWeight: '900', letterSpacing: 0.45, marginTop: 2 },
  fileRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingHorizontal: 8, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fileMain: { flex: 1, minWidth: 0, minHeight: 66, flexDirection: 'row', alignItems: 'center' },
  compactActionButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md },
  itemIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  folderIcon: { backgroundColor: colors.warningBackground },
  pdfIcon: { backgroundColor: colors.dangerBackground || colors.surfaceRaised },
  itemCopy: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 8 },
  itemName: { color: colors.bodyText, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  itemMeta: { color: colors.supportingText, fontSize: 10, marginTop: 4 },
  stateCard: { alignItems: 'center', padding: 28, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 10 },
  stateBody: { color: colors.supportingText, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  errorCard: { alignItems: 'center', padding: 24, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  errorTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 9 },
  errorBody: { color: colors.supportingText, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  errorActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 9, marginTop: 16 },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  retryText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  createWorkspaceButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: colors.accent },
  createWorkspaceText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  createFolderKeyboard: { width: '100%', justifyContent: 'flex-end' },
  createFolderModal: { padding: SPACING.xl, paddingBottom: SPACING.xl + 4, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, backgroundColor: colors.surface },
  createFolderLocation: { color: colors.bodyText, fontSize: 12, fontWeight: '900', marginTop: 4 },
  createFolderLabel: { color: colors.supportingText, fontSize: 9, fontWeight: '900', letterSpacing: 1.05, marginBottom: 8 },
  createFolderInput: { minHeight: 52, paddingHorizontal: 15, borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.inputBackground, color: colors.bodyText, fontSize: 15, fontWeight: '700' },
  createFolderActions: { flexDirection: 'row', gap: 10, marginTop: SPACING.lg },
  createFolderCancel: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: colors.border },
  createFolderCancelText: { color: colors.supportingText, fontSize: 11, fontWeight: '900' },
  createFolderSave: { flex: 1.35, minHeight: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: colors.accent },
  createFolderSaveText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  destinationModal: { maxHeight: '82%', padding: SPACING.xl, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, backgroundColor: colors.surface },
  modalHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, marginBottom: SPACING.lg, backgroundColor: colors.borderStrong },
  modalTitle: { color: colors.bodyText, fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 5 },
  modalBody: { color: colors.supportingText, fontSize: 12, lineHeight: 18, marginTop: 5, marginBottom: SPACING.lg },
  modalFolderRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, marginBottom: 9, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raisedSurface },
  modalCancel: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.sm, borderRadius: RADIUS.md, backgroundColor: colors.navy },
  modalCancelText: { color: colors.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});