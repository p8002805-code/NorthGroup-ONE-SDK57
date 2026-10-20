/*
 * NorthGroup ONE Photogrammetry Worker
 *
 * Watches a locally synced SharePoint "Job Files" folder for .ngscan.zip
 * uploads, processes each capture with RealityScan, and writes status updates
 * plus an optimised GLB beside the upload. The SharePoint sync client carries
 * those files back to the mobile app.
 *
 * Windows 10/11 + Node 18+; no npm packages are required.
 */

const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const WORKER_VERSION = '3.0.0';
const POLL_MS = 5000;
const STABLE_CHECK_MS = 2500;
const PROGRESS_CHECK_MS = 1000;
const MAX_TRIANGLES = 250000;
const WORKER_HEARTBEAT_NAME = 'NGONE_PGM_WORKER.json';
const retryRequested = process.argv.includes('--retry');
const workerId = `${os.hostname()}-${process.pid}`;
const queueRoot = path.resolve(
  process.env.NG_PHOTOGRAMMETRY_ROOT || process.argv[2] || path.join(process.cwd(), 'Job Files'),
);
const configuredRealityScanExe = process.env.NG_REALITYSCAN_EXE || '';
const exportParams = process.env.NG_REALITYSCAN_GLTF_PARAMS || '';
const workRoot = path.join(queueRoot, '.northgroup-pgm-work');
let lastHeartbeatWriteAt = 0;
let lastJobHeartbeatWriteAt = 0;

