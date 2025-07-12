# Збірка Chartex Frontend для Chrome Extension
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Збірка Chartex Frontend для Chrome Extension" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n[1/4] Очищення попередньої збірки..." -ForegroundColor Yellow
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "✓ Папка dist видалена" -ForegroundColor Green
} else {
    Write-Host "✓ Папка dist не існувала" -ForegroundColor Green
}

Write-Host "`n[2/4] Збірка з конфігурацією extension..." -ForegroundColor Yellow
$buildResult = npm run build -- --configuration=extension
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Помилка збірки!" -ForegroundColor Red
    Read-Host "Натисніть Enter для виходу"
    exit 1
}
Write-Host "✓ Збірка завершена успішно" -ForegroundColor Green

Write-Host "`n[3/4] Очищення папки dashboard..." -ForegroundColor Yellow
if (Test-Path "..\extension\dashboard") {
    Remove-Item -Recurse -Force "..\extension\dashboard"
    Write-Host "✓ Папка dashboard очищена" -ForegroundColor Green
} else {
    Write-Host "✓ Папка dashboard не існувала" -ForegroundColor Green
}

Write-Host "`n[4/4] Копіювання файлів..." -ForegroundColor Yellow
Copy-Item -Path "dist\chartex-frontend\browser\*" -Destination "..\extension\dashboard\" -Recurse -Force
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Помилка копіювання файлів!" -ForegroundColor Red
    Read-Host "Натисніть Enter для виходу"
    exit 1
}
Write-Host "✓ Файли скопійовано" -ForegroundColor Green

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ Збірка завершена успішно!" -ForegroundColor Green
Write-Host "📁 Файли знаходяться в: ..\extension\dashboard\" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Натисніть Enter для виходу" 