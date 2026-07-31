export const NAVY = "#061A2D";
export const NAVY_2 = "#09233C";
export const GOLD = "#D6A84F";
export const WHITE = "#FFFFFF";
export const PAGE = "#F2F5F7";

export const PHOTO_BOTTOM_NAV_HEIGHT = 84;
export const ZIP_EMAIL_WARNING_BYTES = 19 * 1024 * 1024;

export const formatFileSize = (bytes) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export const gpsColour = (accuracy) => {
  if (accuracy == null) return "#B8C4D0";
  if (accuracy <= 8) return "#39B86B";
  if (accuracy <= 12) return "#E3A72F";
  return "#E14D4D";
};

export const resolvePhotoUri = (photo) => {
  const uri = String(photo?.uri || "").trim();
  if (!uri || /^[a-z][a-z\d+.-]*:/i.test(uri)) return uri;
  return `file://${uri}`;
};
