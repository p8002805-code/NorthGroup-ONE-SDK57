const clampProgress = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const packageLabel = (status = {}) => {
  const partCount = Math.max(0, Number(status.partCount || status.packageCount) || 0);
  const partNumber = Math.max(0, Number(status.partNumber || status.packageNumber) || 0);
  return partCount > 1 && partNumber
    ? `Package ${partNumber} of ${partCount}`
    : '';
};

export const describeSurveyPhotoZipProgress = (status = {}) => {
  const progress = clampProgress(status.progress);
  const percent = Math.round(progress * 100);
  const photoCount = Math.max(0, Number(status.photoCount) || 0);
  const photoNumber = Math.max(0, Number(status.photoNumber) || 0);
  const packageText = packageLabel(status);

  if (status.phase === 'planning') {
    return {
      progress,
      percent,
      text: 'Preparing photos…',
      detail: photoCount ? `${photoNumber} of ${photoCount} photos checked` : 'Checking photo sizes',
    };
  }
  if (status.phase === 'finalising') {
    return {
      progress,
      percent,
      text: 'Creating upload packages…',
      detail: packageText || 'Building ZIP package',
    };
  }
  if (status.phase === 'saving') {
    return {
      progress,
      percent,
      text: 'Saving upload package…',
      detail: packageText || 'Securing photos for upload',
    };
  }
  if (status.phase === 'complete') {
    return {
      progress,
      percent,
      text: 'Photo packages ready',
      detail: packageText,
    };
  }
  return {
    progress,
    percent,
    text: 'Creating upload packages…',
    detail: [
      packageText,
      photoCount ? `Photo ${photoNumber} of ${photoCount}` : '',
    ].filter(Boolean).join(' · '),
  };
};

export const describeSurveyPhotoUploadProgress = (status = {}) => {
  const progress = clampProgress(status.progress);
  const percent = Math.round(progress * 100);
  const packageText = packageLabel(status);
  const totalPhotoCount = Math.max(0, Number(status.totalPhotoCount) || 0);
  const fileName = String(status.fileName || '').trim();
  const photoText = totalPhotoCount
    ? `${totalPhotoCount} photo${totalPhotoCount === 1 ? '' : 's'} total`
    : '';
  const detail = [packageText, photoText, fileName].filter(Boolean).join('\n');

  if (status.phase === 'confirming') {
    return {
      progress,
      percent,
      text: 'Confirming SharePoint upload…',
      detail: detail || 'Waiting for SharePoint confirmation',
    };
  }
  if (status.phase === 'complete') {
    const uploadedPhotoCount = Math.max(0, Number(status.uploadedPhotoCount) || totalPhotoCount);
    const uploadedPackageCount = Math.max(0, Number(status.uploadedPackageCount) || 0);
    return {
      progress: 1,
      percent: 100,
      text: 'SharePoint Sync Complete ✅',
      detail: [
        uploadedPhotoCount
          ? `${uploadedPhotoCount} photo${uploadedPhotoCount === 1 ? '' : 's'} uploaded`
          : '',
        uploadedPackageCount
          ? `${uploadedPackageCount} ZIP file${uploadedPackageCount === 1 ? '' : 's'}`
          : '',
      ].filter(Boolean).join(' · '),
    };
  }
  if (status.phase === 'interrupted') {
    return {
      progress,
      percent,
      text: 'SharePoint upload paused',
      detail: detail || 'Remaining uploads are safely queued',
    };
  }
  return {
    progress,
    percent,
    text: 'Uploading to SharePoint…',
    detail: detail || 'Starting secure upload',
  };
};

export const describeSurveyPhotoProgress = (status = {}) => (
  status.context === 'sharepoint'
    ? describeSurveyPhotoUploadProgress(status)
    : describeSurveyPhotoZipProgress(status)
);
