import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PDFDocument,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import { buildSE14RecordName } from '../utils/se14Records';
import { SE14_DRAFT_KEY } from '../utils/se14Records';
import { jobStorageKey } from '../features/jobs/jobContext';
import { buildSE14Html } from './se14/buildSE14Html';

const addEditableDataFileFields = async (sourceUri, se14) => {
  const sourceBase64 = await FileSystem.readAsStringAsync(
    sourceUri,
    { encoding: FileSystem.EncodingType.Base64 }
  );
  const document = await PDFDocument.load(sourceBase64);
  const pages = document.getPages();

  if (pages.length !== 4) {
    throw new Error(
      `SE-14 export produced ${pages.length} pages; expected 4.`
    );
  }

  const page = pages[1];
  const { width } = page.getSize();
  const form = document.getForm();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const navy = rgb(6 / 255, 26 / 255, 45 / 255);
  const paleBlue = rgb(231 / 255, 241 / 255, 248 / 255);
  const gold = rgb(214 / 255, 168 / 255, 79 / 255);

  // This panel is drawn directly onto page two so its fields remain editable
  // after the styled HTML has been converted to PDF.
  page.drawRectangle({
    x: 34,
    y: 38,
    width: width - 68,
    height: 105,
    color: rgb(1, 1, 1),
    borderColor: navy,
    borderWidth: 1,
  });
  page.drawRectangle({
    x: 34,
    y: 119,
    width: width - 68,
    height: 24,
    color: navy,
  });
  page.drawText('OFFICE DATA FILES - EDITABLE PDF FIELDS', {
    x: 46,
    y: 127,
    size: 9,
    font: bold,
    color: gold,
  });

  const addField = (name, label, value, y) => {
    page.drawRectangle({
      x: 46,
      y,
      width: 135,
      height: 25,
      color: paleBlue,
      borderColor: navy,
      borderWidth: 0.7,
    });
    page.drawText(label, {
      x: 54,
      y: y + 9,
      size: 8.5,
      font: bold,
      color: navy,
    });

const field = form.createTextField(name);

field.setText(value || '');

field.addToPage(page, {
  x: 181,
  y,
  width: width - 227,
  height: 25,
  textColor: navy,
  backgroundColor: rgb(1, 1, 1),
  borderColor: navy,
  borderWidth: 0.7,
  font,
});

// The field must be on the page before its
// default appearance and font size are changed.
field.setFontSize(10);
  };

  addField(
    'rawGnssDataFilename',
    'Raw GNSS Data Filename',
    se14.rawGnssFile,
    84
  );
  addField(
    'rinexDataFilename',
    'RINEX Data Filename',
    se14.rinexFile,
    52
  );

  form.updateFieldAppearances(font);
  return document.saveAsBase64();
};

export const exportSE14Pdf = async (se14, onPrepared) => {
  try {
    await AsyncStorage.setItem(
      jobStorageKey(SE14_DRAFT_KEY, se14.jobSnapshot || { number: se14.projectNumber }),
      JSON.stringify(se14)
    );

    const html = await buildSE14Html(se14);
    const file = await Print.printToFileAsync({ html });
    const exportName = `${buildSE14RecordName(se14)}.pdf`;
    const exportUri = `${FileSystem.documentDirectory}${exportName}`;

    await FileSystem.deleteAsync(exportUri, {
      idempotent: true,
    });

    const editablePdfBase64 =
      await addEditableDataFileFields(file.uri, se14);

    await FileSystem.writeAsStringAsync(
      exportUri,
      editablePdfBase64,
      { encoding: FileSystem.EncodingType.Base64 }
    );

    // The PDF is now fully prepared. Hide the blocking overlay before
    // opening the iOS share sheet so cancelling Share cannot leave it stuck.
    if (typeof onPrepared === 'function') {
      onPrepared({ uri: exportUri, name: exportName });
    }

    await Sharing.shareAsync(exportUri, {
      mimeType: 'application/pdf',
      dialogTitle: exportName,
      UTI: 'com.adobe.pdf',
    });

    return {
      exported: true,
      uri: exportUri,
      name: exportName,
    };
  } catch (error) {
    Alert.alert(
      'Export failed',
      String(error?.message || error)
    );
    return { exported: false };
  }
};
