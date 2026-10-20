import React from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import styles from "../styles/surveyPhotoStyles";
import { GoldButton } from "./PhotoUi";

export default function PhotoExportView({
  activePhotos,
  exportWholeProject,
  formatDateFolder,
  onExport,
  onUploadSharePoint,
  photoDateKeys,
  photosByDate,
  sharePointDestination,
  selectedExportDates,
  setExportWholeProject,
  setSelectedExportDates,
  sharePointUpload,
}) {
  const uploadBusy = Boolean(sharePointUpload?.active);
  const projectUploadBusy = uploadBusy && sharePointUpload?.scope === "project";
  const uploadPercent = Math.round(
    Math.max(0, Math.min(1, Number(sharePointUpload?.progress) || 0)) * 100,
  );
  const qaMetrics = [
    { label: "PHOTOS", value: activePhotos.length },
    { label: "UNIQUE IDS", value: new Set(activePhotos.map((item) => item.photoId)).size },
    { label: "POINT LINKS", value: activePhotos.filter((item) => item.pointId).length },
    { label: "NO POINT ID", value: activePhotos.filter((item) => !item.pointId).length },
    { label: "NO GPS", value: activePhotos.filter((item) => item.latitude === "").length },
    {
      label: "GPS > 8 M",
      value: activePhotos.filter((item) => Number(item.horizontalAccuracy) > 8).length,
    },
  ];

  return (
    <ScrollView
      style={styles.body}
      contentContainerStyle={styles.content}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
    >
      <Text style={styles.exportPageTitle}>Export</Text>
      <View style={styles.qaCardCompact}>
        <View style={styles.qaHeaderCompact}>
          <View>
            <Text style={styles.qaEyebrowCompact}>PROJECT HEALTH</Text>
            <Text style={styles.qaTitleCompact}>Project QA</Text>
          </View>
          <View style={styles.qaStatusBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#278654" />
            <Text style={styles.qaStatusText}>LIVE</Text>
          </View>
        </View>
        <View style={styles.qaGrid}>
          {qaMetrics.map((metric) => (
            <View key={metric.label} style={styles.qaMetric}>
              <Text style={styles.qaMetricValue}>{metric.value}</Text>
              <Text style={styles.qaMetricLabel}>{metric.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.exportCard}>
        <Text style={styles.exportTitle}>Export Photos</Text>
        <Text style={styles.exportSubtitle}>
          Choose the whole project or particular capture days.
        </Text>
        <Pressable
          style={[
            styles.exportScope,
            exportWholeProject && styles.exportScopeSelected,
          ]}
          onPress={() => {
            setExportWholeProject(true);
            setSelectedExportDates([]);
          }}
        >
          <View>
            <Text
              style={[
                styles.exportScopeTitle,
                exportWholeProject && styles.exportScopeTitleSelected,
              ]}
            >
              Whole Project
            </Text>
            <Text style={styles.exportScopeDetail}>
              {activePhotos.length} photos plus matching JSON and CSV
            </Text>
          </View>
          <Text style={styles.exportCheck}>
            {exportWholeProject ? "✓" : "○"}
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.exportScope,
            !exportWholeProject && styles.exportScopeSelected,
          ]}
          onPress={() => setExportWholeProject(false)}
        >
          <View>
            <Text
              style={[
                styles.exportScopeTitle,
                !exportWholeProject && styles.exportScopeTitleSelected,
              ]}
            >
              Select Capture Days
            </Text>
            <Text style={styles.exportScopeDetail}>
              Export only photos from selected dates
            </Text>
          </View>
          <Text style={styles.exportCheck}>
            {!exportWholeProject ? "✓" : "○"}
          </Text>
        </Pressable>

        {!exportWholeProject ? (
          <View style={styles.exportDates}>
            {photoDateKeys.map((dateKey) => {
              const selected = selectedExportDates.includes(dateKey);
              return (
                <Pressable
                  key={dateKey}
                  style={[
                    styles.exportDateRow,
                    selected && styles.exportDateRowSelected,
                  ]}
                  onPress={() =>
                    setSelectedExportDates((dates) =>
                      selected
                        ? dates.filter((date) => date !== dateKey)
                        : [...dates, dateKey],
                    )
                  }
                >
                  <View>
                    <Text style={styles.exportDateTitle}>
                      {formatDateFolder(dateKey)}
                    </Text>
                    <Text style={styles.exportDateCount}>
                      {photosByDate[dateKey].length} photos
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.exportDateTick,
                      selected && styles.exportDateTickSelected,
                    ]}
                  >
                    {selected ? "✓" : "○"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.sharePointButton,
          pressed && styles.sharePointButtonPressed,
          uploadBusy && !projectUploadBusy && styles.sharePointButtonDisabled,
        ]}
        onPress={onUploadSharePoint}
        disabled={uploadBusy}
        accessibilityRole="button"
        accessibilityLabel={
          projectUploadBusy
            ? `Uploading this photo export, ${uploadPercent} percent`
            : "Upload this photo export to SharePoint"
        }
        accessibilityState={{ busy: projectUploadBusy, disabled: uploadBusy }}
      >
        <View style={styles.sharePointButtonIcon}>
          {projectUploadBusy ? (
            <ActivityIndicator size="small" color="#D6A84F" />
          ) : (
            <Ionicons name="cloud-upload-outline" size={21} color="#D6A84F" />
          )}
        </View>
        <View style={styles.sharePointButtonCopy}>
          <Text style={styles.sharePointButtonTitle}>
            {projectUploadBusy
              ? `Uploading to SharePoint · ${uploadPercent}%`
              : "Upload to SharePoint"}
          </Text>
          <Text style={styles.sharePointButtonPath} numberOfLines={1}>
            {sharePointDestination}
          </Text>
        </View>
        {!projectUploadBusy ? (
          <Ionicons name="chevron-forward" size={20} color="#D6A84F" />
        ) : null}
        {projectUploadBusy ? (
          <View style={styles.sharePointProgressTrack}>
            <View
              style={[
                styles.sharePointProgressFill,
                { width: `${Math.max(4, uploadPercent)}%` },
              ]}
            />
          </View>
        ) : null}
      </Pressable>
      <GoldButton label="Export Project as ZIP" onPress={onExport} />
    </ScrollView>
  );
}
