import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';

import AppCard from '../../../components/AppCard';
import AppButton from '../../../components/AppButton';
import AppBackButton from '../../../components/AppBackButton';

import { COLORS } from '../../../theme/colours';
import {
  SPACING,
  RADIUS,
} from '../../../theme/spacing';
import { TYPOGRAPHY } from '../../../theme/typography';

export default function TmrFeaturePhotoReviewScreen({
  photoUri,
  setScreen,
  clearCapturedPhoto,
  backLabel = 'TMR Guide',
}) {
  const retakePhoto = () => {
    clearCapturedPhoto();
    setScreen('tmrFeatureCamera');
  };

  const openFeatureGuide = () => {
    setScreen('tmrFeatureGuide');
  };

  const cancelReview = () => {
    clearCapturedPhoto();
    setScreen('tmrFeatureGuide');
  };

  if (!photoUri) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.missingContainer}>
          <Text style={styles.missingTitle}>
            Photo unavailable
          </Text>

          <Text style={styles.missingText}>
            The captured photo could not be loaded.
          </Text>

          <AppButton
            title="Open Camera"
            variant="primary"
            onPress={() =>
              setScreen('tmrFeatureCamera')
            }
            style={styles.missingButton}
          />

          <AppButton
            title={`Back to ${backLabel}`}
            variant="secondary"
            onPress={cancelReview}
            style={styles.missingSecondaryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <AppBackButton
          label={backLabel}
          style={styles.headerButton}
          onPress={cancelReview}
        />

        <Text style={styles.headerTitle}>
          Review Photo
        </Text>

        <View style={styles.headerButton} />
      </View>

      <View style={styles.content}>
        <View style={styles.imageCard}>
          <Image
            source={{ uri: photoUri }}
            resizeMode="contain"
            style={styles.photo}
            onError={() => {
              Alert.alert(
                'Photo unavailable',
                'The captured photo could not be displayed.'
              );
            }}
          />
        </View>

        <AppCard style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>
            Is the feature clearly visible?
          </Text>

          <Text style={styles.instructionsText}>
            Make sure the object fills enough of the image and is not heavily
            obscured. Clear photos will be important when automatic
            identification is added.
          </Text>
        </AppCard>

        <View style={styles.buttonRow}>
          <AppButton
            title="Retake"
            variant="light"
            onPress={retakePhoto}
            style={styles.retakeButton}
          />

          <AppButton
            title="Search Feature Guide"
            variant="primary"
            onPress={openFeatureGuide}
            style={styles.searchButton}
          />
        </View>

        <Text style={styles.futureNote}>
          Automatic feature suggestions will be added to this screen later.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  header: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.navy2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    paddingHorizontal: SPACING.lg,
  },

  headerButton: {
    minWidth: 112,
    height: 40,
  },

  headerTitle: {
    flex: 1,
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
  },

  content: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },

  imageCard: {
    flex: 1,
    minHeight: 300,
    maxHeight: 520,
    backgroundColor: COLORS.navy3,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },

  photo: {
    width: '100%',
    height: '100%',
  },

  instructionsCard: {
    marginTop: SPACING.md,
  },

  instructionsTitle: {
    ...TYPOGRAPHY.cardTitle,
    color: COLORS.textPrimary,
  },

  instructionsText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
  },

  buttonRow: {
    flexDirection: 'row',
    marginTop: SPACING.md,
  },

  retakeButton: {
    flex: 1,
    marginRight: SPACING.sm,
  },

  searchButton: {
    flex: 1.5,
    marginLeft: SPACING.sm,
  },

  futureNote: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },

  missingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },

  missingTitle: {
    ...TYPOGRAPHY.sectionTitle,
    color: COLORS.white,
    textAlign: 'center',
  },

  missingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
  },

  missingButton: {
    minWidth: 180,
  },

  missingSecondaryButton: {
    minWidth: 180,
    marginTop: SPACING.sm,
  },
});
