param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$failed = @()

function Invoke-Check {
  param(
    [string]$Name,
    [string]$Directory,
    [scriptblock]$Command
  )

  Write-Host "`n==> $Name" -ForegroundColor Cyan
  Push-Location (Join-Path $root $Directory)
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) {
      throw "exit code $LASTEXITCODE"
    }
    Write-Host "PASS $Name" -ForegroundColor Green
  } catch {
    Write-Host "FAIL $Name : $($_.Exception.Message)" -ForegroundColor Red
    $script:failed += $Name
  } finally {
    Pop-Location
  }
}

Push-Location $root
try {
  Write-Host '==> Docker PostgreSQL health' -ForegroundColor Cyan
  $health = (& docker inspect --format '{{.State.Health.Status}}' tocoffee-postgres 2>$null)
  if ($LASTEXITCODE -ne 0 -or "$health".Trim() -ne 'healthy') {
    Write-Host "FAIL Docker PostgreSQL health : $health" -ForegroundColor Red
    $failed += 'Docker PostgreSQL health'
  } else {
    Write-Host 'PASS Docker PostgreSQL health' -ForegroundColor Green
  }

  Invoke-Check 'API build' 'apps/api' { npm run build }
  Invoke-Check 'API lint' 'apps/api' { npm run lint }
  Invoke-Check 'API tests' 'apps/api' { npm test }
  Invoke-Check 'API e2e' 'apps/api' { npm run test:e2e }
  Invoke-Check 'Admin build' 'apps/admin' { npm run build }
  Invoke-Check 'Passenger type-check' 'apps/passenger' { npm run type-check }

  Write-Host "`n==> git diff --check" -ForegroundColor Cyan
  & git diff --check
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'FAIL git diff --check' -ForegroundColor Red
    $failed += 'git diff --check'
  } else {
    Write-Host 'PASS git diff --check' -ForegroundColor Green
  }

  Write-Host "`n==> git status --short" -ForegroundColor Cyan
  & git status --short
} finally {
  Pop-Location
}

if ($failed.Count -gt 0) {
  Write-Host "`n$($failed.Count) check(s) failed: $($failed -join ', ')" -ForegroundColor Red
  exit 1
}

Write-Host "`nAll checks passed." -ForegroundColor Green
