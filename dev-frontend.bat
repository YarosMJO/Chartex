@echo off
echo ================================
echo Chartex Frontend Development
echo ================================

echo.
echo [1/2] Building frontend...
docker compose build frontend
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [2/2] Restarting frontend...
docker compose up -d frontend

echo.
echo ================================
echo Frontend updated successfully!
echo ================================
echo.
echo Frontend: http://localhost:80
echo Nginx Proxy: http://localhost:8080
echo.
pause
