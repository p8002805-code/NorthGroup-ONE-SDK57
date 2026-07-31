import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppHeader from '../../../components/AppHeader';
import AppStatusPill from '../../../components/AppStatusPill';
import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';
import {
  downloadAndShareJobFile,
  downloadJobFile,
  listFolderItems,
  listJobFiles,
  uploadJobFile,
} from '../jobFilesService';

const formatBytes = (value) => {
  const bytes = Number(value || 0);
  if (!bytes) return '0 KB';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const amount = bytes / (1024 ** index);
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
};

const formatModified = (value) => {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export default function JobFilesScreen({ job, goBack, getAccessToken }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [location, setLocation] = useState(null);
  const [items, setItems] = useState([]);
  const [folderTrail, setFolderTrail] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const currentFolder = folderTrail[folderTrail.length - 1] || location?.folder || null;

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      if (!location) {
        const result = await listJobFiles({ accessToken, job });
        setLocation(result);
        setItems(result.items);
        setFolderTrail([]);
      } else {
        const folder = currentFolder || location.folder;
        const nextItems = await listFolderItems({
          accessToken,
          driveId: location.drive.id,
          folderId: folder.id,
        });
        setItems(nextItems);
      }
    } catch (loadError) {
      setError(loadError?.message || 'Job Files could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentFolder, getAccessToken, job, location]);

  useEffect(() => {
    load();
  }, []); // Resolve the SharePoint location once when this screen opens.

  const refresh = useCallback(() => {
    setRefreshing(true);
    load({ quiet: true });
  }, [load]);

  const openFolder = useCallback(async (item) => {
    if (!location) return;
    setLoading(true);
    setError('');
    try {
      const accessToken = await getAccessToken();
      const nextItems = await listFolderItems({
        accessToken,
        driveId: location.drive.id,
        folderId: item.id,
      });
      setFolderTrail((current) => [...current, item]);
      setItems(nextItems);
    } catch (folderError) {
      setError(folderError?.message || 'This folder could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, location]);

  const goUp = useCallback(async () => {
    if (!location || folderTrail.length === 0) return;
    const nextTrail = folderTrail.slice(0, -1);
    const parent = nextTrail[nextTrail.length - 1] || location.folder;
    setLoading(true);
    try {
      const accessToken = await getAccessToken();
      const nextItems = await listFolderItems({
        accessToken,
        driveId: location.drive.id,
        folderId: parent.id,
      });
      setFolderTrail(nextTrail);
      setItems(nextItems);
    } catch (folderError) {
      setError(folderError?.message || 'The parent folder could not be opened.');
    } finally {
      setLoading(false);
    }
  }, [folderTrail, getAccessToken, location]);

  const chooseAndUpload = useCallback(async () => {
    if (!location || !currentFolder || uploading) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setUploading(true);
      setUploadProgress(0);
      const accessToken = await getAccessToken();
      await uploadJobFile({
        accessToken,
        driveId: location.drive.id,
        folderId: currentFolder.id,
        asset,
        onProgress: setUploadProgress,
      });
      await load({ quiet: true });
      Alert.alert('Upload complete', `${asset.name || 'The file'} is now available to this job.`);
    } catch (uploadError) {
      Alert.alert('Upload failed', uploadError?.message || 'The file could not be uploaded.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [currentFolder, getAccessToken, load, location, uploading]);

  const getFileKind = useCallback((item) => {
    const name = String(item?.name || '').toLowerCase();
    const mime = String(item?.file?.mimeType || '').toLowerCase();
    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(name)) return 'image';
    if (mime === 'application/pdf' || /\.pdf$/i.test(name)) return 'pdf';
    if (/\.(doc|docx|xls|xlsx|ppt|pptx)$/i.test(name)) return 'office';
    return 'external';
  }, []);

  const openInSharePoint = useCallback(async (item) => {
    if (!item?.webUrl) return;
    try {
      await Linking.openURL(item.webUrl);
    } catch {
      Alert.alert('Could not open SharePoint', 'The SharePoint page could not be opened.');
    }
  }, []);

  const openFile = useCallback(async (item) => {
    if (!location) return;
    const kind = getFileKind(item);

    if (kind === 'office') {
      await openInSharePoint(item);
      return;
    }

    if (kind === 'external') {
      try {
        const accessToken = await getAccessToken();
        await downloadAndShareJobFile({ accessToken, driveId: location.drive.id, item });
      } catch (openError) {
        Alert.alert('Could not open file', openError?.message || 'The file could not be opened.');
      }
      return;
    }

    setPreviewLoading(true);
    try {
      const accessToken = await getAccessToken();
      const localUri = await downloadJobFile({ accessToken, driveId: location.drive.id, item });
      setPreview({ item, localUri, kind });
    } catch (openError) {
      Alert.alert('Could not open file', openError?.message || 'The file could not be opened.');
    } finally {
      setPreviewLoading(false);
    }
  }, [getAccessToken, getFileKind, location, openInSharePoint]);

  const shareFile = useCallback(async (item) => {
    if (!location) return;
    try {
      const accessToken = await getAccessToken();
      await downloadAndShareJobFile({
        accessToken,
        driveId: location.drive.id,
        item,
      });
    } catch (shareError) {
      Alert.alert('Download failed', shareError?.message || 'The file could not be downloaded.');
    }
  }, [getAccessToken, location]);

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
      <AppHeader
        eyebrow="JOB WORKSPACE"
        title="Job Files"
        subtitle={job?.number ? `${job.number} · ${job.name || job.location || ''}` : 'No active job'}
        onBack={goBack}
        backLabel="Workspace"
        showTopo
        compact
        rightContent={<AppStatusPill label="SHAREPOINT" tone="info" dot />}
      />

      <View style={styles.toolbar}>
        <View style={styles.pathCopy}>
          <Text style={styles.pathEyebrow}>CURRENT FOLDER</Text>
          <Text numberOfLines={1} style={styles.pathTitle}>
            {currentFolder?.name || 'Connecting to SharePoint…'}
          </Text>
        </View>
        {folderTrail.length ? (
          <Pressable onPress={goUp} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
            <Ionicons name="arrow-up" size={20} color={colors.accentDark} />
          </Pressable>
        ) : null}
        <Pressable
          disabled={!currentFolder || uploading}
          onPress={chooseAndUpload}
          style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed, (!currentFolder || uploading) && styles.disabled]}
        >
          <Ionicons name="cloud-upload-outline" size={18} color={colors.navy} />
          <Text style={styles.uploadButtonText}>{uploading ? 'Uploading' : 'Upload'}</Text>
        </Pressable>
      </View>

      {uploading ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(3, Math.round(uploadProgress * 100))}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(uploadProgress * 100)}%</Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xxxl }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color={colors.accentDark} />
            <Text style={styles.stateTitle}>Loading job files…</Text>
          </View>
        ) : null}

        {!loading && error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={26} color={colors.danger} />
            <Text style={styles.errorTitle}>SharePoint connection issue</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable onPress={() => load()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>TRY AGAIN</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && !error && items.length === 0 ? (
          <View style={styles.stateCard}>
            <Ionicons name="folder-open-outline" size={30} color={colors.supportingText} />
            <Text style={styles.stateTitle}>This folder is empty</Text>
            <Text style={styles.stateBody}>Upload the first meaningful file for this job.</Text>
          </View>
        ) : null}

        {!loading && !error ? items.map((item) => (
          item.folder ? (
            <Pressable
              key={item.id}
              onPress={() => openFolder(item)}
              style={({ pressed }) => [styles.folderCard, pressed && styles.pressed]}
            >
              <View style={[styles.itemIcon, styles.folderIcon]}>
                <Ionicons name="folder-outline" size={23} color={colors.accentDark} />
              </View>
              <View style={styles.itemCopy}>
                <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>{item.folder.childCount || 0} items</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.supportingText} />
            </Pressable>
          ) : (
            <View key={item.id} style={styles.fileCard}>
              <View style={styles.fileHeader}>
                <View style={styles.itemIcon}>
                  <Ionicons name="document-outline" size={23} color={colors.navy} />
                </View>
                <View style={styles.itemCopy}>
                  <Text numberOfLines={2} style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>
                    {formatBytes(item.size)}{item.lastModifiedDateTime ? ` · ${formatModified(item.lastModifiedDateTime)}` : ''}
                  </Text>
                </View>
              </View>

              <Pressable
                disabled={previewLoading}
                onPress={() => openFile(item)}
                style={({ pressed }) => [styles.openButton, pressed && styles.openButtonPressed, previewLoading && styles.disabled]}
              >
                <Ionicons
                  name={getFileKind(item) === 'external' ? 'open-outline' : 'eye-outline'}
                  size={20}
                  color={colors.white}
                />
                <Text style={styles.openButtonText}>
                  {getFileKind(item) === 'office' ? 'OPEN / EDIT FILE' : getFileKind(item) === 'external' ? 'OPEN / SHARE FILE' : 'OPEN / VIEW FILE'}
                </Text>
              </Pressable>

              <View style={styles.fileActions}>
                <Pressable onPress={() => shareFile(item)} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Ionicons name="share-outline" size={18} color={colors.accentDark} />
                  <Text style={styles.actionText}>Share</Text>
                </Pressable>
                <View style={styles.actionDivider} />
                <Pressable onPress={() => openInSharePoint(item)} style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
                  <Ionicons name="ellipsis-horizontal" size={19} color={colors.supportingText} />
                  <Text style={styles.actionTextMuted}>SharePoint</Text>
                </Pressable>
              </View>
            </View>
          )
        )) : null}
      </ScrollView>
      <Modal visible={Boolean(preview)} animationType="slide" onRequestClose={() => setPreview(null)}>
        <View style={styles.previewPage}>
          <View style={[styles.previewHeader, { paddingTop: insets.top + 8 }]}> 
            <Pressable onPress={() => setPreview(null)} style={({ pressed }) => [styles.previewHeaderButton, pressed && styles.pressed]}>
              <Ionicons name="chevron-back" size={24} color={colors.white} />
            </Pressable>
            <View style={styles.previewHeaderCopy}>
              <Text numberOfLines={1} style={styles.previewTitle}>{preview?.item?.name || 'File preview'}</Text>
              <Text style={styles.previewSubtitle}>JOB FILE</Text>
            </View>
            <Pressable onPress={() => preview?.item && shareFile(preview.item)} style={({ pressed }) => [styles.previewHeaderButton, pressed && styles.pressed]}>
              <Ionicons name="share-outline" size={22} color={colors.white} />
            </Pressable>
          </View>
          {preview?.kind === 'image' ? (
            <ScrollView
              maximumZoomScale={4}
              minimumZoomScale={1}
              centerContent
              contentContainerStyle={styles.imagePreviewContent}
            >
              <Image source={{ uri: preview.localUri }} style={styles.previewImage} resizeMode="contain" />
            </ScrollView>
          ) : preview?.kind === 'pdf' ? (
            <WebView
              source={{ uri: preview.localUri }}
              style={styles.previewWebView}
              originWhitelist={['*']}
              allowFileAccess
              allowingReadAccessToURL={preview.localUri}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBackground },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  pathCopy: { flex: 1, minWidth: 0 },
  pathEyebrow: { color: colors.accentDark, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  pathTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 2 },
  iconButton: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  uploadButton: { height: 40, paddingHorizontal: 13, borderRadius: RADIUS.md, flexDirection: 'row', gap: 7, alignItems: 'center', backgroundColor: colors.accent },
  uploadButtonText: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: SPACING.lg, paddingVertical: 8, backgroundColor: colors.surface },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.border },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },
  progressText: { width: 36, color: colors.bodyText, fontSize: 10, fontWeight: '900', textAlign: 'right' },
  content: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  folderCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingHorizontal: 12, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fileCard: { marginBottom: 12, padding: 12, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  fileHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center' },
  itemIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceRaised },
  folderIcon: { backgroundColor: colors.warningBackground },
  itemCopy: { flex: 1, minWidth: 0, marginLeft: 12, marginRight: 8 },
  itemName: { color: colors.bodyText, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  itemMeta: { color: colors.supportingText, fontSize: 10, marginTop: 4 },
  openButton: { minHeight: 50, marginTop: 10, borderRadius: RADIUS.md, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, borderWidth: 1, borderColor: colors.navy },
  openButtonPressed: { opacity: 0.82, transform: [{ scale: 0.995 }] },
  openButtonText: { color: colors.white, fontSize: 12, fontWeight: '900', letterSpacing: 0.65 },
  fileActions: { minHeight: 42, marginTop: 7, flexDirection: 'row', alignItems: 'center' },
  actionButton: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: colors.border },
  actionText: { color: colors.accentDark, fontSize: 10, fontWeight: '900' },
  actionTextMuted: { color: colors.supportingText, fontSize: 10, fontWeight: '800' },
  previewPage: { flex: 1, backgroundColor: '#000000' },
  previewHeader: { minHeight: 70, paddingHorizontal: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.navy },
  previewHeaderButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  previewHeaderCopy: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  previewTitle: { color: colors.white, fontSize: 14, fontWeight: '900', textAlign: 'center' },
  previewSubtitle: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center', marginTop: 3 },
  imagePreviewContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  previewImage: { width: '100%', height: '100%' },
  previewWebView: { flex: 1, backgroundColor: '#FFFFFF' },
  stateCard: { alignItems: 'center', padding: 28, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  stateTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 10 },
  stateBody: { color: colors.supportingText, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 5 },
  errorCard: { alignItems: 'center', padding: 24, borderRadius: RADIUS.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.danger },
  errorTitle: { color: colors.bodyText, fontSize: 14, fontWeight: '900', marginTop: 9 },
  errorBody: { color: colors.supportingText, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  retryButton: { marginTop: 16, paddingHorizontal: 18, paddingVertical: 10, borderRadius: RADIUS.md, backgroundColor: colors.accent },
  retryText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.65 },
});
