@echo off
setlocal EnableExtensions

title NorthGroup ONE Photogrammetry Worker

set "SCRIPT_DIR=%~dp0"
set "PROJECT_ROOT=%SCRIPT_DIR%..\.."
cd /d "%PROJECT_ROOT%"

set "QUEUE_ROOT=%~1"
if not defined QUEUE_ROOT (
  echo.
  echo Enter the local OneDrive-synced SharePoint Job Files folder.
  echo Example: C:\NorthGroup\Job Files
  set /p "QUEUE_ROOT=Job Files folder: "
)

if not defined QUEUE_ROOT (
  echo No Job Files folder was supplied.
  pause
  exit /b 1
)

if not exist "%QUEUE_ROOT%" (
  echo.
  echo The folder does not exist:
  echo %QUEUE_ROOT%
  echo Check OneDrive sync and try again.
  pause
  exit /b 1
)

set "REALITYSCAN_EXE=%NG_REALITYSCAN_EXE%"
if not defined REALITYSCAN_EXE if exist "%ProgramFiles%\Epic Games\RealityScan\RealityScan.exe" set "REALITYSCAN_EXE=%ProgramFiles%\Epic Games\RealityScan\RealityScan.exe"
if not defined REALITYSCAN_EXE if exist "%ProgramW6432%\Epic Games\RealityScan\RealityScan.exe" set "REALITYSCAN_EXE=%ProgramW6432%\Epic Games\RealityScan\RealityScan.exe"

if not defined REALITYSCAN_EXE (
  echo.
  echo RealityScan.exe was not found automatically.
  echo Install RealityScan or set NG_REALITYSCAN_EXE before running this file.
  set /p "REALITYSCAN_EXE=Full path to RealityScan.exe (or press Enter to exit): "
)

if not defined REALITYSCAN_EXE (
  pause
  exit /b 1
)

if not exist "%REALITYSCAN_EXE%" (
  echo RealityScan.exe does not exist at:
  echo %REALITYSCAN_EXE%
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required. Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

set "NG_REALITYSCAN_EXE=%REALITYSCAN_EXE%"
echo.
echo NorthGroup ONE worker is watching:
echo %QUEUE_ROOT%
echo.
node "%SCRIPT_DIR%photogrammetryWorker.js" "%QUEUE_ROOT%"

echo.
echo Worker stopped. Review the message above.
pause
