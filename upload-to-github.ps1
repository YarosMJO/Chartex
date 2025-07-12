# Chartex - Upload to GitHub PowerShell Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "    Chartex - Upload to GitHub" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Git is installed
try {
    $gitVersion = git --version
    Write-Host "✅ Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ ERROR: Git is not installed!" -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Check if .git folder exists
if (-not (Test-Path ".git")) {
    Write-Host "🔧 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host ""
}

# Add all files
Write-Host "📁 Adding files to Git..." -ForegroundColor Yellow
git add .

# Check status
Write-Host ""
Write-Host "📊 Git status:" -ForegroundColor Cyan
$status = git status --porcelain
if ($status) {
    Write-Host $status -ForegroundColor Gray
} else {
    Write-Host "No changes to commit" -ForegroundColor Yellow
}

# Request commit message
Write-Host ""
$commitMessage = Read-Host "Enter commit message (or press Enter for default)"
if ([string]::IsNullOrWhiteSpace($commitMessage)) {
    $commitMessage = "Initial commit: Chartex browser analytics extension"
}

# Create commit
Write-Host ""
Write-Host "💾 Creating commit..." -ForegroundColor Yellow
git commit -m $commitMessage

# Request GitHub username
Write-Host ""
$githubUsername = Read-Host "Enter your GitHub username"
if ([string]::IsNullOrWhiteSpace($githubUsername)) {
    Write-Host "❌ ERROR: GitHub username is required!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Setup remote origin
Write-Host ""
Write-Host "🔗 Setting up remote origin..." -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin "https://github.com/$githubUsername/chartex.git"

# Check remote
Write-Host ""
Write-Host "🔍 Checking remote:" -ForegroundColor Cyan
git remote -v

# Push to GitHub
Write-Host ""
Write-Host "🚀 Pushing to GitHub..." -ForegroundColor Yellow
git branch -M main
git push -u origin main

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ ERROR: Failed to push to GitHub!" -ForegroundColor Red
    Write-Host "Please check:" -ForegroundColor Yellow
    Write-Host "1. Repository is created on GitHub" -ForegroundColor White
    Write-Host "2. Username is correct" -ForegroundColor White
    Write-Host "3. Authentication is configured" -ForegroundColor White
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "    Successfully uploaded to GitHub!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "🌐 Your repository: https://github.com/$githubUsername/chartex" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Yellow
Write-Host "1. Open repository in browser" -ForegroundColor White
Write-Host "2. Check all files" -ForegroundColor White
Write-Host "3. Configure description and tags" -ForegroundColor White
Write-Host "4. Create first release" -ForegroundColor White
Write-Host ""

# Additional commands
Write-Host "🔧 Useful commands:" -ForegroundColor Yellow
Write-Host "git tag -a v1.0.0 -m 'Initial release'" -ForegroundColor Gray
Write-Host "git push origin v1.0.0" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit" 