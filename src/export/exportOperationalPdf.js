import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { fileSafe, dateForFilename } from '../utils/format';
import { buildS501Html, buildS506Html } from './operational/buildOperationalHtml';

const createPdf = async (form, type) => {
  const isVehicle = type === 's501';
  const html = isVehicle ? await buildS501Html(form) : await buildS506Html(form);
  const file = await Print.printToFileAsync({ html });
  const identity = isVehicle ? form.registration : form.jobNumber;
  const label = isVehicle ? 'Vehicle_PreStart' : 'Journey_Management';
  const exportName = `${fileSafe(identity || 'NorthGroup')}_${label}_${dateForFilename(form.date)}.pdf`;
  const exportUri = FileSystem.documentDirectory + exportName;
  await FileSystem.copyAsync({ from: file.uri, to: exportUri });
  return { exportName, exportUri };
};

export const exportOperationalPdf = async (form, type, onReadyToShare) => {
  let readyNotified = false;
  const notifyReady = () => {
    if (readyNotified) return;
    readyNotified = true;
    onReadyToShare?.();
  };

  try {
    const { exportName, exportUri } = await createPdf(form, type);
    notifyReady();
    await Sharing.shareAsync(exportUri, { mimeType: 'application/pdf', dialogTitle: exportName, UTI: 'com.adobe.pdf' });
    return { exported: true, exportName, exportUri };
  } catch (error) {
    notifyReady();
    Alert.alert('Export failed', String(error?.message || error));
    return { exported: false };
  }
};
