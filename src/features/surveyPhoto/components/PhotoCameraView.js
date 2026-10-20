import React from "react";
import {
  ActivityIndicator,
  Animated,
  ImageBackground,
  Keyboard,
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";

import { GOLD, NAVY, WHITE, gpsColour } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";
import SurveyCaptureButton from "./SurveyCaptureButton";
import PhotoSyncBanner from "./PhotoSyncBanner";
import { GoldButton, OverlayInput } from "./PhotoUi";

export default function PhotoCameraView({
  accuracy,
  locationStale = false,
  networkOffline = false,
  pendingUploadCount = 0,
  photoOutboxProcessing = false,
  onRetryPendingUploads,
  cameraDismissResponder,
  cameraDismissY,
  cameraPermission,
  cameraPinchResponder,
  cameraReady,
  cameraRef,
  cameraZoom,
  flash,
  keyboardVisible,
  locationPermission,
  locationRefining,
  onCapture,
  onClose,
  onOpenLocationSettings,
  onRefineLocation,
  safeAreaBottom = 0,
  safeAreaLeft = 0,
  safeAreaRight = 0,
  safeAreaTop = 0,
  photoId,
  pointId,
  requestCameraPermission,
  saveConfirmation,
  saving,
  gpsRefinementMessage,
  gpsCaptureWarning,
  onCancelGpsWarning,
  onContinueGpsWarning,
  setCameraReady,
  setCameraZoom,
  setFlash,
  setPhotoId,
  setPointId,
}) {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const headerHeight = isLandscape ? 48 : 56;
  const cameraBarHeight = isLandscape ? 78 : 116;

  return (
    <Animated.View
      style={[
        styles.cameraScreen,
        { transform: [{ translateY: cameraDismissY }] },
      ]}
      {...cameraDismissResponder.panHandlers}
    >
      {!cameraPermission?.granted ? (
        <View style={styles.permissionScreen}>
          <ImageBackground
            source={require("../../../../assets/topo-bg.png")}
            style={[
              styles.cameraHeader,
              isLandscape && styles.cameraHeaderLandscape,
              styles.permissionCameraHeader,
              {
                minHeight: headerHeight + safeAreaTop,
                paddingTop: safeAreaTop + 2,
                paddingLeft: Math.max(8, safeAreaLeft + 8),
                paddingRight: Math.max(8, safeAreaRight + 8),
              },
            ]}
            imageStyle={styles.cameraHeaderImage}
          >
            <View pointerEvents="none" style={styles.cameraHeaderShade} />
            <Pressable
              style={styles.cameraClose}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to Photo Workspace"
            >
              <Ionicons name="chevron-back" size={27} color={GOLD} />
            </Pressable>
            <View
              pointerEvents="none"
              style={[
                styles.cameraHeaderTitleWrap,
                isLandscape && styles.cameraHeaderTitleWrapLandscape,
                {
                  left: safeAreaLeft + (isLandscape ? 52 : 60),
                  right: safeAreaRight + (isLandscape ? 52 : 60),
                  top: safeAreaTop + (isLandscape ? 5 : 8),
                },
              ]}
            >
              <Text style={styles.cameraHeaderEyebrow}>PHOTO WORKSPACE</Text>
              <Text style={styles.cameraHeaderTitle}>Capture</Text>
            </View>
            <View style={styles.cameraHeaderSpacer} />
          </ImageBackground>
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>Camera access required</Text>
            <Text style={styles.permissionText}>
              Allow camera access to capture official survey photographs.
            </Text>
            <GoldButton
              label="Allow Camera"
              onPress={requestCameraPermission}
            />
          </View>
        </View>
      ) : (
        <View
          style={[styles.cameraWrap, styles.cameraFull]}
          {...cameraPinchResponder.panHandlers}
        >
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            active
            facing="back"
            flash={flash}
            zoom={cameraZoom}
            animateShutter={false}
            responsiveOrientationWhenOrientationLocked
            onCameraReady={() => setCameraReady(true)}
          />

          <ImageBackground
            source={require("../../../../assets/topo-bg.png")}
            style={[
              styles.cameraHeader,
              isLandscape && styles.cameraHeaderLandscape,
              {
                minHeight: headerHeight + safeAreaTop,
                paddingTop: safeAreaTop + 2,
                paddingLeft: Math.max(8, safeAreaLeft + 8),
                paddingRight: Math.max(8, safeAreaRight + 8),
              },
            ]}
            imageStyle={styles.cameraHeaderImage}
          >
            <View pointerEvents="none" style={styles.cameraHeaderShade} />
            <Pressable
              style={styles.cameraClose}
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back to Photo Workspace"
            >
              <Ionicons name="chevron-back" size={27} color={GOLD} />
            </Pressable>
            <View
              pointerEvents="none"
              style={[
                styles.cameraHeaderTitleWrap,
                isLandscape && styles.cameraHeaderTitleWrapLandscape,
                {
                  left: safeAreaLeft + (isLandscape ? 52 : 60),
                  right: safeAreaRight + (isLandscape ? 52 : 60),
                  top: safeAreaTop + (isLandscape ? 5 : 8),
                },
              ]}
            >
              <Text style={styles.cameraHeaderEyebrow}>PHOTO WORKSPACE</Text>
              <Text style={styles.cameraHeaderTitle}>Capture</Text>
            </View>
            <View style={styles.cameraHeaderSpacer} />
          </ImageBackground>

          <View
            style={[
              styles.captureMetaGrid,
              isLandscape && styles.captureMetaGridLandscape,
              {
                top: safeAreaTop + (isLandscape ? 54 : 64),
                left: Math.max(12, safeAreaLeft + 12),
                right: Math.max(12, safeAreaRight + 12),
              },
            ]}
          >
            <View style={styles.captureIdColumn}>
              <View style={styles.captureIdCell}>
                <OverlayInput
                  label="PHOTO ID *"
                  primary
                  value={photoId}
                  onChangeText={setPhotoId}
                />
              </View>
              <View style={styles.captureIdCell}>
                <OverlayInput
                  label="POINT ID"
                  value={pointId}
                  onChangeText={setPointId}
                  placeholder="Optional"
                />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.gpsOverlay,
                isLandscape && styles.gpsOverlayLandscape,
                locationRefining && styles.gpsOverlayRefining,
                pressed && styles.gpsOverlayPressed,
              ]}
              onPress={
                !locationPermission?.granted
                  ? onOpenLocationSettings
                  : onRefineLocation
              }
              disabled={locationRefining}
              accessibilityRole="button"
              accessibilityLabel={
                locationRefining
                  ? "Refining GPS location"
                  : !locationPermission?.granted
                    ? "Open settings to enable precise location"
                    : locationStale
                      ? "GPS fix is stale. Tap to refresh location."
                    : accuracy == null
                      ? "Refresh GPS location"
                      : `GPS accuracy ${accuracy.toFixed(1)} metres. Tap to refine.`
              }
              accessibilityHint="Collects fresh GPS readings and keeps the most accurate result."
              accessibilityState={{ busy: locationRefining }}
            >
              <View style={styles.gpsStatusIcon}>
                {locationRefining ? (
                  <ActivityIndicator size="small" color={GOLD} />
                ) : (
                  <Ionicons
                    name={
                      gpsRefinementMessage
                        ? "checkmark-circle"
                        : !locationPermission?.granted
                          ? "settings-outline"
                          : "location-outline"
                    }
                    size={22}
                    color={gpsRefinementMessage ? "#54D98C" : GOLD}
                  />
                )}
              </View>
              <View style={styles.gpsCopy}>
                <View style={styles.gpsLabelRow}>
                  {!locationRefining ? (
                    <View
                      style={[
                        styles.gpsDot,
                        {
                          backgroundColor: locationStale
                            ? "#E3A72F"
                            : gpsColour(accuracy),
                        },
                      ]}
                    />
                  ) : null}
                  <Text style={styles.overlayLabel}>
                    {locationRefining
                      ? "REFINING GPS"
                      : locationStale
                        ? "GPS · STALE · TAP TO REFRESH"
                      : gpsRefinementMessage ||
                        (!locationPermission?.granted
                          ? "GPS · SETTINGS"
                          : "GPS · TAP TO REFINE")}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.overlayGpsValue,
                    { color: locationStale ? "#E3A72F" : gpsColour(accuracy) },
                  ]}
                >
                  {!locationPermission?.granted
                    ? "Required"
                    : locationStale
                      ? "Refresh"
                    : accuracy == null
                      ? "Waiting…"
                      : `±${accuracy.toFixed(1)} m`}
                </Text>
                <Text style={styles.gpsHint}>
                  {locationRefining ? "Hold still for the best fix" : "Press for a fresh high-quality fix"}
                </Text>
              </View>
              {!locationRefining ? (
                <Ionicons name="refresh" size={18} color={GOLD} />
              ) : null}
            </Pressable>
          </View>

          <PhotoSyncBanner
            compact
            offline={networkOffline}
            pendingCount={pendingUploadCount}
            processing={photoOutboxProcessing}
            onPress={onRetryPendingUploads}
            style={[
              styles.cameraSyncBanner,
              { top: safeAreaTop + (isLandscape ? 156 : 176) },
            ]}
          />

          {keyboardVisible ? (
            <Pressable
              style={[
                styles.cameraDone,
                isLandscape && styles.cameraDoneLandscape,
                {
                  right: Math.max(12, safeAreaRight + 12),
                  top: safeAreaTop + (isLandscape ? 170 : 180),
                },
              ]}
              onPress={Keyboard.dismiss}
            >
              <Text style={styles.cameraDoneText}>DONE ✓</Text>
            </Pressable>
          ) : null}

          {saveConfirmation ? (
            <View
              pointerEvents="none"
              style={[
                styles.cameraSaveToast,
                isLandscape && styles.cameraSaveToastLandscape,
                { bottom: cameraBarHeight + safeAreaBottom + 12 },
              ]}
            >
              <Ionicons name="checkmark-circle" size={19} color="#54D98C" />
              <Text style={styles.cameraSaveToastText}>{saveConfirmation}</Text>
            </View>
          ) : null}

          <ImageBackground
            source={require("../../../../assets/topo-bg.png")}
            resizeMode="cover"
            style={[
              styles.cameraBar,
              isLandscape && styles.cameraBarLandscape,
              { height: cameraBarHeight + safeAreaBottom },
            ]}
            imageStyle={styles.cameraBarImage}
          >
            <View pointerEvents="none" style={styles.cameraBarShade} />
            <View
              style={[
                styles.cameraBarControls,
                isLandscape && styles.cameraBarControlsLandscape,
                {
                  paddingLeft: Math.max(18, safeAreaLeft + 18),
                  paddingRight: Math.max(18, safeAreaRight + 18),
                  paddingBottom: safeAreaBottom,
                },
              ]}
            >
              <Pressable
                style={[
                  styles.cameraSideControl,
                  styles.flashButton,
                  isLandscape && styles.cameraSideControlLandscape,
                  flash !== "off" && styles.cameraSideControlActive,
                ]}
                onPress={() => setFlash(flash === "off" ? "on" : "off")}
                accessibilityRole="button"
                accessibilityLabel={`Turn flash ${
                  flash === "off" ? "on" : "off"
                }`}
              >
                <Ionicons
                  name={flash === "off" ? "flash-outline" : "flash"}
                  size={21}
                  color={flash === "off" ? "rgba(255,255,255,0.88)" : GOLD}
                />
                <Text
                  style={[
                    styles.cameraSideValue,
                    flash !== "off" && styles.flashActive,
                  ]}
                >
                  {flash.toUpperCase()}
                </Text>
                <Text style={styles.cameraSideHint}>FLASH</Text>
              </Pressable>
              <SurveyCaptureButton
                disabled={saving || !cameraReady || Boolean(gpsCaptureWarning)}
                haptic
                onPressIn={onCapture}
                size={isLandscape ? 64 : 86}
                accessibilityLabel="Take photo"
              />
              <Pressable
                style={[
                  styles.cameraSideControl,
                  isLandscape && styles.cameraSideControlLandscape,
                  styles.zoomControl,
                ]}
                onPress={() => setCameraZoom(0)}
                accessibilityRole="button"
                accessibilityLabel={
                  cameraZoom === 0
                    ? "Camera zoom one times. Pinch to zoom."
                    : `Camera zoom ${(1 + cameraZoom * 4).toFixed(
                        1,
                      )} times. Tap to reset.`
                }
              >
                <Text style={styles.zoomResetValue}>
                  {cameraZoom === 0
                    ? "1×"
                    : `${(1 + cameraZoom * 4).toFixed(1)}×`}
                </Text>
                <Text style={styles.cameraSideHint}>
                  {cameraZoom === 0 ? "ZOOM" : "RESET"}
                </Text>
              </Pressable>
            </View>
          </ImageBackground>

          <Modal
            visible={Boolean(gpsCaptureWarning)}
            transparent
            animationType="fade"
            presentationStyle="overFullScreen"
            supportedOrientations={["portrait"]}
            onRequestClose={onCancelGpsWarning}
          >
            <View style={styles.gpsWarningBackdrop}>
              <View style={[
                styles.gpsWarningCard,
                isLandscape && styles.gpsWarningCardLandscape,
              ]}>
                <Pressable
                  style={styles.gpsWarningClose}
                  onPress={onCancelGpsWarning}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss GPS warning and retake photo"
                >
                  <Ionicons name="close" size={22} color="rgba(255,255,255,0.76)" />
                </Pressable>
                <View style={styles.gpsWarningIcon}>
                  <Ionicons name="location-outline" size={24} color={GOLD} />
                </View>
                <Text style={styles.gpsWarningTitle}>Check GPS quality</Text>
                <Text style={styles.gpsWarningText}>
                  {gpsCaptureWarning?.message}
                </Text>
                <Text style={styles.gpsWarningHint}>
                  Retake after refining GPS, or keep this photo and review it.
                </Text>
                <View style={styles.gpsWarningActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gpsWarningSecondary,
                      pressed && styles.gpsOverlayPressed,
                    ]}
                    onPress={onCancelGpsWarning}
                    accessibilityRole="button"
                    accessibilityLabel="Discard this photo and return to camera"
                  >
                    <Ionicons name="camera-reverse-outline" size={18} color={WHITE} />
                    <Text style={styles.gpsWarningSecondaryText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [
                      styles.gpsWarningPrimary,
                      pressed && styles.gpsOverlayPressed,
                    ]}
                    onPress={onContinueGpsWarning}
                    accessibilityRole="button"
                    accessibilityLabel="Keep this photo and continue to review"
                  >
                    <Text style={styles.gpsWarningPrimaryText}>Keep & Review</Text>
                    <Ionicons name="chevron-forward" size={18} color={NAVY} />
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </Animated.View>
  );
}
