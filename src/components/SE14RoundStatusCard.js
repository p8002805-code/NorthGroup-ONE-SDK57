import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GOLD, NAVY, WHITE } from '../styles/styles';

export default function SE14RoundStatusCard({ round, onStartNext }) {
  const styles = useMemo(() => createStyles(), []);
  const recordCount = round?.recordCount || 0;
  const sequence = round?.sequence || 1;
  const label = round?.label || 'Morning';

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Ionicons name="layers-outline" size={20} color="#8A5C08" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>CURRENT FIELD ROUND</Text>
        <Text style={styles.title}>Round {sequence} · {label}</Text>
        <Text style={styles.meta}>
          {recordCount
            ? `${recordCount} session${recordCount === 1 ? '' : 's'} started · end times stay in this round`
            : 'Your first saved session will create this round'}
        </Text>
      </View>
      {recordCount ? (
        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.82}
          onPress={onStartNext}
          accessibilityRole="button"
          accessibilityLabel={`Start field round ${sequence + 1}`}
        >
          <Text style={styles.nextButtonText}>NEW</Text>
          <Text style={styles.nextButtonNumber}>R{sequence + 1}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  card: {
    minHeight: 76,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DDC47E',
    backgroundColor: '#FFF9EA',
    padding: 11,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFE8AD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: {
    color: '#8A5C08',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  title: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  meta: {
    color: '#64748B',
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
  nextButton: {
    width: 46,
    minHeight: 47,
    borderRadius: 11,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  nextButtonText: {
    color: GOLD,
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  nextButtonNumber: {
    color: WHITE,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 1,
  },
});
