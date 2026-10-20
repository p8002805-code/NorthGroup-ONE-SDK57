# NorthGroup ONE photogrammetry worker

The iPhone captures the reconstruction-ready frames. This Windows worker is
the part that turns those frames into a real textured `.glb` model using
RealityScan. The worker writes live status files beside the upload, and
SharePoint/OneDrive carries those files back to NorthGroup ONE.

## What the 2% state means

`2%` is not a slow reconstruction stage. It means:

1. NorthGroup ONE uploaded the `.ngscan.zip` successfully.
2. The phone is waiting for the Windows processor to see the file.

If the card says **PROCESSOR OFFLINE**, the worker is not running, the synced
folder is wrong, or RealityScan is not installed. The app now reports that
reason instead of leaving the user with an unexplained 2% queue.

## Install once on the Windows processing computer

1. Install **RealityScan** from Epic Games.
2. Install or enable **OneDrive** and sync the SharePoint **Job Files** library
   to File Explorer. The synced local folder must contain the job folders used
   by NorthGroup ONE. Right-click the relevant Job Files folder in File
   Explorer and choose **Always keep on this device** so the worker can read
   the uploaded ZIP rather than seeing an online-only placeholder.
3. Install **Node.js 18 or newer** if it is not already installed. The worker
   uses only Node's built-in modules; no `npm install` is needed for the worker.
4. Use a 64-bit Windows PC. RealityScan recommends at least 4 CPU cores,
   16 GB RAM, a fast local SSD and an NVIDIA CUDA-capable GPU. A compatible
   NVIDIA GPU is required for model creation and texturing; image registration
   can run without one.

Open RealityScan once from the Start menu before running the worker. Complete
any first-run sign-in, licence or permissions prompts, then close it. The
worker can then launch it headlessly for each queued scan.

The current RealityScan requirements and CLI reference are maintained here:

- https://dev.epicgames.com/documentation/realityscan/hardware-and-software-requirements
- https://dev.epicgames.com/documentation/realityscan/command-line-operations
- https://dev.epicgames.com/documentation/realityscan/error-handling-and-logging

## Start the worker

The simplest option is to double-click:

```text
tools\photogrammetry-worker\Start-PhotogrammetryWorker.bat
```

It asks for the local synced **Job Files** folder and detects the usual
RealityScan installation path. You can also start it from Command Prompt:

```bat
set NG_REALITYSCAN_EXE=C:\Program Files\Epic Games\RealityScan\RealityScan.exe
node tools\photogrammetry-worker\photogrammetryWorker.js "C:\NorthGroup\Job Files"
```

Keep that window open while scans are being built. The worker continues to
watch for new scans and publishes `NGONE_PGM_WORKER.json` into each job folder
so the app can show whether the processor is connected.

If RealityScan is installed somewhere else:

```bat
set NG_REALITYSCAN_EXE=D:\Apps\RealityScan\RealityScan.exe
node tools\photogrammetry-worker\photogrammetryWorker.js "C:\NorthGroup\Job Files"
```

## Files exchanged in each job folder

- `NGONE_PGM_*.ngscan.zip` — uploaded camera frames and scan manifest
- `NGONE_PGM_*.status.json` — live queue, stage, percentage and estimated time
- `NGONE_PGM_*.glb` — completed mobile-ready model
- `NGONE_PGM_*.cancel.json` — cancellation request from the phone
- `NGONE_PGM_WORKER.json` — worker heartbeat and RealityScan availability

The worker reads RealityScan's native progress records, including its
algorithm ID, normalised progress, elapsed time and estimated remaining time.
The app maps those records into aligning, mesh, optimisation, texturing,
exporting and complete stages without allowing the displayed percentage to
move backwards.

## Expected processing time

For a small feature with approximately 12–24 frames, allow roughly 1–5
minutes on a suitable NVIDIA-equipped PC. Larger or more detailed captures can
take 5–20+ minutes. Upload and OneDrive synchronisation add time before
RealityScan starts. The app shows the actual estimate once RealityScan begins;
before that, it correctly shows that it is waiting for the processor rather
than inventing an ETA.

## Retry and cancellation

Cancel from the build card in NorthGroup ONE. The captured frames stay saved,
and the worker removes partial model output if cancellation arrives during a
build. After fixing a failed worker or RealityScan installation, press
**RETRY 3D** in the app. For a manual worker retry, use:

```bat
node tools\photogrammetry-worker\photogrammetryWorker.js "C:\NorthGroup\Job Files" --retry
```

## Optional GLB export settings

RealityScan can export a GLB with embedded textures using an export-parameter
XML created from its Export Model dialog. Set it before starting the worker:

```bat
set NG_REALITYSCAN_GLTF_PARAMS=C:\NorthGroup\realityscan-mobile-glb.xml
```

The default worker command still requests a GLB export. Supplying the XML is
recommended when the viewer reports that the model has missing external
textures.
