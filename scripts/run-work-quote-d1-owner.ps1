#Requires -Version 5.1
<#
JILL HQ WORK-only quote D1 migration orchestrator.
Inspect (default): read-only target/schema/cost metrics.
Migrate: inspect -> explicit Workers Free usage confirmation ->
private local backup -> explicit migration confirmation -> ONE apply ->
independent read-only verification.
Never run this as part of CI or a scheduled task. Do not paste backup SQL.
#>
[CmdletBinding()]
param(
    [ValidateSet('Inspect', 'Migrate')]
    [string] $Mode = 'Inspect'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

function Invoke-Required {
    param([Parameter(Mandatory=$true)] [string] $ScriptName)
    Write-Host ("WORK quote migration step: " + $ScriptName) -ForegroundColor Cyan
    & npm.cmd run $ScriptName
    if ($LASTEXITCODE -ne 0) {
        throw ("STOP: " + $ScriptName + " failed (exit " + $LASTEXITCODE + "). No further steps are authorized.")
    }
}
function Invoke-Git {
    param([string[]] $GitArgs)
    & git -C $root @GitArgs | Out-Host
    if ($LASTEXITCODE -ne 0) { throw 'STOP: Git verification/sync failed' }
}
try {
    $branch = (& git -C $root branch --show-current)
    if ($LASTEXITCODE -ne 0 -or $branch.Trim() -cne 'jill/rewards-work') {
        throw 'STOP: Not on jill/rewards-work'
    }
    $changes = (& git -C $root status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0 -or $changes) {
        throw 'STOP: Tracked WORK changes need review'
    }

    Push-Location $root
    try {
        Invoke-Git -GitArgs @('pull','--ff-only','origin','jill/rewards-work')
        Invoke-Required 'test:work-hq-quote-d1-owner-migration'
        Invoke-Required 'work:hq:quote:d1:inspect'

        if ($Mode -ceq 'Inspect') {
            Write-Host 'PASS: Read-only WORK database inspection. No backup or migration was attempted.' -ForegroundColor Green
            return
        }

        Write-Host ''
        Write-Host 'MANDATORY COST REVIEW: In Cloudflare Dashboard confirm Workers Free plan and D1 metrics for ALL account databases.' -ForegroundColor Yellow
        Write-Host 'Check total storage, rows read/written and remaining daily free allowance. DB-only 24h stats are NOT account-wide proof.' -ForegroundColor Yellow
        Write-Host 'Do not enter confirmation unless you personally checked these facts. No paid upgrades authorized.' -ForegroundColor Yellow
        $free = Read-Host 'After genuine billing and usage review, type FREE VERIFIED'
        if ($free -cne 'FREE VERIFIED') {
            throw 'STOP: Workers Free and usage were not confirmed. No export or migration.'
        }

        Invoke-Required 'work:hq:quote:d1:backup'

        Write-Host ''
        Write-Host 'PRIVATE BACKUP COMPLETED BY TOOL. Keep it on this PC; it contains sensitive D1 rows. Never paste or upload the SQL.' -ForegroundColor Yellow
        $approval = Read-Host 'Type MIGRATE WORK QUOTES to apply exactly the two approved WORK-only tables'
        if ($approval -cne 'MIGRATE WORK QUOTES') {
            throw 'STOP: Migration not confirmed. Private backup remains on local PC.'
        }

        # A single owner-authorized invocation: no automatic retry after
        # Wrangler errors/timeouts or uncertain commit outcomes.
        Invoke-Required 'work:hq:quote:d1:apply'
        Invoke-Required 'work:hq:quote:d1:verify'
        Write-Host 'PASS: WORK quote schema independently verified (two empty tables). No Worker deployment.' -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host ('STOP WORK QUOTE D1: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No further command in this workflow will run. Do not manually continue past a failure or retry a possibly committed apply.' -ForegroundColor Yellow
    exit 1
}
