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

export default function PhotoGalleryView({
  activePhotos,
  availableGalleryTypes,
  binnedPhotos,
  bottomActionOffset,
  exitSelectionMode,
  exportSelectedPhotos,
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
  selectedGalleryPhotos,
  selectedPhotoIds,
  selectionMode,
  setGalleryType,
  setLibraryMode,
  setSelectionMode,
  togglePhotoSelection,
}) {
  return (
    <>
      <ScrollView
        ref={galleryScrollRef}
        style={styles.body}
        contentContainerStyle={[
          styles.libraryContent,
          selectionMode && styles.libraryContentSelecting,
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
        <View style={styles.libraryHeadingRow}>
          <View style={styles.libraryHeadingCopy}>
            <Text style={styles.libraryEyebrow}>
              {libraryMode === "bin" ? "DELETED PHOTOS" : "PROJECT LIBRARY"}
            </Text>
            <Text style={styles.libraryTitle}>
              {libraryMode === "bin" ? "Bin" : `${activePhotos.length} Photos`}
            </Text>
          </View>
          {libraryMode === "bin" ? (
            <Pressable
              style={styles.libraryBackButton}
              onPress={() => {
                exitSelectionMode();
                setLibraryMode("library");
              }}
            >
              <Ionicons name="chevron-back" size={18} color={GOLD} />
              <Text style={styles.libraryBackButtonText}>Library</Text>
            </Pressable>
          ) : galleryPhotos.length ? (
            <Pressable
              style={styles.selectButton}
              onPress={() =>
                selectionMode ? exitSelectionMode() : setSelectionMode(true)
              }
            >
              <Text style={styles.selectButtonText}>
                {selectionMode ? "Cancel" : "Select"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {libraryMode === "bin" && galleryPhotos.length ? (
          <View style={styles.libraryActionRow}>
            <View style={styles.libraryActionLeft}>
              {selectionMode ? (
                <Text style={styles.librarySelectCount}>
                  {selectedPhotoIds.length} Selected
                </Text>
              ) : binnedPhotos.length ? (
                <Pressable
                  style={styles.emptyBinButton}
                  onPress={requestEmptyBin}
                >
                  <Text style={styles.emptyBinButtonText}>Empty Bin</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              style={styles.selectButton}
              onPress={() =>
                selectionMode ? exitSelectionMode() : setSelectionMode(true)
              }
            >
              <Text style={styles.selectButtonText}>
                {selectionMode ? "Cancel" : "Select"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {libraryMode === "library" && selectionMode ? (
          <View style={styles.librarySelectionCountRow}>
            <Text style={styles.librarySelectCount}>
              {selectedPhotoIds.length} Selected
            </Text>
          </View>
        ) : null}

        {libraryMode === "library" && availableGalleryTypes.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeFilterRow}
          >
            {availableGalleryTypes.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.typeFilterChip,
                  galleryType === type && styles.typeFilterChipActive,
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

        {libraryMode === "library" ? (
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

      {selectionMode ? (
        <View style={[styles.selectionActionBar, { bottom: bottomActionOffset }]}>
          {libraryMode === "library" ? (
            <Pressable
              disabled={!selectedGalleryPhotos.length}
              style={[
                styles.selectionAction,
                !selectedGalleryPhotos.length && styles.selectionActionDisabled,
              ]}
              onPress={exportSelectedPhotos}
            >
              <Ionicons name="share-outline" size={23} color={NAVY} />
              <Text style={styles.selectionActionText}>Export</Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={!selectedGalleryPhotos.length}
              style={[
                styles.selectionAction,
                !selectedGalleryPhotos.length && styles.selectionActionDisabled,
              ]}
              onPress={restoreSelectedFromBin}
            >
              <Ionicons name="arrow-undo-outline" size={23} color={NAVY} />
              <Text style={styles.selectionActionText}>Restore</Text>
            </Pressable>
          )}
          <Pressable
            disabled={!selectedGalleryPhotos.length}
            style={[
              styles.selectionAction,
              !selectedGalleryPhotos.length && styles.selectionActionDisabled,
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
      ) : null}
    </>
  );
}
