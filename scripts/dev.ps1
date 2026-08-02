[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backendDir = Join-Path $root "apps/backend"
$venvPython = Join-Path $backendDir ".venv/Scripts/python.exe"

if (-not (Get-Command py -ErrorAction SilentlyContinue)) {
    throw "Python launcher 'py' was not found. Install Python 3.12 x64 for development."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw "npm was not found. Install Node.js 22 or later for development."
}
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    throw "Rust was not found. Install the stable MSVC Rust toolchain for Tauri development."
}

if (-not (Test-Path $venvPython)) {
    & py -3.12 -m venv (Join-Path $backendDir ".venv")
}
& $venvPython -m pip install --disable-pip-version-check -r (Join-Path $backendDir "requirements-dev.lock")

$target = (& rustc --print host-tuple).Trim()
$sidecar = Join-Path $root "apps/desktop/src-tauri/binaries/projectmind-backend-$target.exe"
if (-not (Test-Path $sidecar)) {
    & (Join-Path $PSScriptRoot "build-backend.ps1")
}

Push-Location $root
try {
    npm install

    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }
    $token = [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
    $devData = Join-Path $root ".dev-data"
    New-Item -ItemType Directory -Force -Path $devData | Out-Null

    $env:PROJECTMIND_ENVIRONMENT = "development"
    $env:PROJECTMIND_SESSION_TOKEN = $token
    $env:PROJECTMIND_BACKEND_URL = "http://127.0.0.1:8765"
    $env:VITE_BACKEND_URL = $env:PROJECTMIND_BACKEND_URL
    $env:VITE_BACKEND_TOKEN = $token

    $backendStart = @{
        FilePath = $venvPython
        ArgumentList = @("-m", "app", "--host", "127.0.0.1", "--port", "8765", "--data-dir=$devData", "--environment", "development")
        WorkingDirectory = $backendDir
        PassThru = $true
        NoNewWindow = $true
    }
    $backend = Start-Process @backendStart

    try {
        $headers = @{ "X-ProjectMind-Session" = $token }
        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            Start-Sleep -Milliseconds 250
            try {
                Invoke-RestMethod -Uri "$($env:PROJECTMIND_BACKEND_URL)/api/health" -Headers $headers | Out-Null
                $ready = $true
                break
            }
            catch {
                if ($backend.HasExited) {
                    throw "The local backend stopped before it became ready."
                }
            }
        }
        if (-not $ready) {
            throw "The local backend did not become ready within 10 seconds."
        }
        npm run desktop:dev
    }
    finally {
        if ($null -ne $backend -and -not $backend.HasExited) {
            Stop-Process -Id $backend.Id
        }
    }
}
finally {
    Pop-Location
}
