import React from "react";
import { ImageBackground, StyleSheet, Text, View } from "react-native";

import AppBackButton from "../../../components/AppBackButton";
import { GOLD, NAVY, WHITE } from "../constants/photoTheme";

export default function SurveyPhotoHeader({
  insets,
  activeJob,
  photoCount,
  accuracy,
  locationPermission,
  onBack,
  backLabel,
}) {
  const gpsReady =
    locationPermission?.granted && Number.isFinite(Number(accuracy));
  const gpsStatus = !locationPermission?.granted
    ? "GPS required"
    : gpsReady
      ? `GPS ±${Number(accuracy).toFixed(1)} m`
      : "GPS waiting";

  return (
    <ImageBackground
      source={require("../../../../assets/topo-bg.png")}
      style={styles.banner}
      imageStyle={styles.bannerImage}
    >
      <View pointerEvents="none" style={styles.shade} />
      <View style={[styles.navigation, { paddingTop: insets.top + 8 }]}>
        <AppBackButton
          label=""
          style={styles.backButton}
          onPress={onBack}
        />
        <View pointerEvents="none" style={styles.titleCopy}>
          <Text style={styles.title}>Photo Workspace</Text>
        </View>
        <View style={styles.jobPill}>
          <Text style={styles.jobLabel}>JOB</Text>
          <Text numberOfLines={1} style={styles.jobNumber}>
            {activeJob?.number || "—"}
          </Text>
        </View>
      </View>
      <View style={styles.statusRow}>
        <Text style={styles.statusText}>
          {photoCount} {photoCount === 1 ? "photo" : "photos"}
        </Text>
        <View style={styles.statusDivider} />
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor:
                gpsReady && Number(accuracy) <= 8 ? "#54D98C" : GOLD,
            },
          ]}
        />
        <Text style={styles.statusText}>{gpsStatus}</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: NAVY, overflow: "hidden" },
  bannerImage: { opacity: 0.46 },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,18,33,0.68)",
  },
  navigation: {
    minHeight: 68,
    paddingHorizontal: 16,
    paddingBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  titleCopy: {
    position: "absolute",
    left: 104,
    right: 104,
    bottom: 15,
    alignItems: "center",
  },
  title: {
    color: WHITE,
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  jobPill: {
    minWidth: 76,
    maxWidth: 94,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,22,38,0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(214,168,79,0.64)",
    paddingHorizontal: 9,
  },
  jobLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 6,
    fontWeight: "800",
    letterSpacing: 1,
  },
  jobNumber: {
    color: GOLD,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  backButton: { width: 42, minWidth: 42, zIndex: 2 },
  statusRow: {
    height: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.13)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  statusText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontWeight: "600",
  },
  statusDivider: {
    width: 1,
    height: 11,
    marginHorizontal: 9,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginRight: 5 },
});
