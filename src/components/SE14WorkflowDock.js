import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GOLD, NAVY, WHITE } from '../styles/styles';

export default function SE14WorkflowDock({
  activeTab,
  bottomInset = 0,
  counts = {},
  onSelect,
}) {
  const tabs = [
    ['start', 'play-circle-outline', 'START', 0],
    ['end', 'stop-circle-outline', 'END', counts.end],
    ['review', 'checkmark-circle-outline', 'REVIEW', counts.review],
    ['archive', 'folder-outline', 'SAVED', counts.archive],
    ['photos', 'images-outline', 'PHOTOS', counts.photos],
  ];

  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 7) }]}>
      {tabs.map(([key, icon, label, count]) => {
        const active = activeTab === key;

        return (
          <TouchableOpacity
            key={key}
            style={styles.button}
            activeOpacity={0.78}
            onPress={() => onSelect(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <View style={[styles.icon, active && styles.iconActive]}>
              <Ionicons
                name={icon}
                size={20}
                color={active ? GOLD : '#607484'}
              />
              {count ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { minHeight: 66, flexDirection: 'row', alignItems: 'flex-start', paddingTop: 7, paddingHorizontal: 6, backgroundColor: WHITE, borderTopWidth: 1, borderTopColor: '#D8E0E6', shadowColor: '#061A2D', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 12 },
  button: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-start' },
  icon: { width: 30, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2F4' },
  iconActive: { backgroundColor: NAVY },
  badge: { position: 'absolute', top: -5, right: -9, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#B42318', borderWidth: 2, borderColor: WHITE },
  badgeText: { color: WHITE, fontSize: 7, fontWeight: '900' },
  label: { color: '#687B8B', fontSize: 7, fontWeight: '900', letterSpacing: 0.35, marginTop: 4 },
  labelActive: { color: NAVY },
});
