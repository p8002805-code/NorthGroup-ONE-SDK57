import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  gpsColour,
  resolvePhotoUri,
} from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";

const isDownwardSingleFingerGesture = (
  gesture,
  minimumDistance = 8,
  directionRatio = 1.12,
) => {
  const activeTouches = gesture.numberActiveTouches || 1;
  return (
    activeTouches <= 1 &&
    gesture.dy > minimumDistance &&
    gesture.dy > Math.abs(gesture.dx) * directionRatio
  );
};

const shouldFinishViewerDismiss = (gesture) => {
  const mostlyVertical = gesture.dy > Math.abs(gesture.dx) * 1.04;
  return (
    mostlyVertical &&
    (gesture.dy > 44 || (gesture.dy > 25 && gesture.vy > 0.45))
  );
};

export default function PhotoViewerModal({
  insets,
  onClose,
  onCloseToGallery,
  onPhotoChange,
  onRequestDelete,
  onRestore,
  onSaveCopy,
  onShare,
  previewPhoto,
  previewPhotos,
}) {
  const { width, height } = useWindowDimensions();
  const [zoomedPhotoId, setZoomedPhotoId] = useState(null);
  const closingRef = useRef(false);
  const dismissY = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const indexRef = useRef(0);
  const visibleIndexRef = useRef(0);
  const touchStartRef = useRef(null);
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;
  const handleViewableItemsChanged = useRef(({ viewableItems }) => {
    const visible = viewableItems.find(
      (item) => item.isViewable && Number.isInteger(item.index),
    );
    if (visible) visibleIndexRef.current = visible.index;
  }).current;

  useEffect(() => {
    if (!previewPhoto) return;
    closingRef.current = false;
    dismissY.setValue(0);
    const nextIndex = Math.max(
      0,
      previewPhotos.findIndex((item) => item.id === previewPhoto.id),
    );
    indexRef.current = nextIndex;
    visibleIndexRef.current = nextIndex;
  }, [dismissY, previewPhoto?.id]);

  const previewIndex = Math.max(
    0,
    previewPhotos.findIndex((item) => item.id === previewPhoto?.id),
  );
  const previewAccuracy =
    previewPhoto?.horizontalAccuracy === "" ||
    previewPhoto?.horizontalAccuracy == null
      ? null
      : Number(previewPhoto.horizontalAccuracy);

  const close = () => {
    closingRef.current = true;
    setZoomedPhotoId(null);
    onClose();
  };

  const resetPosition = () =>
    Animated.spring(dismissY, {
      toValue: 0,
      speed: 24,
      bounciness: 5,
      useNativeDriver: true,
    }).start();

  const finishDismiss = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    Animated.timing(dismissY, {
      toValue: Math.max(height, 700),
      duration: 170,
      useNativeDriver: true,
    }).start(() => {
      setZoomedPhotoId(null);
      onCloseToGallery();
    });
  };

  const dismissResponder = useMemo(() => {
    const shouldDismiss = (_, gesture) =>
      !zoomedPhotoId && isDownwardSingleFingerGesture(gesture);

    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: shouldDismiss,
      onMoveShouldSetPanResponder: shouldDismiss,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => dismissY.setValue(0),
      onPanResponderMove: (_, gesture) =>
        dismissY.setValue(Math.max(0, gesture.dy)),
      onPanResponderRelease: (_, gesture) => {
        if (shouldFinishViewerDismiss(gesture)) finishDismiss();
        else resetPosition();
      },
      onPanResponderTerminate: (_, gesture) => {
        if (shouldFinishViewerDismiss(gesture)) finishDismiss();
        else resetPosition();
      },
    });
  }, [dismissY, finishDismiss, resetPosition, zoomedPhotoId]);

  const handleTouchStart = (event) => {
    const touches = event.nativeEvent.touches || [];
    if (touches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const touch = touches[0];
    touchStartRef.current = {
      x: touch.pageX ?? touch.locationX ?? 0,
      y: touch.pageY ?? touch.locationY ?? 0,
      time: Date.now(),
    };
  };

  const handleTouchMove = (event) => {
    const touches = event.nativeEvent.touches || [];
    const start = touchStartRef.current;
    if (
      touches.length !== 1 ||
      !start ||
      zoomedPhotoId ||
      closingRef.current
    ) {
      return;
    }
    const touch = touches[0];
    const dx = (touch.pageX ?? touch.locationX ?? 0) - start.x;
    const dy = (touch.pageY ?? touch.locationY ?? 0) - start.y;
    if (dy > 8 && dy > Math.abs(dx) * 1.08) {
      dismissY.setValue(Math.max(0, dy));
    }
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || zoomedPhotoId || closingRef.current) return;
    const touch = event.nativeEvent.changedTouches?.[0];
    if (!touch) return;
    const dx = (touch.pageX ?? touch.locationX ?? 0) - start.x;
    const dy = (touch.pageY ?? touch.locationY ?? 0) - start.y;
    if (dy <= 8 || dy <= Math.abs(dx) * 1.08) return;
    const elapsed = Math.max(1, Date.now() - start.time);
    const gesture = { dx, dy, vy: (dy / elapsed) * 1000 };
    if (shouldFinishViewerDismiss(gesture)) finishDismiss();
    else resetPosition();
  };

  const handleMomentumEnd = (event) => {
    if (closingRef.current || !width || !previewPhotos.length) return;
    const rawIndex = Math.round(
      Math.max(0, event.nativeEvent.contentOffset.x) / width,
    );
    const nextIndex = Math.min(previewPhotos.length - 1, Math.max(0, rawIndex));
    const nextPhoto = previewPhotos[nextIndex];
    if (!nextPhoto) return;
    indexRef.current = nextIndex;
    setZoomedPhotoId(null);
    if (nextPhoto.id !== previewPhoto?.id) onPhotoChange(nextPhoto);
  };

  return (
    <Modal
      visible={Boolean(previewPhoto)}
      animationType="fade"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait"]}
      onRequestClose={close}
    >
      <View style={styles.photoViewer}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Animated.View
          style={[
            styles.photoViewerImageWrap,
            { transform: [{ translateY: dismissY }] },
          ]}
          {...dismissResponder.panHandlers}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            touchStartRef.current = null;
            if (!closingRef.current) resetPosition();
          }}
        >
          <FlatList
            ref={listRef}
            style={styles.photoPager}
            data={previewPhotos}
            extraData={previewPhoto?.id}
            horizontal
            pagingEnabled
            scrollEnabled={!zoomedPhotoId}
            initialScrollIndex={previewIndex}
            keyExtractor={(photo) => photo.id}
            getItemLayout={(_, index) => ({
              length: width,
              offset: width * index,
              index,
            })}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            bounces={false}
            removeClippedSubviews={false}
            initialNumToRender={Math.min(previewPhotos.length, 5)}
            maxToRenderPerBatch={Math.min(
              Math.max(previewPhotos.length, 5),
              8,
            )}
            updateCellsBatchingPeriod={16}
            windowSize={Math.min(Math.max(previewPhotos.length, 7), 11)}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={handleViewableItemsChanged}
            onScroll={(event) => {
              const offset = Math.max(0, event.nativeEvent.contentOffset.x);
              visibleIndexRef.current = Math.min(
                previewPhotos.length - 1,
                Math.max(0, Math.round(offset / width)),
              );
            }}
            scrollEventThrottle={16}
            onScrollBeginDrag={() => {
              if (closingRef.current) return;
              dismissY.stopAnimation();
              dismissY.setValue(0);
            }}
            renderItem={({ item }) => (
              <PhotoViewerPage
                photo={item}
                width={width}
                isActive={previewPhoto?.id === item.id}
                onZoomChange={(zoomed) =>
                  setZoomedPhotoId(zoomed ? item.id : null)
                }
              />
            )}
            onMomentumScrollEnd={handleMomentumEnd}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                listRef.current?.scrollToOffset({
                  offset: Math.max(0, index) * width,
                  animated: false,
                });
              }, 0);
            }}
          />

          <View style={[styles.photoViewerTopBubble, { top: insets.top + 8 }]}>
            <View style={styles.photoViewerTopCopy}>
              <Text style={styles.photoViewerCounter}>
                {previewIndex + 1} OF {previewPhotos.length}
              </Text>
              <Text style={styles.photoViewerDate}>
                {previewPhoto?.captureDateTime
                  ? new Date(previewPhoto.captureDateTime).toLocaleString(
                      "en-AU",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )
                  : "Project photo"}
              </Text>
            </View>
            <Pressable
              style={styles.photoViewerClose}
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Close photo preview"
            >
              <Text style={styles.photoViewerCloseText}>×</Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.photoViewerBottom,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            <View style={styles.photoInfoBubble}>
              <View style={styles.photoInfoHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.photoInfoType}>
                    {previewPhoto?.imageType || "Survey Photo"}
                  </Text>
                  <Text style={styles.photoInfoFile} numberOfLines={1}>
                    {previewPhoto?.fileName || ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.photoInfoGpsBadge,
                    { borderColor: gpsColour(previewAccuracy) },
                  ]}
                >
                  <Text
                    style={[
                      styles.photoInfoGpsText,
                      { color: gpsColour(previewAccuracy) },
                    ]}
                  >
                    {previewAccuracy == null
                      ? "NO GPS"
                      : `GPS ±${previewAccuracy.toFixed(1)} m`}
                  </Text>
                </View>
              </View>
              <View style={styles.photoInfoDetailsRow}>
                <View style={styles.photoInfoDetail}>
                  <Text style={styles.photoInfoLabel}>PHOTO ID</Text>
                  <Text style={styles.photoInfoValue}>
                    {previewPhoto?.photoId || "—"}
                  </Text>
                </View>
                <View style={styles.photoInfoDetail}>
                  <Text style={styles.photoInfoLabel}>POINT ID</Text>
                  <Text style={styles.photoInfoValue}>
                    {previewPhoto?.pointId || "—"}
                  </Text>
                </View>
              </View>
              <Text style={styles.photoInfoComment}>
                {previewPhoto?.comment || "No comment recorded"}
              </Text>
            </View>

            <View style={styles.photoViewerToolbar}>
              <ViewerAction
                icon="↗"
                label="Share"
                onPress={() => onShare(previewPhoto)}
              />
              <ViewerAction
                icon="⇩"
                label="Save Copy"
                onPress={() => onSaveCopy(previewPhoto)}
              />
              {previewPhoto?.deletedAt ? (
                <>
                  <ViewerAction
                    icon="↶"
                    label="Restore"
                    onPress={() => onRestore(previewPhoto)}
                  />
                  <ViewerAction
                    icon="⌫"
                    label="Delete"
                    danger
                    onPress={() => onRequestDelete(previewPhoto, true)}
                  />
                </>
              ) : (
                <ViewerAction
                  icon="⌫"
                  label="Bin"
                  danger
                  onPress={() => onRequestDelete(previewPhoto, false)}
                />
              )}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PhotoViewerPage({ photo, width, isActive, onZoomChange }) {
  const scrollRef = useRef(null);
  const lastTapRef = useRef(0);
  const touchStartRef = useRef(null);
  const zoomRef = useRef(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [zoomEnabled, setZoomEnabled] = useState(false);

  useEffect(() => {
    if (isActive || !pageHeight) return;
    zoomRef.current = 1;
    setZoomEnabled(false);
    onZoomChange(false);
    const responder =
      scrollRef.current?.getScrollResponder?.() || scrollRef.current;
    const zoomTo = responder?.scrollResponderZoomTo?.bind(responder);
    if (zoomTo) {
      zoomTo({ x: 0, y: 0, width, height: pageHeight, animated: false });
    }
  }, [isActive]);

  const handleZoom = (event) => {
    const next = event.nativeEvent.zoomScale || 1;
    zoomRef.current = next;
    const zoomed = next > 1.01;
    setZoomEnabled(zoomed);
    onZoomChange(zoomed);
  };

  const handleTouchStart = (event) => {
    const touches = event.nativeEvent.touches || [];
    if (touches.length !== 1) {
      touchStartRef.current = null;
      lastTapRef.current = 0;
      return;
    }
    const touch = touches[0];
    touchStartRef.current = {
      x: touch.pageX ?? touch.locationX ?? 0,
      y: touch.pageY ?? touch.locationY ?? 0,
    };
  };

  const handleTouchEnd = (event) => {
    const touch = event.nativeEvent.changedTouches?.[0];
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || !touch) return;

    const dx = (touch.pageX ?? touch.locationX ?? 0) - start.x;
    const dy = (touch.pageY ?? touch.locationY ?? 0) - start.y;
    if (Math.hypot(dx, dy) > 18) {
      lastTapRef.current = 0;
      return;
    }

    const now = Date.now();
    const elapsed = now - lastTapRef.current;
    lastTapRef.current = now;
    if (elapsed > 300 || !pageHeight) return;

    const responder = scrollRef.current;
    const scrollResponder = responder?.getScrollResponder?.() || responder;
    const zoomTo =
      scrollResponder?.scrollResponderZoomTo?.bind(scrollResponder);
    if (!zoomTo) return;

    if (zoomRef.current > 1.01) {
      setZoomEnabled(false);
      onZoomChange(false);
      zoomTo({ x: 0, y: 0, width, height: pageHeight, animated: true });
      return;
    }

    const x = touch.locationX ?? width / 2;
    const y = touch.locationY ?? pageHeight / 2;
    setZoomEnabled(true);
    onZoomChange(true);
    setTimeout(
      () =>
        zoomTo({
          x: Math.max(0, x - width / 4),
          y: Math.max(0, y - pageHeight / 4),
          width: width / 2,
          height: pageHeight / 2,
          animated: true,
        }),
      0,
    );
  };

  return (
    <Animated.View
      style={[styles.photoPagerPage, { width }]}
      onLayout={(event) => setPageHeight(event.nativeEvent.layout.height)}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.zoomViewer}
        contentContainerStyle={[
          styles.zoomViewerContent,
          { width, height: pageHeight || undefined },
        ]}
        scrollEnabled={zoomEnabled}
        disableScrollViewPanResponder={!zoomEnabled}
        pinchGestureEnabled
        minimumZoomScale={1}
        maximumZoomScale={5}
        bouncesZoom
        centerContent
        directionalLockEnabled
        scrollEventThrottle={16}
        onScroll={handleZoom}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Image
          source={{ uri: resolvePhotoUri(photo) }}
          style={[
            styles.photoViewerImage,
            { width, height: pageHeight || "100%" },
          ]}
          resizeMode="contain"
        />
      </ScrollView>
    </Animated.View>
  );
}

function ViewerAction({ icon, label, onPress, danger = false }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.viewerAction,
        danger && styles.viewerActionDanger,
        pressed && styles.viewerActionPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text
        style={[
          styles.viewerActionIcon,
          danger && styles.viewerActionIconDanger,
        ]}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.viewerActionLabel,
          danger && styles.viewerActionLabelDanger,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
