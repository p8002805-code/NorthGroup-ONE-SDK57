import React, { useState } from "react";
import { Keyboard, Pressable, Text, TextInput, View } from "react-native";

import { GOLD } from "../constants/photoTheme";
import styles from "../styles/surveyPhotoStyles";

export const Label = ({ text }) => <Text style={styles.label}>{text}</Text>;

export const Input = (props) => (
  <TextInput
    placeholderTextColor="#82909D"
    style={[styles.input, props.multiline && styles.multilineInput]}
    {...props}
  />
);

export const OverlayInput = ({
  label,
  primary = false,
  onBlur,
  onFocus,
  ...props
}) => {
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.overlayInputWrap,
        primary
          ? styles.overlayInputWrapPrimary
          : styles.overlayInputWrapSecondary,
        focused && styles.overlayInputWrapFocused,
      ]}
    >
      <Text
        style={[
          styles.overlayInputLabel,
          primary && styles.overlayInputLabelPrimary,
        ]}
      >
        {label}
      </Text>
      <TextInput
        {...props}
        keyboardType="number-pad"
        placeholderTextColor="rgba(255,255,255,0.48)"
        selectionColor={GOLD}
        style={[styles.overlayInput, primary && styles.overlayInputPrimary]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
    </View>
  );
};

export const DoneButton = () => (
  <Pressable style={styles.doneButton} onPress={Keyboard.dismiss}>
    <Text style={styles.doneButtonText}>Done ✓</Text>
  </Pressable>
);

export const GoldButton = ({ label, onPress, disabled = false }) => (
  <Pressable
    disabled={disabled}
    style={[styles.goldButton, disabled && { opacity: 0.45 }]}
    onPress={onPress}
  >
    <Text style={styles.goldText}>{label}</Text>
  </Pressable>
);

export const QaRow = ({ label, value }) => (
  <View style={styles.qaRow}>
    <Text style={styles.qaLabel}>{label}</Text>
    <Text style={styles.qaValue}>{value}</Text>
  </View>
);
