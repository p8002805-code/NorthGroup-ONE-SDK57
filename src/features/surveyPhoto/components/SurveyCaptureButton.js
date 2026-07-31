import React from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import * as Haptics from "expo-haptics";

import { GOLD, NAVY, WHITE } from "../constants/photoTheme";

export default function SurveyCaptureButton({
  onPress,
  onPressIn,
  disabled = false,
  haptic = false,
  size = 78,
  accessibilityLabel = "Open camera",
  style,
}) {
  const middleSize = Math.round(size * 0.8);
  const innerSize = Math.round(size * 0.67);
  const markSize = Math.round(size * 0.47);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={(event) => {
        if (haptic) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
        onPressIn?.(event);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={
        disabled ? "Camera is preparing" : "Opens or activates the survey camera"
      }
      style={({ pressed }) => [
        styles.touchTarget,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <View
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <View
          style={[
            styles.middleRing,
            {
              width: middleSize,
              height: middleSize,
              borderRadius: middleSize / 2,
            },
          ]}
        >
          <View
            style={[
              styles.innerDisc,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
              },
            ]}
          >
            <Image
              source={require("../../../../assets/logo-transparent.png")}
              resizeMode="contain"
              style={{ width: markSize, height: markSize }}
            />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.32,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },
  outerRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: WHITE,
    backgroundColor: NAVY,
  },
  middleRing: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  innerDisc: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: NAVY,
  },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.94 }] },
});
