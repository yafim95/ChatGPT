[CmdletBinding()]
param(
    [switch]$SkipTests
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

& (Join-Path $PSScriptRoot "build-backend.ps1")
& (Join-Path $PSScriptRoot "smoke-backend-windows.ps1")

Push-Location $root
try {
    npm ci
    if (-not $SkipTests) {
        & (Join-Path $PSScriptRoot "verify.ps1")
    }
    npm run desktop:build
}
finally {
    Pop-Location
}

$bundleDir = Join-Path $root "apps/desktop/src-tauri/target/release/bundle/nsis"
Write-Host "Windows installer output: $bundleDir"
