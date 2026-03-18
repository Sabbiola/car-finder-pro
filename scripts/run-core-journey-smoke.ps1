param(
  [Parameter(Mandatory = $true)]
  [string]$FastApiBaseUrl,
  [string]$OpsToken = "",
  [string]$AlertsToken = "",
  [string]$OutputFile = ""
)

$ErrorActionPreference = "Stop"

function Normalize-BaseUrl {
  param([string]$Url)
  return $Url.TrimEnd("/")
}

function Add-StepResult {
  param(
    [System.Collections.Generic.List[object]]$Results,
    [string]$Step,
    [bool]$Ok,
    [string]$Detail,
    [double]$DurationMs
  )
  $Results.Add([pscustomobject]@{
      step = $Step
      ok = $Ok
      detail = $Detail
      duration_ms = [Math]::Round($DurationMs, 2)
    }) | Out-Null
  if ($Ok) {
    Write-Host "[PASS] $Step - $Detail" -ForegroundColor Green
  } else {
    Write-Host "[FAIL] $Step - $Detail" -ForegroundColor Red
  }
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Url,
    [hashtable]$Headers = @{},
    [object]$Body = $null,
    [int]$TimeoutSec = 30
  )

  $params = @{
    Method = $Method
    Uri = $Url
    Headers = $Headers
    TimeoutSec = $TimeoutSec
  }
  if ($null -ne $Body) {
    $params.ContentType = "application/json"
    $params.Body = ($Body | ConvertTo-Json -Depth 20 -Compress)
  }
  return Invoke-RestMethod @params
}

$baseUrl = Normalize-BaseUrl $FastApiBaseUrl
$results = New-Object System.Collections.Generic.List[object]
$startAt = [DateTimeOffset]::UtcNow
$smokeUserId = "smoke-user"
$smokeClientId = "smoke-client-$([Guid]::NewGuid().ToString('N').Substring(0, 8))"
$savedSearchId = $null
$alertId = $null
$listingId = $null
$providerCatalog = @()
$configuredEnabledProviders = @()
$unconfiguredEnabledProviders = @()

