import React from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { STAFF_NAMES } from "../../../constants/staffNames";
import styles from "../styles/surveyPhotoStyles";

export default function SurveyorPickerModal({
  onChooseSurveyor,
  projectSurveyor,
  setSurveyorPicker,
  surveyor,
  surveyorPicker,
  userInitials = 'NG',
}) {
  return (
    <Modal
      visible={surveyorPicker}
      transparent
      animationType="fade"
      onRequestClose={() => setSurveyorPicker(false)}
    >
      <Pressable
        style={styles.modalShade}
        onPress={() => setSurveyorPicker(false)}
      >
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>Select Surveyor</Text>
          <Text style={styles.initialsText}>
            Photo initials: {userInitials} · Profile Settings
          </Text>
          <ScrollView>
            {STAFF_NAMES.map((name) => {
              const selected = (projectSurveyor || surveyor) === name;
              return (
                <Pressable
                  key={name}
                  style={styles.typeRow}
                  onPress={() => onChooseSurveyor(name)}
                >
                  <View>
                    <Text style={styles.typeText}>{name}</Text>
                  </View>
                  {selected ? (
                    <Text style={styles.selectedTick}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}
