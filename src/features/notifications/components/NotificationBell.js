import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationBell({
  count = 0,
  onPress,
  color = '#FFFFFF',
  badgeColor = '#D6A84F',
  size = 22,
  accessibilityLabel = 'Open notifications',
}) {
  const unreadCount = Math.max(0, Number(count) || 0);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
    >
      <Ionicons
        name={unreadCount ? 'notifications' : 'notifications-outline'}
        size={size}
        color={color}
      />
      {unreadCount > 0 ? (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  pressed: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 1,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#061A2D',
  },
  badgeText: {
    color: '#061A2D',
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
});

