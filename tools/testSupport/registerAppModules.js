const fs = require('fs');
const path = require('path');
const Module = require('module');
const babel = require('@babel/core');
const commonJsPluginModule = require('@babel/plugin-transform-modules-commonjs');

const ROOT = path.resolve(__dirname, '../..');
const SOURCE_ROOT = path.join(ROOT, 'src');
const originalJavaScriptLoader = Module._extensions['.js'];
const originalModuleLoad = Module._load;
const commonJsPlugin = commonJsPluginModule.default || commonJsPluginModule;
const storage = new Map();
let uuidCounter = 0;

const asyncStorageMock = {
  getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: async (key, value) => { storage.set(key, String(value)); },
  removeItem: async (key) => { storage.delete(key); },
  multiSet: async (pairs) => { pairs.forEach(([key, value]) => storage.set(key, String(value))); },
  multiRemove: async (keys) => { keys.forEach((key) => storage.delete(key)); },
  getAllKeys: async () => [...storage.keys()],
  clear: async () => { storage.clear(); },
};

const fileSystemMock = {
  __esModule: true,
  documentDirectory: 'file:///documents/',
  cacheDirectory: 'file:///cache/',
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  FileSystemSessionType: { BACKGROUND: 0, FOREGROUND: 1 },
  getInfoAsync: async () => ({ exists: false, isDirectory: false, size: 0 }),
  makeDirectoryAsync: async () => undefined,
  readDirectoryAsync: async () => [],
  readAsStringAsync: async () => '',
  writeAsStringAsync: async () => undefined,
  copyAsync: async () => undefined,
  moveAsync: async () => undefined,
  deleteAsync: async () => undefined,
  downloadAsync: async (_url, uri) => ({ uri, status: 200, headers: {} }),
  createUploadTask: () => ({ uploadAsync: async () => ({ status: 200, body: '{}' }) }),
};

Module._load = function loadWithNorthGroupMocks(request, parent, isMain) {
  if (request === '@react-native-async-storage/async-storage') {
    return { __esModule: true, default: asyncStorageMock };
  }
  if (request === 'expo-file-system/legacy' || request === 'expo-file-system') {
    return fileSystemMock;
  }
  if (request === 'expo-sharing') {
    return {
      __esModule: true,
      isAvailableAsync: async () => true,
      shareAsync: async () => undefined,
    };
  }
  if (request === 'expo-crypto') {
    return {
      __esModule: true,
      randomUUID: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, '0')}`,
    };
  }
  if (
    request === '../jobFiles/jobFilesService'
    && (
      parent?.filename?.endsWith(`${path.sep}jobProgressService.js`)
      || parent?.filename?.endsWith(`${path.sep}jobAccommodationService.js`)
      || parent?.filename?.endsWith(`${path.sep}jobWorkspaceMetaService.js`)
      || parent?.filename?.endsWith(`${path.sep}jobDetailsHubService.js`)
    )
  ) {
    const testLocation = {
      drive: { id: 'drive-test' },
      folder: { id: 'folder-test' },
      jobFolder: { id: 'folder-test' },
      appDataFolder: { id: 'app-data-test' },
      sectionsFolder: { id: 'sections-test' },
    };
    return {
      resolveJobFilesLocation: async () => testLocation,
      resolveJobAppDataLocation: async () => testLocation,
    };
  }
  return originalModuleLoad.call(this, request, parent, isMain);
};

Module._extensions['.js'] = function compileAppModule(module, filename) {
  if (!filename.startsWith(`${SOURCE_ROOT}${path.sep}`)) {
    originalJavaScriptLoader(module, filename);
    return;
  }

  const source = fs.readFileSync(filename, 'utf8');
  const result = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    sourceMaps: 'inline',
    parserOpts: { sourceType: 'unambiguous', plugins: ['jsx'] },
    plugins: [commonJsPlugin],
  });
  module._compile(result.code, filename);
};

module.exports = {
  asyncStorageMock,
  fileSystemMock,
  resetTestState: async () => {
    await asyncStorageMock.clear();
    uuidCounter = 0;
  },
};
