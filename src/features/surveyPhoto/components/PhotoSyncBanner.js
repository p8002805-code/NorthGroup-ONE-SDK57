import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GOLD, NAVY, WHITE } from '../constants/photoTheme';

export default function PhotoSyncBanner({
  offline = false,
  pendingCount = 0,
  processing = false,
  progress = 0,
  compact = false,
  onPress,
  style,
}) {
  if (!offline && !pendingCount) return null;

  const pendingLabel = `${pendingCount} upload${pendingCount === 1 ? '' : 's'} pending`;
  const title = offline ? 'OFFLINE — PHOTOS STAY ON THIS IPHONE' : 'SHAREPOINT SYNC';
  const progressPercent = Math.max(0, Math.min(100, Math.round((Number(progress) || 0) * 100)));
  const detail = processing
    ? `Uploading now · ${progressPercent}% · ${pendingLabel}`
    : pendingCount
      ? `${pendingLabel} · ${offline ? 'Automatic retry when connected' : 'Tap to retry now'}`
      : 'New uploads will wait for reception';

  return (
    <Pressable
      disabled={processing || !onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [
        styles.banner,
        compact && styles.compact,
        offline ? styles.offline : styles.online,
        style,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.icon}>
        {processing ? (
          <ActivityIndicator size="small" color={GOLD} />
        ) : (
          <Ionicons
            name={offline ? 'cloud-offline-outline' : 'cloud-upload-outline'}
            size={compact ? 16 : 18}
            color={offline ? GOLD : '#54D98C'}
          />
        )}
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, compact && styles.compactTitle]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.detail, compact && styles.compactDetail]}>
          {detail}
        </Text>
      </View>
      {!processing && pendingCount > 0 && onPress ? (
        <Ionicons name="refresh" size={compact ? 15 : 17} color={GOLD} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compact: {
    position: 'absolute',
    zIndex: 8,
    minHeight: 38,
    left: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 13,
  },
  offline: {
    backgroundColor: '#2C271C',
    borderColor: 'rgba(214,168,79,0.7)',
  },
  online: {
    backgroundColor: '#0B2B2A',
    borderColor: 'rgba(84,217,140,0.56)',
  },
  pressed: { opacity: 0.82 },
  icon: {
    width: 29,
    height: 29,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  copy: { flex: 1, minWidth: 0 },
  title: {
    color: WHITE,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  compactTitle: { fontSize: 8 },
  detail: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  compactDetail: { fontSize: 8, marginTop: 1 },
});
