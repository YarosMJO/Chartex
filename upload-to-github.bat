@echo off
echo ========================================
echo    Chartex - Upload to GitHub
echo ========================================
echo.

REM Check if Git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git is not installed!
    echo Please install Git from https://git-scm.com/
    pause
    exit /b 1
)

REM Check if .git folder exists
if not exist ".git" (
    echo Initializing Git repository...
    git init
    echo.
)

REM Add all files
echo Adding files to Git...
git add .

REM Check status
echo.
echo Git status:
git status --porcelain

REM Request commit message
echo.
set /p commit_message="Enter commit message (or press Enter for default): "
if "%commit_message%"=="" set commit_message="Initial commit: Chartex browser analytics extension"

REM Create commit
echo.
echo Creating commit...
git commit -m "%commit_message%"

REM Request GitHub username
echo.
set /p github_username="Enter your GitHub username: "
if "%github_username%"=="" (
    echo ERROR: GitHub username is required!
    pause
    exit /b 1
)

REM Setup remote origin
echo.
echo Setting up remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/%github_username%/chartex.git

REM Check remote
echo.
echo Checking remote:
git remote -v

REM Push to GitHub
echo.
echo Pushing to GitHub...
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Failed to push to GitHub!
    echo Please check:
    echo 1. Repository is created on GitHub
    echo 2. Username is correct
    echo 3. Authentication is configured
    pause
    exit /b 1
)

echo.
echo ========================================
echo    Successfully uploaded to GitHub!
echo ========================================
echo.
echo Your repository: https://github.com/%github_username%/chartex
echo.
echo Next steps:
echo 1. Open repository in browser
echo 2. Check all files
echo 3. Configure description and tags
echo 4. Create first release
echo.
pause 