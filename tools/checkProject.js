const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'App.js');
const SOURCE_ROOT = path.join(ROOT, 'src');
const TOOLS_ROOT = path.join(ROOT, 'tools');
const TESTS_ROOT = path.join(ROOT, 'tests');
const APP_CONFIG_FILE = path.join(ROOT, 'app.config.js');
const APP_JSON_FILE = path.join(ROOT, 'app.json');
const PACKAGE_FILE = path.join(ROOT, 'package.json');
const NPM_CONFIG_FILE = path.join(ROOT, '.npmrc');
const RELEASE_FILE = path.join(ROOT, 'release.json');
const STABILITY_GUIDE_FILE = path.join(ROOT, 'STABILITY_TESTING.md');
const SYNC_ARCHITECTURE_FILE = path.join(ROOT, 'SYNC_ARCHITECTURE.md');
const SECURITY_POLICY_FILE = path.join(ROOT, 'SECURITY.md');
const VALIDATION_WORKFLOW_FILE = path.join(ROOT, '.github/workflows/validate.yml');
const errors = [];
const warnings = [];

const normalise = (value) => value.split(path.sep).join('/');
const relative = (value) => normalise(path.relative(ROOT, value));

const walk = (directory, predicate, files = []) => {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(filePath, predicate, files);
    else if (predicate(filePath)) files.push(filePath);
  }
  return files;
};

const appSourceFiles = [
  ENTRY,
  ...walk(SOURCE_ROOT, (filePath) => filePath.endsWith('.js')),
].map((filePath) => path.resolve(filePath));
const supportFiles = [
  ...(fs.existsSync(APP_CONFIG_FILE) ? [APP_CONFIG_FILE] : []),
  ...walk(TOOLS_ROOT, (filePath) => filePath.endsWith('.js')),
].map((filePath) => path.resolve(filePath));
const testFiles = walk(TESTS_ROOT, (filePath) => filePath.endsWith('.js'))
  .map((filePath) => path.resolve(filePath));
const sourceFiles = [...appSourceFiles, ...supportFiles, ...testFiles];
const sourceSet = new Set(sourceFiles);
const dependencyEdges = new Map();
const externalPackages = new Map();

const packageNameFromSpecifier = (specifier) => (
  specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]
);

