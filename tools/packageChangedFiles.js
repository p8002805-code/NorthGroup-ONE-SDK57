const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');

const ROOT = path.resolve(__dirname, '..');
const RELEASE_FILE = path.join(ROOT, 'release.json');
const DEFAULT_OUTPUT_DIRECTORY = path.join(ROOT, '_updates');
const BLOCKED_SEGMENTS = new Set(['.git', '.expo', 'node_modules', '_updates']);

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const cleanName = (value) => String(value || 'update')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'update';

const normalisePath = (value) => String(value || '')
  .replace(/\\/g, '/')
  .replace(/^\.\//, '')
  .trim();

const unique = (values) => [...new Set(values.filter(Boolean))].sort();

const readFlag = (args, flag) => {
  const index = args.indexOf(flag);
  if (index < 0) return '';
  return args[index + 1] || '';
};

const explicitFiles = (args) => {
  const index = args.indexOf('--files');
  if (index < 0) return [];
  const values = [];
  for (let cursor = index + 1; cursor < args.length; cursor += 1) {
    if (args[cursor].startsWith('--')) break;
    values.push(args[cursor]);
  }
  return values;
};

const gitLines = (gitArgs) => {
  try {
    return execFileSync('git', gitArgs, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).split(/\r?\n/).map(normalisePath).filter(Boolean);
  } catch (error) {
    fail(
      'Could not read the Git diff. Run this command in the canonical project folder, '
      + 'or supply exact paths after --files.\n'
      + (error?.stderr?.toString().trim() || error.message),
    );
    return [];
  }
};

const changedGitFiles = () => unique([
  ...gitLines(['diff', '--name-only', '--diff-filter=ACMRTUXB', 'HEAD']),
  ...gitLines(['ls-files', '--others', '--exclude-standard']),
]);

const validateFile = (relativePath) => {
  const cleaned = normalisePath(relativePath);
  if (!cleaned || path.isAbsolute(cleaned) || cleaned.startsWith('../')) {
    fail(`Unsafe project path: ${relativePath}`);
  }
  if (cleaned.split('/').some((segment) => BLOCKED_SEGMENTS.has(segment))) {
    fail(`Local/build content cannot be packaged: ${cleaned}`);
  }

  const absolutePath = path.resolve(ROOT, cleaned);
  if (!absolutePath.startsWith(`${ROOT}${path.sep}`)) fail(`Path leaves the project: ${cleaned}`);
  if (!fs.existsSync(absolutePath)) fail(`Changed file does not exist: ${cleaned}`);
  if (!fs.statSync(absolutePath).isFile()) fail(`Changed path is not a file: ${cleaned}`);
  return { relativePath: cleaned, absolutePath };
};

const manifestFor = ({ release, label, files, createdAt }) => [
  'NorthGroup ONE — Changed Files Package',
  '',
  `Release: ${release.releaseId}`,
  `Version: ${release.version}`,
  `Source build: ${release.buildNumber}`,
  `Revision: ${release.revision}`,
  `Package: ${label}`,
  `Created: ${createdAt}`,
  '',
  `Changed/created files (${files.length}):`,
  ...files.map((file) => `- ${file.relativePath}`),
  '',
  'Replace each file at the matching project-relative path.',
  'Then run: npm run validate',
  'Restart development testing with: npx expo start --tunnel --clear',
  '',
].join('\n');

const main = async () => {
  if (!fs.existsSync(RELEASE_FILE)) fail('release.json is missing.');
  const release = JSON.parse(fs.readFileSync(RELEASE_FILE, 'utf8'));
  const args = process.argv.slice(2);
  const label = cleanName(readFlag(args, '--name'));
  const requestedFiles = explicitFiles(args);
  const paths = unique(requestedFiles.length ? requestedFiles : changedGitFiles());
  const files = paths.map(validateFile);

  if (!files.length) fail('No changed or created files were found.');

  const zip = new JSZip();
  files.forEach(({ relativePath, absolutePath }) => {
    zip.file(relativePath, fs.readFileSync(absolutePath));
  });

  const createdAt = new Date().toISOString();
  zip.file('CHANGE_MANIFEST.txt', manifestFor({ release, label, files, createdAt }));

  const outputDirectoryFlag = readFlag(args, '--output');
  const outputDirectory = outputDirectoryFlag
    ? path.resolve(ROOT, outputDirectoryFlag)
    : DEFAULT_OUTPUT_DIRECTORY;
  fs.mkdirSync(outputDirectory, { recursive: true });
  const fileName = `NorthGroup-ONE-${cleanName(release.releaseId)}-${label}-changed-files.zip`;
  const outputPath = path.join(outputDirectory, fileName);
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });
  fs.writeFileSync(outputPath, buffer);

  console.log(`Changed-files package created: ${outputPath}`);
  console.log(`Files packaged: ${files.length}`);
  files.forEach((file) => console.log(`- ${file.relativePath}`));
};

main().catch((error) => fail(error?.stack || error?.message || String(error)));
