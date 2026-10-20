import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ProfileAvatar({
  uri,
  revision = 0,
  initials = 'NG',
  size = 40,
  backgroundColor = '#D6A84F',
  textColor = '#061A2D',
  borderColor = 'transparent',
  borderWidth = 0,
  style,
}) {
  const radius = size / 2;
  const displayInitials = String(initials || 'NG').slice(0, 4).toUpperCase();
  const sharedStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    borderColor,
    borderWidth,
  };

  if (uri) {
    return (
      <Image
        key={`${uri}:${revision}`}
        source={{ uri }}
        style={[styles.image, sharedStyle, style]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        sharedStyle,
        { backgroundColor },
        style,
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            color: textColor,
            fontSize: Math.max(
              8,
              Math.round(size * (displayInitials.length > 2 ? 0.26 : 0.34)),
            ),
          },
        ]}
      >
        {displayInitials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: '#DCE3E8',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '900',
  },
});
