$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$daemon = Join-Path $scriptDir "gcs_bridge_daemon.py"
. (Join-Path $scriptDir "Resolve-Python.ps1")

$python = Resolve-GcsPython
& $python.Exe @($python.Args) $daemon @args
exit $LASTEXITCODE
