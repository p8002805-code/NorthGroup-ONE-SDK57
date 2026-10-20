import { Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { buildS500Html } from './s500/buildS500Html';
import { buildS500ExportName } from './formExportNames';
import { jobStorageKey } from '../features/jobs/jobContext';

const MAIL_SENT = MailComposer.MailComposerStatus?.SENT ?? 'sent';
const MAIL_SAVED = MailComposer.MailComposerStatus?.SAVED ?? 'saved';

const warnIfNotSavedLocally = (saveWarning) => {
  if (!saveWarning) return;
  Alert.alert(
    'Form copy not saved',
    `The PDF was created, but this phone could not save a copy of the form: ${saveWarning}`
  );
};

const createS500Pdf = async (s500, userInitials = '') => {
  // The local copy is a safety net. If saving it fails (e.g. phone storage is
  // full) the PDF is still created, and the user is told afterwards.
  let saveWarning = null;
  try {
    await AsyncStorage.setItem(
      jobStorageKey('s500_form', s500.jobSnapshot || { number: s500.jobNumber }),
      JSON.stringify(s500)
    );
  } catch (error) {
    saveWarning = String(error?.message || error);
  }

  const html = await buildS500Html(s500);
  const file = await Print.printToFileAsync({ html });

  const exportName = buildS500ExportName(s500, userInitials);

  const exportUri = FileSystem.documentDirectory + exportName;

  // Exporting the same form twice in a day gives the same file name; clear any
  // earlier copy so the second export cannot fail on "file already exists".
  await FileSystem.deleteAsync(exportUri, { idempotent: true });

  await FileSystem.copyAsync({
    from: file.uri,
    to: exportUri,
  });

  return {
    exportName,
    exportUri,
    saveWarning,
  };
};

export const prepareS500Pdf = async (s500, userInitials = '') => {
  try {
    const { exportName, exportUri, saveWarning } = await createS500Pdf(s500, userInitials);
    warnIfNotSavedLocally(saveWarning);
    return { exported: true, exportName, exportUri };
  } catch (error) {
    Alert.alert('PDF preparation failed', String(error?.message || error));
    return { exported: false };
  }
};

export const exportS500Pdf = async (s500, userInitials = '') => {
  try {
    const { exportName, exportUri, saveWarning } = await createS500Pdf(s500, userInitials);

    await Sharing.shareAsync(exportUri, {
      mimeType: 'application/pdf',
      dialogTitle: exportName,
      UTI: 'com.adobe.pdf',
    });
    warnIfNotSavedLocally(saveWarning);
    return { exported: true, exportName, exportUri };
  } catch (error) {
    Alert.alert('Export failed', String(error?.message || error));
    return { exported: false };
  }
};

export const emailS500Pdf = async (s500, userInitials = '') => {
  try {
    const mailAvailable = await MailComposer.isAvailableAsync();

    if (!mailAvailable) {
      Alert.alert(
        'Email unavailable',
        'No compatible email account is currently available on this device.'
      );

      return { exported: false };
    }

    const { exportName, exportUri, saveWarning } = await createS500Pdf(s500, userInitials);

    const subject = exportName.replace(/\.pdf$/i, '');

    const mailResult = await MailComposer.composeAsync({
      recipients: ['OHS@northgroup.com.au'],
      subject,
      body: 'Please find the completed Pre-Start Risk Assessment attached.',
      attachments: [exportUri],
    });
    warnIfNotSavedLocally(saveWarning);

    // Only a sent email counts as submitted. Cancelling the compose window must
    // not mark the pre-start complete. (Android always reports "sent".)
    const status = mailResult?.status ?? MAIL_SENT;
    if (status !== MAIL_SENT) {
      if (status === MAIL_SAVED) {
        Alert.alert(
          'Email saved, not sent',
          'The email was saved as a draft but has not been sent, so the S-500 is not marked complete.'
        );
      }
      return { exported: false, emailStatus: status, exportName, exportUri };
    }
    return { exported: true, exportName, exportUri };
  } catch (error) {
    Alert.alert('Email failed', String(error?.message || error));
    return { exported: false };
  }
};