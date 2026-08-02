[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "apps/backend"
$venvPython = Join-Path $backendDir ".venv/Scripts/python.exe"

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' was not found. Install Python 3.12 x64."
}
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    throw "rustc was not found. Install the stable MSVC Rust toolchain."
}
if (-not (Test-Path $venvPython)) {
    & py -3.12 -m venv (Join-Path $backendDir ".venv")
}

& $venvPython -m pip install --disable-pip-version-check -r (Join-Path $backendDir "requirements-dev.lock")

Push-Location $backendDir
try {
    & $venvPython -m PyInstaller --noconfirm --clean "projectmind-backend.spec"
}
finally {
    Pop-Location
}

$target = (& rustc --print host-tuple).Trim()
if (-not $target) {
    throw "Rust did not report a target triple."
}
$source = Join-Path $backendDir "dist/projectmind-backend.exe"
$destinationDir = Join-Path $root "apps/desktop/src-tauri/binaries"
$destination = Join-Path $destinationDir "projectmind-backend-$target.exe"
if (-not (Test-Path $source)) {
    throw "PyInstaller did not produce $source"
}
New-Item -ItemType Directory -Force -Path $destinationDir | Out-Null
Copy-Item -Force $source $destination
Write-Host "Backend sidecar created: $destination"
