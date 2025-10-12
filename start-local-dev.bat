@echo off
chcp 65001 > nul
echo ========================================
echo Chartex Local Development Setup
echo ========================================
echo.
echo Цей скрипт запустить MongoDB через Docker
echo Backend та Frontend потрібно запустити окремо
echo.
echo ========================================
echo.

REM Перевірка Docker
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Desktop не запущено!
    echo.
    echo Будь ласка:
    echo   1. Запустіть Docker Desktop
    echo   2. Дочекайтеся повного запуску
    echo   3. Запустіть цей скрипт знову
    echo.
    pause
    exit /b 1
)

echo [1/2] Запускаємо MongoDB через Docker...
docker-compose up -d mongodb
if errorlevel 1 (
    echo ❌ Не вдалося запустити MongoDB!
    pause
    exit /b 1
)

echo.
echo [2/2] Чекаємо поки MongoDB запуститься...
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo ✅ MongoDB готовий!
echo ========================================
echo.
echo 📋 Наступні кроки:
echo.
echo 1️⃣  Запустіть Backend (новий термінал):
echo    cd backend
echo    npm start
echo.
echo    Має з'явитися:
echo    "Підключено до MongoDB"
echo    "Сервер запущено на порту 5000"
echo.
echo 2️⃣  Запустіть Frontend (новий термінал):
echo    cd frontend
echo    npm start
echo.
echo    Відкриється: http://localhost:4200
echo.
echo 3️⃣  Перезавантажте Extension в Chrome:
echo    chrome://extensions
echo    Знайдіть Chartex → натисніть "Перезавантажити"
echo.
echo ========================================
echo ℹ️  Інформація
echo ========================================
echo.
echo ✅ MongoDB: localhost:27017
echo ✅ Backend: http://localhost:5000
echo ✅ Frontend: http://localhost:4200
echo.
echo ✅ Extension автоматично використає localhost:5000
echo ✅ Firebase credentials налаштовано в .env
echo.
echo 📖 Щоб зупинити MongoDB:
echo    docker-compose stop mongodb
echo.
pause

