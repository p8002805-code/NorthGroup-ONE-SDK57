require('../tools/testSupport/registerAppModules');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSurveyPhotoFileNameBase,
  buildSurveyPhotoZipName,
  getGpsCaptureWarning,
  getPhotoDateKey,
  getSurveyPhotoZipPartInfo,
  getSurveyorInitials,
  planSurveyPhotoZipParts,
  SURVEY_PHOTO_ZIP_MAX_BYTES,
  SURVEY_PHOTO_ZIP_TARGET_BYTES,
} = require('../src/features/surveyPhoto/services/surveyPhotoRules');
const {
  describeSurveyPhotoUploadProgress,
} = require('../src/features/surveyPhoto/services/surveyPhotoProgress');
const {
  buildFormExportName,
  buildOperationalExportName,
  buildS500ExportName,
  buildSE14ExportName,
} = require('../src/export/formExportNames');
const { normaliseProfile } = require('../src/features/account/accountProfile');
const { SURVEY_IMAGE_TYPES } = require('../src/features/surveyPhoto/constants/imageTypes');
const {
  createRecentlyOpenedJobFile,
  normaliseRecentlyOpenedItem,
} = require('../src/navigation/recentlyOpened');

test('survey photo initials preserve all supplied name parts', () => {
  assert.equal(getSurveyorInitials('Louis B'), 'LB');
  assert.equal(getSurveyorInitials('  Liam   B  '), 'LTB');
  assert.equal(getSurveyorInitials('Patricia Mary Carroll'), 'PMC');
});

test('profile initials are authoritative over automatic name mappings', () => {
  assert.equal(normaliseProfile({
    firstName: 'Liam',
    lastName: 'B',
    initials: 'LB',
  }).initials, 'LB');
  assert.equal(normaliseProfile({
    firstName: 'Liam',
    lastName: 'B',
    initials: '',
  }).initials, 'LTB');
});

test('survey photo image types include Trees', () => {
  assert.equal(SURVEY_IMAGE_TYPES.includes('Trees'), true);
});

test('survey photo ZIP names end with compact date and profile initials', () => {
  assert.equal(
    buildSurveyPhotoZipName({
      projectNumber: '205127',
      initials: 'pc',
      exportedAt: new Date(2026, 7, 17, 19, 45, 59),
    }),
    '205127_Photos_260817PC.zip',
  );
  assert.equal(
    buildSurveyPhotoZipName({
      projectNumber: '205127',
      initials: 'PC',
      exportedAt: new Date(2026, 7, 17, 19, 45, 59),
      kind: 'selected',
    }),
    '205127_Photos_260817PC.zip',
  );
});

test('survey photo filenames stay initials, number, image type', () => {
  assert.equal(
    buildSurveyPhotoFileNameBase({
      initials: 'pc',
      photoId: '1007',
      imageType: 'Trees',
    }),
    'PC_1007_Trees',
  );
  assert.equal(
    buildSurveyPhotoFileNameBase({
      initials: 'LTB',
      photoId: '1042',
      imageType: 'Power Poles',
    }),
    'LTB_1042_Power_Poles',
  );
});

test('SharePoint upload progress reports real overall percentage and package context', () => {
  const status = describeSurveyPhotoUploadProgress({
    phase: 'uploading',
    progress: 0.684,
    partNumber: 2,
    partCount: 3,
    totalPhotoCount: 126,
    fileName: '205127_Photos_Part02-of-03_260820PC.zip',
  });
  assert.equal(status.percent, 68);
  assert.equal(status.text, 'Uploading to SharePoint…');
  assert.equal(status.detail.includes('Package 2 of 3'), true);
  assert.equal(status.detail.includes('126 photos total'), true);
});

test('large survey photo exports use numbered ZIP packages', () => {
  assert.equal(SURVEY_PHOTO_ZIP_TARGET_BYTES, 100 * 1024 * 1024);
  assert.equal(SURVEY_PHOTO_ZIP_MAX_BYTES, 150 * 1024 * 1024);
  assert.equal(
    buildSurveyPhotoZipName({
      projectNumber: '205127',
      initials: 'PC',
      exportedAt: new Date(2026, 7, 20, 19, 13, 0),
      partNumber: 1,
      partCount: 3,
    }),
    '205127_Photos_Part01-of-03_260820PC.zip',
  );
  assert.deepEqual(
    getSurveyPhotoZipPartInfo('205127_Photos_Part03-of-12_260820PC.zip'),
    { partNumber: 3, partCount: 12 },
  );
  assert.deepEqual(
    getSurveyPhotoZipPartInfo('205127_Photos_20260820_PC_Part03-of-12.zip'),
    { partNumber: 3, partCount: 12 },
  );
});

