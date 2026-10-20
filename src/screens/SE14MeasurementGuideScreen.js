import React, { useState } from 'react';

import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Image,
  StyleSheet,
} from 'react-native';

import ImageView from 'react-native-image-viewing';
import AppBackButton from '../components/AppBackButton';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const MUTED = '#B8C4D0';

const MEASUREMENT_DIAGRAM = require(
  '../../assets/se14-measurement-diagram.png'
);

export default function SE14MeasurementGuideScreen({
  setScreen,
  backLabel = 'GNSS Session',
}) {
  const [
    showFullScreenImage,
    setShowFullScreenImage,
  ] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.topBar}>
        <AppBackButton label={backLabel} onPress={() => setScreen('fillSE14')} style={styles.backButton} />

        <Text style={styles.topTitle}>
          Measurement Guide
        </Text>

        <View style={styles.topSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>
            Antenna Height Check
          </Text>

          <Text style={styles.introText}>
            Measure HMP and BQR at the points shown.
          </Text>

          <View style={styles.toleranceBox}>
            <Text style={styles.toleranceLabel}>
              Required tolerance
            </Text>

            <Text style={styles.toleranceValue}>
              ARP-BQR: within ±0.005 m
            </Text>

            <Text style={styles.arpHelpText}>
              ARP = Antenna Reference Point
            </Text>
          </View>
        </View>

<TouchableOpacity
  style={styles.imageCard}
  activeOpacity={0.9}
  onPress={() =>
    setShowFullScreenImage(true)
  }
  accessibilityRole="button"
  accessibilityLabel="Open antenna measurement diagram full screen"
>
  <View style={styles.imageFrame}>
    <Image
      source={MEASUREMENT_DIAGRAM}
      style={styles.guideImage}
      resizeMode="contain"
    />
  </View>

  <View style={styles.tapHint}>
    <Text style={styles.tapHintText}>
      Tap image to view full screen
    </Text>
  </View>
</TouchableOpacity>

        <View style={styles.notesCard}>
          <Text style={styles.notesTitle}>
            How to use
          </Text>

          <Text style={styles.noteText}>
            1. Measure HMP to the lever.
          </Text>

          <Text style={styles.noteText}>
            2. Measure BQR to the bottom of the quick
            release.
          </Text>

          <Text style={styles.noteText}>
            3. Confirm ARP-BQR is within ±0.005 m. If
            not, measure again.
          </Text>
        </View>
      </ScrollView>

      <ImageView
        images={[
          {
            uri: Image.resolveAssetSource(
              MEASUREMENT_DIAGRAM
            ).uri,
          },
        ]}
        imageIndex={0}
        visible={showFullScreenImage}
        onRequestClose={() =>
          setShowFullScreenImage(false)
        }
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        presentationStyle="fullScreen"
        backgroundColor="#000000"
        HeaderComponent={() => (
          <SafeAreaView style={styles.viewerHeader}>
            <TouchableOpacity
              style={styles.viewerCloseButton}
              activeOpacity={0.8}
              onPress={() =>
                setShowFullScreenImage(false)
              }
            >
              <Text style={styles.viewerCloseText}>
                Close
              </Text>
            </TouchableOpacity>

            <Text style={styles.viewerTitle}>
              Antenna Height Diagram
            </Text>

            <View
              style={styles.viewerHeaderSpacer}
            />
          </SafeAreaView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },

  topBar: {
    minHeight: 54,
    backgroundColor: NAVY_2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor:
      'rgba(255,255,255,0.12)',
  },

  backButton: {
    width: 112,
    height: 40,
  },

  topTitle: {
    flex: 1,
    color: WHITE,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },

  topSpacer: {
    width: 112,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },

  introCard: {
    backgroundColor: NAVY_2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor:
      'rgba(214,168,79,0.38)',
    padding: 16,
    marginBottom: 14,
  },

  introTitle: {
    color: GOLD,
    fontSize: 20,
    fontWeight: '900',
  },

  introText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },

  toleranceBox: {
    backgroundColor:
      'rgba(214,168,79,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor:
      'rgba(214,168,79,0.45)',
    padding: 12,
    marginTop: 14,
  },

  toleranceLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  toleranceValue: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
  arpHelpText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 5,
  },
imageCard: {
  width: '100%',
  backgroundColor: WHITE,
  borderRadius: 16,
  overflow: 'hidden',
  borderWidth: 2,
  borderColor: GOLD,
},

imageFrame: {
  width: '100%',
  aspectRatio: 962 / 862,
  backgroundColor: WHITE,
  position: 'relative',
},

guideImage: {
  ...StyleSheet.absoluteFillObject,
  width: undefined,
  height: undefined,
},

tapHint: {
  minHeight: 42,
  backgroundColor: NAVY_2,
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: 12,
  paddingVertical: 10,
  borderTopWidth: 1,
  borderTopColor:
    'rgba(214,168,79,0.35)',
},

tapHintText: {
  color: GOLD,
  fontSize: 12,
  fontWeight: '900',
  textAlign: 'center',
},

  notesCard: {
    backgroundColor: NAVY_2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor:
      'rgba(255,255,255,0.12)',
    padding: 16,
    marginTop: 14,
  },

  notesTitle: {
    color: GOLD,
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 8,
  },

  noteText: {
    color: WHITE,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 7,
  },

  viewerHeader: {
    backgroundColor:
      'rgba(6,26,45,0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 82,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  viewerCloseButton: {
    width: 82,
    minHeight: 52,
    justifyContent: 'center',
  },

  viewerCloseText: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '900',
  },

  viewerTitle: {
    flex: 1,
    color: WHITE,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },

  viewerHeaderSpacer: {
    width: 82,
  },
});
