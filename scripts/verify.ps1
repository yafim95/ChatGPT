[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "apps/backend"
$venvPython = Join-Path $backendDir ".venv/Scripts/python.exe"

if (-not (Test-Path $venvPython)) {
    & py -3.12 -m venv (Join-Path $backendDir ".venv")
}
& $venvPython -m pip install --disable-pip-version-check -r (Join-Path $backendDir "requirements-dev.lock")

Push-Location $backendDir
try {
    & $venvPython -m pytest
    & $venvPython -m ruff check .
    & $venvPython -m mypy app
}
finally {
    Pop-Location
}

Push-Location $root
try {
    npm ci
    npm run format:check
    npm run lint
    npm run typecheck
    npm test
    npm run build
    Push-Location "apps/desktop/src-tauri"
    try {
        cargo fmt --check
        cargo check
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
