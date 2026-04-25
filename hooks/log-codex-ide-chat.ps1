$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logger = Join-Path $scriptDir "log-codex-ide-chat.py"

if ($args.Count -gt 0) {
  python $logger @args
  exit $LASTEXITCODE
}

$stdin = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($stdin)) {
  throw "Pass notes as arguments or pipe a summary into this command."
}

$stdin | python $logger
exit $LASTEXITCODE
