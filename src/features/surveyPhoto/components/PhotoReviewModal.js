import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SURVEY_IMAGE_TYPES } from "../constants/imageTypes";
import { GOLD, NAVY, WHITE } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";
import { Input } from "./PhotoUi";

const ALL_TYPES = [...SURVEY_IMAGE_TYPES, "Custom"];

export default function PhotoReviewModal({
  customType,
  imageType,
  insets,
  onDiscard,
  onSave,
  pendingShot,
  recentImageTypes,
  repeatLastType,
  saving,
  savingText,
  setCustomType,
  setImageType,
  setRepeatLastType,
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const [showAllTypes, setShowAllTypes] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);
  const previewDismissY = useRef(new Animated.Value(0)).current;
  const selectedType =
    imageType === "Custom" ? customType.trim() : imageType.trim();
  const canSave = Boolean(selectedType) && !saving;
  const captureTime = pendingShot?.capturedAt
    ? new Date(pendingShot.capturedAt).toLocaleTimeString("en-AU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
  const accuracy = Number(pendingShot?.location?.accuracy);
  const gpsText = Number.isFinite(accuracy)
    ? `GPS ±${accuracy.toFixed(1)} m`
    : "No GPS";

  useEffect(() => {
    if (!pendingShot) {
      setShowAllTypes(false);
      setShowImagePreview(false);
    }
  }, [pendingShot]);

  useEffect(() => {
    if (!showImagePreview) previewDismissY.setValue(0);
  }, [previewDismissY, showImagePreview]);

  const closeImagePreview = useCallback(() => {
    previewDismissY.stopAnimation();
    previewDismissY.setValue(0);
    setShowImagePreview(false);
  }, [previewDismissY]);

  const previewDismissResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          (gesture.numberActiveTouches || 1) <= 1 &&
          gesture.dy > 10 &&
          gesture.dy > Math.abs(gesture.dx) * 1.12,
        onMoveShouldSetPanResponder: (_, gesture) =>
          (gesture.numberActiveTouches || 1) <= 1 &&
          gesture.dy > 10 &&
          gesture.dy > Math.abs(gesture.dx) * 1.12,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, gesture) => {
          previewDismissY.setValue(Math.max(0, gesture.dy));
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldClose =
            gesture.dy > 58 || (gesture.dy > 30 && gesture.vy > 0.55);
          if (shouldClose) {
            Animated.timing(previewDismissY, {
              toValue: Math.max(windowHeight, 700),
              duration: 170,
              useNativeDriver: true,
            }).start(closeImagePreview);
          } else {
            Animated.spring(previewDismissY, {
              toValue: 0,
              speed: 24,
              bounciness: 5,
              useNativeDriver: true,
            }).start();
          }
        },
        onPanResponderTerminate: () => {
          Animated.spring(previewDismissY, {
            toValue: 0,
            speed: 24,
            bounciness: 5,
            useNativeDriver: true,
          }).start();
        },
      }),
    [closeImagePreview, previewDismissY, windowHeight],
  );

  const selectType = (type) => {
    setImageType(type);
    if (type !== "Custom") setCustomType("");
    setShowAllTypes(false);
  };

  return (
    <Modal
      visible={Boolean(pendingShot)}
      animationType="slide"
      supportedOrientations={["portrait", "landscape-left", "landscape-right"]}
      onRequestClose={onDiscard}
    >
      <View style={styles.classifyPage}>
        <StatusBar
          animated
          hidden={isLandscape}
          barStyle="light-content"
          backgroundColor={NAVY}
        />
        <ImageBackground
          source={require("../../../../assets/topo-bg.png")}
          style={[
            styles.classifyHeader,
            isLandscape && styles.classifyHeaderLandscape,
            {
              paddingTop: isLandscape ? 0 : insets.top + 7,
              paddingLeft: Math.max(14, insets.left + 12),
              paddingRight: Math.max(14, insets.right + 12),
            },
          ]}
          imageStyle={styles.classifyHeaderImage}
        >
          <View pointerEvents="none" style={styles.classifyHeaderShade} />
          <Pressable
            style={[
              styles.classifyBack,
              isLandscape && styles.classifyBackLandscape,
            ]}
            onPress={onDiscard}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Discard photo and retake"
          >
            <Ionicons name="chevron-back" size={24} color={GOLD} />
            <Text style={styles.classifyBackText}>Retake</Text>
          </Pressable>
          <View
            pointerEvents="none"
            style={[
              styles.classifyHeaderCopy,
              isLandscape && styles.classifyHeaderCopyLandscape,
              {
                left: insets.left + (isLandscape ? 112 : 116),
                right: insets.right + (isLandscape ? 108 : 100),
              },
            ]}
          >
            <Text style={styles.classifyEyebrow}>PHOTO WORKSPACE</Text>
            <Text
              style={styles.classifyTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
              allowFontScaling={false}
            >
              Review & classify
            </Text>
          </View>
          <View
            style={[
              styles.classifyIdPill,
              isLandscape && styles.classifyIdPillLandscape,
            ]}
          >
            <Text style={styles.classifyIdLabel}>PHOTO</Text>
            <Text style={styles.classifyIdValue}>
              #{pendingShot?.photoId || "—"}
            </Text>
          </View>
        </ImageBackground>

        <ScrollView
          style={styles.classifyBody}
          contentContainerStyle={styles.classifyContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {pendingShot ? (
            <Pressable
              style={styles.classifyPreviewWrap}
              onPress={() => setShowImagePreview(true)}
              accessibilityRole="button"
              accessibilityLabel="Open photo full screen"
            >
              <Image
                source={{ uri: pendingShot.uri }}
                style={styles.classifyPreview}
                resizeMode="contain"
              />
              <View style={styles.classifyPreviewHint}>
                <Ionicons name="expand-outline" size={15} color={WHITE} />
                <Text style={styles.classifyPreviewHintText}>
                  Tap to inspect
                </Text>
              </View>
            </Pressable>
          ) : null}

          <View style={styles.classifyMetaStrip}>
            <MetaItem label="PHOTO" value={pendingShot?.photoId || "—"} />
            <View style={styles.classifyMetaDivider} />
            <MetaItem label="POSITION" value={gpsText} />
            <View style={styles.classifyMetaDivider} />
            <MetaItem label="CAPTURED" value={captureTime} />
          </View>

          <View style={styles.classifySectionHeading}>
            <View>
              <Text style={styles.classifySectionEyebrow}>CLASSIFICATION</Text>
              <Text style={styles.classifySectionTitle}>Image type</Text>
            </View>
            {selectedType ? (
              <View style={styles.classifySelectedBadge}>
                <Ionicons name="checkmark-circle" size={15} color={GOLD} />
                <Text
                  numberOfLines={1}
                  style={styles.classifySelectedBadgeText}
                >
                  {selectedType}
                </Text>
              </View>
            ) : null}
          </View>

          {recentImageTypes.length ? (
            <>
              <View style={styles.classifyRecentHeading}>
                <Text style={styles.classifyRecentLabel}>RECENTLY USED</Text>
                {!imageType && recentImageTypes[0] ? (
                  <Pressable
                    onPress={() => selectType(recentImageTypes[0])}
                    hitSlop={8}
                  >
                    <Text style={styles.classifyUseAgain}>Use last again</Text>
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.classifyRecentRow}>
                {recentImageTypes.map((type) => {
                  const selected = imageType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        styles.classifyRecentChip,
                        selected && styles.classifyRecentChipSelected,
                      ]}
                      onPress={() => selectType(type)}
                    >
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.classifyRecentChipText,
                          selected && styles.classifyRecentChipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                      {selected ? (
                        <Ionicons name="checkmark" size={14} color={GOLD} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.classifyFirstPhotoText}>
              Select a type for this first project photo.
            </Text>
          )}

          <Pressable
            style={styles.classifyAllTypesButton}
            onPress={() => setShowAllTypes(true)}
            accessibilityRole="button"
            accessibilityLabel="Show all image types"
          >
            <View style={styles.classifyAllTypesIcon}>
              <Ionicons name="grid-outline" size={18} color={GOLD} />
            </View>
            <View style={styles.classifyAllTypesCopy}>
              <Text style={styles.classifyAllTypesTitle}>All image types</Text>
              <Text style={styles.classifyAllTypesDetail}>
                Browse the complete classification list
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={19} color={GOLD} />
          </Pressable>

          {imageType === "Custom" ? (
            <View style={styles.classifyCustomWrap}>
              <Text style={styles.classifyRecentLabel}>CUSTOM IMAGE TYPE</Text>
              <Input
                value={customType}
                onChangeText={setCustomType}
                placeholder="Enter custom image type"
                returnKeyType="done"
                onSubmitEditing={Keyboard.dismiss}
              />
            </View>
          ) : null}

          <View style={styles.classifyRepeatRow}>
            <View style={styles.classifyRepeatCopy}>
              <Text style={styles.classifyRepeatTitle}>
                Keep type for next photo
              </Text>
              <Text style={styles.classifyRepeatDetail}>
                Useful when capturing a run of similar assets.
              </Text>
            </View>
            <Switch
              value={repeatLastType}
              onValueChange={setRepeatLastType}
              trackColor={{ false: "#CBD4DA", true: "#D8B867" }}
              thumbColor={repeatLastType ? GOLD : "#FFFFFF"}
              ios_backgroundColor="#CBD4DA"
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.classifyActionDock,
            {
              paddingBottom: Math.max(insets.bottom, 10),
              paddingLeft: Math.max(12, insets.left + 12),
              paddingRight: Math.max(12, insets.right + 12),
            },
          ]}
        >
          <Pressable
            style={({ pressed }) => [
              styles.classifyRetakeButton,
              pressed && styles.classifyActionPressed,
            ]}
            onPress={onDiscard}
          >
            <Ionicons name="refresh-outline" size={18} color={NAVY} />
            <Text style={styles.classifyRetakeButtonText}>Retake</Text>
          </Pressable>
          <Pressable
            disabled={!canSave}
            style={({ pressed }) => [
              styles.classifySaveButton,
              !canSave && styles.classifySaveButtonDisabled,
              pressed && canSave && styles.classifyActionPressed,
            ]}
            onPress={onSave}
          >
            <Text
              style={[
                styles.classifySaveButtonText,
                !canSave && styles.classifySaveButtonTextDisabled,
              ]}
            >
              Save & Next
            </Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={canSave ? NAVY : "#7D8790"}
            />
          </Pressable>
        </View>

        <Modal
          visible={showAllTypes}
          transparent
          animationType="slide"
          onRequestClose={() => setShowAllTypes(false)}
        >
          <Pressable
            style={styles.classifySheetShade}
            onPress={() => setShowAllTypes(false)}
          >
            <Pressable
              style={[
                styles.classifySheet,
                { paddingBottom: Math.max(insets.bottom, 14) },
              ]}
              onPress={() => {}}
            >
              <View style={styles.classifySheetHandle} />
              <View style={styles.classifySheetHeader}>
                <View>
                  <Text style={styles.classifySectionEyebrow}>
                    CLASSIFICATION
                  </Text>
                  <Text style={styles.classifySheetTitle}>All image types</Text>
                </View>
                <Pressable
                  style={styles.classifySheetClose}
                  onPress={() => setShowAllTypes(false)}
                >
                  <Ionicons name="close" size={22} color={NAVY} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.classifySheetScroll}
                contentContainerStyle={styles.classifyGrid}
                showsVerticalScrollIndicator={false}
              >
                {ALL_TYPES.map((type) => {
                  const selected = imageType === type;
                  return (
                    <Pressable
                      key={type}
                      style={[
                        styles.classifyOption,
                        selected && styles.classifyOptionSelected,
                      ]}
                      onPress={() => selectType(type)}
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
                        <Ionicons
                          name="checkmark-circle"
                          size={17}
                          color={GOLD}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal
          visible={showImagePreview}
          animationType="fade"
          supportedOrientations={[
            "portrait",
            "landscape-left",
            "landscape-right",
          ]}
          onRequestClose={closeImagePreview}
        >
          <View style={styles.classifyZoomPage}>
            <StatusBar animated hidden backgroundColor="#000000" />
            <Animated.View
              style={[
                styles.classifyZoomAnimatedPage,
                { transform: [{ translateY: previewDismissY }] },
              ]}
              {...previewDismissResponder.panHandlers}
            >
              <ScrollView
                style={styles.classifyZoomScroll}
                contentContainerStyle={styles.classifyZoomContent}
                minimumZoomScale={1}
                maximumZoomScale={4}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                {pendingShot ? (
                  <Image
                    source={{ uri: pendingShot.uri }}
                    style={[
                      styles.classifyZoomImage,
                      { width: windowWidth, height: windowHeight },
                    ]}
                    resizeMode="contain"
                  />
                ) : null}
              </ScrollView>
              <View
                pointerEvents="none"
                style={[
                  styles.classifyZoomGrabber,
                  {
                    top: Math.max(8, insets.top + 6),
                    left: insets.left + 74,
                    right: insets.right + 74,
                  },
                ]}
              >
                <View style={styles.classifyZoomGrabberBar} />
              </View>
            </Animated.View>
            <Pressable
              style={[
                styles.classifyZoomClose,
                {
                  top: Math.max(10, insets.top + 8),
                  right: Math.max(14, insets.right + 12),
                },
              ]}
              onPress={closeImagePreview}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close full screen photo"
            >
              <Ionicons name="close" size={25} color={WHITE} />
            </Pressable>
          </View>
        </Modal>

        {saving ? (
          <View style={styles.saving}>
            <ActivityIndicator size="large" color={GOLD} />
            <Text style={styles.savingText}>{savingText}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function MetaItem({ label, value }) {
  return (
    <View style={styles.classifyMetaItem}>
      <Text style={styles.classifyMetaLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.classifyMetaValue}>
        {value}
      </Text>
    </View>
  );
}
