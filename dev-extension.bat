@echo off
echo ================================
echo Chartex Extension Development
echo ================================

echo.
echo [1/2] Building extension...
cd frontend
call .\build-extension.bat
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Extension built successfully!
echo.
echo ================================
echo Next steps:
echo ================================
echo 1. Go to chrome://extensions/
echo 2. Find Chartex extension
echo 3. Click "Reload" button
echo 4. Test the extension
echo.
echo Extension files: extension\dashboard\
echo.
pause
