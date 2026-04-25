$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir "run-codex.py"
. (Join-Path $scriptDir "Resolve-Python.ps1")

if (-not $env:GCS_PROVIDER) {
  $env:GCS_PROVIDER = "codex"
}

$python = Resolve-GcsPython
& $python.Exe @($python.Args) $runner @args
exit $LASTEXITCODE