const resolveLocalImport = (fromFile, specifier) => {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.js`,
    path.join(base, 'index.js'),
  ];
  return candidates.find((candidate) => sourceSet.has(candidate));
};

const getStaticPropertyName = (property) => {
  if (property.computed) return null;
  if (property.key?.type === 'Identifier') return property.key.name;
  if (
    property.key?.type === 'StringLiteral'
    || property.key?.type === 'NumericLiteral'
  ) {
    return String(property.key.value);
  }
  return null;
};

const visit = (node, filePath, imports) => {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'ImportDeclaration' && node.source?.value) {
    imports.push({ specifier: node.source.value, line: node.loc?.start.line });
  }

  if (
    node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === 'require'
    && node.arguments?.[0]?.type === 'StringLiteral'
  ) {
    imports.push({
      specifier: node.arguments[0].value,
      line: node.loc?.start.line,
      requireCall: true,
    });
  }

  if (node.type === 'ObjectExpression') {
    const keys = new Map();
    for (const property of node.properties || []) {
      if (!['ObjectProperty', 'ObjectMethod'].includes(property.type)) continue;
      const key = getStaticPropertyName(property);
      if (key == null) continue;
      if (keys.has(key)) {
        errors.push(
          `${relative(filePath)}:${property.loc?.start.line} duplicates object key "${key}" `
          + `(first defined at line ${keys.get(key)}).`,
        );
      } else {
        keys.set(key, property.loc?.start.line);
      }
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'extra'].includes(key)) continue;
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, filePath, imports));
    } else if (value?.type) {
      visit(value, filePath, imports);
    }
  }
};

for (const filePath of sourceFiles) {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(filePath, 'utf8'), {
      sourceType: 'unambiguous',
      plugins: ['jsx'],
    });
  } catch (error) {
    errors.push(`${relative(filePath)} could not be parsed: ${error.message}`);
    continue;
  }

  const imports = [];
  visit(ast, filePath, imports);
  const localEdges = [];

  for (const item of imports) {
    const { specifier, line, requireCall } = item;
    if (specifier.startsWith('.')) {
      const resolved = resolveLocalImport(filePath, specifier);
      if (resolved) {
        localEdges.push(resolved);
        continue;
      }

      const assetPath = path.resolve(path.dirname(filePath), specifier);
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) continue;
      errors.push(
        `${relative(filePath)}:${line} cannot resolve local import "${specifier}".`,
      );
      continue;
    }

    const packageName = packageNameFromSpecifier(specifier);
    if (!externalPackages.has(packageName)) externalPackages.set(packageName, []);
    externalPackages.get(packageName).push(`${relative(filePath)}:${line}`);
  }

  dependencyEdges.set(filePath, localEdges);
}

const packageJson = JSON.parse(fs.readFileSync(PACKAGE_FILE, 'utf8'));
const declaredPackages = new Set([
  ...Object.keys(packageJson.dependencies || {}),
  ...Object.keys(packageJson.devDependencies || {}),
]);
const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
]);

for (const [packageName, locations] of externalPackages) {
  if (builtins.has(packageName) || declaredPackages.has(packageName)) continue;
  errors.push(
    `Package "${packageName}" is imported but not declared (${locations[0]}).`,
  );
}

const reachable = new Set();
const queue = [ENTRY];
while (queue.length) {
  const filePath = queue.pop();
  if (reachable.has(filePath)) continue;
  reachable.add(filePath);
  for (const dependency of dependencyEdges.get(filePath) || []) {
    queue.push(dependency);
  }
}

const unreachable = appSourceFiles.filter((filePath) => !reachable.has(filePath));
if (unreachable.length) {
  errors.push(
    `Unreachable source modules: ${unreachable.map(relative).join(', ')}.`,
  );
}

const importVisitState = new Map();
const importVisitStack = [];
const circularImports = [];
const visitImportGraph = (filePath) => {
  importVisitState.set(filePath, 'visiting');
  importVisitStack.push(filePath);
  for (const dependency of dependencyEdges.get(filePath) || []) {
    if (!sourceSet.has(dependency)) continue;
    if (!importVisitState.has(dependency)) {
      visitImportGraph(dependency);
      continue;
    }
    if (importVisitState.get(dependency) === 'visiting') {
      const cycleStart = importVisitStack.indexOf(dependency);
      circularImports.push([
        ...importVisitStack.slice(cycleStart),
        dependency,
      ]);
    }
  }
  importVisitStack.pop();
  importVisitState.set(filePath, 'visited');
};
appSourceFiles.forEach((filePath) => {
  if (!importVisitState.has(filePath)) visitImportGraph(filePath);
});
if (circularImports.length) {
  errors.push(
    `Circular source imports are not allowed: ${circularImports[0].map(relative).join(' -> ')}.`,
  );
}

const sharedServicesRoot = `${path.join(SOURCE_ROOT, 'services')}${path.sep}`;
const featureRoot = `${path.join(SOURCE_ROOT, 'features')}${path.sep}`;
for (const [owner, dependencies] of dependencyEdges) {
  if (!owner.startsWith(sharedServicesRoot)) continue;
  const featureDependency = dependencies.find((dependency) => dependency.startsWith(featureRoot));
  if (featureDependency) {
    errors.push(
      `${relative(owner)} is shared infrastructure and cannot depend on feature module ${relative(featureDependency)}.`,
    );
  }
}

const defaultSourceModuleLineBudget = 1200;
const legacySourceModuleLineBudgets = new Map(Object.entries({
  'App.js': 2500,
  'src/screens/SE14FormScreen.js': 3200,
  'src/features/chat/screens/JobChatScreen.js': 2500,
  'src/screens/SE14InProgressScreen.js': 2400,
  'src/features/surveyPhoto/styles/surveyPhotoStyles.js': 2100,
  'src/features/surveyPhoto/screens/SurveyPhotoScreen.js': 2100,
  'src/features/jobs/screens/JobWorkspaceScreen.js': 1900,
  'src/features/jobs/components/JobDetailsHub.js': 1900,
  'src/features/kml/screens/KmlEditorScreen.js': 1700,
  'src/features/chat/screens/ChatHomeScreen.js': 1600,
  'src/features/scanner/screens/FeatureScannerScreen.js': 1500,
  'src/features/kml/components/KmlEditorSheets.js': 1350,
  'src/features/dashboard/screens/DashboardScreen.js': 1350,
  'src/styles/styles.js': 1300,
  'src/features/jobs/components/JobProgressSection.js': 1300,
}));
appSourceFiles.forEach((filePath) => {
  const modulePath = relative(filePath);
  const lineCount = fs.readFileSync(filePath, 'utf8').split(/\r?\n/).length;
  const lineBudget = legacySourceModuleLineBudgets.get(modulePath)
    || defaultSourceModuleLineBudget;
  if (lineCount > lineBudget) {
    errors.push(
      `${modulePath} has ${lineCount} lines and exceeds its ${lineBudget}-line architecture budget. Split responsibilities before adding more.`,
    );
  }
});

const s500Template = fs.readFileSync(
  path.join(SOURCE_ROOT, 'export/s500/buildS500Html.js'),
  'utf8',
);
const pageRules = [...s500Template.matchAll(/\.page\s*\{([^}]*)\}/g)];
for (const match of pageRules) {
  if (/(?:^|[;\s])(?:min-)?height\s*:/m.test(match[1])) {
    errors.push(
      'src/export/s500/buildS500Html.js sets height or min-height on .page. '
      + 'This can create blank navy PDF pages.',
    );
  }
}

let release = null;
try {
  release = JSON.parse(fs.readFileSync(RELEASE_FILE, 'utf8'));
} catch (error) {
  errors.push(`release.json could not be read: ${error.message}`);
}

if (release) {
  const requiredReleaseFields = [
    'version',
    'buildNumber',
    'releaseId',
    'revision',
    'channel',
    'releasedAt',
    'summary',
  ];
  requiredReleaseFields.forEach((field) => {
    if (!String(release[field] || '').trim()) {
      errors.push(`release.json is missing "${field}".`);
    }
  });

  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(release.version || ''))) {
    errors.push('release.json version must use semantic version format, for example 1.0.1.');
  }
  if (!/^\d+$/.test(String(release.buildNumber || '')) || Number(release.buildNumber) < 1) {
    errors.push('release.json buildNumber must be a positive whole number stored as text.');
  }
  if (Number.isNaN(new Date(release.releasedAt).getTime())) {
    errors.push('release.json releasedAt must be a valid ISO date and time.');
  }

  try {
    delete require.cache[require.resolve(APP_CONFIG_FILE)];
    const configFactory = require(APP_CONFIG_FILE);
    const staticConfig = JSON.parse(fs.readFileSync(APP_JSON_FILE, 'utf8'));
    if (typeof configFactory !== 'function') {
      errors.push('app.config.js must extend the app.json config supplied by Expo.');
    }
    const appConfig = typeof configFactory === 'function'
      ? configFactory({ config: staticConfig })
      : configFactory;
    if (appConfig.version !== release.version) {
      errors.push('app.config.js is not applying the version from release.json.');
    }
    if (String(appConfig.ios?.buildNumber || '') !== String(release.buildNumber)) {
      errors.push('app.config.js is not applying the iOS build number from release.json.');
    }
    if (Number(appConfig.android?.versionCode) !== Number(release.buildNumber)) {
      errors.push('app.config.js is not applying the Android version code from release.json.');
    }
    if (appConfig.extra?.release?.releaseId !== release.releaseId) {
      errors.push('app.config.js is not embedding the release identity from release.json.');
    }
    if (appConfig.ios?.infoPlist?.UIFileSharingEnabled !== false) {
      errors.push('iOS document sharing must remain disabled so private field records are not exposed through the app container.');
    }
    if (appConfig.ios?.infoPlist?.LSSupportsOpeningDocumentsInPlace !== false) {
      errors.push('iOS opening-in-place must remain disabled for NorthGroup One private documents.');
    }
    const transportSecurity = appConfig.ios?.infoPlist?.NSAppTransportSecurity || {};
    for (const key of [
      'NSAllowsArbitraryLoads',
      'NSAllowsArbitraryLoadsForMedia',
      'NSAllowsArbitraryLoadsInWebContent',
      'NSAllowsLocalNetworking',
    ]) {
      if (transportSecurity[key] !== false) {
        errors.push(`iOS transport security must keep ${key} disabled.`);
      }
    }
    if (
      appConfig.ios?.entitlements?.['com.apple.developer.default-data-protection']
      !== 'NSFileProtectionComplete'
    ) {
      errors.push('iOS field records must retain complete device file protection.');
    }
    if (appConfig.android?.allowBackup !== false) {
      errors.push('Android application backup must remain disabled for private field records.');
    }
  } catch (error) {
    errors.push(`app.config.js could not be evaluated: ${error.message}`);
  }
}

if (!declaredPackages.has('expo-constants')) {
  errors.push('expo-constants must be declared directly because runtime build identity uses it.');
}

if (!declaredPackages.has('@babel/plugin-transform-modules-commonjs')) {
  errors.push('@babel/plugin-transform-modules-commonjs must be declared for the stability test loader.');
}

if (!packageJson.scripts?.test || !packageJson.scripts?.validate) {
  errors.push('package.json must provide both test and validate scripts.');
}

for (const [name, version] of Object.entries({
  ...(packageJson.dependencies || {}),
  ...(packageJson.devDependencies || {}),
})) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(String(version || ''))) {
    errors.push(`Dependency "${name}" must use an exact version for reproducible installs (found "${version}").`);
  }
}

if (!fs.existsSync(NPM_CONFIG_FILE)) {
  errors.push('.npmrc is missing; dependency installation safeguards are not active.');
} else {
  const npmConfig = fs.readFileSync(NPM_CONFIG_FILE, 'utf8');
  for (const requiredSetting of ['audit=true', 'ignore-scripts=true', 'save-exact=true']) {
    if (!npmConfig.split(/\r?\n/).includes(requiredSetting)) {
      errors.push(`.npmrc must contain ${requiredSetting}.`);
    }
  }
}

if (!testFiles.some((filePath) => filePath.endsWith('.test.js'))) {
  errors.push('No automated stability tests were found in tests/.');
}

if (!fs.existsSync(STABILITY_GUIDE_FILE)) {
  errors.push('STABILITY_TESTING.md is missing.');
}

if (!fs.existsSync(SYNC_ARCHITECTURE_FILE)) {
  errors.push('SYNC_ARCHITECTURE.md is missing.');
}

if (!fs.existsSync(SECURITY_POLICY_FILE)) {
  errors.push('SECURITY.md is missing.');
}

if (!fs.existsSync(VALIDATION_WORKFLOW_FILE)) {
  errors.push('The continuous validation workflow is missing.');
} else {
  const workflow = fs.readFileSync(VALIDATION_WORKFLOW_FILE, 'utf8');
  for (const requiredText of [
    'permissions:\n  contents: read',
    'persist-credentials: false',
    'npm ci --ignore-scripts',
    'npm audit --omit=dev --audit-level=critical',
    'npm run validate',
    'npx expo-doctor',
    'npx expo export --platform ios',
  ]) {
    if (!workflow.includes(requiredText)) {
      errors.push(`The continuous validation workflow is missing: ${requiredText}.`);
    }
  }
}

const requiredSyncModules = [
  'src/services/security/secureRequestHeaders.js',
  'src/services/sync/graphClient.js',
  'src/services/sync/graphFileTransfer.js',
  'src/services/sync/syncRules.js',
  'src/services/sync/syncState.js',
];
requiredSyncModules.forEach((relativePath) => {
  if (!fs.existsSync(path.join(ROOT, relativePath))) {
    errors.push(`Shared synchronisation module is missing: ${relativePath}.`);
  }
});

const securitySentinels = [
  {
    relativePath: 'src/features/auth/useMicrosoftAuth.js',
    requiredText: 'SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY',
    message: 'Microsoft sessions must remain device-bound and require an iPhone passcode.',
  },
  {
    relativePath: 'src/services/sync/graphClient.js',
    requiredText: 'SYNC_UNTRUSTED_URL',
    message: 'Microsoft Graph requests must keep the trusted-origin bearer-token guard.',
  },
  {
    relativePath: 'src/services/security/privateFileCache.js',
    requiredText: 'clearPrivateFileCaches',
    message: 'Private cache cleanup must remain available for Microsoft sign-out.',
  },
  {
    relativePath: 'src/features/scanner/components/PhotogrammetryModelViewer.js',
    requiredText: 'Content-Security-Policy',
    message: 'The embedded 3D model viewer must keep its content-security policy.',
  },
  {
    relativePath: 'src/features/scanner/components/PhotogrammetryModelViewer.js',
    requiredText: 'allowFileAccess={false}',
    message: 'The embedded 3D model viewer must not receive local-file access.',
  },
  {
    relativePath: 'src/features/weather/screens/WeatherRadarScreen.js',
    requiredText: "originWhitelist={['https://*.bom.gov.au/*']}",
    message: 'The embedded weather radar must remain restricted to official BOM hosts.',
  },
  {
    relativePath: 'src/features/jobFiles/components/JobPdfGallery.js',
    requiredText: "originWhitelist={['file://*']}",
    message: 'The Job Files PDF viewer must remain restricted to its downloaded local document.',
  },
];
securitySentinels.forEach(({ relativePath, requiredText, message }) => {
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath) || !fs.readFileSync(absolutePath, 'utf8').includes(requiredText)) {
    errors.push(message);
  }
});

const graphLiteralOwners = new Set([
  path.join(SOURCE_ROOT, 'features/auth/microsoftConfig.js'),
  path.join(SOURCE_ROOT, 'services/sync/syncRules.js'),
]);
appSourceFiles.forEach((filePath) => {
  if (graphLiteralOwners.has(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  if (contents.includes('https://graph.microsoft.com')) {
    errors.push(
      `${relative(filePath)} hard-codes the Microsoft Graph root. Route it through src/services/sync/graphClient.js.`,
    );
  }
});

const bearerTokenOwners = new Set([
  path.join(SOURCE_ROOT, 'services/sync/graphClient.js'),
  path.join(SOURCE_ROOT, 'services/sync/graphFileTransfer.js'),
  path.join(SOURCE_ROOT, 'services/security/secureRequestHeaders.js'),
]);
appSourceFiles.forEach((filePath) => {
  if (bearerTokenOwners.has(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  if (/Authorization\s*:\s*[`'\"]Bearer\s/i.test(contents)) {
    errors.push(
      `${relative(filePath)} constructs a bearer token outside the shared Microsoft transfer boundary.`,
    );
  }
});

