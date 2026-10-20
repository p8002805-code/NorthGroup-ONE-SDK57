import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  StyleSheet,
  Image,
  ImageBackground,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ImageView from "react-native-image-viewing";

import AppCard from "../../../components/AppCard";
import AppButton from "../../../components/AppButton";
import AppBackButton from "../../../components/AppBackButton";

import { COLORS } from "../../../theme/colours";
import { SPACING, RADIUS } from "../../../theme/spacing";
import { TYPOGRAPHY } from "../../../theme/typography";

import { getTmrFeatureImages } from "../data/tmrFeatureImages";

const NAVY = "#061A2D";
const GOLD = "#D6A84F";
const WHITE = "#FFFFFF";
const PAGE = "#F2F5F7";

function TmrFeatureHeader({ insets, feature, onBack }) {
  return (
    <ImageBackground
      source={require("../../../../assets/topo-bg.png")}
      style={styles.featureHeaderBanner}
      imageStyle={styles.featureHeaderBannerImage}
    >
      <View pointerEvents="none" style={styles.featureHeaderShade} />
      <View style={[styles.featureHeaderTop, { paddingTop: insets.top + 8 }]}>
        <AppBackButton
          label="TMR Guide"
          style={styles.featureBackButton}
          onPress={onBack}
        />
        <View style={styles.featureHeaderBadge}>
          <Text style={styles.featureHeaderBadgeIcon}>▦</Text>
          <Text style={styles.featureHeaderBadgeLabel}>CODE</Text>
        </View>
      </View>
      <View style={styles.featureHeaderTitleRow}>
        <View style={styles.featureHeaderTitleCopy}>
          <Text style={styles.featureHeaderEyebrow}>{feature.model}</Text>
          <Text style={styles.featureHeaderTitle}>{feature.code}</Text>
          <Text style={styles.featureHeaderSubtitle}>
            {feature.description}
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const DetailSection = ({ label, children }) => {
  if (!children) {
    return null;
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionValue}>{children}</Text>
    </View>
  );
};

export default function TmrFeatureDetailsScreen({ feature, setScreen }) {
  const insets = useSafeAreaInsets();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fullScreenInitialIndex, setFullScreenInitialIndex] = useState(0);
  const [showFullScreenImage, setShowFullScreenImage] = useState(false);
  const fullScreenCurrentIndexRef = useRef(0);

  const featureImages = feature ? getTmrFeatureImages(feature.code) : [];

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [feature?.code]);

  const hasImages = featureImages.length > 0;

  const selectedImage = hasImages ? featureImages[selectedImageIndex] : null;
  const fullScreenImages = featureImages.map((image) => ({
    uri: Image.resolveAssetSource(image).uri,
  }));

  const returnToGuide = () => {
    setScreen("tmrFeatureGuide");
  };

  const openFullScreenImage = () => {
    fullScreenCurrentIndexRef.current = selectedImageIndex;
    setFullScreenInitialIndex(selectedImageIndex);
    setShowFullScreenImage(true);
  };

  const closeFullScreenImage = () => {
    setShowFullScreenImage(false);
    setSelectedImageIndex(fullScreenCurrentIndexRef.current);
  };

  const reportIssue = () =>
    Alert.alert(
      "Report guidance issue",
      `Please report ${feature.code} to the NorthGroup administrator with the correction required.`,
      [{ text: "OK" }],
    );

  const showPreviousImage = () => {
    if (!hasImages) {
      return;
    }

    setSelectedImageIndex((currentIndex) => {
      if (currentIndex === 0) {
        return featureImages.length - 1;
      }

      return currentIndex - 1;
    });
  };

  const showNextImage = () => {
    if (!hasImages) {
      return;
    }

    setSelectedImageIndex((currentIndex) => {
      if (currentIndex === featureImages.length - 1) {
        return 0;
      }

      return currentIndex + 1;
    });
  };

  if (!feature) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.missingContainer}>
          <Text style={styles.missingTitle}>Feature unavailable</Text>

          <Text style={styles.missingText}>
            This feature could not be loaded.
          </Text>

          <AppButton
            title="Back to TMR Guide"
            onPress={returnToGuide}
            variant="primary"
            style={styles.missingButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <TmrFeatureHeader
        insets={insets}
        feature={feature}
        onBack={returnToGuide}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <AppCard style={styles.imageCard}>
          <View style={styles.imageSectionHeader}>
            <Text style={styles.imageSectionTitle}>Reference Images</Text>

            {hasImages && (
              <Text style={styles.imageCounter}>
                {selectedImageIndex + 1} of {featureImages.length}
              </Text>
            )}
          </View>

          {hasImages ? (
            <>
              <TouchableOpacity
                style={styles.mainImageContainer}
                activeOpacity={0.9}
                onPress={openFullScreenImage}
                accessibilityRole="button"
                accessibilityLabel="Open reference image full screen"
                accessibilityHint="Pinch or double tap to zoom"
              >
                <Image
                  source={selectedImage}
                  resizeMode="contain"
                  style={styles.mainImage}
                />
                <View pointerEvents="none" style={styles.fullScreenHint}>
                  <Text style={styles.fullScreenHintIcon}>⛶</Text>
                  <Text style={styles.fullScreenHintText}>
                    TAP TO VIEW & ZOOM
                  </Text>
                </View>
              </TouchableOpacity>

              {featureImages.length > 1 && (
                <View style={styles.imageControls}>
                  <TouchableOpacity
                    style={[
                      styles.imageControlButton,
                      styles.imageControlButtonLeft,
                    ]}
                    activeOpacity={0.82}
                    onPress={showPreviousImage}
                    accessibilityRole="button"
                    accessibilityLabel="Show previous reference image"
                  >
                    <Text style={styles.imageControlButtonText}>
                      ‹ Previous
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.imageControlButton,
                      styles.imageControlButtonRight,
                    ]}
                    activeOpacity={0.82}
                    onPress={showNextImage}
                    accessibilityRole="button"
                    accessibilityLabel="Show next reference image"
                  >
                    <Text style={styles.imageControlButtonText}>Next ›</Text>
                  </TouchableOpacity>
                </View>
              )}

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailRow}
              >
                {featureImages.map((image, index) => {
                  const isSelected = index === selectedImageIndex;

                  return (
                    <TouchableOpacity
                      key={`${feature.code}-${index}`}
                      activeOpacity={0.82}
                      onPress={() => setSelectedImageIndex(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show reference image ${index + 1}`}
                      accessibilityState={{
                        selected: isSelected,
                      }}
                      style={[
                        styles.thumbnailButton,
                        isSelected && styles.thumbnailButtonSelected,
                      ]}
                    >
                      <Image
                        source={image}
                        resizeMode="cover"
                        style={styles.thumbnailImage}
                      />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          ) : (
            <View style={styles.noImagesContainer}>
              <Text style={styles.noImagesTitle}>
                No reference images added yet
              </Text>

              <Text style={styles.noImagesText}>
                Images can be added later to the folder for code {feature.code}.
              </Text>
            </View>
          )}
        </AppCard>

        <AppCard style={styles.detailCard}>
          <DetailSection label="Code">{feature.code}</DetailSection>

          <DetailSection label="Feature">{feature.description}</DetailSection>

          <DetailSection label="Model">{feature.model}</DetailSection>

          <DetailSection label="Pickup Method">
            {feature.pickupMethod}
          </DetailSection>

          <DetailSection label="Comment Required">
            {feature.standardComment}
          </DetailSection>

          {!!feature.exampleComments?.length && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Example Comments</Text>

              {feature.exampleComments.map((comment) => (
                <View key={comment} style={styles.commentPill}>
                  <Text style={styles.commentText}>{comment}</Text>
                </View>
              ))}
            </View>
          )}

          <DetailSection label="Field Notes">
            {feature.fieldNotes}
          </DetailSection>
        </AppCard>

        <Text style={styles.disclaimer}>
          Confirm project-specific requirements and current TMR instructions
          before relying on this guide in the field.
        </Text>

        <TouchableOpacity onPress={reportIssue} style={styles.reportButton}>
          <Text style={styles.reportText}>
            REPORT INCORRECT OR OUTDATED GUIDANCE
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ImageView
        images={fullScreenImages}
        imageIndex={fullScreenInitialIndex}
        visible={showFullScreenImage}
        onRequestClose={closeFullScreenImage}
        onImageIndexChange={(imageIndex) => {
          fullScreenCurrentIndexRef.current = imageIndex;
        }}
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        presentationStyle="fullScreen"
        backgroundColor="#000000"
        HeaderComponent={({ imageIndex }) => (
          <SafeAreaView style={styles.viewerHeader}>
            <TouchableOpacity
              style={styles.viewerCloseButton}
              activeOpacity={0.8}
              onPress={closeFullScreenImage}
              accessibilityRole="button"
              accessibilityLabel="Close full screen image"
            >
              <Text style={styles.viewerCloseText}>Close</Text>
            </TouchableOpacity>

            <View style={styles.viewerTitleWrap}>
              <Text style={styles.viewerTitle}>{feature.code}</Text>
              <Text style={styles.viewerCounter}>
                {imageIndex + 1} of {featureImages.length}
              </Text>
            </View>

            <View style={styles.viewerHeaderSpacer} />
          </SafeAreaView>
        )}
        FooterComponent={() => (
          <SafeAreaView style={styles.viewerFooter}>
            <Text style={styles.viewerHelp}>
              Pinch or double-tap to zoom
            </Text>
          </SafeAreaView>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PAGE,
  },

  scrollContent: {
    backgroundColor: PAGE,
    padding: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },

  featureHeaderBanner: { backgroundColor: NAVY, overflow: "hidden" },
  featureHeaderBannerImage: { opacity: 0.58 },
  featureHeaderShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,18,33,0.62)",
  },
  featureHeaderTop: {
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureHeaderTitleRow: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  featureHeaderTitleCopy: { flex: 1, paddingRight: 12 },
  featureHeaderEyebrow: {
    color: GOLD,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  featureHeaderTitle: {
    color: WHITE,
    fontSize: 27,
    fontWeight: "900",
    letterSpacing: -0.4,
    marginTop: 3,
  },
  featureHeaderSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  featureHeaderBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GOLD,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.42)",
  },
  featureHeaderBadgeIcon: {
    color: NAVY,
    fontSize: 23,
    lineHeight: 25,
    fontWeight: "900",
  },
  featureHeaderBadgeLabel: {
    color: NAVY,
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 1,
  },
  featureBackButton: { alignSelf: "flex-start", minWidth: 112 },

  imageCard: {
    marginBottom: SPACING.md,
  },

  reportButton: {
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  reportText: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center",
  },

  imageSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.md,
  },

  imageSectionTitle: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
  },

  imageCounter: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  mainImageContainer: {
    width: "100%",
    height: 270,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    overflow: "hidden",
  },

  mainImage: {
    width: "100%",
    height: "100%",
  },

  fullScreenHint: {
    position: "absolute",
    right: 10,
    bottom: 10,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: "rgba(6,26,45,0.88)",
  },

  fullScreenHintIcon: {
    color: GOLD,
    fontSize: 15,
    fontWeight: "900",
    marginRight: 6,
  },

  fullScreenHintText: {
    color: WHITE,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },

  imageControls: {
    flexDirection: "row",
    marginTop: SPACING.md,
  },

  imageControlButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.navy2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },

  imageControlButtonLeft: {
    marginRight: SPACING.xs,
  },

  imageControlButtonRight: {
    marginLeft: SPACING.xs,
  },

  imageControlButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  thumbnailRow: {
    paddingTop: SPACING.md,
    paddingRight: SPACING.xs,
  },

  thumbnailButton: {
    width: 72,
    height: 58,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: COLORS.offWhite,
    overflow: "hidden",
    marginRight: SPACING.sm,
  },

  thumbnailButtonSelected: {
    borderColor: COLORS.gold,
  },

  thumbnailImage: {
    width: "100%",
    height: "100%",
  },

  noImagesContainer: {
    minHeight: 145,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xxl,
  },

  noImagesTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },

  noImagesText: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textSecondary,
    textAlign: "center",
    marginTop: SPACING.sm,
  },

  detailCard: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: SPACING.lg,
  },

  section: {
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },

  sectionLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.goldDark,
    marginBottom: SPACING.sm,
  },

  sectionValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
  },

  commentPill: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },

  commentText: {
    color: COLORS.textPrimary,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },

  disclaimer: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.lg,
    paddingHorizontal: SPACING.md,
  },

  missingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xxl,
  },

  missingTitle: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.white,
    textAlign: "center",
  },

  missingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: "center",
    marginTop: SPACING.sm,
  },

  missingButton: {
    minWidth: 180,
    marginTop: SPACING.xl,
  },

  viewerHeader: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    backgroundColor: "rgba(0,0,0,0.72)",
  },

  viewerCloseButton: {
    width: 76,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: GOLD,
  },

  viewerCloseText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: "900",
  },

  viewerTitleWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },

  viewerTitle: {
    color: WHITE,
    fontSize: 16,
    fontWeight: "900",
  },

  viewerCounter: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  viewerHeaderSpacer: {
    width: 76,
  },

  viewerFooter: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },

  viewerHelp: {
    color: "rgba(255,255,255,0.76)",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
});
