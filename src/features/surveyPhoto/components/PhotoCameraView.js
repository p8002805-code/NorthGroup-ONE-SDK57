import React from "react";
import {
  Animated,
  ImageBackground,
  Keyboard,
  Pressable,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView } from "expo-camera";

import { GOLD, gpsColour } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";
import SurveyCaptureButton from "./SurveyCaptureButton";
import { GoldButton, OverlayInput } from "./PhotoUi";

export default function PhotoCameraView({
  accuracy,
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
  onCapture,
  onClose,
  onOpenLocationSettings,
  safeAreaTop = 0,
  photoId,
  pointId,
  requestCameraPermission,
  saveConfirmation,
  saving,
  setCameraReady,
  setCameraZoom,
  setFlash,
  setPhotoId,
  setPointId,
}) {
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
              styles.permissionCameraHeader,
              {
                minHeight: 56 + safeAreaTop,
                paddingTop: safeAreaTop + 2,
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
                { top: safeAreaTop + 8 },
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
            facing="back"
            flash={flash}
            zoom={cameraZoom}
            animateShutter={false}
            onCameraReady={() => setCameraReady(true)}
          />

          <ImageBackground
            source={require("../../../../assets/topo-bg.png")}
            style={[
              styles.cameraHeader,
              {
                minHeight: 56 + safeAreaTop,
                paddingTop: safeAreaTop + 2,
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
                { top: safeAreaTop + 8 },
              ]}
            >
              <Text style={styles.cameraHeaderEyebrow}>PHOTO WORKSPACE</Text>
              <Text style={styles.cameraHeaderTitle}>Capture</Text>
            </View>
            <View style={styles.cameraHeaderSpacer} />
          </ImageBackground>

          <Pressable
            style={[styles.gpsOverlay, { top: safeAreaTop + 64 }]}
            onPress={
              !locationPermission?.granted
                ? onOpenLocationSettings
                : undefined
            }
            accessibilityRole="button"
            accessibilityLabel={
              accuracy == null
                ? "GPS waiting"
                : `GPS accuracy ${accuracy.toFixed(1)} metres`
            }
          >
            <View
              style={[
                styles.gpsDot,
                { backgroundColor: gpsColour(accuracy) },
              ]}
            />
            <View style={styles.gpsCopy}>
              <Text style={styles.overlayLabel}>GPS</Text>
              <Text
                style={[
                  styles.overlayGpsValue,
                  { color: gpsColour(accuracy) },
                ]}
              >
                {!locationPermission?.granted
                  ? "Required"
                  : accuracy == null
                    ? "Waiting…"
                    : `±${accuracy.toFixed(1)} m`}
              </Text>
            </View>
          </Pressable>

          <View
            style={[styles.idOverlayRow, { top: safeAreaTop + 106 }]}
          >
            <OverlayInput
              label="PHOTO ID *"
              primary
              value={photoId}
              onChangeText={setPhotoId}
            />
            <OverlayInput
              label="POINT ID"
              value={pointId}
              onChangeText={setPointId}
              placeholder="Optional"
            />
          </View>

          {keyboardVisible ? (
            <Pressable style={styles.cameraDone} onPress={Keyboard.dismiss}>
              <Text style={styles.cameraDoneText}>DONE ✓</Text>
            </Pressable>
          ) : null}

          {saveConfirmation ? (
            <View pointerEvents="none" style={styles.cameraSaveToast}>
              <Ionicons name="checkmark-circle" size={19} color="#54D98C" />
              <Text style={styles.cameraSaveToastText}>{saveConfirmation}</Text>
            </View>
          ) : null}

          <ImageBackground
            source={require("../../../../assets/topo-bg.png")}
            resizeMode="cover"
            style={styles.cameraBar}
            imageStyle={styles.cameraBarImage}
          >
            <View pointerEvents="none" style={styles.cameraBarShade} />
            <View style={styles.cameraBarControls}>
              <Pressable
                style={[
                  styles.cameraSideControl,
                  styles.flashButton,
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
                disabled={saving || !cameraReady}
                haptic
                onPressIn={onCapture}
                size={86}
                accessibilityLabel="Take photo"
              />
              <Pressable
                style={[styles.cameraSideControl, styles.zoomControl]}
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
        </View>
      )}
    </Animated.View>
  );
}
