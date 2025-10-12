@echo off
echo ================================
echo Chartex Frontend build for Chrome Extension
echo ================================

echo.
echo [1/6] Cleaning previous build...
if exist "dist" (
    rmdir /s /q "dist"
    echo dist folder removed
) else (
    echo dist folder did not exist
)

echo.
echo [2/6] Building with extension configuration...
call npm run build -- --configuration=extension
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)
echo Build finished successfully

echo.
echo [3/6] Cleaning dashboard folder...
if exist "..\extension\dashboard" (
    rmdir /s /q "..\extension\dashboard"
    echo dashboard folder cleaned
) else (
    echo dashboard folder did not exist
)

echo.
echo [4/6] Copying files...
xcopy /E /I /Y "dist\chartex-frontend\browser\*" "..\extension\dashboard\" >nul
if %errorlevel% neq 0 (
    echo File copy failed!
    pause
    exit /b 1
)
echo Files copied

echo.
echo [5/6] Renaming index.html to dashboard.html...
if exist "..\extension\dashboard\index.html" (
    ren "..\extension\dashboard\index.html" "dashboard.html"
    echo index.html renamed to dashboard.html
) else (
    echo index.html not found, skipping rename
)

echo.
echo [6/6] Removing all onload attributes from dashboard.html...
powershell -NoProfile -ExecutionPolicy Bypass -File "remove-onload.ps1"
echo onload attributes removed

echo.
echo ================================
echo Build completed!
echo Files are in: ..\extension\dashboard\
echo ================================
echo.
pause 