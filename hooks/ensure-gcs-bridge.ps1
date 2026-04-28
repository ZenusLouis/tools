$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$daemonPath = Join-Path $root "hooks\gcs_bridge_daemon.py"

$running = Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine -like "*gcs_bridge_daemon.py*" -and
    $_.CommandLine -like "*$daemonPath*"
  } |
  Select-Object -First 1

if ($running) {
  Write-Host "GCS bridge already running (PID $($running.ProcessId))."
  exit 0
}

Start-Process `
  -FilePath powershell.exe `
  -WindowStyle Hidden `
  -WorkingDirectory $root `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "hooks/start-gcs-bridge.ps1")

Start-Sleep -Seconds 2

$started = Get-CimInstance Win32_Process |
  Where-Object {
    $_.CommandLine -and
    $_.CommandLine -like "*gcs_bridge_daemon.py*" -and
    $_.CommandLine -like "*$daemonPath*"
  } |
  Select-Object -First 1

if (-not $started) {
  Write-Error "Failed to start GCS bridge daemon."
  exit 1
}

Write-Host "GCS bridge started (PID $($started.ProcessId))."