const productionLoggerOwner = path.join(SOURCE_ROOT, 'services/security/securityLogger.js');
appSourceFiles.forEach((filePath) => {
  const contents = fs.readFileSync(filePath, 'utf8');
  if (filePath !== productionLoggerOwner && /console\.(?:log|debug|info|warn|error)\s*\(/.test(contents)) {
    errors.push(
      `${relative(filePath)} writes directly to device logs. Use the redacted development logger.`,
    );
  }
  if (contents.includes('http://')) {
    errors.push(`${relative(filePath)} contains a clear-text network address. Use HTTPS only.`);
  }
});

const secretPatterns = [
  {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    label: 'private key',
  },
  {
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/,
    label: 'provider credential',
  },
  {
    pattern: /\b(?:client[_-]?secret|clientSecret|api[_-]?secret|refresh[_-]?token)\s*[:=]\s*[`'"][^`'"\s]{12,}[`'"]/i,
    label: 'hard-coded secret',
  },
];
sourceFiles.forEach((filePath) => {
  const contents = fs.readFileSync(filePath, 'utf8');
  secretPatterns.forEach(({ pattern, label }) => {
    if (pattern.test(contents)) {
      errors.push(`${relative(filePath)} appears to contain a ${label}. Remove it and rotate the credential.`);
    }
  });
});

for (const forbidden of [
  '.expo',
  'bup',
  'tmp',
  'NorthGroup-One-Photo-Gallery-Bin-Update',
]) {
  if (fs.existsSync(path.join(ROOT, forbidden))) {
    warnings.push(`Local-only folder remains in the project: ${forbidden}/`);
  }
}

if (errors.length) {
  console.error(`Project check failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Project check passed: ${sourceFiles.length} JavaScript files parsed.`);
  console.log(`Import graph passed: ${reachable.size} source modules reachable, no circular imports.`);
  console.log('Architecture boundaries passed: shared services remain feature-independent and module budgets hold.');
  console.log(`Dependency declarations passed: ${externalPackages.size} packages checked.`);
  console.log(`Stability suite discovered: ${testFiles.filter((filePath) => filePath.endsWith('.test.js')).length} test files.`);
  console.log('S-500 pagination safeguard passed.');
  console.log(`Build identity passed: ${release?.releaseId || 'release unavailable'}.`);
  console.log('Security guardrails passed: passcode-bound session, protected files, HTTPS-only networking, redacted logs and guarded bearer headers.');
}

if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
