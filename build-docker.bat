@echo off
echo ================================
echo Chartex Docker Build Script
echo ================================

echo.
echo [1/4] Checking Docker installation...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)
echo Docker is installed

echo.
echo [2/4] Checking Docker Compose...
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker Compose is not installed
    pause
    exit /b 1
)
echo Docker Compose is available

echo.
echo [3/4] Creating environment file...
if not exist ".env" (
    copy "env.example" ".env"
    echo Environment file created from template
    echo Please edit .env file with your configuration
) else (
    echo Environment file already exists
)

echo.
echo [4/4] Building and starting containers...
docker-compose build
if %errorlevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

docker-compose up -d
if %errorlevel% neq 0 (
    echo Failed to start containers!
    pause
    exit /b 1
)

echo.
echo ================================
echo Build completed successfully!
echo ================================
echo.
echo Services are running:
echo - Frontend: http://localhost:80
echo - Backend API: http://localhost:5000/api
echo - MongoDB: localhost:27017
echo - Nginx Proxy: http://localhost:8080
echo.
echo To view logs: docker-compose logs -f
echo To stop: docker-compose down
echo.
pause
