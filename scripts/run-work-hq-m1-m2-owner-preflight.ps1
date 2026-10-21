# M1+M2 Owner PowerShell HANDOFF: explicit READ ONLY preflight.
# Must run inside a separate, clean preview checkout under %TEMP%.
# Installs local npm dependencies and builds locally; provider interaction
# is ONLY authenticated Cloudflare metadata GETs and public health GET.
# NO git push/merge, Worker upload/deploy, D1 migration, R2, Shopify writes,
# quote publish, customer message, paid tier, or spent-receipt replay.
param([switch]$ReadOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $ReadOnly) { throw 'STOP: Explicit -ReadOnly required.' }

$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tempPrefix = [System.IO.Path]::GetFullPath($env:TEMP).TrimEnd([char]'\') + '\'
if (-not $root.StartsWith($tempPrefix,[System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'STOP: Run only in a separate TEMP preview checkout. Original JILL-WEB is protected.'
}
$expected = 'jill/m1-work-queue-preview-20261021'
$branch = (& git -C $root branch --show-current)
if ($LASTEXITCODE -ne 0 -or $branch.Trim() -ne $expected) {
  throw 'STOP: Wrong source branch.'
}
$dirty = (& git -C $root status --porcelain --untracked-files=no)
if ($LASTEXITCODE -ne 0 -or $dirty) {
  throw 'STOP: Preview checkout has tracked changes.'
}
Push-Location $root
try {
  $env:WRANGLER_SEND_METRICS = 'false'
  $env:CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV = 'false'
  & node scripts/test-work-hq-m1-m2-source-edition.mjs
  if ($LASTEXITCODE -ne 0) { throw 'STOP: M1/M2 locked source proof failed.' }
  & node scripts/test-work-hq-m1-m2-owner-inspect.mjs
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Read-only runtime guard tests failed.' }

  # Only local dependencies and compilation, no store activation.
  & npm.cmd install --prefix services/jill-order-desk/app-home --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Local dependencies unavailable.' }
  & npm.cmd run typecheck --prefix services/jill-order-desk/app-home
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Embedded application typecheck failed.' }
  & npm.cmd run build --prefix services/jill-order-desk/app-home
  if ($LASTEXITCODE -ne 0) { throw 'STOP: Embedded application build failed.' }

  Push-Location (Join-Path $root 'services/jill-order-desk/app-home')
  try {
    & node scripts/test-workerd-m1m2-compiled-local.mjs
    if ($LASTEXITCODE -ne 0) { throw 'STOP: Compiled Worker local safety check failed.' }
  } finally { Pop-Location }

  # The only remote reads are through the reviewed M1/M2 inspector.
  & node scripts/inspect-work-hq-m1-m2-owner.mjs --owner
  if ($LASTEXITCODE -ne 0) {
    throw 'HOLD: Current WORK allocation/health/permissions not independently verified. No deployment.'
  }
  Write-Output 'M1_M2_SOURCE_AND_WORK_RUNTIME_PREFLIGHT_PASSED'
  Write-Output 'HOLD: This is not activation authorization. Real Owner and My JILL A/B QA, Shopify totals, rollback and approval remain required.'
} finally {
  Pop-Location
}
