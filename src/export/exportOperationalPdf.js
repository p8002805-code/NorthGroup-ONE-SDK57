import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { buildS501Html, buildS506Html } from './operational/buildOperationalHtml';
import { buildOperationalExportName } from './formExportNames';

const createPdf = async (form, type, userInitials = '') => {
  const isVehicle = type === 's501';
  const html = isVehicle ? await buildS501Html(form) : await buildS506Html(form);
  const file = await Print.printToFileAsync({ html });
  const exportName = buildOperationalExportName(form, type, userInitials);
  const exportUri = FileSystem.documentDirectory + exportName;
  await FileSystem.copyAsync({ from: file.uri, to: exportUri });
  return { exportName, exportUri };
};

export const prepareOperationalPdf = async (form, type, userInitials = '') => {
  try {
    return await createPdf(form, type, userInitials);
  } catch (error) {
    Alert.alert('PDF preparation failed', String(error?.message || error));
    return { exported: false };
  }
};

export const exportOperationalPdf = async (form, type, onReadyToShare, userInitials = '') => {
  let readyNotified = false;
  const notifyReady = () => {
    if (readyNotified) return;
    readyNotified = true;
    onReadyToShare?.();
  };

  try {
    const { exportName, exportUri } = await createPdf(form, type, userInitials);
    notifyReady();
    await Sharing.shareAsync(exportUri, { mimeType: 'application/pdf', dialogTitle: exportName, UTI: 'com.adobe.pdf' });
    return { exported: true, exportName, exportUri };
  } catch (error) {
    notifyReady();
    Alert.alert('Export failed', String(error?.message || error));
    return { exported: false };
  }
};
