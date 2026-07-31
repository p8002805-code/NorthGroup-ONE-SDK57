import React, { useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';

import {
  CameraView,
  useCameraPermissions,
} from 'expo-camera';

import AppCard from '../../../components/AppCard';
import AppButton from '../../../components/AppButton';
import AppBackButton from '../../../components/AppBackButton';
import { getTmrFeatureImages } from '../data/tmrFeatureImages';

import { COLORS } from '../../../theme/colours';
import {
  SPACING,
  RADIUS,
} from '../../../theme/spacing';
import { TYPOGRAPHY } from '../../../theme/typography';

export default function TmrFeatureCameraScreen({
  setScreen,
  onPhotoCaptured,
  selectedFeature,
  backLabel = 'TMR Guide',
}) {
  const cameraRef = useRef(null);

  const [permission, requestPermission] =
    useCameraPermissions();

  const [isTakingPhoto, setIsTakingPhoto] =
    useState(false);

  const returnToGuide = () => {
    setScreen('tmrFeatureGuide');
  };

  const takePhoto = async () => {
    if (!cameraRef.current || isTakingPhoto) {
      return;
    }

    try {
      setIsTakingPhoto(true);

      const photo =
        await cameraRef.current.takePictureAsync({
          quality: 0.8,
          skipProcessing: false,
        });

      if (!photo?.uri) {
        throw new Error(
          'The camera did not return a photo.'
        );
      }

      onPhotoCaptured(photo.uri);
    } catch (error) {
      Alert.alert(
        'Photo failed',
        String(error?.message || error)
      );
    } finally {
      setIsTakingPhoto(false);
    }
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />

        <ActivityIndicator
          size="large"
          color={COLORS.gold}
        />

        <Text style={styles.loadingText}>
          Checking camera permission...
        </Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <StatusBar barStyle="light-content" />

        <AppCard style={styles.permissionCard}>
          <Text style={styles.permissionTitle}>
            Camera permission required
          </Text>

          <Text style={styles.permissionText}>
            NorthGroup Forms needs camera access so
            you can photograph and identify survey
            features.
          </Text>

          <AppButton
            title="Allow Camera Access"
            variant="primary"
            onPress={requestPermission}
            style={styles.permissionPrimaryButton}
          />

          <AppButton
            title={`Back to ${backLabel}`}
            variant="secondary"
            onPress={returnToGuide}
            style={styles.permissionSecondaryButton}
          />
        </AppCard>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      />

      <SafeAreaView style={styles.overlay}>
        <View style={styles.topBar}>
          <AppBackButton
            label={backLabel}
            style={styles.overlayButton}
            onPress={returnToGuide}
          />

          <Text style={styles.cameraTitle}>
            Identify TMR Feature
          </Text>

          <View style={styles.overlayButton} />
        </View>

        <View style={styles.guideArea}>
          {selectedFeature && getTmrFeatureImages(selectedFeature.code)[0] ? (
            <View style={styles.referenceCard}>
              <Image source={getTmrFeatureImages(selectedFeature.code)[0]} style={styles.referenceImage} />
              <Text style={styles.referenceText}>{selectedFeature.code} · GUIDE IMAGE</Text>
            </View>
          ) : null}
          <View style={styles.focusFrame} />

          <Text style={styles.guideText}>
            Position the survey feature clearly
            inside the frame.
          </Text>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.captureOuter,
              isTakingPhoto &&
                styles.captureOuterDisabled,
            ]}
            activeOpacity={0.82}
            disabled={isTakingPhoto}
            onPress={takePhoto}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
          >
            {isTakingPhoto ? (
              <ActivityIndicator
                size="small"
                color={COLORS.navy}
              />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>

          <Text style={styles.captureHint}>
            Tap to take a photo
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },

  camera: {
    ...StyleSheet.absoluteFillObject,
  },

  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },

  topBar: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(6, 26, 45, 0.76)',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },

  cameraTitle: {
    flex: 1,
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
    paddingHorizontal: SPACING.sm,
  },

  overlayButton: {
    minWidth: 112,
    height: 40,
  },

  guideArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxxl,
  },

  referenceCard: { position: 'absolute', top: SPACING.lg, right: SPACING.lg, width: 112, backgroundColor: 'rgba(6, 26, 45, 0.88)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.gold, padding: 5 },
  referenceImage: { width: 100, height: 76, borderRadius: RADIUS.sm },
  referenceText: { color: COLORS.gold, fontSize: 9, fontWeight: '900', textAlign: 'center', marginTop: 4 },

  focusFrame: {
    width: '100%',
    maxWidth: 330,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.xl,
    backgroundColor: 'transparent',
  },

  guideText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    fontWeight: '800',
    textAlign: 'center',
    backgroundColor: 'rgba(6, 26, 45, 0.78)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.lg,
  },

  bottomBar: {
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(6, 26, 45, 0.78)',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingBottom: SPACING.lg,
  },

  captureOuter: {
    width: 78,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.pill,
    borderWidth: 4,
    borderColor: COLORS.gold,
  },

  captureOuterDisabled: {
    opacity: 0.65,
  },

  captureInner: {
    width: 58,
    height: 58,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.pill,
    borderWidth: 3,
    borderColor: COLORS.navy,
  },

  captureHint: {
    color: COLORS.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xxl,
  },

  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.white,
    marginTop: SPACING.md,
  },

  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.xl,
  },

  permissionCard: {
    width: '100%',
    maxWidth: 420,
  },

  permissionTitle: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  permissionText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
  },

  permissionPrimaryButton: {
    marginTop: SPACING.xl,
  },

  permissionSecondaryButton: {
    marginTop: SPACING.sm,
  },
});
