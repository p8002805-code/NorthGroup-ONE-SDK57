import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import styles from "../styles/surveyPhotoStyles";
import { GoldButton, QaRow } from "./PhotoUi";

export default function PhotoExportView({
  activePhotos,
  exportWholeProject,
  formatDateFolder,
  onExport,
  photoDateKeys,
  photosByDate,
  selectedExportDates,
  setExportWholeProject,
  setSelectedExportDates,
}) {
  return (
    <ScrollView style={styles.body} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.exportPageTitle}>Export</Text>
        <Text style={styles.qaTitle}>Project QA</Text>
        <QaRow label="Total photos" value={activePhotos.length} />
        <QaRow
          label="Unique Photo IDs"
          value={new Set(activePhotos.map((item) => item.photoId)).size}
        />
        <QaRow
          label="Linked to Point IDs"
          value={activePhotos.filter((item) => item.pointId).length}
        />
        <QaRow
          label="Without Point IDs"
          value={activePhotos.filter((item) => !item.pointId).length}
        />
        <QaRow
          label="Without GPS"
          value={activePhotos.filter((item) => item.latitude === "").length}
        />
        <QaRow
          label="GPS worse than 8 m"
          value={
            activePhotos.filter(
              (item) => Number(item.horizontalAccuracy) > 8,
            ).length
          }
        />
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

      <GoldButton label="Export Project as ZIP" onPress={onExport} />
    </ScrollView>
  );
}
