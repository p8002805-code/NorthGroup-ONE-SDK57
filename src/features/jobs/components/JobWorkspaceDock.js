import React, { useCallback, useMemo } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../theme/ThemeContext';
import { RADIUS, SPACING } from '../../../theme/spacing';

const getUsableCoordinates = (job) => {
  const latitudeValue = job?.latitude;
  const longitudeValue = job?.longitude;
  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);

  if (
    latitudeValue === null
    || latitudeValue === undefined
    || String(latitudeValue).trim() === ''
    || longitudeValue === null
    || longitudeValue === undefined
    || String(longitudeValue).trim() === ''
    || !Number.isFinite(latitude)
    || !Number.isFinite(longitude)
    || (latitude === 0 && longitude === 0)
    || latitude < -90
    || latitude > 90
    || longitude < -180
    || longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
};

export const buildJobMapLinks = (job) => {
  const coordinates = getUsableCoordinates(job);
  const location = String(job?.location || '').trim();

  if (!coordinates && !location) return null;

  const destination = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : location;
  const encodedDestination = encodeURIComponent(destination);
  const encodedLabel = encodeURIComponent(
    location || job?.name || job?.number || 'Job location',
  );

  return {
    label: location || 'Pinned job location',
    apple: `maps://?daddr=${encodedDestination}&dirflg=d&q=${encodedLabel}`,
    appleFallback: `https://maps.apple.com/?daddr=${encodedDestination}&dirflg=d&q=${encodedLabel}`,
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`,
  };
};

const openUrl = async (url, fallbackUrl = '') => {
  try {
    await Linking.openURL(url);
  } catch (_error) {
    if (fallbackUrl) {
      try {
        await Linking.openURL(fallbackUrl);
        return;
      } catch (_fallbackError) {
        // Continue to the shared error message below.
      }
    }

    Alert.alert(
      'Maps could not be opened',
      'Please check the available map apps and try again.',
    );
  }
};

export const useJobDirections = (job) => {
  const { colors } = useTheme();
  const mapLinks = useMemo(() => buildJobMapLinks(job), [job]);

  const openDirections = useCallback(() => {
    if (!mapLinks) return;

    const openAppleMaps = () => openUrl(mapLinks.apple, mapLinks.appleFallback);
    const openGoogleMaps = () => openUrl(mapLinks.google);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: `Directions to ${mapLinks.label}`,
          options: ['Apple Maps', 'Google Maps', 'Cancel'],
          cancelButtonIndex: 2,
          userInterfaceStyle: colors.isDark ? 'dark' : 'light',
        },
        (buttonIndex) => {
          if (buttonIndex === 0) openAppleMaps();
          if (buttonIndex === 1) openGoogleMaps();
        },
      );
      return;
    }

    Alert.alert(
      'Get directions',
      mapLinks.label,
      [
        { text: 'Apple Maps', onPress: openAppleMaps },
        { text: 'Google Maps', onPress: openGoogleMaps },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [colors.isDark, mapLinks]);

  return { mapLinks, openDirections };
};

function DockItem({ icon, activeIcon, label, active = false, disabled = false, onPress }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.dockItem,
        disabled && styles.dockItemDisabled,
        pressed && !disabled && styles.dockItemPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={label}
    >
      <View style={[styles.dockIcon, active && styles.dockIconActive]}>
        <Ionicons
          name={active ? (activeIcon || icon) : icon}
          size={21}
          color={active ? colors.accent : colors.supportingText}
        />
      </View>
      <Text style={[styles.dockLabel, active && styles.dockLabelActive]}>
        {label}
      </Text>
      {active ? <View style={styles.dockActiveMark} /> : null}
    </Pressable>
  );
}

export default function JobWorkspaceDock({
  job,
  activeTab,
  onWorkspace,
  onForms,
  onJobFiles,
  onCapture,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const hasJob = Boolean(job?.number);

  return (
    <View style={[styles.dockPosition, { bottom: Math.max(insets.bottom, SPACING.sm) }]}>
      <View style={styles.dock}>
        <DockItem
          icon="folder-open-outline"
          activeIcon="folder-open"
          label="Job Files"
          active={activeTab === 'files'}
          disabled={!hasJob}
          onPress={onJobFiles}
        />
        <DockItem
          icon="grid-outline"
          activeIcon="grid"
          label="Workspace"
          active={activeTab === 'workspace'}
          disabled={!hasJob}
          onPress={onWorkspace}
        />
        <DockItem
          icon="camera-outline"
          activeIcon="camera"
          label="Capture"
          active={activeTab === 'capture'}
          disabled={!hasJob}
          onPress={onCapture}
        />
        <DockItem
          icon="document-text-outline"
          activeIcon="document-text"
          label="Forms"
          active={activeTab === 'forms'}
          disabled={!hasJob}
          onPress={onForms}
        />
      </View>
    </View>
  );
}

const createStyles = (colors) => StyleSheet.create({
  dockPosition: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    zIndex: 20,
  },
  dock: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
    borderRadius: RADIUS.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardBackground,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: colors.isDark ? 0.34 : 0.16,
    shadowRadius: 18,
    elevation: 10,
  },
  dockItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  dockItemDisabled: {
    opacity: 0.36,
  },
  dockItemPressed: {
    opacity: 0.68,
    transform: [{ scale: 0.97 }],
  },
  dockIcon: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.pill,
  },
  dockIconActive: {
    backgroundColor: colors.navy,
  },
  dockLabel: {
    color: colors.supportingText,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  dockLabelActive: {
    color: colors.bodyText,
    fontWeight: '900',
  },
  dockActiveMark: {
    position: 'absolute',
    bottom: 1,
    width: 18,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
});
