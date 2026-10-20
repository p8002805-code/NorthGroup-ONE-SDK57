import Constants from 'expo-constants';

import release from '../../release.json';

const clean = (value) => String(value || '').trim();

const isExpoGoRuntime = () => (
  Constants.appOwnership === 'expo'
  || Constants.executionEnvironment === 'storeClient'
);

const runtimeLabel = () => {
  if (isExpoGoRuntime()) return 'Expo Go';
  if (typeof __DEV__ !== 'undefined' && __DEV__) return 'Development build';
  return 'Installed app';
};

export const getBuildInfo = () => {
  const configuredRelease = Constants.expoConfig?.extra?.release || release;
  const expoGo = isExpoGoRuntime();
  const configuredVersion = clean(Constants.expoConfig?.version || configuredRelease.version);
  const configuredBuild = clean(
    Constants.expoConfig?.ios?.buildNumber
      || Constants.expoConfig?.android?.versionCode
      || configuredRelease.buildNumber,
  );
  const installedVersion = expoGo
    ? configuredVersion
    : clean(Constants.nativeAppVersion || configuredVersion);
  const installedBuild = expoGo
    ? configuredBuild
    : clean(Constants.nativeBuildVersion || configuredBuild);

  return {
    version: installedVersion || release.version,
    buildNumber: installedBuild || release.buildNumber,
    sourceBuildNumber: clean(configuredRelease.buildNumber || release.buildNumber),
    releaseId: clean(configuredRelease.releaseId || release.releaseId),
    revision: clean(configuredRelease.revision || release.revision),
    channel: clean(configuredRelease.channel || release.channel),
    releasedAt: clean(configuredRelease.releasedAt || release.releasedAt),
    summary: clean(configuredRelease.summary || release.summary),
    runtime: runtimeLabel(),
    isExpoGo: expoGo,
  };
};

export const BUILD_INFO = getBuildInfo();

export const buildDisplayLabel = () => (
  `${BUILD_INFO.releaseId} · ${BUILD_INFO.runtime}`
);
