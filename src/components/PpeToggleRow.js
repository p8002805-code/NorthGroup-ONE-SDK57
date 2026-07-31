import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';

import styles from '../styles/styles';

export default function PpeToggleRow({
  label,
  value,
  onValueChange,
  editableLabel = false,
  onLabelChange,
  autoFocus = false,
  compact = false,
}) {
  const RowContainer = editableLabel ? View : TouchableOpacity;

  return (
    <RowContainer
      style={[
        styles.ppeRow,
        compact && styles.ppeGridItem,
        compact && value && styles.ppeGridItemSelected,
      ]}
      {...(editableLabel ? {} : {
        onPress: () => onValueChange(!value),
        activeOpacity: 0.8,
      })}
    >
      {editableLabel ? (
        <TextInput
          autoFocus={autoFocus}
          value={label}
          onChangeText={onLabelChange}
          placeholder="Enter PPE item"
          placeholderTextColor="#8291A1"
          style={[
            styles.ppeRowLabel,
            compact && styles.ppeGridLabel,
            { paddingVertical: 6 },
          ]}
          returnKeyType="done"
        />
      ) : (
        <Text
          style={[
            styles.ppeRowLabel,
            compact && styles.ppeGridLabel,
            compact && value && styles.ppeGridLabelSelected,
          ]}
        >
          {label}
        </Text>
      )}

      {compact ? (
        editableLabel ? (
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: '#D7DEE5', true: '#55C982' }}
            thumbColor="#FFFFFF"
            style={styles.ppeGridSwitch}
          />
        ) : (
          <Text style={[styles.ppeGridCheck, !value && styles.ppeGridCheckEmpty]}>
            {value ? '✓' : ''}
          </Text>
        )
      ) : (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#E6E8EE', true: '#30D158' }}
          thumbColor="#FFFFFF"
        />
      )}
    </RowContainer>
  );
}
