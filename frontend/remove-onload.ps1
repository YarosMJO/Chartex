param (
    [string]$file = "..\extension\dashboard\dashboard.html"
)
(Get-Content $file) -replace ' onload="[^"]*"', '' | Set-Content $file
Write-Host "onload attributes removed from $file" 