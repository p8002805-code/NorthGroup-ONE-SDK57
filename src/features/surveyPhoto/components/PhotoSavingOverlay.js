import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { GOLD } from '../constants/photoTheme';
import styles from '../styles/surveyPhotoStyles';

export default function PhotoSavingOverlay({ detail = '', progress = null, text = '' }) {
  if (!text) return null;
  const percent = progress == null
    ? null
    : Math.max(0, Math.min(100, Math.round(Number(progress || 0) * 100)));

  return (
    <View style={styles.saving}>
      <ActivityIndicator size="large" color={GOLD} />
      <Text style={styles.savingText}>{text}</Text>
      {detail ? <Text style={styles.savingDetail}>{detail}</Text> : null}
      {percent != null ? (
        <>
          <View style={styles.savingProgressTrack}>
            <View
              style={[
                styles.savingProgressFill,
                { width: `${Math.max(2, percent)}%` },
              ]}
            />
          </View>
          <Text style={styles.savingProgressText}>{percent}%</Text>
        </>
      ) : null}
    </View>
  );
}
