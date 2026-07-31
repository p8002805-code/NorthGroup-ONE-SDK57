import React from "react";
import {
  ImageBackground,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  GOLD,
  NAVY,
  PHOTO_BOTTOM_NAV_HEIGHT,
  WHITE,
} from "../constants/photoTheme";
import SurveyCaptureButton from "./SurveyCaptureButton";

const ITEMS = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  {
    key: "gallery",
    label: "Gallery",
    icon: "images-outline",
    activeIcon: "images",
  },
  { key: "capture", label: "Capture" },
  {
    key: "qa",
    label: "Export",
    icon: "share-outline",
    activeIcon: "share",
  },
  {
    key: "more",
    label: "More",
    icon: "ellipsis-horizontal-circle-outline",
    activeIcon: "ellipsis-horizontal-circle",
  },
];

export default function SurveyPhotoBottomBar({
  activeTab,
  bottomInset,
  onChangeTab,
  onCapture,
}) {
  const selectTab = (nextTab) => {
    Keyboard.dismiss();
    onChangeTab(nextTab);
  };

  return (
    <ImageBackground
      source={require("../../../../assets/topo-bg.png")}
      resizeMode="cover"
      style={[
        styles.bar,
        {
          minHeight: PHOTO_BOTTOM_NAV_HEIGHT + Math.max(bottomInset, 7),
          paddingBottom: Math.max(bottomInset, 7),
        },
      ]}
      imageStyle={styles.backgroundImage}
    >
      <View pointerEvents="none" style={styles.shade} />
      <View style={styles.captureAnchor}>
        <SurveyCaptureButton
          onPress={onCapture}
          size={78}
          accessibilityLabel="Open survey camera"
        />
      </View>
      <View style={styles.navRow}>
        {ITEMS.map((item) => {
          if (item.key === "capture") {
            return (
              <Pressable
                key={item.key}
                onPress={onCapture}
                accessibilityRole="button"
                accessibilityLabel="Open survey camera"
                style={({ pressed }) => [
                  styles.item,
                  styles.captureItem,
                  pressed && styles.itemPressed,
                ]}
              >
                <Text style={[styles.label, styles.captureLabel]}>CAPTURE</Text>
                <View style={[styles.indicator, styles.captureIndicator]} />
              </Pressable>
            );
          }
          const active = activeTab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => selectTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${item.label} tab`}
              style={({ pressed }) => [
                styles.item,
                pressed && styles.itemPressed,
              ]}
            >
              <Ionicons
                name={active ? item.activeIcon : item.icon}
                size={19}
                color={active ? GOLD : "rgba(255,255,255,0.7)"}
              />
              <Text style={[styles.label, active && styles.labelActive]}>
                {item.label.toUpperCase()}
              </Text>
              <View
                style={[styles.indicator, active && styles.indicatorActive]}
              />
            </Pressable>
          );
        })}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "relative",
    backgroundColor: NAVY,
    borderTopWidth: 1,
    borderTopColor: "rgba(214,168,79,0.72)",
    paddingTop: 35,
    paddingHorizontal: 10,
    overflow: "visible",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -5 },
    elevation: 18,
    zIndex: 30,
  },
  backgroundImage: { opacity: 0.34 },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,18,33,0.72)",
  },
  captureAnchor: {
    position: "absolute",
    top: -41,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 4,
  },
  navRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  item: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 3,
  },
  itemPressed: { opacity: 0.62 },
  captureItem: { paddingTop: 27 },
  label: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 3,
  },
  labelActive: { color: WHITE },
  captureLabel: { color: WHITE },
  indicator: {
    width: 18,
    height: 2,
    borderRadius: 1,
    marginTop: 4,
    backgroundColor: "transparent",
  },
  indicatorActive: { backgroundColor: GOLD },
  captureIndicator: { backgroundColor: GOLD },
});
