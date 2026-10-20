import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DISMISS_DISTANCE = 68;
const DISMISS_VELOCITY = 0.55;

export default function JobPdfGallery({
  visible,
  items = [],
  initialItemId,
  driveId,
  jobNumber,
  getAccessToken,
  downloadFile,
  onOpened,
  onShare,
  onClose,
  colors,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const translateY = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const webViewRef = useRef(null);
  const localUrisRef = useRef(new Map());
  const downloadPromisesRef = useRef(new Map());
  const downloadEpochRef = useRef(0);
  const requestIdRef = useRef(0);
  const reportedItemIdRef = useRef('');
  const onOpenedRef = useRef(onOpened);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [localUri, setLocalUri] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingIndex, setPendingIndex] = useState(null);
  const [error, setError] = useState('');
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  const currentItem = items[currentIndex] || null;

  useEffect(() => {
    onOpenedRef.current = onOpened;
  }, [onOpened]);

  const clearSessionFileReferences = useCallback(() => {
    localUrisRef.current.clear();
  }, []);

  useEffect(() => {
    downloadEpochRef.current += 1;
    if (!visible) {
      requestIdRef.current += 1;
      clearSessionFileReferences();
      downloadPromisesRef.current.clear();
      reportedItemIdRef.current = '';
      setPendingIndex(null);
      return;
    }
    clearSessionFileReferences();
    downloadPromisesRef.current.clear();
    const nextIndex = Math.max(0, items.findIndex((item) => item.id === initialItemId));
    setCurrentIndex(nextIndex);
    setLocalUri('');
    setLoading(true);
    setPendingIndex(null);
    setError('');
    reportedItemIdRef.current = '';
    closingRef.current = false;
    translateY.setValue(0);
  }, [clearSessionFileReferences, initialItemId, items, translateY, visible]);

  useEffect(() => () => {
    downloadEpochRef.current += 1;
    clearSessionFileReferences();
    downloadPromisesRef.current.clear();
  }, [clearSessionFileReferences]);

  const reportOpened = useCallback((item) => {
    if (!item?.id || reportedItemIdRef.current === item.id) return;
    reportedItemIdRef.current = item.id;
    onOpenedRef.current?.(item);
  }, []);

  const getLocalUri = useCallback(async (item) => {
    if (!item?.id || !driveId) throw new Error('This PDF could not be identified.');

    const cachedUri = localUrisRef.current.get(item.id);
    if (cachedUri) return cachedUri;

    const activeDownload = downloadPromisesRef.current.get(item.id);
    if (activeDownload) return activeDownload;

    const downloadEpoch = downloadEpochRef.current;
    const downloadPromise = (async () => {
      const uri = await downloadFile({
        getAccessToken,
        driveId,
        item,
        jobNumber,
        persist: true,
      });
      if (visibleRef.current && downloadEpochRef.current === downloadEpoch) {
        localUrisRef.current.set(item.id, uri);
      }
      return uri;
    })();

    downloadPromisesRef.current.set(item.id, downloadPromise);
    try {
      return await downloadPromise;
    } finally {
      if (downloadPromisesRef.current.get(item.id) === downloadPromise) {
        downloadPromisesRef.current.delete(item.id);
      }
    }
  }, [downloadFile, driveId, getAccessToken, jobNumber]);

  const loadCurrent = useCallback(async () => {
    if (!visible || !currentItem || !driveId) return;

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    setError('');
    try {
      const uri = await getLocalUri(currentItem);
      if (requestIdRef.current !== requestId) return;
      setLocalUri(uri);
      reportOpened(currentItem);
    } catch (loadError) {
      if (requestIdRef.current !== requestId) return;
      setError(loadError?.message || 'This PDF could not be opened.');
      setLoading(false);
    }
  }, [currentItem, driveId, getLocalUri, reportOpened, visible]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const moveTo = useCallback(async (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= items.length || nextIndex === currentIndex) return;
    if (pendingIndex !== null) return;

    const nextItem = items[nextIndex];
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setPendingIndex(nextIndex);
    setError('');

    try {
      const nextUri = await getLocalUri(nextItem);
      if (requestIdRef.current !== requestId) return;

      setLoading(true);
      setCurrentIndex(nextIndex);
      setLocalUri(nextUri);
      reportedItemIdRef.current = '';
      reportOpened(nextItem);
    } catch (navigationError) {
      if (requestIdRef.current !== requestId) return;
      Alert.alert(
        'PDF unavailable',
        navigationError?.message || `${nextItem?.name || 'The next PDF'} could not be opened.`,
      );
    } finally {
      if (requestIdRef.current === requestId) setPendingIndex(null);
    }
  }, [currentIndex, getLocalUri, items, pendingIndex, reportOpened]);

  const restoreViewerPosition = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      speed: 24,
      bounciness: 4,
    }).start();
  }, [translateY]);

  const closeToFolder = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(translateY, {
      toValue: windowHeight + 40,
      duration: 190,
      useNativeDriver: true,
    }).start(() => {
      onClose?.();
      translateY.setValue(0);
      closingRef.current = false;
    });
  }, [onClose, translateY, windowHeight]);

  const isCurrentDocumentRequest = useCallback((url) => {
    const normaliseUrl = (value) => {
      const urlWithoutPage = String(value || '').split('#')[0];
      try {
        return decodeURIComponent(urlWithoutPage);
      } catch {
        return urlWithoutPage;
      }
    };
    const requestedUrl = normaliseUrl(url);
    const documentUrl = normaliseUrl(localUri);
    return Boolean(documentUrl && requestedUrl === documentUrl);
  }, [localUri]);

  const dismissResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      gesture.dy > 10
      && gesture.dy > Math.abs(gesture.dx) * 1.2
    ),
    onMoveShouldSetPanResponder: (_event, gesture) => (
      gesture.dy > 10
      && gesture.dy > Math.abs(gesture.dx) * 1.2
    ),
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_event, gesture) => {
      translateY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) closeToFolder();
      else restoreViewerPosition();
    },
    onPanResponderTerminate: restoreViewerPosition,
  }), [closeToFolder, restoreViewerPosition, translateY]);

  const previousDisabled = currentIndex <= 0 || pendingIndex !== null || loading;
  const nextDisabled = currentIndex >= items.length - 1 || pendingIndex !== null || loading;
  const pendingItem = pendingIndex === null ? null : items[pendingIndex];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={closeToFolder}>
      <Animated.View
        style={[styles.page, { transform: [{ translateY }] }]}
      >
        <StatusBar barStyle="light-content" backgroundColor={colors.navy} />
        <View
          accessibilityLabel="Pull down to close PDF"
          style={[styles.dismissGestureZone, { paddingTop: insets.top }]}
          {...dismissResponder.panHandlers}
        >
          <View pointerEvents="none" style={styles.pullHandle} />
          <Text pointerEvents="none" style={styles.dismissGestureText}>PULL DOWN TO CLOSE</Text>
        </View>
        <View
          style={styles.header}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to the containing folder"
            onPress={closeToFolder}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={25} color={colors.white} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.title}>{currentItem?.name || 'PDF'}</Text>
            <Text style={styles.subtitle}>
              {items.length ? `${currentIndex + 1} OF ${items.length} · USE BUTTONS TO BROWSE` : 'JOB PDF'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share ${currentItem?.name || 'PDF'}`}
            disabled={!currentItem}
            onPress={() => currentItem && onShare?.(currentItem)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
          >
            <Ionicons name="share-outline" size={22} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.viewer}>
          <View style={styles.document}>
            {loading && !localUri ? (
              <View style={styles.state}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.stateText}>Loading {currentItem?.name || 'PDF'}…</Text>
              </View>
            ) : null}

            {!loading && error && !localUri ? (
              <View style={styles.state}>
                <Ionicons name="alert-circle-outline" size={34} color={colors.accent} />
                <Text style={styles.errorTitle}>PDF unavailable</Text>
                <Text style={styles.stateText}>{error}</Text>
                <Pressable onPress={loadCurrent} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
                  <Text style={styles.retryText}>TRY AGAIN</Text>
                </Pressable>
              </View>
            ) : null}

            {!error && localUri ? (
              <WebView
                ref={webViewRef}
                key={`${currentItem?.id}-${localUri}`}
                source={{ uri: localUri }}
                style={styles.webView}
                originWhitelist={['file://*']}
                allowFileAccess
                allowFileAccessFromFileURLs={false}
                allowUniversalAccessFromFileURLs={false}
                mixedContentMode="never"
                javaScriptCanOpenWindowsAutomatically={false}
                sharedCookiesEnabled={false}
                thirdPartyCookiesEnabled={false}
                allowsLinkPreview={false}
                allowingReadAccessToURL={localUri}
                allowsBackForwardNavigationGestures={false}
                bounces={false}
                directionalLockEnabled
                javaScriptEnabled={false}
                setSupportMultipleWindows={false}
                onShouldStartLoadWithRequest={(request) => isCurrentDocumentRequest(request?.url)}
                onNavigationStateChange={(navigationState) => {
                  if (!isCurrentDocumentRequest(navigationState?.url)) {
                    webViewRef.current?.stopLoading?.();
                  }
                }}
                onLoadEnd={() => setLoading(false)}
              />
            ) : null}

            {loading && localUri ? (
              <View style={styles.loadingCover}>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.stateText}>Rendering {currentItem?.name || 'PDF'}…</Text>
              </View>
            ) : null}
          </View>

          {items.length > 1 ? (
            <View style={[styles.pdfNavigation, { bottom: insets.bottom + 14 }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open previous PDF"
                hitSlop={6}
                disabled={previousDisabled}
                onPress={() => moveTo(currentIndex - 1)}
                style={({ pressed }) => [
                  styles.pdfNavigationButton,
                  previousDisabled && styles.pdfNavigationButtonDisabled,
                  pressed && !previousDisabled && styles.pressed,
                ]}
              >
                <Ionicons name="chevron-back" size={20} color={colors.white} />
                <Text style={styles.pdfNavigationButtonText}>PREV</Text>
              </Pressable>
              <View style={styles.pdfNavigationCount}>
                {pendingIndex !== null ? <ActivityIndicator size="small" color={colors.accent} /> : null}
                <Text style={styles.pageCountText}>
                  {pendingItem ? `LOADING ${pendingIndex + 1}` : `${currentIndex + 1} / ${items.length}`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open next PDF"
                hitSlop={6}
                disabled={nextDisabled}
                onPress={() => moveTo(currentIndex + 1)}
                style={({ pressed }) => [
                  styles.pdfNavigationButton,
                  nextDisabled && styles.pdfNavigationButtonDisabled,
                  pressed && !nextDisabled && styles.pressed,
                ]}
              >
                <Text style={styles.pdfNavigationButtonText}>NEXT</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (colors) => StyleSheet.create({
  page: { flex: 1, backgroundColor: '#000000' },
  dismissGestureZone: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 7,
    backgroundColor: colors.navy,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navy,
  },
  pullHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.58)',
  },
  dismissGestureText: { marginTop: 5, color: 'rgba(255, 255, 255, 0.58)', fontSize: 7, fontWeight: '900', letterSpacing: 1.05 },
  headerButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  headerCopy: { flex: 1, minWidth: 0, paddingHorizontal: 8 },
  title: { color: colors.white, fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.accent, fontSize: 8, fontWeight: '900', letterSpacing: 0.9, textAlign: 'center', marginTop: 3 },
  viewer: { flex: 1, overflow: 'hidden', backgroundColor: '#16181D' },
  document: { flex: 1, backgroundColor: '#FFFFFF' },
  webView: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingCover: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#16181D',
  },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#16181D' },
  stateText: { maxWidth: 300, marginTop: 12, color: '#D6DBE1', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  errorTitle: { marginTop: 12, color: colors.white, fontSize: 17, fontWeight: '900' },
  retryButton: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.accent },
  retryText: { color: colors.navy, fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  pdfNavigation: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 31,
    backgroundColor: 'rgba(10, 16, 25, 0.90)',
  },
  pdfNavigationButton: {
    minWidth: 96,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  pdfNavigationButtonDisabled: { opacity: 0.28 },
  pdfNavigationButtonText: { color: colors.white, fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
  pdfNavigationCount: {
    minWidth: 68,
    height: 50,
    paddingHorizontal: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  pageCountText: { color: colors.white, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.62 },
});
