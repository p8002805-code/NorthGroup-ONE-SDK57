import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { GOLD, NAVY, resolvePhotoUri } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";

export default function PhotoGalleryView({
  activePhotos,
  availableGalleryTypes,
  binnedPhotos,
  exitSelectionMode,
  exportSelectedPhotos,
  uploadSelectedPhotosToSharePoint,
  galleryGridLayoutRef,
  galleryPhotos,
  galleryScrollRef,
  galleryScrollYRef,
  gallerySelectionResponder,
  galleryTileSize,
  galleryType,
  galleryViewerPhotos,
  galleryViewportRef,
  libraryMode,
  moveSelectedToBin,
  openPreview,
  requestDeleteSelectedFromBin,
  requestEmptyBin,
  restoreSelectedFromBin,
  safeAreaBottom,
  selectedGalleryPhotos,
  selectedPhotoIds,
  selectionMode,
  sharePointUpload,
  setGalleryType,
  setLibraryMode,
  setSelectionMode,
  togglePhotoSelection,
}) {
  const uploadBusy = Boolean(sharePointUpload?.active);
  const selectedUploadBusy =
    uploadBusy && sharePointUpload?.scope === "selected";
  const selectedUploadPercent = Math.round(
    Math.max(0, Math.min(1, Number(sharePointUpload?.progress) || 0)) * 100,
  );
  const selectionButtonLabel = selectionMode ? "Cancel" : "Select";
  const selectionDockBottom = Math.max(Number(safeAreaBottom) || 0, 7) + 8;
  const toggleSelectionMode = () => {
    if (selectionMode) exitSelectionMode();
    else setSelectionMode(true);
  };

  return (
    <View style={styles.galleryPane}>
      <ScrollView
        ref={galleryScrollRef}
        style={styles.body}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        contentContainerStyle={[
          styles.libraryContent,
          selectionMode && {
            paddingBottom: selectionDockBottom + 78,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        onScroll={(event) => {
          galleryScrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        onLayout={() => {
          galleryScrollRef.current?.measureInWindow(
            (left, top, width, height) => {
              galleryViewportRef.current = { left, top, width, height };
            },
          );
        }}
      >
        <View style={styles.libraryHeader}>
          <View style={styles.libraryHeadingRow}>
            {libraryMode === "bin" ? (
              <Pressable
                style={({ pressed }) => [
                  styles.libraryBackButton,
                  pressed && styles.galleryHeaderButtonPressed,
                ]}
                onPress={() => {
                  exitSelectionMode();
                  setLibraryMode("library");
                }}
                accessibilityRole="button"
                accessibilityLabel="Back to photo library"
              >
                <Ionicons name="chevron-back" size={18} color={GOLD} />
                <Text style={styles.libraryBackButtonText}>Library</Text>
              </Pressable>
            ) : null}
            <View style={styles.libraryHeadingCopy}>
              <Text style={styles.libraryEyebrow}>
                {libraryMode === "bin" ? "DELETED PHOTOS" : "PROJECT LIBRARY"}
              </Text>
              <Text style={styles.libraryTitle}>
                {libraryMode === "bin"
                  ? "Bin"
                  : `${activePhotos.length} Photos`}
              </Text>
            </View>
          </View>

          {libraryMode === "bin" && galleryPhotos.length && !selectionMode ? (
            <View style={styles.libraryActionRow}>
              <View style={styles.libraryActionLeft}>
                {binnedPhotos.length ? (
                  <Pressable
                    style={({ pressed }) => [
                      styles.emptyBinButton,
                      pressed && styles.galleryHeaderButtonPressed,
                    ]}
                    onPress={requestEmptyBin}
                    accessibilityRole="button"
                    accessibilityLabel="Empty photo bin"
                  >
                    <Text style={styles.emptyBinButtonText}>Empty Bin</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

        </View>

        {libraryMode === "library" && availableGalleryTypes.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeFilterRow}
          >
            {availableGalleryTypes.map((type) => (
              <Pressable
                key={type}
                disabled={selectionMode}
                style={[
                  styles.typeFilterChip,
                  galleryType === type && styles.typeFilterChipActive,
                  selectionMode && styles.typeFilterChipDisabled,
                ]}
                onPress={() => setGalleryType(type)}
              >
                <Text
                  style={[
                    styles.typeFilterText,
                    galleryType === type && styles.typeFilterTextActive,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {!galleryPhotos.length ? (
          <View style={styles.libraryEmptyCard}>
            <Ionicons
              name={libraryMode === "bin" ? "trash-outline" : "images-outline"}
              size={34}
              color={GOLD}
            />
            <Text style={styles.libraryEmptyTitle}>
              {libraryMode === "bin" ? "Bin is empty" : "No photos in this view"}
            </Text>
            <Text style={styles.libraryEmptyText}>
              {libraryMode === "bin"
                ? "Photos moved to the Bin will appear here."
                : "Capture a photo or select another image type."}
            </Text>
          </View>
        ) : null}

        {galleryPhotos.length ? (
          <View
            style={styles.thumbnailGrid}
            onLayout={(event) => {
              const { x, y } = event.nativeEvent.layout;
              galleryGridLayoutRef.current = { x, y };
            }}
            {...(selectionMode ? gallerySelectionResponder.panHandlers : {})}
          >
            {galleryPhotos.map((item, index) => {
              const selected = selectedPhotoIds.includes(item.id);
              return (
                <Pressable
                  key={item.id}
                  style={[
                    styles.thumbnailTile,
                    {
                      width: galleryTileSize,
                      height: galleryTileSize,
                      marginRight: index % 3 === 2 ? 0 : 3,
                    },
                  ]}
                  onPress={() =>
                    selectionMode
                      ? togglePhotoSelection(item)
                      : openPreview(item, galleryViewerPhotos)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectionMode
                      ? `${selected ? "Deselect" : "Select"} photo ${item.photoId || item.fileName || ""}`
                      : `Open photo ${item.photoId || item.fileName || ""}`
                  }
                >
                  <Image
                    source={{ uri: resolvePhotoUri(item) }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                  {selectionMode ? (
                    <View
                      style={[
                        styles.thumbnailSelection,
                        selected && styles.thumbnailSelectionActive,
                      ]}
                    >
                      <Text style={styles.thumbnailSelectionTick}>
                        {selected ? "✓" : ""}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {libraryMode === "library" && !selectionMode ? (
          <Pressable
            style={styles.binFolderCard}
            onPress={() => {
              setLibraryMode("bin");
              setGalleryType("All");
            }}
          >
            <View style={styles.binFolderIcon}>
              <Ionicons name="trash-outline" size={22} color="#A64242" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.binFolderTitle}>Bin</Text>
              <Text style={styles.binFolderText}>
                {binnedPhotos.length} deleted photo
                {binnedPhotos.length === 1 ? "" : "s"} · excluded from normal
                export
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color={GOLD} />
          </Pressable>
        ) : null}
      </ScrollView>

      {galleryPhotos.length ? (
        <Pressable
          style={({ pressed }) => [
            styles.floatingSelectButton,
            selectionMode && styles.floatingSelectButtonActive,
            pressed && styles.galleryHeaderButtonPressed,
          ]}
          onPress={toggleSelectionMode}
          accessibilityRole="button"
          accessibilityLabel={
            selectionMode ? "Cancel photo selection" : "Select photos"
          }
        >
          <Text style={[
            styles.selectButtonText,
            selectionMode && styles.floatingSelectButtonTextActive,
          ]}>
            {selectionButtonLabel}
          </Text>
          {selectionMode ? (
            <View style={styles.floatingSelectCount}>
              <Text style={styles.floatingSelectCountText}>
                {selectedPhotoIds.length > 99 ? "99+" : selectedPhotoIds.length}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {selectionMode ? (
        <View
          style={[
            styles.selectionActionBar,
            { bottom: selectionDockBottom },
          ]}
        >
          <View style={styles.selectionActionContent}>
            {libraryMode === "library" ? (
              <>
                <Pressable
                  disabled={!selectedGalleryPhotos.length || uploadBusy}
                  style={[
                    styles.selectionAction,
                    (!selectedGalleryPhotos.length || uploadBusy) &&
                      styles.selectionActionDisabled,
                  ]}
                  onPress={exportSelectedPhotos}
                >
                  <Ionicons name="share-outline" size={23} color={NAVY} />
                  <Text style={styles.selectionActionText}>Export</Text>
                </Pressable>
                <Pressable
                  disabled={!selectedGalleryPhotos.length || uploadBusy}
                  style={[
                    styles.selectionAction,
                    (!selectedGalleryPhotos.length ||
                      (uploadBusy && !selectedUploadBusy)) &&
                      styles.selectionActionDisabled,
                  ]}
                  onPress={uploadSelectedPhotosToSharePoint}
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedUploadBusy
                      ? `Uploading selected photos, ${selectedUploadPercent} percent`
                      : "Upload selected photos to SharePoint"
                  }
                  accessibilityState={{
                    busy: selectedUploadBusy,
                    disabled: !selectedGalleryPhotos.length || uploadBusy,
                  }}
                >
                  {selectedUploadBusy ? (
                    <ActivityIndicator size="small" color={NAVY} />
                  ) : (
                    <Ionicons name="cloud-upload-outline" size={23} color={NAVY} />
                  )}
                  <Text style={styles.selectionActionText}>
                    {selectedUploadBusy
                      ? `${selectedUploadPercent}%`
                      : "SharePoint"}
                  </Text>
                  {selectedUploadBusy ? (
                    <View style={styles.selectionProgressTrack}>
                      <View
                        style={[
                          styles.selectionProgressFill,
                          { width: `${Math.max(4, selectedUploadPercent)}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </Pressable>
              </>
            ) : (
              <Pressable
                disabled={!selectedGalleryPhotos.length || uploadBusy}
                style={[
                  styles.selectionAction,
                  (!selectedGalleryPhotos.length || uploadBusy) &&
                    styles.selectionActionDisabled,
                ]}
                onPress={restoreSelectedFromBin}
              >
                <Ionicons name="arrow-undo-outline" size={23} color={NAVY} />
                <Text style={styles.selectionActionText}>Restore</Text>
              </Pressable>
            )}

            <Pressable
              disabled={!selectedGalleryPhotos.length || uploadBusy}
              style={[
                styles.selectionAction,
                (!selectedGalleryPhotos.length || uploadBusy) &&
                  styles.selectionActionDisabled,
              ]}
              onPress={
                libraryMode === "bin"
                  ? requestDeleteSelectedFromBin
                  : moveSelectedToBin
              }
            >
              <Ionicons name="trash-outline" size={23} color="#B43C3C" />
              <Text style={[styles.selectionActionText, styles.selectionDanger]}>
                {libraryMode === "bin" ? "Delete" : "Bin"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