const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const exists = async (target) => {
  try {
    await fsp.access(target, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const safeReadJson = async (target, fallback = null) => {
  try {
    return JSON.parse(await fsp.readFile(target, 'utf8'));
  } catch {
    return fallback;
  }
};

const fileSize = async (target) => {
  try {
    const info = await fsp.stat(target);
    return Number(info.size || 0);
  } catch {
    return 0;
  }
};

const realityScanCandidates = () => [
  configuredRealityScanExe,
  process.env.ProgramFiles
    ? path.join(process.env.ProgramFiles, 'Epic Games', 'RealityScan', 'RealityScan.exe')
    : '',
  process.env.ProgramW6432
    ? path.join(process.env.ProgramW6432, 'Epic Games', 'RealityScan', 'RealityScan.exe')
    : '',
  process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Epic Games', 'RealityScan', 'RealityScan.exe')
    : '',
  'C:\\Program Files\\Epic Games\\RealityScan\\RealityScan.exe',
].filter(Boolean);

const resolveRealityScanExe = async () => {
  for (const candidate of [...new Set(realityScanCandidates())]) {
    if (await exists(candidate)) return candidate;
  }
  return '';
};

const writeJsonAtomic = async (target, value) => {
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  await fsp.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fsp.rename(temporary, target);
};

const statusPathFor = (zipPath) => zipPath.replace(/\.ngscan\.zip$/i, '.status.json');
const modelPathFor = (zipPath) => zipPath.replace(/\.ngscan\.zip$/i, '.glb');
const cancelPathFor = (zipPath) => zipPath.replace(/\.ngscan\.zip$/i, '.cancel.json');

const heartbeatPathFor = (root) => path.join(root, WORKER_HEARTBEAT_NAME);

const setStatus = async (zipPath, patch) => {
  const target = statusPathFor(zipPath);
  const previous = await safeReadJson(target, {});
  await writeJsonAtomic(target, {
    schemaVersion: 2,
    workerVersion: WORKER_VERSION,
    workerId,
    jobFile: path.basename(zipPath),
    modelFileName: path.basename(modelPathFor(zipPath)),
    ...previous,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
};

const setWorkerHeartbeat = async (extra = {}) => {
  const now = Date.now();
  const shouldWriteRoot = extra.status !== 'online' || (now - lastHeartbeatWriteAt >= 3000);
  const shouldWriteJobs = extra.status !== 'online' || (now - lastJobHeartbeatWriteAt >= 10000);
  if (!shouldWriteRoot && !shouldWriteJobs) return;

  const payload = {
    schemaVersion: 1,
    status: 'online',
    workerVersion: WORKER_VERSION,
    workerId,
    host: os.hostname(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };

  if (shouldWriteRoot) {
    await fsp.mkdir(queueRoot, { recursive: true });
    await writeJsonAtomic(heartbeatPathFor(queueRoot), payload);
    lastHeartbeatWriteAt = now;
  }

  if (shouldWriteJobs) {
    const targets = new Set();
    try {
      const entries = await fsp.readdir(queueRoot, { withFileTypes: true });
      entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== path.basename(workRoot))
        .forEach((entry) => targets.add(path.join(queueRoot, entry.name)));
    } catch {
      // The main heartbeat still reports the worker if individual job folders are unavailable.
    }

    for (const target of targets) {
      try {
        await fsp.mkdir(target, { recursive: true });
        await writeJsonAtomic(heartbeatPathFor(target), payload);
      } catch (error) {
        log(`Could not update job heartbeat in ${target}: ${error.message}`);
      }
    }
    lastJobHeartbeatWriteAt = now;
  }
};

const cancellationError = () => {
  const error = new Error('The build was cancelled from NorthGroup ONE.');
  error.code = 'NG_CANCELLED';
  return error;
};

const isCancellationRequested = async (cancelPath) => exists(cancelPath);

const listFilesRecursive = async (root, matcher, results = []) => {
  if (!(await exists(root))) return results;
  const entries = await fsp.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await listFilesRecursive(target, matcher, results);
    } else if (!matcher || matcher(target)) {
      results.push(target);
    }
  }
  return results;
};

const findImageRoot = async (root) => {
  const images = await listFilesRecursive(root, (target) => /\.(jpg|jpeg|png)$/i.test(target));
  if (images.length < 8) {
    throw new Error(`Only ${images.length} camera frames were found. Capture at least 12 overlapping frames before processing.`);
  }
  return {
    path: path.dirname(images[0]),
    count: images.length,
  };
};

const waitForStableFile = async (target) => {
  let previousSize = -1;
  let stableCount = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const info = await fsp.stat(target);
    if (info.size > 0 && info.size === previousSize) {
      stableCount += 1;
      if (stableCount >= 2) return;
    } else {
      stableCount = 0;
      previousSize = info.size;
    }
    await sleep(STABLE_CHECK_MS);
  }
  throw new Error('The uploaded scan did not finish synchronising to the processing computer.');
};

const runProcess = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  let cancellationTimer = null;

  const finish = (handler, value) => {
    if (settled) return;
    settled = true;
    if (cancellationTimer) clearInterval(cancellationTimer);
    handler(value);
  };

  const stopProcessTree = () => {
    if (!child.pid) return;
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
        windowsHide: true,
        stdio: 'ignore',
      }).unref();
    } else {
      child.kill('SIGTERM');
    }
  };

  if (options.cancelPath) {
    cancellationTimer = setInterval(async () => {
      if (settled) return;
      if (await isCancellationRequested(options.cancelPath)) {
        stopProcessTree();
        finish(reject, cancellationError());
      }
    }, 1200);
  }

  child.stdout?.on('data', (chunk) => {
    const value = chunk.toString();
    stdout += value;
    options.onStdout?.(value);
  });
  child.stderr?.on('data', (chunk) => {
    const value = chunk.toString();
    stderr += value;
    options.onStderr?.(value);
  });
  child.on('error', (error) => finish(reject, error));
  child.on('close', (code) => {
    if (settled) return;
    if (code === 0) {
      finish(resolve, { code, stdout, stderr });
    } else {
      finish(reject, new Error(`${command} exited with code ${code}. ${stderr || stdout}`.trim()));
    }
  });
});

