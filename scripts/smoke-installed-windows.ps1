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
$smokeLogDirectory = if ([string]::IsNullOrWhiteSpace($env:RUNNER_TEMP)) {
    $null
}
else {
    Join-Path $env:RUNNER_TEMP "projectmind-installed-smoke-logs"
}
$expectedVersion = "0.1.4"
$baselineLineCount = if (Test-Path $desktopLog) {
    @(Get-Content $desktopLog).Count
}
else {
    0
}
$application = Start-Process -FilePath $applicationPath -PassThru
$failure = $null
$ready = $false
$launchId = $null
$newDesktopLines = @()

try {
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($application.HasExited) {
            throw "The installed desktop application exited early (exit code $($application.ExitCode))."
        }
        if (Test-Path $desktopLog) {
            $allLines = @(Get-Content $desktopLog)
            $newDesktopLines = if ($allLines.Count -ge $baselineLineCount) {
                @($allLines | Select-Object -Skip $baselineLineCount)
            }
            else {
                # The desktop rotates an oversized log before writing this launch.
                $allLines
            }

            if (-not $launchId) {
                $launchLine = $newDesktopLines |
                    Where-Object {
                        $_ -match "desktop launch \[version=$([regex]::Escape($expectedVersion)) launch=([A-Za-z0-9_-]+)\]"
                    } |
                    Select-Object -Last 1
                if ($launchLine -and
                    $launchLine -match "launch=([A-Za-z0-9_-]+)\]") {
                    $launchId = $Matches[1]
                }
            }

            if ($launchId) {
                $escapedLaunchId = [regex]::Escape($launchId)
                $mounted = $newDesktopLines |
                    Where-Object {
                        $_ -match "renderer mounted \[launch=$escapedLaunchId\]"
                    } |
                    Select-Object -First 1
                $readyLine = $newDesktopLines |
                    Where-Object {
                        $_ -match "renderer ready \[launch=$escapedLaunchId\] interface_visible=true"
                    } |
                    Select-Object -First 1
                $watchdog = $newDesktopLines |
                    Where-Object {
                        $_ -match "renderer watchdog timeout \[launch=$escapedLaunchId\]"
                    } |
                    Select-Object -First 1

                if ($watchdog) {
                    throw "The renderer watchdog fired for launch $launchId."
                }
                if ($mounted -and $readyLine) {
                    $ready = $true
                    break
                }
            }
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $ready) {
        throw (
            "The installed desktop application did not provide fresh visible " +
            "interface evidence within $TimeoutSeconds seconds."
        )
    }
    Write-Host (
        "Installed desktop smoke test passed for launch $launchId`: " +
        "$applicationPath"
    )
}
catch {
    $failure = $_.Exception.Message
}
finally {
    if (-not $application.HasExited) {
        $application.Kill($true)
        [void]$application.WaitForExit(10000)
    }
    if ($smokeLogDirectory) {
        try {
            [void](New-Item -ItemType Directory -Force -Path $smokeLogDirectory)
            @(
                $desktopLog,
                "${desktopLog}.previous",
                $applicationLog
            ) |
                Where-Object { Test-Path $_ } |
                ForEach-Object {
                    Copy-Item -Force $_ $smokeLogDirectory
                }
        }
        catch {
            Write-Warning "Could not preserve installed smoke-test logs: $($_.Exception.Message)"
        }
    }
}

if ($failure) {
    if ($newDesktopLines.Count -gt 0) {
        Write-Host "Desktop log for this launch:`n$($newDesktopLines -join "`n")"
    }
    elseif (Test-Path $desktopLog) {
        Write-Host "Desktop log:`n$(Get-Content -Raw $desktopLog)"
    }
    if (Test-Path $applicationLog) {
        Write-Host "Backend application log:`n$(Get-Content -Raw $applicationLog)"
    }
    throw "Installed desktop smoke test failed: $failure"
}
