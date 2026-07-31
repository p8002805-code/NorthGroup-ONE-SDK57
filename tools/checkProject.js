const fs = require('fs');
const path = require('path');
const { builtinModules } = require('module');
const parser = require('@babel/parser');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'App.js');
const SOURCE_ROOT = path.join(ROOT, 'src');
const PACKAGE_FILE = path.join(ROOT, 'package.json');
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

const sourceFiles = [
  ENTRY,
  ...walk(SOURCE_ROOT, (filePath) => filePath.endsWith('.js')),
].map((filePath) => path.resolve(filePath));
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
      if (requireCall && fs.existsSync(assetPath)) continue;
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

const unreachable = sourceFiles.filter((filePath) => !reachable.has(filePath));
if (unreachable.length) {
  errors.push(
    `Unreachable source modules: ${unreachable.map(relative).join(', ')}.`,
  );
}

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
  console.log(`Import graph passed: ${reachable.size} source modules reachable.`);
  console.log(`Dependency declarations passed: ${externalPackages.size} packages checked.`);
  console.log('S-500 pagination safeguard passed.');
}

if (warnings.length) {
  console.warn(`Warnings (${warnings.length}):`);
  warnings.forEach((warning) => console.warn(`- ${warning}`));
}
