import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function NorthGroupBrandButton({
  onPress,
  accessibilityLabel = 'NorthGroup One',
  accessibilityHint,
  style,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? accessibilityLabel : undefined}
      accessibilityHint={onPress ? accessibilityHint : undefined}
      hitSlop={6}
      style={({ pressed }) => [
        styles.button,
        style,
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={require('../../assets/logo-transparent.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <View style={styles.copy}>
        <Text style={styles.brand}>NORTHGROUP</Text>
        <Text style={styles.one}>ONE</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minWidth: 136,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  pressed: {
    opacity: 0.68,
  },
  logo: {
    width: 42,
    height: 42,
    marginRight: 8,
  },
  copy: {
    justifyContent: 'center',
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '900',
    letterSpacing: 2.05,
  },
  one: {
    color: '#D6A84F',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 2.6,
  },
});
