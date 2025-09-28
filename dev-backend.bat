@echo off
echo ================================
echo Chartex Backend Development
echo ================================

echo.
echo [1/2] Building backend...
docker compose build backend
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Restarting backend...
docker compose up -d backend

echo.
echo ================================
echo Backend updated successfully!
echo ================================
echo.
echo Backend API: http://localhost:5001/api
echo.
pause
