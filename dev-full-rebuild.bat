@echo off
echo ================================
echo Chartex Full Rebuild
echo ================================

echo.
echo [1/4] Stopping all services...
docker compose down

echo.
echo [2/4] Building all services...
docker compose build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Starting all services...
docker compose up -d

echo.
echo [4/4] Building extension...
cd frontend
call .\build-extension.bat
cd ..

echo.
echo ================================
echo Full rebuild completed!
echo ================================
echo.
echo Services:
echo - Frontend: http://localhost:80
echo - Backend API: http://localhost:5001/api
echo - MongoDB: localhost:27017
echo - Nginx Proxy: http://localhost:8080
echo.
echo Extension: Reload in chrome://extensions/
echo.
pause
