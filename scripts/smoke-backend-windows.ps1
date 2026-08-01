[CmdletBinding()]
param(
    [string]$BackendPath,
    [int]$TimeoutSeconds = 90,
    [switch]$SeedInterruptedMigration
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
$databasePath = Join-Path $testRoot "projectmind.db"

if ($SeedInterruptedMigration) {
    $pythonPath = Join-Path $root "apps/backend/.venv/Scripts/python.exe"
    if (-not (Test-Path $pythonPath)) {
        throw "The backend virtual-environment Python was not found."
    }
    $seedCode = @'
import sqlite3
import sys

connection = sqlite3.connect(sys.argv[1])
connection.executescript(
    """
    CREATE TABLE projects (
        id VARCHAR(36) NOT NULL,
        name VARCHAR(200) NOT NULL,
        project_number VARCHAR(80) NOT NULL,
        client VARCHAR(200),
        consultant VARCHAR(200),
        contractor VARCHAR(200),
        description TEXT,
        status VARCHAR(30) NOT NULL,
        deleted_at DATETIME,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        PRIMARY KEY (id),
        UNIQUE (project_number)
    );
    INSERT INTO projects (
        id, name, project_number, status, created_at, updated_at
    ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        'Interrupted migration project',
        'SYNTHETIC-001',
        'active',
        '2026-07-26T00:00:00Z',
        '2026-07-26T00:00:00Z'
    );
    """
)
connection.commit()
connection.close()
'@
    & $pythonPath -c $seedCode $databasePath
    if ($LASTEXITCODE -ne 0) {
        throw "Could not seed the interrupted-migration smoke database."
    }
}

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

    $headers = @{ "X-ProjectMind-Session" = $token }
    $workspace = Join-Path $testRoot "source-documents"
    New-Item -ItemType Directory -Force -Path $workspace | Out-Null
    Set-Content `
        -LiteralPath (Join-Path $workspace "Synthetic Requirement.txt") `
        -Value "The synthetic smoke requirement mandates a 42 year design life." `
        -Encoding UTF8
    $projectPayload = @{
        name = "Packaged sidecar smoke project"
        project_number = "PACKAGE-SMOKE-001"
        settings = @{ workspace_path = $workspace }
    } | ConvertTo-Json -Depth 4
    $project = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$port/api/projects" `
        -Headers $headers `
        -ContentType "application/json" `
        -Body $projectPayload `
        -TimeoutSec 10
    $scan = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$port/api/projects/$($project.id)/documents/scan" `
        -Headers $headers `
        -TimeoutSec 30
    if ($scan.added -ne 1 -or $scan.failed -ne 0) {
        throw "Packaged document scan returned an unexpected result: $($scan | ConvertTo-Json -Compress)"
    }
    $search = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$port/api/projects/$($project.id)/documents/search?query=design%20life" `
        -Headers $headers `
        -TimeoutSec 10
    if ($search.total -ne 1 -or $search.results[0].excerpt -notmatch "42 year") {
        throw "Packaged full-text search did not return the synthetic requirement."
    }
    $backup = Invoke-RestMethod `
        -Method Post `
        -Uri "http://127.0.0.1:$port/api/maintenance/backup" `
        -Headers $headers `
        -TimeoutSec 30
    if (-not (Test-Path -LiteralPath $backup.path)) {
        throw "The packaged backend did not create the requested database backup."
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

if ($SeedInterruptedMigration) {
    $verificationCode = @'
import sqlite3
import sys

connection = sqlite3.connect(sys.argv[1])
revision = connection.execute("SELECT version_num FROM alembic_version").fetchone()
project = connection.execute(
    "SELECT name FROM projects WHERE project_number = 'SYNTHETIC-001'"
).fetchone()
connection.close()
assert revision == ("20260801_0002",), revision
assert project == ("Interrupted migration project",), project
'@
    & $pythonPath -c $verificationCode $databasePath
    if ($LASTEXITCODE -ne 0) {
        throw "The packaged backend did not preserve and complete the interrupted migration."
    }
    Write-Host "Interrupted-migration recovery smoke test passed."
}