const extractZip = async (zipPath, destination, cancelPath) => {
  await fsp.rm(destination, { recursive: true, force: true });
  await fsp.mkdir(destination, { recursive: true });
  if (await isCancellationRequested(cancelPath)) throw cancellationError();

  try {
    await runProcess('tar.exe', ['-xf', zipPath, '-C', destination], { cancelPath });
  } catch (tarError) {
    if (tarError?.code === 'NG_CANCELLED') throw tarError;
    log(`tar.exe could not extract ${path.basename(zipPath)}; trying PowerShell.`);
    const escapedZip = zipPath.replace(/'/g, "''");
    const escapedDestination = destination.replace(/'/g, "''");
    await runProcess('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Expand-Archive -LiteralPath '${escapedZip}' -DestinationPath '${escapedDestination}' -Force`,
    ], { cancelPath }).catch(() => { throw tarError; });
  }
};

const readRealityScanProgress = async (progressPath) => {
  try {
    const raw = await fsp.readFile(progressPath, 'utf8');
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

    // RealityScan writes: algId progress duration estimation #eventType
    // where progress is a normalised value from 0 to 1, not a percentage.
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const parts = lines[index].split(/\s+/);
      if (parts.length < 5) continue;
      const algId = Number(parts[0]);
      const progress = Number(parts[1]);
      const duration = Number(parts[2]);
      const estimation = Number(parts[3]);
      if (!Number.isFinite(algId) || !Number.isFinite(progress)) continue;
      return {
        algId,
        progress: Math.min(1, Math.max(0, progress)),
        duration: Number.isFinite(duration) ? Math.max(0, duration) : null,
        estimation: Number.isFinite(estimation) ? Math.max(0, estimation) : null,
        eventType: parts.slice(4).join(' '),
      };
    }

    // Keep compatibility with older RealityScan builds that emit percentages.
    const percentageMatch = raw.match(/(\d+(?:\.\d+)?)\s*%/g)?.at(-1);
    if (!percentageMatch) return null;
    const value = Number.parseFloat(percentageMatch);
    return Number.isFinite(value)
      ? { algId: null, progress: Math.min(1, Math.max(0, value / 100)), duration: null, estimation: null }
      : null;
  } catch {
    return null;
  }
};

const progressPhaseFor = (algId) => {
  const id = Number(algId);
  if ([65536, 65537, 65538, 65539, 77824, 77840, 4144].includes(id)) {
    return { start: 4, end: 35, stage: 'ALIGNING', message: 'Registering overlapping camera frames.' };
  }
  if ([8208, 8240, 20560, 20561, 20562, 21785].includes(id)) {
    return { start: 35, end: 70, stage: 'BUILDING MESH', message: 'Building the 3D surface from the aligned frames.' };
  }
  if ([11, 12, 25, 26, 28, 29, 44].includes(id)) {
    return { start: 70, end: 78, stage: 'OPTIMISING MESH', message: 'Optimising the model for field use.' };
  }
  if ([7, 8, 50, 20737, 20738, 20739, 20740, 20741, 20742].includes(id)) {
    return { start: 78, end: 94, stage: 'TEXTURING', message: 'Applying camera textures to the reconstructed surface.' };
  }
  if ([6, 21876].includes(id)) {
    return { start: 94, end: 98, stage: 'EXPORTING MODEL', message: 'Exporting the mobile-ready GLB model.' };
  }
  if ([20533, 20534].includes(id)) {
    return { start: 98, end: 99, stage: 'SAVING PROJECT', message: 'Saving the completed reconstruction.' };
  }
  return { start: 12, end: 96, stage: 'PROCESSING', message: 'RealityScan is processing the captured frames.' };
};

const mapRealityProgress = (progressRecord) => {
  const phase = progressPhaseFor(progressRecord?.algId);
  const progress = Math.min(1, Math.max(0, Number(progressRecord?.progress || 0)));
  if (progressRecord?.eventType?.includes('completed')) {
    return {
      progress: Math.round(phase.end),
      stage: phase.stage,
      message: phase.message,
    };
  }
  const overall = phase.start + ((phase.end - phase.start) * progress);
  if (phase.stage === 'PROCESSING') {
    return {
      progress: Math.min(96, Math.max(12, Math.round(overall))),
      stage: 'PROCESSING',
      message: phase.message,
    };
  }
  return {
    progress: Math.min(98, Math.max(phase.start, Math.round(overall))),
    stage: phase.stage,
    message: phase.message,
  };
};

