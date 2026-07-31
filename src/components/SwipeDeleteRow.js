import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const ACTION_WIDTH = 96;

export default function SwipeDeleteRow({ children, onDelete, onOpenChange, topInset = 10 }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const [deleteOpen, setDeleteOpen] = useState(false);

  const settle = (open) => {
    setDeleteOpen(open);
    onOpenChange?.(open);
    Animated.spring(translateX, {
      toValue: open ? -ACTION_WIDTH : 0,
      useNativeDriver: true,
      friction: 9,
      tension: 80,
    }).start();
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => (
      (deleteOpen ? gesture.dx > 2 : gesture.dx < -2) &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.45
    ),
    onMoveShouldSetPanResponderCapture: (_, gesture) => (
      (deleteOpen ? gesture.dx > 2 : gesture.dx < -2) &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 0.45
    ),
    onPanResponderGrant: () => {
      translateX.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      const startPosition = deleteOpen ? -ACTION_WIDTH : 0;
      translateX.setValue(Math.max(
        -ACTION_WIDTH,
        Math.min(0, startPosition + gesture.dx)
      ));
    },
    onPanResponderRelease: (_, gesture) => {
      if (deleteOpen) {
        settle(!(gesture.dx > 12 || gesture.vx > 0.12));
        return;
      }

      settle(gesture.dx < -12 || gesture.vx < -0.12);
    },
    onPanResponderTerminate: () => settle(deleteOpen),
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }), [deleteOpen, translateX]);

  const handleDelete = () => {
    setDeleteOpen(false);
    onOpenChange?.(false);
    onDelete();
  };

  return (
    <View
      {...panResponder.panHandlers}
      style={{ position: 'relative', overflow: 'hidden', borderRadius: 14 }}
    >
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Delete"
        activeOpacity={0.85}
        onPress={handleDelete}
        style={{
          position: 'absolute',
          top: topInset,
          right: 0,
          bottom: 0,
          width: ACTION_WIDTH,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#D92D2D',
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '900' }}>Delete</Text>
      </TouchableOpacity>

      <Animated.View
        style={{ transform: [{ translateX }] }}
      >
        {children}
      </Animated.View>

      {deleteOpen ? (
        <Pressable
          accessibilityLabel="Close delete action"
          onPress={() => settle(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: ACTION_WIDTH,
            bottom: 0,
            zIndex: 2,
          }}
        />
      ) : null}
    </View>
  );
}
