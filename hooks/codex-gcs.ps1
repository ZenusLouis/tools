$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$runner = Join-Path $scriptDir "run-codex.py"

if (-not $env:GCS_PROVIDER) {
  $env:GCS_PROVIDER = "codex"
}

python $runner @args
exit $LASTEXITCODE