const processCapture = async (zipPath) => {
  const statusPath = statusPathFor(zipPath);
  const cancelPath = cancelPathFor(zipPath);
  const existing = await safeReadJson(statusPath, {});

  if (existing.status === 'complete') return;
  if (
    existing.status === 'failed'
    && !retryRequested
    && existing.errorCode !== 'REALITYSCAN_NOT_FOUND'
  ) return;
  if (existing.status === 'cancelled' && !retryRequested) return;

  if (retryRequested && await exists(cancelPath)) {
    await fsp.rm(cancelPath, { force: true });
  }

  if (await isCancellationRequested(cancelPath)) {
    await setStatus(zipPath, {
      status: 'cancelled',
      progress: 0,
      stage: 'CANCELLED',
      queueState: 'cancelled',
      message: 'This build was cancelled before the processor started.',
      error: '',
      cancelledAt: new Date().toISOString(),
    });
    return;
  }

  const realityScanExe = await resolveRealityScanExe();
  if (!realityScanExe) {
    const message = 'RealityScan.exe was not found. Install RealityScan on this Windows processing computer or set NG_REALITYSCAN_EXE to its full path.';
    await setStatus(zipPath, {
      status: 'failed',
      progress: 0,
      stage: 'PROCESSOR OFFLINE',
      queueState: 'processor-offline',
      message,
      error: message,
      errorCode: 'REALITYSCAN_NOT_FOUND',
      failedAt: new Date().toISOString(),
      workerSeenAt: new Date().toISOString(),
    });
    return;
  }

  const id = path.basename(zipPath, '.ngscan.zip');
  const workDirectory = path.join(workRoot, id);
  const projectPath = path.join(workDirectory, `${id}.rsproj`);
  const progressPath = path.join(workDirectory, 'realityscan-progress.txt');
  const modelPath = modelPathFor(zipPath);

  log(`Starting ${id}`);
  await setStatus(zipPath, {
    status: 'processing',
    progress: 4,
    stage: 'PREPARING',
    queueState: 'processing',
    message: 'The processing computer has picked up this scan.',
    error: '',
    errorCode: '',
    estimatedRemainingSeconds: null,
    elapsedSeconds: 0,
    queuedAt: existing.queuedAt || new Date().toISOString(),
    startedAt: new Date().toISOString(),
    workerSeenAt: new Date().toISOString(),
  });

  let progressTimer = null;
  try {
    await waitForStableFile(zipPath);
    if (await isCancellationRequested(cancelPath)) throw cancellationError();

    await fsp.mkdir(workRoot, { recursive: true });
    await extractZip(zipPath, workDirectory, cancelPath);
    const imageInfo = await findImageRoot(workDirectory);
    const imageRoot = imageInfo.path;

    await setStatus(zipPath, {
      progress: 12,
      stage: 'ALIGNING',
      queueState: 'processing',
      message: 'Registering overlapping camera frames.',
      frameCount: imageInfo.count,
      workerSeenAt: new Date().toISOString(),
    });

    const exportCommand = ['-exportSelectedModel', modelPath];
    if (exportParams) exportCommand.push(exportParams);

    await fsp.mkdir(path.join(workDirectory, 'crash-reports'), { recursive: true });

    const commandArgs = [
      '-headless',
      '-silent',
      path.join(workDirectory, 'crash-reports'),
      '-set', 'appQuitOnError=true',
      '-writeProgress', progressPath, '1',
      '-printProgress', '1',
      '-stdConsole',
      '-newScene',
      '-set', 'appIncSubdirs=true',
      '-addFolder', imageRoot,
      '-align',
      '-selectMaximalComponent',
      '-setReconstructionRegionAuto',
      '-calculateNormalModel',
      '-simplify', String(MAX_TRIANGLES),
      '-calculateTexture',
      ...exportCommand,
      '-save', projectPath,
      '-quit',
    ];

    progressTimer = setInterval(async () => {
      if (await isCancellationRequested(cancelPath)) return;
      const realityProgress = await readRealityScanProgress(progressPath);
      if (realityProgress === null) return;
      const mapped = mapRealityProgress(realityProgress);
      const previousStatus = await safeReadJson(statusPath, {});
      const effectiveMapped = {
        ...mapped,
        // A new RealityScan algorithm can report an internal progress value
        // that is lower than the previous algorithm. The user-facing build
        // percentage must never move backwards.
        progress: Math.max(Number(previousStatus.progress || 0), mapped.progress),
      };
      await setStatus(zipPath, {
        ...effectiveMapped,
        estimatedRemainingSeconds: realityProgress.estimation,
        elapsedSeconds: realityProgress.duration,
        progressRecord: {
          algId: realityProgress.algId,
          eventType: realityProgress.eventType,
        },
        workerSeenAt: new Date().toISOString(),
      }).catch((error) => log(`Could not publish progress for ${id}: ${error.message}`));
      await setWorkerHeartbeat({
        status: 'online',
        activeJobFile: path.basename(zipPath),
        activeStage: effectiveMapped.stage,
      }).catch(() => {});
    }, PROGRESS_CHECK_MS);

    await runProcess(realityScanExe, commandArgs, {
      cancelPath,
      cwd: workDirectory,
      onStdout: (chunk) => {
        if (/error|failed|cannot/i.test(chunk)) log(`[RealityScan] ${chunk.trim()}`);
      },
      onStderr: (chunk) => log(`[RealityScan] ${chunk.trim()}`),
    });

    if (await isCancellationRequested(cancelPath)) throw cancellationError();

    await setStatus(zipPath, {
      progress: 96,
      stage: 'EXPORTING MODEL',
      queueState: 'processing',
      message: 'Writing the mobile-ready GLB model.',
      workerSeenAt: new Date().toISOString(),
    });

    if ((await fileSize(modelPath)) <= 0) {
      throw new Error('RealityScan finished without producing the expected GLB model.');
    }

    await setStatus(zipPath, {
      status: 'complete',
      progress: 100,
      stage: 'COMPLETE',
      queueState: 'complete',
      message: 'The textured 3D model is ready in NorthGroup ONE.',
      modelFileName: path.basename(modelPath),
      completedAt: new Date().toISOString(),
      workerSeenAt: new Date().toISOString(),
    });
    log(`Completed ${id}`);
  } catch (error) {
    if (error?.code === 'NG_CANCELLED' || await isCancellationRequested(cancelPath)) {
      await fsp.rm(modelPath, { force: true }).catch(() => {});
      await setStatus(zipPath, {
        status: 'cancelled',
        progress: 0,
        stage: 'CANCELLED',
        queueState: 'cancelled',
        message: 'This 3D build was cancelled from NorthGroup ONE.',
        error: '',
        cancelledAt: new Date().toISOString(),
        workerSeenAt: new Date().toISOString(),
      });
      log(`Cancelled ${id}`);
    } else {
      const message = error?.message || 'The processing worker failed.';
      await setStatus(zipPath, {
        status: 'failed',
        progress: 0,
        stage: 'FAILED',
        queueState: 'failed',
        message: 'The processing computer could not create the model.',
        error: message,
        errorCode: 'REALITYSCAN_PROCESS_FAILED',
        failedAt: new Date().toISOString(),
        workerSeenAt: new Date().toISOString(),
      });
      log(`Failed ${id}: ${message}`);
    }
  } finally {
    if (progressTimer) clearInterval(progressTimer);
  }
};

