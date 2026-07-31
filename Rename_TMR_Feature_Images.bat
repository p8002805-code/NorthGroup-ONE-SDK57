@echo off
setlocal

cd /d "%~dp0"

set "IMAGE_ROOT=%~dp0assets\tmr-feature-guide"

echo.
echo TMR Feature Image Renamer
echo =========================
echo.
echo This will rename images inside each code folder using the folder name.
echo Example:
echo   PTSP\IMG_1234.JPG  becomes  PTSP\ptsp-01.jpg
echo   PTSP\photo.png     becomes  PTSP\ptsp-02.png
echo.
echo Supported file types: JPG, JPEG, PNG, WEBP
echo Non-image files such as .keep are ignored.
echo.
echo Folder:
echo %IMAGE_ROOT%
echo.

if not exist "%IMAGE_ROOT%" (
    echo ERROR: The TMR feature image folder was not found.
    echo Expected:
    echo %IMAGE_ROOT%
    echo.
    pause
    exit /b 1
)

choice /c YN /n /m "Continue and rename the images? [Y/N]: "
if errorlevel 2 (
    echo.
    echo Cancelled. No files were changed.
    echo.
    pause
    exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = [System.IO.Path]::GetFullPath('%IMAGE_ROOT%');" ^
  "$extensions = @('.jpg', '.jpeg', '.png', '.webp');" ^
  "$folders = Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name;" ^
  "$total = 0;" ^
  "foreach ($folder in $folders) {" ^
  "  $code = $folder.Name.ToLowerInvariant();" ^
  "  $files = Get-ChildItem -LiteralPath $folder.FullName -File | Where-Object { $extensions -contains $_.Extension.ToLowerInvariant() } | Sort-Object Name;" ^
  "  if ($files.Count -eq 0) { continue }" ^
  "  $tempFiles = @();" ^
  "  $index = 1;" ^
  "  foreach ($file in $files) {" ^
  "    $tempName = '__tmr_rename_' + [guid]::NewGuid().ToString('N') + $file.Extension.ToLowerInvariant();" ^
  "    $tempPath = Join-Path $folder.FullName $tempName;" ^
  "    Move-Item -LiteralPath $file.FullName -Destination $tempPath;" ^
  "    $tempFiles += [pscustomobject]@{ Path = $tempPath; Extension = $file.Extension.ToLowerInvariant(); Index = $index };" ^
  "    $index++;" ^
  "  }" ^
  "  foreach ($item in $tempFiles) {" ^
  "    $number = $item.Index.ToString('00');" ^
  "    $newName = $code + '-' + $number + $item.Extension;" ^
  "    $newPath = Join-Path $folder.FullName $newName;" ^
  "    Move-Item -LiteralPath $item.Path -Destination $newPath;" ^
  "    Write-Host ($folder.Name + '\' + $newName);" ^
  "    $total++;" ^
  "  }" ^
  "}" ^
  "Write-Host '';" ^
  "Write-Host ('Renamed ' + $total + ' image(s).');"

if errorlevel 1 (
    echo.
    echo ERROR: The rename process failed.
    echo Review the message above.
    echo.
    pause
    exit /b 1
)

echo.
echo Rename complete.
echo.
echo Next, run:
echo   Generate_TMR_Feature_Images.bat
echo.
pause
