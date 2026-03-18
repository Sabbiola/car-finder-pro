$ErrorActionPreference = "Stop"

Set-Location (Join-Path $PSScriptRoot "..")

$failures = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]
$passes = New-Object System.Collections.Generic.List[string]

function Add-Pass {
  param([string]$Message)
  $passes.Add($Message) | Out-Null
  Write-Host "[PASS] $Message" -ForegroundColor Green
}

function Add-Warning {
  param([string]$Message)
  $warnings.Add($Message) | Out-Null
  Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Add-Failure {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
  Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Check-Path {
  param(
    [string]$Path,
    [string]$Label
  )
  if (Test-Path $Path) {
    Add-Pass $Label
  } else {
    Add-Failure "$Label (`"$Path`" missing)"
  }
}

function Check-Command {
  param(
    [string]$Name,
    [string]$VersionArg = "--version",
    [string]$Label,
    [string]$ExpectedPattern = ""
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    Add-Failure "$Label command not found: $Name"
    return
  }

  try {
    $output = & $Name $VersionArg 2>&1
    $exitCode = $LASTEXITCODE
    $version = $output | Select-Object -First 1

    if ($exitCode -ne 0) {
      if ($version) {
        Add-Failure "$Label command failed ($version)"
      } else {
        Add-Failure "$Label command failed with exit code $exitCode"
      }
      return
    }

    if ($version) {
      Add-Pass "$Label available ($version)"
      if ($ExpectedPattern -and ($version -notmatch $ExpectedPattern)) {
        Add-Failure "$Label version does not match expected pattern: $ExpectedPattern"
      }
    } else {
      Add-Pass "$Label available"
    }
  } catch {
    Add-Failure "$Label found but not executable"
  }
}

Write-Host "== Go-Live Readiness Preflight ==" -ForegroundColor Cyan

Check-Command -Name "python" -VersionArg "--version" -Label "Python" -ExpectedPattern "3\.14"
Check-Command -Name "node" -VersionArg "--version" -Label "Node" -ExpectedPattern "v22\."
Check-Command -Name "npm" -VersionArg "--version" -Label "npm"
Check-Command -Name "deno" -VersionArg "--version" -Label "Deno" -ExpectedPattern "deno 2\."

$requiredFiles = @(
  ".github/workflows/ci.yml",
  ".github/workflows/deploy-fastapi.yml",
  ".github/workflows/deploy-functions.yml",
  ".github/workflows/perf-load.yml",
  ".github/workflows/ops-snapshot.yml",
  ".github/workflows/process-alerts.yml",
  ".github/workflows/canary-smoke.yml",
  "frontend/.env.local.example",
  "frontend/.env.staging.example",
  "frontend/.env.production.example",
  "backend/.env.local.example",
  "backend/.env.staging.example",
  "backend/.env.production.example",
  ".env.edge.local.example",
  ".env.edge.staging.example",
  ".env.edge.production.example",
  "docs/production_readiness_checklist.md",
  "docs/production_readiness_backlog.md",
  "docs/release_go_live_checklist.md",
  "docs/release_approval_checklist.md",
  "docs/stabilization_window_policy.md",
  "docs/runtime_env_profiles.md",
  "docs/observability_operations.md",
  "docs/staging_provider_smoke_checklist.md",
  "docs/runbooks/provider_failure_spike.md",
  "docs/runbooks/stream_completion_drop.md",
  "docs/runbooks/alerts_processor_failure.md",
  "docs/runbooks/rollback_runtime_mode.md",
  "docs/runbooks/staging_soak_canary.md",
  "scripts/run-core-journey-smoke.ps1",
  "scripts/run-staging-soak.ps1",
  "scripts/run-rollback-drill.ps1"
)

foreach ($file in $requiredFiles) {
  Check-Path -Path $file -Label "Required file present"
}

$migrationFiles = Get-ChildItem "supabase/migrations" -File -ErrorAction SilentlyContinue
if (-not $migrationFiles) {
  Add-Failure "No migration files found under supabase/migrations"
} else {
  if ($migrationFiles.Count -ge 15) {
    Add-Pass "Migration count is $($migrationFiles.Count) (>= 15)"
  } else {
    Add-Failure "Migration count too low: $($migrationFiles.Count), expected at least 15"
  }
}

if (Test-Path "supabase/migrations/20260313000000_alert_delivery_attempts.sql") {
  Add-Pass "Latest alert delivery migration present"
} else {
  Add-Failure "Missing migration: 20260313000000_alert_delivery_attempts.sql"
}

$workflowFiles = Get-ChildItem ".github/workflows" -File -Filter "*.yml" -ErrorAction SilentlyContinue
if (-not $workflowFiles) {
  Add-Failure "Unable to read workflow files under .github/workflows"
} else {
  $workflowContent = ($workflowFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n"
  $expectedSecrets = @(
    "RAILWAY_TOKEN",
    "RAILWAY_PROJECT_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "RAILWAY_SERVICE_ID",
    "FASTAPI_HEALTHCHECK_URL",
    "SUPABASE_ACCESS_TOKEN",
    "SUPABASE_PROJECT_ID",
    "FASTAPI_STAGING_BASE_URL",
    "FASTAPI_OPS_BASE_URL",
    "FASTAPI_OPS_TOKEN",
    "ALERTS_PROCESS_URL",
    "ALERTS_PROCESSOR_TOKEN",
    "ALERTS_SMOKE_LISTING_ID"
  )

  foreach ($secret in $expectedSecrets) {
    if ($workflowContent -match [Regex]::Escape($secret)) {
      Add-Pass "Workflow secret reference present: $secret"
    } else {
      Add-Failure "Missing workflow secret reference: $secret"
    }
  }
}

$apiFiles = Get-ChildItem "backend/app/api" -File -Filter "*.py" -ErrorAction SilentlyContinue
$mainFile = "backend/app/main.py"
$content = ""

if ($apiFiles) {
  $content = (($apiFiles | ForEach-Object { Get-Content $_.FullName -Raw }) -join "`n")
}
if (Test-Path $mainFile) {
  $content = $content + "`n" + (Get-Content $mainFile -Raw)
}

$expectedRoutes = @(
  "/search",
  "/search/stream",
  "/providers",
  "/providers/health",
  "/filters/metadata",
  "/metadata/ownership",
  "/listings/{listing_id}",
  "/listings/analyze",
  "/alerts",
  "/alerts/{alert_id}/deactivate",
  "/alerts/process",
  "/user/favorites",
  "/user/favorites/{listing_id}",
  "/user/saved-searches",
  "/user/saved-searches/{search_id}",
  "/listings/batch",
  "/ops/metrics",
  "/ops/alerts",
  "/healthz"
)

if ($content.Trim().Length -eq 0) {
  Add-Failure "Unable to scan backend route files"
} else {
  foreach ($route in $expectedRoutes) {
    if ($content -match [Regex]::Escape($route)) {
      Add-Pass "Route string present: $route"
    } else {
      Add-Failure "Missing expected route string: $route"
    }
  }
}

if ($warnings.Count -eq 0) {
  Add-Pass "No warnings emitted by preflight"
} else {
  Write-Host ""
  Write-Host "Warnings ($($warnings.Count)):" -ForegroundColor Yellow
  foreach ($w in $warnings) {
    Write-Host "  - $w" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Summary: $($passes.Count) pass, $($warnings.Count) warning, $($failures.Count) fail" -ForegroundColor Cyan

if ($failures.Count -gt 0) {
  Write-Host ""
  Write-Host "Failures:" -ForegroundColor Red
  foreach ($f in $failures) {
    Write-Host "  - $f" -ForegroundColor Red
  }
  exit 1
}

exit 0
