import React from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";

import styles from "../styles/surveyPhotoStyles";

export default function PhotoDeleteConfirmModal({
  binnedPhotoCount,
  confirmation,
  deleteRequest,
  onCancel,
  onConfirm,
  setConfirmation,
}) {
  const confirmed = confirmation.trim().toUpperCase() === "DELETE";

  return (
    <Modal
      visible={Boolean(deleteRequest)}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.deleteConfirmShade}>
        <View style={styles.deleteConfirmCard}>
          <View style={styles.deleteConfirmIcon}>
            <Text style={styles.deleteConfirmIconText}>!</Text>
          </View>
          <Text style={styles.deleteConfirmTitle}>
            {deleteRequest?.action === "empty"
              ? "Empty Bin?"
              : deleteRequest?.action === "multiple"
                ? "Permanently delete selected photos?"
                : "Permanently delete photo?"}
          </Text>
          {deleteRequest?.action === "single" ? (
            <Text style={styles.deleteConfirmFile} numberOfLines={2}>
              {deleteRequest?.photo?.fileName}
            </Text>
          ) : null}
          <Text style={styles.deleteConfirmWarning}>
            {deleteRequest?.action === "empty"
              ? `This permanently removes all ${binnedPhotoCount} photos in the Bin and cannot be undone.`
              : deleteRequest?.action === "multiple"
                ? `This permanently removes ${deleteRequest?.photos?.length || 0} selected photos and cannot be undone.`
                : "This permanently removes the official project file and cannot be undone."}
          </Text>
          <Text style={styles.deleteConfirmInstruction}>
            Type DELETE to continue
          </Text>
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="DELETE"
            placeholderTextColor="#9BA6AE"
            style={styles.deleteConfirmInput}
          />
          <Pressable
            disabled={!confirmed}
            style={[
              styles.deleteConfirmButton,
              !confirmed && styles.deleteConfirmButtonDisabled,
            ]}
            onPress={onConfirm}
          >
            <Text style={styles.deleteConfirmButtonText}>
              {deleteRequest?.action === "empty"
                ? "EMPTY BIN"
                : "PERMANENTLY DELETE"}
            </Text>
          </Pressable>
          <Pressable style={styles.deleteCancelButton} onPress={onCancel}>
            <Text style={styles.deleteCancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
