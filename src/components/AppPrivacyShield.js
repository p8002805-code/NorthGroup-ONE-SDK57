import React, { useEffect, useState } from 'react';
import {
  AppState,
  Modal,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  isPrivacyShieldSuspended,
  subscribeToPrivacyShieldSuspension,
} from '../services/security/privacyShieldControl';

const shouldShield = (state) => Boolean(state && state !== 'active');

export default function AppPrivacyShield() {
  const [appState, setAppState] = useState(AppState.currentState);
  const [suspended, setSuspended] = useState(isPrivacyShieldSuspended);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppState(state);
    });
    const unsubscribe = subscribeToPrivacyShieldSuspension(setSuspended);
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);

  const visible = !suspended && shouldShield(appState);

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent={false}
      supportedOrientations={['portrait', 'landscape']}
      onRequestClose={() => {}}
    >
      <StatusBar barStyle="light-content" backgroundColor="#061A2D" />
      <View
        accessibilityLabel="Protected NorthGroup workspace"
        importantForAccessibility="yes"
        pointerEvents="auto"
        style={styles.shield}
      >
        <View style={styles.mark} />
        <Text style={styles.brand}>NORTHGROUP ONE</Text>
        <Text style={styles.message}>Protected workspace</Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  shield: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#061A2D',
    justifyContent: 'center',
    zIndex: 100000,
  },
  mark: {
    backgroundColor: '#D6A84F',
    borderRadius: 3,
    height: 6,
    marginBottom: 18,
    width: 52,
  },
  brand: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  message: {
    color: '#9FB0BF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginTop: 10,
    textTransform: 'uppercase',
  },
});
