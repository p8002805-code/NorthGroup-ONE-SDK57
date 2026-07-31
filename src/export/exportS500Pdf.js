import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { fileSafe, dateForFilename } from '../utils/format';
import { buildS500Html } from './s500/buildS500Html';
import { jobStorageKey } from '../features/jobs/jobContext';

const createS500Pdf = async (s500) => {
  await AsyncStorage.setItem(jobStorageKey('s500_form', s500.jobSnapshot || { number: s500.jobNumber }), JSON.stringify(s500));

  const html = await buildS500Html(s500);
  const file = await Print.printToFileAsync({ html });

  const exportName =
    `${fileSafe(s500.jobNumber || 'Job')}` +
    `_Pre-Start-Risk-Assessment_${dateForFilename(s500.date)}.pdf`;

  const exportUri = FileSystem.documentDirectory + exportName;

  await FileSystem.copyAsync({
    from: file.uri,
    to: exportUri,
  });

  return {
    exportName,
    exportUri,
  };
};

export const exportS500Pdf = async (s500) => {
  try {
    const { exportName, exportUri } = await createS500Pdf(s500);

    await Sharing.shareAsync(exportUri, {
      mimeType: 'application/pdf',
      dialogTitle: exportName,
      UTI: 'com.adobe.pdf',
    });
    return { exported: true, exportName, exportUri };
  } catch (error) {
    Alert.alert('Export failed', String(error?.message || error));
    return { exported: false };
  }
};

export const emailS500Pdf = async (s500) => {
  try {
    const mailAvailable = await MailComposer.isAvailableAsync();

    if (!mailAvailable) {
      Alert.alert(
        'Email unavailable',
        'No compatible email account is currently available on this device.'
      );

      return { exported: false };
    }

    const { exportName, exportUri } = await createS500Pdf(s500);

    const subject = exportName.replace(/\.pdf$/i, '');

    await MailComposer.composeAsync({
      recipients: ['OHS@northgroup.com.au'],
      subject,
      body: 'Please find the completed Pre-Start Risk Assessment attached.',
      attachments: [exportUri],
    });
    return { exported: true, exportName, exportUri };
  } catch (error) {
    Alert.alert('Email failed', String(error?.message || error));
    return { exported: false };
  }
};
