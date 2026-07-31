import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GOLD, NAVY, resolvePhotoUri } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";

export default function PhotoHomeView({
  project,
  activePhotos,
  accuracy,
  locationPermission,
  lastSaved,
  onOpenGallery,
  openPreview,
}) {
  const recentPhotos = [...activePhotos]
    .sort((a, b) =>
      String(b.captureDateTime || b.id).localeCompare(
        String(a.captureDateTime || a.id),
      ),
    )
    .slice(0, 8);
  const gpsReady =
    locationPermission?.granted && Number.isFinite(Number(accuracy));
  const gpsValue = !locationPermission?.granted
    ? "Required"
    : gpsReady
      ? `±${Number(accuracy).toFixed(1)} m`
      : "Waiting";

  return (
    <View style={styles.homePage}>
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.homeContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.homeReadyCard}>
          <View style={styles.homeReadyHeading}>
            <View>
              <Text style={styles.homeEyebrow}>CAPTURE READINESS</Text>
              <Text style={styles.homeReadyTitle}>Ready for the field</Text>
            </View>
            <View
              style={[
                styles.homeReadyBadge,
                !gpsReady && styles.homeReadyBadgeWaiting,
              ]}
            >
              <View
                style={[
                  styles.homeReadyDot,
                  { backgroundColor: gpsReady ? "#21854E" : GOLD },
                ]}
              />
              <Text style={styles.homeReadyBadgeText}>
                {gpsReady ? "READY" : "CHECK GPS"}
              </Text>
            </View>
          </View>
          <View style={styles.homeReadinessGrid}>
            <ReadinessItem
              icon="camera-outline"
              label="NEXT PHOTO"
              value={project.nextPhotoId}
            />
            <ReadinessItem
              icon="navigate-circle-outline"
              label="GPS"
              value={gpsValue}
              accent={gpsReady}
            />
            <ReadinessItem
              icon="briefcase-outline"
              label="PROJECT"
              value={project.projectNumber}
            />
            <ReadinessItem
              icon="phone-portrait-outline"
              label="STORAGE"
              value="On device"
            />
          </View>
          <Text style={styles.homeCaptureHint}>
            Use the centre Capture button to take the next official photo.
          </Text>
        </View>

        {lastSaved ? (
          <View style={styles.homeSaved}>
            <Text style={styles.homeSavedTick}>✓</Text>
            <View>
              <Text style={styles.homeSavedLabel}>LAST SAVED</Text>
              <Text style={styles.homeSavedText}>{lastSaved}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.homeSectionHeading}>
          <View>
            <Text style={styles.homeSectionEyebrow}>PROJECT ACTIVITY</Text>
            <Text style={styles.homeSectionTitle}>Recent photos</Text>
          </View>
          {activePhotos.length ? (
            <Pressable
              style={styles.homeViewAll}
              onPress={onOpenGallery}
              accessibilityRole="button"
              accessibilityLabel="View all project photos"
            >
              <Text style={styles.homeViewAllText}>View all</Text>
              <Ionicons name="chevron-forward" size={16} color={GOLD} />
            </Pressable>
          ) : null}
        </View>

        {recentPhotos.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.homeRecentRow}
          >
            {recentPhotos.map((photo) => (
              <Pressable
                key={photo.id}
                style={styles.homeRecentTile}
                onPress={() => openPreview(photo, recentPhotos)}
                accessibilityRole="button"
                accessibilityLabel={`Open photo ${photo.photoId || photo.fileName}`}
              >
                <Image
                  source={{ uri: resolvePhotoUri(photo) }}
                  style={styles.homeRecentImage}
                  resizeMode="cover"
                />
                <View style={styles.homeRecentShade} />
                <Text numberOfLines={1} style={styles.homeRecentType}>
                  {photo.imageType || "Photo"}
                </Text>
                <Text style={styles.homeRecentId}>#{photo.photoId}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.homeEmptyRecent}>
            <Ionicons name="images-outline" size={28} color={GOLD} />
            <Text style={styles.homeEmptyRecentTitle}>No project photos yet</Text>
            <Text style={styles.homeEmptyRecentText}>
              Your latest captures will appear here for fast review.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ReadinessItem({ accent, icon, label, value }) {
  return (
    <View style={styles.homeReadinessItem}>
      <View style={styles.homeReadinessIcon}>
        <Ionicons name={icon} size={17} color={accent ? "#21854E" : GOLD} />
      </View>
      <View style={styles.homeReadinessCopy}>
        <Text style={styles.homeReadinessLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.homeReadinessValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}
