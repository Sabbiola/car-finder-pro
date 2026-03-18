param(
  [Parameter(Mandatory = $true)]
  [string]$FastApiBaseUrl,
  [string]$OpsToken = "",
  [string]$AlertsToken = "",
  [string]$EvidenceDir = "artifacts/rollback-drill",
  [ValidateSet("fastapi_only", "primary_with_fallback", "legacy_only")]
  [string]$TargetProxyMode = "primary_with_fallback",
  [ValidateSet("fastapi_only", "primary_with_fallback", "legacy_only")]
  [string]$RestoreProxyMode = "fastapi_only",
  [string]$SupabaseProjectRef = "",
  [switch]$ApplyEdgeProxyMode,
  [switch]$SkipRestoreMode
)

$ErrorActionPreference = "Stop"

$repoRoot = Join-Path $PSScriptRoot ".."
Set-Location $repoRoot

if (-not (Test-Path $EvidenceDir)) {
  New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null
}

$smokeScript = Join-Path $PSScriptRoot "run-core-journey-smoke.ps1"
if (-not (Test-Path $smokeScript)) {
  throw "Missing smoke script: $smokeScript"
}

$summary = [ordered]@{
  started_at_utc = [DateTimeOffset]::UtcNow.ToString("o")
  fastapi_base_url = $FastApiBaseUrl.TrimEnd("/")
  target_proxy_mode = $TargetProxyMode
  restore_proxy_mode = $RestoreProxyMode
  apply_edge_proxy_mode = [bool]$ApplyEdgeProxyMode
  pre_smoke_ok = $false
  post_smoke_ok = $false
  mode_switch_applied = $false
  mode_restore_applied = $false
  mode_switch_notes = @()
}

$preSmokePath = Join-Path $EvidenceDir "pre-smoke.json"
$postSmokePath = Join-Path $EvidenceDir "post-smoke.json"

Write-Host "Rollback drill: pre-smoke" -ForegroundColor Cyan
& $smokeScript `
  -FastApiBaseUrl $FastApiBaseUrl `
  -OpsToken $OpsToken `
  -AlertsToken $AlertsToken `
  -OutputFile $preSmokePath
$summary.pre_smoke_ok = ($LASTEXITCODE -eq 0)

if ($ApplyEdgeProxyMode) {
  if ([string]::IsNullOrWhiteSpace($SupabaseProjectRef)) {
    throw "SupabaseProjectRef is required when ApplyEdgeProxyMode is set."
  }
  $supabaseCmd = Get-Command "supabase" -ErrorAction SilentlyContinue
  if (-not $supabaseCmd) {
    throw "Supabase CLI not found. Install supabase CLI or run mode switch manually."
  }

  Write-Host "Applying edge proxy mode: $TargetProxyMode" -ForegroundColor Yellow
  & supabase secrets set "FASTAPI_PROXY_MODE=$TargetProxyMode" --project-ref $SupabaseProjectRef
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply FASTAPI_PROXY_MODE=$TargetProxyMode"
  }
  $summary.mode_switch_applied = $true
} else {
  $manualNote = "Manual mode switch required before post-smoke: supabase secrets set FASTAPI_PROXY_MODE=$TargetProxyMode --project-ref <PROJECT_REF>"
  $summary.mode_switch_notes += $manualNote
  Write-Host $manualNote -ForegroundColor Yellow
}

Write-Host "Rollback drill: post-smoke" -ForegroundColor Cyan
& $smokeScript `
  -FastApiBaseUrl $FastApiBaseUrl `
  -OpsToken $OpsToken `
  -AlertsToken $AlertsToken `
  -OutputFile $postSmokePath
$summary.post_smoke_ok = ($LASTEXITCODE -eq 0)

if ($ApplyEdgeProxyMode -and -not $SkipRestoreMode) {
  Write-Host "Restoring edge proxy mode: $RestoreProxyMode" -ForegroundColor Yellow
  & supabase secrets set "FASTAPI_PROXY_MODE=$RestoreProxyMode" --project-ref $SupabaseProjectRef
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to restore FASTAPI_PROXY_MODE=$RestoreProxyMode"
  }
  $summary.mode_restore_applied = $true
}

$summary.finished_at_utc = [DateTimeOffset]::UtcNow.ToString("o")
$summary.drill_ok = [bool]($summary.pre_smoke_ok -and $summary.post_smoke_ok)

$summaryPath = Join-Path $EvidenceDir "rollback-drill-summary.json"
$summary | ConvertTo-Json -Depth 20 | Out-File -FilePath $summaryPath -Encoding utf8
Write-Host "Rollback drill summary written to $summaryPath" -ForegroundColor Cyan

if ($summary.drill_ok -and ($ApplyEdgeProxyMode -or $summary.mode_switch_notes.Count -gt 0)) {
  Write-Host "Rollback drill completed" -ForegroundColor Green
  if (-not $ApplyEdgeProxyMode) {
    Write-Host "Note: mode switch was manual and must be confirmed by operator evidence." -ForegroundColor Yellow
    exit 2
  }
  exit 0
}

Write-Host "Rollback drill failed" -ForegroundColor Red
exit 1
