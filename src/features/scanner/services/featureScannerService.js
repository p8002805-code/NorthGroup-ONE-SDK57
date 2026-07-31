import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

const NorthGroupScanner = requireOptionalNativeModule('NorthGroupScanner');

const DEVELOPMENT_BUILD_REASON = 'development-build-required';

export const getFeatureScannerCapabilities = async () => {
  if (Platform.OS !== 'ios') {
    return {
      available: false,
      reason: 'ios-required',
      minimumIOS: '18.0',
      mode: 'area',
      format: 'usdz',
    };
  }

  if (!NorthGroupScanner) {
    return {
      available: false,
      reason: DEVELOPMENT_BUILD_REASON,
      minimumIOS: '18.0',
      mode: 'area',
      format: 'usdz',
    };
  }

  try {
    return await NorthGroupScanner.getCapabilities();
  } catch {
    return {
      available: false,
      reason: 'capability-check-failed',
      minimumIOS: '18.0',
      mode: 'area',
      format: 'usdz',
    };
  }
};

export const launchFeatureScanner = async ({
  jobNumber,
  featureId,
  notes,
}) => {
  if (!NorthGroupScanner) {
    throw new Error(
      'The 3D scanner needs a NorthGroup One development or TestFlight build. It is not included in Expo Go.',
    );
  }

  return NorthGroupScanner.launchScanner({
    jobNumber: String(jobNumber || '').trim(),
    featureId: String(featureId || '').trim().toUpperCase(),
    notes: String(notes || '').trim(),
  });
};

export const previewFeatureModel = async (modelUri) => {
  if (!NorthGroupScanner) {
    throw new Error('3D preview is available in the development or TestFlight build.');
  }

  return NorthGroupScanner.previewModel(modelUri);
};

export const getScannerAvailabilityMessage = (capabilities) => {
  switch (capabilities?.reason) {
    case 'checking':
      return 'Checking this iPhone for Apple 3D scanning support…';
    case DEVELOPMENT_BUILD_REASON:
      return 'The scanner is ready in the project, but Expo Go cannot load Apple’s native 3D capture framework. Install a NorthGroup One development or TestFlight build to scan.';
    case 'ios-version-not-supported':
      return 'Area scanning requires iOS 18 or later.';
    case 'device-not-supported':
      return 'This iPhone does not support Apple Object Capture. A LiDAR-equipped Pro iPhone or supported iPad is required.';
    case 'ios-required':
      return 'The first 3D scanner release is available on supported Apple devices only.';
    default:
      return 'NorthGroup One could not confirm 3D scanner support on this device.';
  }
};
