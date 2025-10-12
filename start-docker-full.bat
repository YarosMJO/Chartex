@echo off
chcp 65001 > nul
echo ========================================
echo Chartex Full Docker Setup
echo ========================================
echo.
echo Цей скрипт запустить весь стек через Docker:
echo   - Backend на порту 5001
echo   - Frontend на порту 80
echo   - MongoDB на порту 27017
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

echo [1/4] Збираємо frontend для production...
cd frontend
call npm run build:prod
if errorlevel 1 (
    echo ❌ Не вдалося зібрати frontend!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [2/4] Збираємо extension...
cd frontend
call npm run build:extension
if errorlevel 1 (
    echo ❌ Не вдалося зібрати extension!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/4] Збираємо Docker images...
docker-compose build
if errorlevel 1 (
    echo ❌ Не вдалося зібрати Docker images!
    pause
    exit /b 1
)

echo.
echo [4/4] Запускаємо всі сервіси...
docker-compose up -d

if errorlevel 1 (
    echo ❌ Не вдалося запустити Docker services!
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ Всі сервіси запущено!
echo ========================================
echo.
echo 📊 Доступні URL:
echo   - Frontend:    http://localhost
echo   - Backend API: http://localhost:5000/api
echo   - MongoDB:     localhost:27017
echo.
echo 🔍 Переглянути логи:
echo   docker-compose logs -f
echo.
echo 🛑 Зупинити всі сервіси:
echo   docker-compose down
echo.
echo ========================================
echo ℹ️  Інформація
echo ========================================
echo.
echo ✅ Extension зібрано і готово до використання
echo    - Файли в extension/dashboard/ директорії
echo    - Автоматично визначить доступний API (localhost:5000)
echo.
echo ✅ Frontend зібрано в production режимі
echo    - Використовує environment.prod.ts
echo    - API: http://localhost:5000/api
echo.
echo ✅ Backend працює на порту 5000
echo ✅ Firebase credentials налаштовано в docker-compose.yml
echo.
pause

