[CmdletBinding()]
param(
    [string]$InstallerPath,
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$productName = "ProjectMind Engineering AI"
$identifier = "com.projectmind.engineeringai"

if ([string]::IsNullOrWhiteSpace($InstallerPath)) {
    $installer = Get-ChildItem `
        -Path (Join-Path $root "apps/desktop/src-tauri/target/release/bundle/nsis") `
        -Filter "*.exe" `
        -File | Select-Object -First 1
    if (-not $installer) {
        throw "The NSIS installer was not found."
    }
    $InstallerPath = $installer.FullName
}
else {
    $InstallerPath = (Resolve-Path $InstallerPath).Path
}

$installerProcess = Start-Process `
    -FilePath $InstallerPath `
    -ArgumentList "/S" `
    -Wait `
    -PassThru
if ($installerProcess.ExitCode -ne 0) {
    throw "The NSIS installer failed with exit code $($installerProcess.ExitCode)."
}

$uninstallRoots = @(
    "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall"
)
$uninstallEntry = $uninstallRoots |
    Where-Object { Test-Path $_ } |
    ForEach-Object { Get-ChildItem $_ -ErrorAction SilentlyContinue } |
    ForEach-Object { Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue } |
    Where-Object { $_.DisplayName -eq $productName } |
    Select-Object -First 1

$applicationPath = $null
if ($uninstallEntry -and $uninstallEntry.InstallLocation) {
    $installLocation = ([string]$uninstallEntry.InstallLocation).Trim().Trim('"')
    $candidate = Join-Path $installLocation "$productName.exe"
    if (Test-Path $candidate) {
        $applicationPath = $candidate
    }
}
if (-not $applicationPath -and $uninstallEntry -and $uninstallEntry.DisplayIcon) {
    $candidate = ([string]$uninstallEntry.DisplayIcon).Trim()
    $candidate = ($candidate -replace ",\d+$", "").Trim().Trim('"')
    if (Test-Path $candidate) {
        $applicationPath = $candidate
    }
}
if (-not $applicationPath) {
    @(
        (Join-Path $env:LOCALAPPDATA "$productName\$productName.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\$productName\$productName.exe")
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1 | ForEach-Object {
        $applicationPath = $_
    }
}
if (-not $applicationPath) {
    throw "The installed ProjectMind executable could not be located."
}

$dataDir = Join-Path $env:LOCALAPPDATA $identifier
$desktopLog = Join-Path $dataDir "logs/desktop.log"
$applicationLog = Join-Path $dataDir "logs/application.log"
$application = Start-Process -FilePath $applicationPath -PassThru
$failure = $null
$ready = $false

try {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($application.HasExited) {
            throw "The installed desktop application exited early (exit code $($application.ExitCode))."
        }
        if (Test-Path $desktopLog) {
            $logText = Get-Content -Raw $desktopLog
            if ($logText.Contains("frontend connected to local backend")) {
                $ready = $true
                break
            }
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        throw "The installed desktop application did not connect to its backend within $TimeoutSeconds seconds."
    }
    Write-Host "Installed desktop smoke test passed: $applicationPath"
}
catch {
    $failure = $_.Exception.Message
}
finally {
    if (-not $application.HasExited) {
        $application.Kill($true)
        [void]$application.WaitForExit(10000)
    }
}

if ($failure) {
    if (Test-Path $desktopLog) {
        Write-Host "Desktop log:`n$(Get-Content -Raw $desktopLog)"
    }
    if (Test-Path $applicationLog) {
        Write-Host "Backend application log:`n$(Get-Content -Raw $applicationLog)"
    }
    throw "Installed desktop smoke test failed: $failure"
}
