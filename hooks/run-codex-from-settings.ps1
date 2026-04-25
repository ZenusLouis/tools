$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$settingsPath = Join-Path $repoRoot ".codex\settings.json"

if (-not (Test-Path $settingsPath)) {
  throw "Missing Codex settings: $settingsPath"
}

$settings = Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json
if (-not $settings.runner -or -not $settings.runner.command) {
  throw "Missing runner.command in .codex/settings.json"
}

$command = [string]$settings.runner.command
$runnerArgs = @()
if ($settings.runner.args) {
  $runnerArgs = @($settings.runner.args | ForEach-Object { [string]$_ })
}

Push-Location $repoRoot
try {
  & $command @runnerArgs @args
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
