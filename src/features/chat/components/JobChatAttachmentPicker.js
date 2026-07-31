import React, { useCallback, useEffect, useRef } from 'react';
import {
  ImageBackground,
  InteractionManager,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const NAVY = '#061A2D';
const NAVY_2 = '#09233C';
const GOLD = '#D6A84F';
const WHITE = '#FFFFFF';
const MUTED = '#AAB8C3';

const actions = [
  {
    key: 'camera',
    label: 'Take Photo',
    detail: 'Use the iPhone camera',
    icon: 'camera-outline',
  },
  {
    key: 'photos',
    label: 'Choose Photos',
    detail: 'Select up to five images',
    icon: 'images-outline',
  },
  {
    key: 'file',
    label: 'Choose File',
    detail: 'Files, iCloud Drive, KML and more',
    icon: 'document-attach-outline',
  },
];

export default function JobChatAttachmentPicker({
  visible,
  onClose,
  onTakePhoto,
  onChoosePhotos,
  onChooseFile,
}) {
  const insets = useSafeAreaInsets();
  const pendingActionRef = useRef('');
  const fallbackTimerRef = useRef(null);
  const handlersRef = useRef({});

  handlersRef.current = {
    camera: onTakePhoto,
    photos: onChoosePhotos,
    file: onChooseFile,
  };

  const runPendingAction = useCallback(() => {
    const actionKey = pendingActionRef.current;
    if (!actionKey) return;

    pendingActionRef.current = '';
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    InteractionManager.runAfterInteractions(() => {
      handlersRef.current[actionKey]?.();
    });
  }, []);

  const chooseAction = useCallback((actionKey) => {
    pendingActionRef.current = actionKey;
    onClose?.();

    // iOS calls Modal.onDismiss after the sheet is fully gone. This fallback
    // keeps the controls functional on platforms where onDismiss is delayed.
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(runPendingAction, 650);
  }, [onClose, runPendingAction]);

  useEffect(() => () => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={runPendingAction}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <ImageBackground
          source={require('../../../../assets/topo-bg.png')}
          resizeMode="cover"
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) }]}
          imageStyle={styles.sheetImage}
        >
          <View pointerEvents="none" style={styles.sheetShade} />
          <View style={styles.handle} />

          <View style={styles.headingRow}>
            <View>
              <Text style={styles.eyebrow}>JOB CHAT</Text>
              <Text style={styles.title}>Add an attachment</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Close attachment options"
            >
              <Ionicons name="close" size={20} color={WHITE} />
            </Pressable>
          </View>

          <View style={styles.actionList}>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => chooseAction(action.key)}
                style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={styles.actionIcon}>
                  <Ionicons name={action.icon} size={22} color={GOLD} />
                </View>
                <View style={styles.actionCopy}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                  <Text style={styles.actionDetail}>{action.detail}</Text>
                </View>
                <Ionicons name="chevron-forward" size={17} color={MUTED} />
              </Pressable>
            ))}
          </View>

          <Text style={styles.footer}>FILES ARE SHARED SECURELY THROUGH MICROSOFT 365</Text>
        </ImageBackground>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,10,20,0.55)',
  },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: GOLD,
    paddingHorizontal: 16,
    paddingTop: 10,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  sheetImage: { opacity: 0.42 },
  sheetShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,18,33,0.78)',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginBottom: 13,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  eyebrow: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.35,
  },
  title: {
    color: WHITE,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  actionList: { gap: 8 },
  action: {
    minHeight: 68,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(10,35,58,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(184,196,208,0.22)',
  },
  actionPressed: {
    opacity: 0.74,
    transform: [{ scale: 0.99 }],
  },
  actionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(214,168,79,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(214,168,79,0.32)',
  },
  actionCopy: { flex: 1, minWidth: 0, marginLeft: 12 },
  actionLabel: { color: WHITE, fontSize: 14, fontWeight: '900' },
  actionDetail: { color: MUTED, fontSize: 10, marginTop: 3 },
  footer: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.8,
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 2,
  },
  pressed: { opacity: 0.65 },
});
