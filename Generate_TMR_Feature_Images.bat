@echo off
setlocal

cd /d "%~dp0"

echo.
echo Generating TMR Feature Guide image mapping...
echo.

node "tools\generateTmrFeatureImages.js"

if errorlevel 1 (
    echo.
    echo The image mapping could not be generated.
    echo Check the error message above.
    echo.
    pause
    exit /b 1
)

echo.
echo Image mapping generated successfully.
echo.
pause