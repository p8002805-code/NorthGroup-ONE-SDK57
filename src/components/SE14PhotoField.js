import React, { useState } from 'react';

import {
  Alert,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';

import styles from '../styles/styles';
import { embedSE14PhotoMetadata } from '../utils/se14PhotoStorage';
import { accountDirectoryName } from '../features/account/accountWorkspace';

const safePart = (value, fallback) =>
  String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_');

const dateFolderName = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shortMarkPart = (value) => {
  const cleaned = safePart(value, 'UnassignedMark');
  return /^PM/i.test(cleaned) ? cleaned : `PM${cleaned}`;
};

export default function SE14PhotoField({
  label,
  value,
  photoType,
  projectNumber,
  markId,
  sessionNumber,
  tagText,
  onChange,
  onAccepted,
  optional = false,
}) {
  const [busy, setBusy] = useState(false);

  const takePhoto = async () => {
    try {
      setBusy(true);

      const cameraPermission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!cameraPermission.granted) {
        Alert.alert(
          'Camera permission required',
          'Allow camera access to take the SE-14 site photo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
        exif: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return;
      }

      const capturedAt = new Date();
      const jobNumber = safePart(projectNumber, 'UnassignedJob');
      const dateFolder = dateFolderName(capturedAt);
      const directory =
        `${FileSystem.documentDirectory}${accountDirectoryName()}GNSS Photos/` +
        `${jobNumber} GNSS Photos/${dateFolder}/`;

      await FileSystem.makeDirectoryAsync(directory, {
        intermediates: true,
      });

      const filename = [
        shortMarkPart(markId),
        `S${safePart(sessionNumber, '0')}`,
        safePart(photoType, 'Photo'),
      ].join('_');

      const permanentUri = `${directory}${filename}.jpg`;
      await FileSystem.deleteAsync(permanentUri, {
        idempotent: true,
      });
      await FileSystem.copyAsync({
        from: result.assets[0].uri,
        to: permanentUri,
      });

      const stampText = [
        projectNumber || 'No Job Number',
        markId || 'No Mark ID',
        `Session ${sessionNumber || '-'}`,
        String(photoType || 'Photo').replace(/_/g, ' '),
        tagText || null,
        capturedAt.toLocaleString(),
      ]
        .filter(Boolean)
        .join('  •  ');

      const savedPhoto = {
        uri: permanentUri,
        filename: `${filename}.jpg`,
        capturedAt: capturedAt.toISOString(),
        dateFolder,
        projectNumber: String(projectNumber || ''),
        markId: String(markId || ''),
        sessionNumber: String(sessionNumber || ''),
        photoType,
        tagText: String(tagText || ''),
        stampText,
      };

      // Update the form immediately so the preview appears without waiting
      // for EXIF work or the iPhone Photos library operation.
      onChange(savedPhoto);
      onAccepted?.(savedPhoto);
      setBusy(false);

      // A second copy is saved to a dedicated Photos album. iOS does not
      // allow Expo Go to silently create arbitrary folders in the Files app.
      (async () => {
        try {
          await embedSE14PhotoMetadata(savedPhoto);

          const libraryPermission =
            await MediaLibrary.requestPermissionsAsync();

          if (!libraryPermission.granted) return;

          const asset = await MediaLibrary.createAssetAsync(permanentUri);
          const albumName = `${jobNumber} GNSS Photos`;
          const existingAlbum = await MediaLibrary.getAlbumAsync(albumName);

          if (existingAlbum) {
            await MediaLibrary.addAssetsToAlbumAsync(
              [asset],
              existingAlbum,
              false
            );
          } else {
            await MediaLibrary.createAlbumAsync(
              albumName,
              asset,
              false
            );
          }
        } catch (libraryError) {
          console.log(
            'Could not save SE-14 photo to the GNSS Photos album:',
            libraryError
          );
        }
      })();
    } catch (error) {
      Alert.alert(
        'Photo not saved',
        'The photo could not be saved. Please try again.'
      );
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = () => {
    Alert.alert(
      'Retake photo?',
      'This removes the photo from the SE-14 record. The copy already saved in Photos will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (value?.uri) {
              await FileSystem.deleteAsync(value.uri, {
                idempotent: true,
              });
            }
            onChange(null);
          },
        },
      ]
    );
  };

  const stampText = value?.stampText || (value
    ? `${projectNumber || 'No Job Number'}  •  ${
        markId || 'No Mark ID'
      }  •  Session ${sessionNumber || '-'}${
        tagText ? `  •  ${tagText}` : ''
      }  •  ${new Date(value.capturedAt).toLocaleString()}`
    : '');

  return (
    <View style={styles.photoFieldCard}>
      <View style={styles.photoFieldHeader}>
        <Text style={styles.photoFieldLabel}>{label}</Text>
        {optional && (
          <Text style={styles.photoOptionalText}>Optional</Text>
        )}
      </View>

      {value?.uri ? (
        <>
          <View style={styles.photoPreviewWrap}>
            <Image
              source={{ uri: value.uri }}
              style={styles.photoPreview}
              resizeMode="cover"
            />
            <View style={styles.photoStampPreview}>
              <Text style={styles.photoStampText}>
                {stampText}
              </Text>
            </View>
          </View>

          <View style={styles.photoActionRow}>
            <TouchableOpacity
              style={styles.photoRetakeButton}
              activeOpacity={0.8}
              onPress={removePhoto}
            >
              <Text style={styles.photoRetakeText}>
                Retake / Remove
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <TouchableOpacity
          style={styles.photoCaptureButton}
          activeOpacity={0.8}
          disabled={busy}
          onPress={takePhoto}
        >
          <Text style={styles.photoCaptureIcon}>⌾</Text>
          <Text style={styles.photoCaptureText}>
            {busy ? 'Saving…' : 'Take Photo'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
