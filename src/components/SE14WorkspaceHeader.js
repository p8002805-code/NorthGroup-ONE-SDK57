import React from 'react';

import {
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import NorthGroupBrandButton from './NorthGroupBrandButton';
import { GOLD, NAVY, WHITE } from '../styles/styles';

export default function SE14WorkspaceHeader({
  topInset = 0,
  jobNumber,
  jobName,
  onBack,
  backLabel = 'Forms',
}) {
  return (
    <ImageBackground
      source={require('../../assets/topo-bg.png')}
      style={[styles.header, { paddingTop: topInset }]}
      imageStyle={styles.backgroundImage}
    >
      <View style={styles.shade} />

      <View style={styles.topRow}>
        <NorthGroupBrandButton
          onPress={onBack}
          style={styles.brandButton}
          accessibilityLabel={`NorthGroup One, return to ${backLabel}`}
          accessibilityHint={`Returns to ${backLabel}`}
        />

        <View style={styles.titleCopy}>
          <Text style={styles.formCode}>SE-14 · GNSS</Text>
          <Text style={styles.title}>GNSS Sessions</Text>
        </View>
      </View>

      <View style={styles.jobBar}>
        <View style={styles.lockIcon}>
          <Text style={styles.lockIconText}>✓</Text>
        </View>

        <View style={styles.jobCopy}>
          <Text style={styles.jobNumber} numberOfLines={1}>
            {jobNumber}
          </Text>
          <Text style={styles.jobName} numberOfLines={1}>
            {jobName}
          </Text>
        </View>

        <View style={styles.lockedPill}>
          <Text style={styles.lockedText}>LOCKED</Text>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 11,
    overflow: 'hidden',
  },
  backgroundImage: {
    opacity: 0.32,
  },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,28,48,0.72)',
  },
  topRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandButton: {
    minHeight: 42,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    marginLeft: 10,
  },
  formCode: {
    color: GOLD,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.05,
  },
  title: {
    color: WHITE,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
    marginTop: 1,
  },
  jobBar: {
    minHeight: 42,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.42)',
    backgroundColor: 'rgba(5,34,56,0.88)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  lockIcon: {
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GOLD,
    marginRight: 9,
  },
  lockIconText: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '900',
  },
  jobCopy: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  jobNumber: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '900',
    marginRight: 8,
  },
  jobName: {
    flex: 1,
    color: '#AFC2D2',
    fontSize: 10,
    fontWeight: '700',
  },
  lockedPill: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#7890A2',
    paddingHorizontal: 7,
    paddingVertical: 4,
    marginLeft: 7,
  },
  lockedText: {
    color: '#D7E1E8',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
