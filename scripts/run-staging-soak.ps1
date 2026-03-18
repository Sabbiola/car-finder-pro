param(
  [Parameter(Mandatory = $true)]
  [string]$FastApiBaseUrl,
  [int]$DurationHours = 120,
  [int]$IntervalMinutes = 30,
  [string]$OpsToken = "",
  [string]$AlertsToken = "",
  [string]$OutputDir = "artifacts/soak",
  [double]$MinimumSuccessRate = 0.98
)

$ErrorActionPreference = "Stop"

if ($DurationHours -lt 1) {
  throw "DurationHours must be >= 1"
}
if ($IntervalMinutes -lt 1) {
  throw "IntervalMinutes must be >= 1"
}

$repoRoot = Join-Path $PSScriptRoot ".."
Set-Location $repoRoot

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$smokeScript = Join-Path $PSScriptRoot "run-core-journey-smoke.ps1"
if (-not (Test-Path $smokeScript)) {
  throw "Missing smoke script: $smokeScript"
}

$startAt = [DateTimeOffset]::UtcNow
$endAt = $startAt.AddHours($DurationHours)
$runs = New-Object System.Collections.Generic.List[object]
$runIndex = 0

Write-Host "Starting staging soak window" -ForegroundColor Cyan
Write-Host "  Base URL: $FastApiBaseUrl"
Write-Host "  DurationHours: $DurationHours"
Write-Host "  IntervalMinutes: $IntervalMinutes"
Write-Host "  OutputDir: $OutputDir"

while ([DateTimeOffset]::UtcNow -lt $endAt) {
  $runIndex += 1
  $timestamp = [DateTimeOffset]::UtcNow.ToString("yyyyMMdd-HHmmss")
  $runOutput = Join-Path $OutputDir "smoke-$timestamp.json"

  Write-Host ""
  Write-Host "Soak run #$runIndex - $timestamp" -ForegroundColor Cyan
  & $smokeScript `
    -FastApiBaseUrl $FastApiBaseUrl `
    -OpsToken $OpsToken `
    -AlertsToken $AlertsToken `
    -OutputFile $runOutput

  $exitCode = $LASTEXITCODE
  $ok = ($exitCode -eq 0)
  $runs.Add([pscustomobject]@{
      run = $runIndex
      timestamp_utc = [DateTimeOffset]::UtcNow.ToString("o")
      output_file = $runOutput
      ok = $ok
      exit_code = $exitCode
    }) | Out-Null

  if (-not $ok) {
    Write-Host "Soak run failed (exit code $exitCode)" -ForegroundColor Red
  }

  $now = [DateTimeOffset]::UtcNow
  if ($now -ge $endAt) {
    break
  }

  $sleepSeconds = [int][Math]::Min(
    ($IntervalMinutes * 60),
    [Math]::Max(0, ($endAt - $now).TotalSeconds)
  )
  if ($sleepSeconds -gt 0) {
    Write-Host "Waiting $sleepSeconds seconds before next run..." -ForegroundColor Yellow
    Start-Sleep -Seconds $sleepSeconds
  }
}

$successCount = @($runs | Where-Object { $_.ok }).Count
$totalCount = $runs.Count
$successRate = if ($totalCount -gt 0) { $successCount / $totalCount } else { 0.0 }
$soakOk = ($totalCount -gt 0 -and $successRate -ge $MinimumSuccessRate)

$summary = [pscustomobject]@{
  started_at_utc = $startAt.ToString("o")
  finished_at_utc = [DateTimeOffset]::UtcNow.ToString("o")
  duration_hours = $DurationHours
  interval_minutes = $IntervalMinutes
  minimum_success_rate = $MinimumSuccessRate
  total_runs = $totalCount
  success_runs = $successCount
  success_rate = [Math]::Round($successRate, 4)
  soak_ok = $soakOk
  fastapi_base_url = $FastApiBaseUrl.TrimEnd("/")
  runs = $runs
}

$summaryPath = Join-Path $OutputDir "soak-summary.json"
$summary | ConvertTo-Json -Depth 20 | Out-File -FilePath $summaryPath -Encoding utf8
Write-Host ""
Write-Host "Soak summary written to $summaryPath" -ForegroundColor Cyan
Write-Host "Success rate: $([Math]::Round($successRate * 100, 2))%" -ForegroundColor Cyan

if ($soakOk) {
  Write-Host "Staging soak: PASS" -ForegroundColor Green
  exit 0
}

Write-Host "Staging soak: FAIL" -ForegroundColor Red
exit 1