const activeJobs = new Set();

const scanQueue = async () => {
  const uploads = await listFilesRecursive(queueRoot, (target) => /\.ngscan\.zip$/i.test(target));
  for (const upload of uploads) {
    const id = path.basename(upload, '.ngscan.zip');
    if (activeJobs.has(id)) continue;
    activeJobs.add(id);
    try {
      await processCapture(upload);
    } finally {
      activeJobs.delete(id);
    }
  }
};

const main = async () => {
  if (!(await exists(queueRoot))) {
    throw new Error(`Processing root does not exist: ${queueRoot}`);
  }

  await fsp.mkdir(workRoot, { recursive: true });
  const initialRealityScanExe = await resolveRealityScanExe();
  await setWorkerHeartbeat({
    status: initialRealityScanExe ? 'online' : 'offline',
    realityScanAvailable: Boolean(initialRealityScanExe),
    realityScanPath: initialRealityScanExe,
    error: initialRealityScanExe
      ? ''
      : 'RealityScan.exe was not found. Install RealityScan or set NG_REALITYSCAN_EXE.',
  });
  log(`Watching ${queueRoot}`);
  log(initialRealityScanExe
    ? `Using ${initialRealityScanExe}`
    : 'RealityScan.exe is unavailable; the worker will keep watching and report this clearly.');
  log(`Worker ${workerId} is running`);
  await scanQueue();
  setInterval(async () => {
    const currentRealityScanExe = await resolveRealityScanExe();
    await setWorkerHeartbeat({
      status: currentRealityScanExe ? 'online' : 'offline',
      realityScanAvailable: Boolean(currentRealityScanExe),
      realityScanPath: currentRealityScanExe,
      error: currentRealityScanExe
        ? ''
        : 'RealityScan.exe was not found. Install RealityScan or set NG_REALITYSCAN_EXE.',
    }).catch((error) => log(`Heartbeat failed: ${error.message}`));
    await scanQueue().catch((error) => log(error.message));
  }, POLL_MS);
};

main().catch(async (error) => {
  console.error(error.message);
  await setWorkerHeartbeat({ status: 'offline', error: error.message }).catch(() => {});
  process.exitCode = 1;
});