# 1. Health
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $health = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/healthz"
  if ($health.status -eq "ok") {
    Add-StepResult -Results $results -Step "healthz" -Ok $true -Detail "status=ok" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "healthz" -Ok $false -Detail "unexpected payload" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "healthz" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 2. Provider catalog
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $providersPayload = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/providers"
  $providerCatalog = @($providersPayload.providers)
  if ($providerCatalog.Count -lt 1) {
    Add-StepResult -Results $results -Step "providers_catalog" -Ok $false -Detail "empty provider catalog" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    $hasConfigFields = $true
    foreach ($provider in $providerCatalog) {
      if ($null -eq $provider.configuration_requirements -or $null -eq $provider.missing_configuration -or [string]::IsNullOrWhiteSpace([string]$provider.configuration_message)) {
        $hasConfigFields = $false
        break
      }
    }
    if (-not $hasConfigFields) {
      Add-StepResult -Results $results -Step "providers_catalog" -Ok $false -Detail "missing provider configuration fields" -DurationMs $sw.Elapsed.TotalMilliseconds
    } else {
      $configuredEnabledProviders = @($providerCatalog | Where-Object { $_.enabled -eq $true -and $_.configured -eq $true })
      $unconfiguredEnabledProviders = @($providerCatalog | Where-Object { $_.enabled -eq $true -and $_.configured -eq $false })
      Add-StepResult -Results $results -Step "providers_catalog" -Ok $true -Detail "providers=$($providerCatalog.Count) configured_enabled=$($configuredEnabledProviders.Count) unconfigured_enabled=$($unconfiguredEnabledProviders.Count)" -DurationMs $sw.Elapsed.TotalMilliseconds
    }
  }
} catch {
  Add-StepResult -Results $results -Step "providers_catalog" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 3. Provider health
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $providersHealthPayload = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/providers/health"
  $providerHealthRows = @($providersHealthPayload.providers)
  if ($providerHealthRows.Count -lt 1) {
    Add-StepResult -Results $results -Step "providers_health" -Ok $false -Detail "empty provider health payload" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    $hasHealthConfigFields = $true
    foreach ($provider in $providerHealthRows) {
      if ($null -eq $provider.configuration_requirements -or $null -eq $provider.missing_configuration -or [string]::IsNullOrWhiteSpace([string]$provider.configuration_message)) {
        $hasHealthConfigFields = $false
        break
      }
    }
    if ($hasHealthConfigFields) {
      Add-StepResult -Results $results -Step "providers_health" -Ok $true -Detail "providers=$($providerHealthRows.Count)" -DurationMs $sw.Elapsed.TotalMilliseconds
    } else {
      Add-StepResult -Results $results -Step "providers_health" -Ok $false -Detail "missing provider health configuration fields" -DurationMs $sw.Elapsed.TotalMilliseconds
    }
  }
} catch {
  Add-StepResult -Results $results -Step "providers_health" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 4. Filters metadata
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $filtersMetadata = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/filters/metadata"
  $searchContract = $filtersMetadata.search_contract
  if (
    $null -eq $searchContract -or
    $null -eq $searchContract.provider_filter_union -or
    $null -eq $searchContract.provider_filter_intersection -or
    $searchContract.provider_filter_semantics -ne "strict_all_active_non_post_filters"
  ) {
    Add-StepResult -Results $results -Step "filters_metadata" -Ok $false -Detail "missing canonical search_contract fields" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "filters_metadata" -Ok $true -Detail "strict metadata contract detected" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "filters_metadata" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 5. Search sync
$searchPayload = @{
  brand = "BMW"
  model = "320d"
  sources = @("autoscout24", "subito", "ebay")
}
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $search = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/search" -Body $searchPayload
  if ($null -ne $search.total_results -and $search.total_results -ge 1 -and $search.listings.Count -ge 1) {
    $listingId = [string]$search.listings[0].id
    Add-StepResult -Results $results -Step "search_sync" -Ok $true -Detail "total_results=$($search.total_results) listing_id=$listingId" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "search_sync" -Ok $false -Detail "no listings returned" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "search_sync" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 6. Search stream
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $streamBody = $searchPayload | ConvertTo-Json -Depth 10 -Compress
  $streamResponse = Invoke-WebRequest -Method POST -Uri "$baseUrl/api/search/stream" -ContentType "application/json" -Body $streamBody -TimeoutSec 40
  $streamContent = [string]$streamResponse.Content
  if ($streamContent.Contains("event: complete")) {
    Add-StepResult -Results $results -Step "search_stream" -Ok $true -Detail "complete event found" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "search_stream" -Ok $false -Detail "complete event missing" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "search_stream" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 7. Provider partial failure (deterministic if at least one provider is unconfigured)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  if ($configuredEnabledProviders.Count -ge 1 -and $unconfiguredEnabledProviders.Count -ge 1) {
    $configuredSource = [string]$configuredEnabledProviders[0].id
    $unconfiguredSource = [string]$unconfiguredEnabledProviders[0].id
    $partialPayload = @{
      brand = "BMW"
      model = "320d"
      sources = @($configuredSource, $unconfiguredSource)
    }
    $partialSearch = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/search" -Body $partialPayload
    $partialDetails = @($partialSearch.provider_error_details)
    $notConfiguredError = $partialDetails | Where-Object {
      $_.provider -eq $unconfiguredSource -and $_.code -eq "provider_not_configured"
    }
    if ($notConfiguredError) {
      Add-StepResult -Results $results -Step "partial_failure" -Ok $true -Detail "$unconfiguredSource excluded with provider_not_configured while search stays available" -DurationMs $sw.Elapsed.TotalMilliseconds
    } else {
      Add-StepResult -Results $results -Step "partial_failure" -Ok $false -Detail "provider_not_configured not reported for $unconfiguredSource" -DurationMs $sw.Elapsed.TotalMilliseconds
    }
  } else {
    Add-StepResult -Results $results -Step "partial_failure" -Ok $true -Detail "skipped (requires one configured and one unconfigured enabled provider)" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "partial_failure" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

if ([string]::IsNullOrWhiteSpace($listingId)) {
  $listingId = "11111111-1111-4111-8111-111111111111"
}

# 8. Detail
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $detail = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/listings/$listingId?include_context=true"
  if ($detail.listing.id -eq $listingId) {
    Add-StepResult -Results $results -Step "detail" -Ok $true -Detail "listing resolved" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "detail" -Ok $false -Detail "listing mismatch" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "detail" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 9. Listings batch (compare/recently viewed/favorites)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $batch = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/listings/batch" -Body @{ ids = @($listingId) }
  if ($batch.listings.Count -ge 1) {
    Add-StepResult -Results $results -Step "listings_batch" -Ok $true -Detail "count=$($batch.listings.Count)" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "listings_batch" -Ok $false -Detail "no listings in batch" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "listings_batch" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 10. Favorites
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $null = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/user/favorites" -Body @{
    user_id = $smokeUserId
    listing_id = $listingId
  }
  $favorites = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/user/favorites?user_id=$smokeUserId"
  $hasFavorite = $favorites.favorites | Where-Object { $_.listing_id -eq $listingId }
  $null = Invoke-JsonRequest -Method "DELETE" -Url "$baseUrl/api/user/favorites/$listingId" -Body @{ user_id = $smokeUserId }
  if ($hasFavorite) {
    Add-StepResult -Results $results -Step "favorites" -Ok $true -Detail "add/list/delete ok" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "favorites" -Ok $false -Detail "favorite not persisted" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "favorites" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 11. Saved searches
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $created = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/user/saved-searches" -Body @{
    user_id = $smokeUserId
    name = "smoke-bmw-320d"
    filters = @{
      brand = "BMW"
      model = "320d"
      sources = @("autoscout24", "subito")
    }
  }
  $savedSearchId = [string]$created.id
  $saved = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/user/saved-searches?user_id=$smokeUserId"
  $exists = $saved.saved_searches | Where-Object { $_.id -eq $savedSearchId }
  $deleteResponse = Invoke-JsonRequest -Method "DELETE" -Url "$baseUrl/api/user/saved-searches/$savedSearchId" -Body @{ user_id = $smokeUserId }
  if ($exists -and $deleteResponse.deleted -eq $true) {
    Add-StepResult -Results $results -Step "saved_searches" -Ok $true -Detail "create/list/delete ok" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "saved_searches" -Ok $false -Detail "saved search flow invalid" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "saved_searches" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 12. Alerts
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $createdAlert = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/alerts" -Body @{
    listing_id = $listingId
    target_price = 9999999
    client_id = $smokeClientId
  }
  $alertId = [string]$createdAlert.alert.id
  $listedAlerts = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/alerts?client_id=$smokeClientId"
  $alertExists = $listedAlerts.alerts | Where-Object { $_.alert.id -eq $alertId }
  $deactivated = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/alerts/$alertId/deactivate" -Body @{
    client_id = $smokeClientId
  }
  if ($alertExists -and $deactivated.alert.is_active -eq $false) {
    Add-StepResult -Results $results -Step "alerts" -Ok $true -Detail "create/list/deactivate ok" -DurationMs $sw.Elapsed.TotalMilliseconds
  } else {
    Add-StepResult -Results $results -Step "alerts" -Ok $false -Detail "alerts flow invalid" -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} catch {
  Add-StepResult -Results $results -Step "alerts" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 13. Alerts processor dry-run (optional)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
if (-not [string]::IsNullOrWhiteSpace($AlertsToken)) {
  try {
    $processHeaders = @{ "x-alerts-token" = $AlertsToken }
    $process = Invoke-JsonRequest -Method "POST" -Url "$baseUrl/api/alerts/process" -Headers $processHeaders -Body @{
      dry_run = $true
      limit = 20
      idempotency_key = "smoke-dryrun-$([Guid]::NewGuid().ToString('N'))"
    }
    if ($null -ne $process.run_id) {
      Add-StepResult -Results $results -Step "alerts_processor_dry_run" -Ok $true -Detail "run_id=$($process.run_id)" -DurationMs $sw.Elapsed.TotalMilliseconds
    } else {
      Add-StepResult -Results $results -Step "alerts_processor_dry_run" -Ok $false -Detail "missing run_id" -DurationMs $sw.Elapsed.TotalMilliseconds
    }
  } catch {
    Add-StepResult -Results $results -Step "alerts_processor_dry_run" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} else {
  Add-StepResult -Results $results -Step "alerts_processor_dry_run" -Ok $true -Detail "skipped (Alerts token not provided)" -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

# 14. Ops endpoints (optional)
$sw = [System.Diagnostics.Stopwatch]::StartNew()
if (-not [string]::IsNullOrWhiteSpace($OpsToken)) {
  try {
    $opsHeaders = @{ "x-ops-token" = $OpsToken }
    $opsMetrics = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/ops/metrics" -Headers $opsHeaders
    $opsAlerts = Invoke-JsonRequest -Method "GET" -Url "$baseUrl/api/ops/alerts" -Headers $opsHeaders
    if ($opsMetrics.runtime -and $opsAlerts.alerts -ne $null) {
      Add-StepResult -Results $results -Step "ops_endpoints" -Ok $true -Detail "metrics+alerts reachable" -DurationMs $sw.Elapsed.TotalMilliseconds
    } else {
      Add-StepResult -Results $results -Step "ops_endpoints" -Ok $false -Detail "unexpected ops payload" -DurationMs $sw.Elapsed.TotalMilliseconds
    }
  } catch {
    Add-StepResult -Results $results -Step "ops_endpoints" -Ok $false -Detail $_.Exception.Message -DurationMs $sw.Elapsed.TotalMilliseconds
  }
} else {
  Add-StepResult -Results $results -Step "ops_endpoints" -Ok $true -Detail "skipped (Ops token not provided)" -DurationMs $sw.Elapsed.TotalMilliseconds
}
$sw.Stop()

$endAt = [DateTimeOffset]::UtcNow
$failedSteps = @($results | Where-Object { -not $_.ok } | ForEach-Object { $_.step })
$summary = [pscustomobject]@{
  started_at_utc = $startAt.ToString("o")
  finished_at_utc = $endAt.ToString("o")
  duration_seconds = [Math]::Round(($endAt - $startAt).TotalSeconds, 2)
  fastapi_base_url = $baseUrl
  overall_ok = ($failedSteps.Count -eq 0)
  failed_steps = $failedSteps
  results = $results
}

if (-not [string]::IsNullOrWhiteSpace($OutputFile)) {
  $directory = Split-Path -Parent $OutputFile
  if (-not [string]::IsNullOrWhiteSpace($directory) -and -not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
  }
  $summary | ConvertTo-Json -Depth 20 | Out-File -FilePath $OutputFile -Encoding utf8
  Write-Host "Smoke report written to $OutputFile" -ForegroundColor Cyan
}

if ($summary.overall_ok) {
  Write-Host "Core journey smoke: PASS" -ForegroundColor Green
  exit 0
}

Write-Host "Core journey smoke: FAIL ($($failedSteps -join ', '))" -ForegroundColor Red
exit 1
