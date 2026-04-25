function Resolve-GcsPython {
  $python = Get-Command python -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($python) {
    return [pscustomobject]@{ Exe = $python.Source; Args = @() }
  }

  $py = Get-Command py -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($py) {
    return [pscustomobject]@{ Exe = $py.Source; Args = @("-3") }
  }

  $known = @(
    "$env:LOCALAPPDATA\Microsoft\WindowsApps\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
  )
  foreach ($candidate in $known) {
    if (Test-Path $candidate) {
      return [pscustomobject]@{ Exe = $candidate; Args = @() }
    }
  }

  throw "Python was not found. Install Python or enable the Windows python launcher."
}
