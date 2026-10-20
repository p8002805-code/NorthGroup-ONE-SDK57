import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
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

import { SURVEY_IMAGE_TYPES } from "../constants/imageTypes";
import {
  GOLD,
  NAVY,
  gpsColour,
  resolvePhotoUri,
} from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";
import { Input } from "./PhotoUi";

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
  onUploadSharePoint,
  onUpdateImageType,
  previewPhoto,
  previewPhotos,
  sharePointUpload,
}) {
  const { width, height } = useWindowDimensions();
  const [zoomedPhotoId, setZoomedPhotoId] = useState(null);
  const [typeEditorOpen, setTypeEditorOpen] = useState(false);
  const [typeDraft, setTypeDraft] = useState("");
  const [customTypeDraft, setCustomTypeDraft] = useState("");
  const [typeSaving, setTypeSaving] = useState(false);
  const [viewerChromeVisible, setViewerChromeVisible] = useState(true);
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
    setViewerChromeVisible(true);
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
  const uploadBusy = Boolean(sharePointUpload?.active);
  const thisPhotoUploadBusy =
    uploadBusy && sharePointUpload?.scope === `photo:${previewPhoto?.id}`;
  const uploadPercent = Math.round(
    Math.max(0, Math.min(1, Number(sharePointUpload?.progress) || 0)) * 100,
  );

  const openTypeEditor = () => {
    const currentType = String(previewPhoto?.imageType || "").trim();
    const isStandardType = SURVEY_IMAGE_TYPES.includes(currentType);
    setTypeDraft(isStandardType ? currentType : "Custom");
    setCustomTypeDraft(isStandardType ? "" : currentType);
    setTypeEditorOpen(true);
  };

  const saveTypeChange = async () => {
    const nextType = typeDraft === "Custom" ? customTypeDraft.trim() : typeDraft;
    if (!nextType || typeSaving || !previewPhoto) return;
    try {
      setTypeSaving(true);
      const updatedPhoto = await onUpdateImageType(previewPhoto, nextType);
      if (updatedPhoto) setTypeEditorOpen(false);
    } finally {
      setTypeSaving(false);
    }
  };

  const close = () => {
    closingRef.current = true;
    setZoomedPhotoId(null);
    setViewerChromeVisible(true);
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
    setViewerChromeVisible(true);
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
              setViewerChromeVisible(true);
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
                onToggleChrome={() =>
                  setViewerChromeVisible((visible) => !visible)
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

          {viewerChromeVisible ? (
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
          ) : null}

          {viewerChromeVisible ? (
            <View
              style={[
                styles.photoViewerBottom,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
            >
              <View style={styles.photoInfoBubble}>
                <View style={styles.photoInfoHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.photoInfoTitleRow}>
                      <Text numberOfLines={1} style={styles.photoInfoType}>
                        {previewPhoto?.imageType || "Survey Photo"}
                      </Text>
                      {!previewPhoto?.deletedAt ? (
                        <Pressable
                          style={styles.photoInfoEditTypeButton}
                          onPress={openTypeEditor}
                          accessibilityRole="button"
                          accessibilityLabel="Change photo image type"
                        >
                          <Text style={styles.photoInfoEditTypeText}>EDIT TYPE</Text>
                        </Pressable>
                      ) : null}
                    </View>
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
                  disabled={uploadBusy}
                  onPress={() => onShare(previewPhoto)}
                />
                <ViewerAction
                  icon="⇩"
                  label="Save Copy"
                  disabled={uploadBusy}
                  onPress={() => onSaveCopy(previewPhoto)}
                />
                {!previewPhoto?.deletedAt ? (
                  <ViewerAction
                    icon="☁"
                    label={thisPhotoUploadBusy ? `${uploadPercent}%` : "SharePoint"}
                    disabled={uploadBusy}
                    loading={thisPhotoUploadBusy}
                    progress={uploadPercent}
                    onPress={() => onUploadSharePoint(previewPhoto)}
                  />
                ) : null}
                {previewPhoto?.deletedAt ? (
                  <>
                    <ViewerAction
                      icon="↶"
                      label="Restore"
                      disabled={uploadBusy}
                      onPress={() => onRestore(previewPhoto)}
                    />
                    <ViewerAction
                      icon="⌫"
                      label="Delete"
                      danger
                      disabled={uploadBusy}
                      onPress={() => onRequestDelete(previewPhoto, true)}
                    />
                  </>
                ) : (
                  <ViewerAction
                    icon="⌫"
                    label="Bin"
                    danger
                    disabled={uploadBusy}
                    onPress={() => onRequestDelete(previewPhoto, false)}
                  />
                )}
              </View>
            </View>
          ) : null}
        </Animated.View>

        <Modal
          visible={typeEditorOpen}
          transparent
          animationType="slide"
          onRequestClose={() => !typeSaving && setTypeEditorOpen(false)}
        >
          <Pressable
            style={styles.classifySheetShade}
            onPress={() => !typeSaving && setTypeEditorOpen(false)}
          >
            <Pressable
              style={[
                styles.classifySheet,
                styles.photoTypeEditorSheet,
                { paddingBottom: Math.max(insets.bottom, 14) },
              ]}
              onPress={() => {}}
            >
              <View style={styles.classifySheetHandle} />
              <View style={styles.classifySheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.classifySectionEyebrow}>EDIT PHOTO</Text>
                  <Text style={styles.classifySheetTitle}>Change image type</Text>
                  <Text style={styles.photoTypeEditorDetail}>
                    The photo will move to the matching gallery and export folder.
                  </Text>
                </View>
                <Pressable
                  style={styles.classifySheetClose}
                  disabled={typeSaving}
                  onPress={() => setTypeEditorOpen(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel image type change"
                >
                  <Text style={styles.photoTypeEditorCloseText}>×</Text>
                </Pressable>
              </View>

              <ScrollView
                style={styles.classifySheetScroll}
                contentContainerStyle={styles.classifyGrid}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {[...SURVEY_IMAGE_TYPES, "Custom"].map((type) => {
                  const selected = typeDraft === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        styles.classifyOption,
                        selected && styles.classifyOptionSelected,
                      ]}
                      disabled={typeSaving}
                      onPress={() => {
                        setTypeDraft(type);
                        if (type !== "Custom") setCustomTypeDraft("");
                      }}
                    >
                      <Text
                        style={[
                          styles.classifyOptionText,
                          selected && styles.classifyOptionTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                      {selected ? (
                        <Text style={styles.photoTypeEditorTick}>✓</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>

              {typeDraft === "Custom" ? (
                <View style={styles.photoTypeEditorCustom}>
                  <Text style={styles.classifyRecentLabel}>CUSTOM IMAGE TYPE</Text>
                  <Input
                    value={customTypeDraft}
                    onChangeText={setCustomTypeDraft}
                    placeholder="Enter custom image type"
                    editable={!typeSaving}
                  />
                </View>
              ) : null}

              <Pressable
                style={[
                  styles.photoTypeEditorSave,
                  (!typeDraft || (typeDraft === "Custom" && !customTypeDraft.trim()) || typeSaving) &&
                    styles.classifySaveButtonDisabled,
                ]}
                disabled={!typeDraft || (typeDraft === "Custom" && !customTypeDraft.trim()) || typeSaving}
                onPress={saveTypeChange}
                accessibilityRole="button"
                accessibilityLabel="Save image type change"
              >
                {typeSaving ? (
                  <ActivityIndicator color={NAVY} size="small" />
                ) : (
                  <Text style={styles.photoTypeEditorSaveText}>Save image type</Text>
                )}
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      </View>
    </Modal>
  );
}

function PhotoViewerPage({
  photo,
  width,
  isActive,
  onToggleChrome,
  onZoomChange,
}) {
  const scrollRef = useRef(null);
  const lastTapRef = useRef(0);
  const singleTapTimerRef = useRef(null);
  const zoomRef = useRef(1);
  const [pageHeight, setPageHeight] = useState(0);
  const [zoomEnabled, setZoomEnabled] = useState(false);

  useEffect(
    () => () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (isActive) return;
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    lastTapRef.current = 0;
    if (!pageHeight) return;
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

  const handlePhotoPress = (event) => {
    const now = Date.now();
    const elapsed = now - lastTapRef.current;
    if (elapsed > 300) {
      lastTapRef.current = now;
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        lastTapRef.current = 0;
        if (isActive) onToggleChrome();
      }, 300);
      return;
    }

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }
    lastTapRef.current = 0;
    if (!pageHeight) return;

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

    const x = event.nativeEvent.locationX ?? width / 2;
    const y = event.nativeEvent.locationY ?? pageHeight / 2;
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
        onTouchCancel={() => {
          lastTapRef.current = 0;
          if (singleTapTimerRef.current) {
            clearTimeout(singleTapTimerRef.current);
            singleTapTimerRef.current = null;
          }
        }}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={{ width, height: pageHeight || "100%" }}
          onPress={handlePhotoPress}
          accessibilityRole="button"
          accessibilityLabel="Show or hide photo details"
        >
          <Image
            source={{ uri: resolvePhotoUri(photo) }}
            style={[
              styles.photoViewerImage,
              { width, height: pageHeight || "100%" },
            ]}
            resizeMode="contain"
          />
        </Pressable>
      </ScrollView>
    </Animated.View>
  );
}

function ViewerAction({
  icon,
  label,
  onPress,
  danger = false,
  disabled = false,
  loading = false,
  progress = 0,
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [
        styles.viewerAction,
        danger && styles.viewerActionDanger,
        disabled && !loading && styles.viewerActionDisabled,
        pressed && styles.viewerActionPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: loading, disabled }}
    >
      {loading ? (
        <ActivityIndicator color={GOLD} size="small" />
      ) : (
        <Text
          style={[
            styles.viewerActionIcon,
            danger && styles.viewerActionIconDanger,
          ]}
        >
          {icon}
        </Text>
      )}
      <Text
        style={[
          styles.viewerActionLabel,
          danger && styles.viewerActionLabelDanger,
        ]}
      >
        {label}
      </Text>
      {loading ? (
        <View style={styles.viewerActionProgressTrack}>
          <View
            style={[
              styles.viewerActionProgressFill,
              { width: `${Math.max(4, progress)}%` },
            ]}
          />
        </View>
      ) : null}
    </Pressable>
  );
}