test('survey photo ZIP planner splits large exports near the 100 MB target', () => {
  const mb = 1024 * 1024;
  const entries = [
    { id: 'a', sizeBytes: 60 * mb },
    { id: 'b', sizeBytes: 45 * mb },
    { id: 'c', sizeBytes: 40 * mb },
  ];
  const parts = planSurveyPhotoZipParts(entries);
  assert.equal(parts.length, 2);
  assert.deepEqual(parts[0].entries.map((entry) => entry.id), ['a']);
  assert.deepEqual(parts[1].entries.map((entry) => entry.id), ['b', 'c']);
  assert.equal(parts[1].estimatedBytes, 85 * mb);
});

test('survey photo date grouping prefers the captured local date key', () => {
  assert.equal(getPhotoDateKey({
    captureDateKey: '2026-08-10',
    captureDateTime: '2026-08-09T14:30:00.000Z',
  }), '2026-08-10');
  assert.equal(getPhotoDateKey({ captureDateTime: 'invalid' }), 'Unknown Date');
});

test('survey photo GPS warning accepts fixes within tolerance', () => {
  assert.equal(getGpsCaptureWarning({
    hasLocation: true,
    accuracy: 5,
    toleranceMetres: 8,
  }), '');
});

test('survey photo GPS warning explains low-quality and unavailable fixes', () => {
  assert.equal(
    getGpsCaptureWarning({ hasLocation: true, accuracy: 11, toleranceMetres: 8 }),
    'GPS accuracy was ±11.0 m, outside the 8 m tolerance.',
  );
  assert.equal(
    getGpsCaptureWarning({ hasLocation: false, accuracy: null }),
    'No GPS position was available for this photo.',
  );
  assert.equal(
    getGpsCaptureWarning({
      hasLocation: true,
      accuracy: 4,
      preciseLocationDisabled: true,
    }),
    'Precise Location was off when this photo was taken.',
  );
});

test('survey photo GPS warning rejects a stale fix even when its accuracy is good', () => {
  assert.equal(
    getGpsCaptureWarning({
      hasLocation: true,
      accuracy: 3.2,
      fixTimestamp: 1000,
      now: 14000,
      maxFixAgeMs: 10000,
    }),
    'GPS position was 13 seconds old when this photo was taken. Refresh GPS and retake for a current position.',
  );
  assert.equal(
    getGpsCaptureWarning({
      hasLocation: true,
      accuracy: 3.2,
      fixTimestamp: 5000,
      now: 14000,
      maxFixAgeMs: 10000,
    }),
    '',
  );
});

test('S-500 export names include job, user initials and date', () => {
  assert.equal(
    buildS500ExportName({ jobNumber: '24001', completedBy: 'Louis B', date: '10/08/2026' }),
    '24001_Pre-Start-Risk-Assessment_260810LB.pdf',
  );
  assert.equal(
    buildS500ExportName({ jobNumber: '24001', completedBy: 'Liam B', date: '10/08/2026' }),
    '24001_Pre-Start-Risk-Assessment_260810LTB.pdf',
  );
});

test('SE-14 export names omit the old SE-14 wording and normalise PM marks', () => {
  const name = buildSE14ExportName({
    projectNumber: '24001',
    markId: 'pm 123',
    sessionNumber: '2',
    startDate: '10/08/2026',
    employeeProfile: { initials: 'PC', fullName: 'Patrick Carroll' },
  });
  assert.equal(name, '24001_GNSS_PM123_Session-2_260810PC.pdf');
  assert.equal(name.includes('SE-14'), false);
});

test('vehicle and journey export names end with date and user initials and omit registration', () => {
  assert.equal(
    buildOperationalExportName({
      jobNumber: '24/001',
      registration: '123 ABC',
      date: '2026-08-10',
      employeeProfile: { initials: 'LTB', fullName: 'Liam B' },
    }, 's501'),
    '24001_Vehicle-Pre-Start-Checklist_260810LTB.pdf',
  );
  assert.equal(
    buildOperationalExportName({
      jobNumber: '24001',
      vehicleRegistration: 'NG 42',
      date: '2026-08-10',
      employeeProfile: { initials: 'LB', fullName: 'Louis B' },
    }, 's506'),
    '24001_Journey-Management-Plan_260810LB.pdf',
  );
});

test('future form exports inherit the shared date-initials suffix convention', () => {
  assert.equal(
    buildFormExportName({
      form: {
        jobNumber: '24001',
        date: '2026-08-10',
        employeeProfile: { initials: 'PC', fullName: 'Patrick Carroll' },
      },
      formName: 'New Field Form',
    }),
    '24001_New_Field_Form_260810PC.pdf',
  );
});

test('recent SharePoint files retain the job and parent-folder context', () => {
  const recent = createRecentlyOpenedJobFile({
    item: { id: 'file-1', name: 'Plan.pdf', file: { mimeType: 'application/pdf' } },
    driveId: 'drive-1',
    job: { number: '24001' },
    folderPath: ['Survey', 'Plans'],
  });
  assert.equal(recent.eyebrow, 'SHAREPOINT PDF');
  assert.equal(recent.detail, '24001 · Survey / Plans');
  assert.deepEqual(normaliseRecentlyOpenedItem(recent), recent);
  assert.equal(normaliseRecentlyOpenedItem({ type: 'jobFile', title: 'Missing ids' }), null);
});
