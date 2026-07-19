[CmdletBinding()]
param(
    [string]$BackendPath,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if ([string]::IsNullOrWhiteSpace($BackendPath)) {
    $target = (& rustc --print host-tuple).Trim()
    if (-not $target) {
        throw "Rust did not report a target triple."
    }
    $BackendPath = Join-Path $root "apps/desktop/src-tauri/binaries/projectmind-backend-$target.exe"
}

$BackendPath = (Resolve-Path $BackendPath).Path
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("projectmind-sidecar-smoke-" + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $testRoot | Out-Null

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$tokenBytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$token = [Convert]::ToBase64String($tokenBytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
$startInfo = [System.Diagnostics.ProcessStartInfo]::new()
$startInfo.FileName = $BackendPath
$startInfo.UseShellExecute = $false
$startInfo.CreateNoWindow = $true
$startInfo.RedirectStandardOutput = $true
$startInfo.RedirectStandardError = $true
$startInfo.Environment["PROJECTMIND_SESSION_TOKEN"] = $token

@(
    "--host",
    "127.0.0.1",
    "--port",
    $port.ToString(),
    "--data-dir",
    $testRoot,
    "--environment",
    "production"
) | ForEach-Object { [void]$startInfo.ArgumentList.Add($_) }

$process = [System.Diagnostics.Process]::new()
$process.StartInfo = $startInfo
$stdoutTask = $null
$stderrTask = $null
$failure = $null
$ready = $false
$started = $false

try {
    if (-not $process.Start()) {
        throw "Windows did not start the packaged backend process."
    }
    $started = $true
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)

    while ([DateTime]::UtcNow -lt $deadline) {
        if ($process.HasExited) {
            throw "The packaged backend exited before becoming ready (exit code $($process.ExitCode))."
        }
        try {
            $response = Invoke-RestMethod `
                -Uri "http://127.0.0.1:$port/api/health" `
                -Headers @{ "X-ProjectMind-Session" = $token } `
                -TimeoutSec 2
            if ($response.status -eq "ok" -and $response.database -eq "ok") {
                $ready = $true
                break
            }
        }
        catch {
            # The one-file executable may still be extracting or migrating the database.
        }
        Start-Sleep -Milliseconds 500
    }

    if (-not $ready) {
        throw "The packaged backend did not become healthy within $TimeoutSeconds seconds."
    }
    Write-Host "Packaged backend smoke test passed on port $port."
}
catch {
    $failure = $_.Exception.Message
}
finally {
    if ($started -and -not $process.HasExited) {
        $process.Kill($true)
        [void]$process.WaitForExit(10000)
    }
}

if ($failure) {
    if ($stdoutTask) {
        $stdout = $stdoutTask.GetAwaiter().GetResult()
        if ($stdout) {
            Write-Host "Backend stdout:`n$stdout"
        }
    }
    if ($stderrTask) {
        $stderr = $stderrTask.GetAwaiter().GetResult()
        if ($stderr) {
            Write-Host "Backend stderr:`n$stderr"
        }
    }
    $applicationLog = Join-Path $testRoot "logs/application.log"
    if (Test-Path $applicationLog) {
        Write-Host "Backend application log:`n$(Get-Content -Raw $applicationLog)"
    }
    throw "Packaged backend smoke test failed: $failure"
}
