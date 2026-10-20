const release = require('./release.json');

module.exports = ({ config }) => {
  const googleMapsIosApiKey = String(process.env.GOOGLE_MAPS_IOS_API_KEY || '').trim();
  const iosConfig = {
    ...(config.ios?.config || {}),
    ...(googleMapsIosApiKey ? { googleMapsApiKey: googleMapsIosApiKey } : {}),
  };

  return {
    ...config,
    version: release.version,
    ios: {
      ...(config.ios || {}),
      buildNumber: release.buildNumber,
      ...(Object.keys(iosConfig).length ? { config: iosConfig } : {}),
    },
    android: {
      ...(config.android || {}),
      versionCode: Number(release.buildNumber),
    },
    extra: {
      ...(config.extra || {}),
      release,
      maps: {
        ...(config.extra?.maps || {}),
        googleMapsIosEnabled: Boolean(googleMapsIosApiKey),
      },
    },
  };
};
