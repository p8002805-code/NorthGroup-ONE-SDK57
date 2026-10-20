import React from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GOLD, NAVY } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";

export default function PhotoMoreView({
  accuracy,
  activePhotos,
  binnedPhotos,
  locationPermission,
  onOpenBin,
  onOpenLocationSettings,
  onOpenSurveyorPicker,
  project,
  repeatLastType,
  saveToPhotos,
  setRepeatLastType,
  setSaveToPhotos,
}) {
  const gpsValue = !locationPermission?.granted
    ? "Location access required"
    : Number.isFinite(Number(accuracy))
      ? `Current accuracy ±${Number(accuracy).toFixed(1)} m`
      : "Waiting for current position";

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.moreContent}
      showsVerticalScrollIndicator={false}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
    >
      <Text style={styles.moreEyebrow}>PROJECT CONTROLS</Text>
      <Text style={styles.moreTitle}>Workspace</Text>

      <View style={styles.moreProjectCard}>
        <View style={styles.moreProjectIcon}>
          <Ionicons name="briefcase-outline" size={22} color={GOLD} />
        </View>
        <View style={styles.moreProjectCopy}>
          <Text style={styles.moreProjectLabel}>ACTIVE PROJECT</Text>
          <Text style={styles.moreProjectNumber}>{project.projectNumber}</Text>
          <Text style={styles.moreProjectDetail}>
            {activePhotos.length} {activePhotos.length === 1 ? "photo" : "photos"} ·
            Next ID {project.nextPhotoId}
          </Text>
        </View>
      </View>

      <Text style={styles.moreSectionLabel}>CAPTURE PREFERENCES</Text>
      <View style={styles.moreCard}>
        <SettingRow
          icon="repeat-outline"
          title="Repeat last image type"
          detail="Preselect the previous classification for fast photo runs."
          control={
            <Switch
              value={repeatLastType}
              onValueChange={setRepeatLastType}
              trackColor={{ false: "#CBD4DA", true: "#D8B867" }}
              thumbColor={repeatLastType ? GOLD : "#FFFFFF"}
              ios_backgroundColor="#CBD4DA"
            />
          }
        />
        <View style={styles.moreDivider} />
        <SettingRow
          icon="images-outline"
          title="Save copy to iPhone Photos"
          detail="The project copy always remains the official record."
          control={
            <Switch
              value={saveToPhotos}
              onValueChange={setSaveToPhotos}
              trackColor={{ false: "#CBD4DA", true: "#D8B867" }}
              thumbColor={saveToPhotos ? GOLD : "#FFFFFF"}
              ios_backgroundColor="#CBD4DA"
            />
          }
        />
      </View>

      <Text style={styles.moreSectionLabel}>PROJECT DETAILS</Text>
      <View style={styles.moreCard}>
        <ActionRow
          icon="person-outline"
          title="Surveyor"
          detail={project.surveyor || "Not selected"}
          onPress={onOpenSurveyorPicker}
        />
        <View style={styles.moreDivider} />
        <ActionRow
          icon="navigate-outline"
          title="Location"
          detail={gpsValue}
          onPress={onOpenLocationSettings}
        />
        <View style={styles.moreDivider} />
        <ActionRow
          danger
          icon="trash-outline"
          title="Bin"
          detail={`${binnedPhotos.length} deleted ${
            binnedPhotos.length === 1 ? "photo" : "photos"
          }`}
          onPress={onOpenBin}
        />
      </View>
    </ScrollView>
  );
}

function SettingRow({ control, detail, icon, title }) {
  return (
    <View style={styles.moreRow}>
      <View style={styles.moreRowIcon}>
        <Ionicons name={icon} size={20} color={GOLD} />
      </View>
      <View style={styles.moreRowCopy}>
        <Text style={styles.moreRowTitle}>{title}</Text>
        <Text style={styles.moreRowDetail}>{detail}</Text>
      </View>
      {control}
    </View>
  );
}

function ActionRow({ danger, detail, icon, onPress, title }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.moreRow,
        pressed && styles.moreRowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
    >
      <View style={[styles.moreRowIcon, danger && styles.moreRowIconDanger]}>
        <Ionicons name={icon} size={20} color={danger ? "#A64242" : GOLD} />
      </View>
      <View style={styles.moreRowCopy}>
        <Text style={[styles.moreRowTitle, danger && styles.moreRowTitleDanger]}>
          {title}
        </Text>
        <Text style={styles.moreRowDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={danger ? "#A64242" : GOLD} />
    </Pressable>
  );
}
