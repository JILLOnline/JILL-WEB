# JILL HQ — approved WORK-only quote draft D1 migration

Approval: October 17, 2026. The Owner approved **only** the WORK quote
database schema, **conditional** on a read-only backup and successful
Cloudflare Workers Free usage/cost review. **This approval is not a
Worker deployment, a Shopify order, customer message, LIVE/KEEP edit,
paid upgrade or authorization for R2.**

## Scope

- Exact account database: `jill-order-desk-work`
- Exact D1 database UUID: `3f17c186-c794-4e00-8f20-017191373a19`
- WORK canary Worker must still have *unique 100% active* v34
  `4973b74d-d479-41da-897c-e36129303279`.
- SQL must be the committed, previously locally tested proposal
  `services/jill-order-desk/quote-proposals/0008_work_quote_drafts.sql`.
- Exactly **two empty tables**: `jill_work_quote_drafts` and
  `jill_work_quote_draft_operations`. No changes to the core tables,
  migrations ledger, Shopify sessions, customer payloads or orders.
- The SQL remains outside `migrations/`; this explicit owner-approved
  manual migration is not registered with Wrangler's migrations ledger.
  Future migration plans must account for this already-installed schema.

## Free-tier cost gate — must be checked by Owner

Cloudflare's currently published D1 Workers Free allowance is **5
million rows read/day**, **100,000 rows written/day**, and **5 GB total
database storage across the account**. Free-tier D1 requests fail when
daily query limits are exceeded; paid Workers may generate overage
charges. See <https://developers.cloudflare.com/d1/platform/pricing/>.
The operator script imposes additional conservative limits of **32
MiB current DB size** and **64 MiB full export size**, but it **cannot**
measure account-wide remaining rows or billing-tier state.

Before exporting any customer/session data, the Owner must inspect
**Cloudflare Dashboard → Workers & Pages → Plans/Billing** and
**D1 → Metrics → Row Metrics**, and confirm:

1. The account is on **Workers Free**, not Workers Paid.
2. Existing D1 storage is comfortably below the shared 5 GB Free cap.
3. Today's row read/write usage is comfortably below daily Free caps,
   allowing for the backup and two empty table creations.
4. No paid plan upgrade or additional product activation is required.
5. No other operator is simultaneously migrating WORK D1.

If any billing/usage fact is unavailable or ambiguous, **STOP** and
share only a redacted billing/usage screenshot, never credentials or
customer records. Passing `--inspect` **alone** is not proof of these
billing facts.

## STEP 1 — Windows read-only inspection (zero schema writes)

Run from `C:\Users\itzen\JILL-WEB` after syncing:

```powershell
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') {
    throw 'STOP: Wrong branch'
}
if (git status --porcelain --untracked-files=no) {
    throw 'STOP: Tracked changes require review'
}
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }

npm.cmd run test:work-hq-quote-d1-owner-migration
if ($LASTEXITCODE -ne 0) { throw 'STOP: Migration guards failed' }

npm.cmd run work:hq:quote:d1:inspect
if ($LASTEXITCODE -ne 0) { throw 'STOP: WORK database preflight failed' }
```

This queries only Worker version, D1 account/database metadata, and
JILL-prefixed schema names (not customer rows). It refuses unknown
schema, wrong UUID, incomplete quote tables, oversized database or
unrecognized SQL. The current WORK inbox index can be present or
absent; its status is reported, never modified here.

## STEP 2 — Full read-only private backup, after Free-tier review

The SQL export may contain **Shopify session tokens, customer details
and other confidential data**. Keep it strictly on the Owner's trusted
Windows machine. Never attach it to GitHub, Cloudflare storage, chat,
email or cloud sync. The script uses the private user
`%LOCALAPPDATA%\JILL-WEB\private-d1-backups\work-quote` directory,
outside the repository; protect this directory with the Owner's
Windows user-only access rights.

```powershell
npm.cmd run work:hq:quote:d1:backup
if ($LASTEXITCODE -ne 0) { throw 'STOP: Private D1 backup failed' }
```

The backup operation **does not modify remote D1**. It refuses any
existing backup/manifest (never overwrites), exports complete remote
schema and data, bounds its size, computes the SHA-256 without printing
contents, and writes a timestamped manifest with the migration source
hash, account/database UUID, exact WORK HEAD and exported digest.
Backup and manifest are held locally and must remain available for
subsequent hash verification. `--backup` is an explicit declaration
that the Owner **already checked Workers Free and D1 usage**.

## STEP 3 — single approved migration, only after backup confirmation

```powershell
npm.cmd run work:hq:quote:d1:apply
if ($LASTEXITCODE -ne 0) {
    throw 'STOP: Do not rerun schema apply; inspect the remote table state'
}
```

`--apply` rechecks the source/target/Worker, verifies a private backup
under two hours old with matching SHA-256, and requires an unchanged
empty quote-table schema state. Only then does it send the exact
committed two-table SQL file via Wrangler `d1 execute --remote --file`.
After the request, it independently checks both new table names and
that both are empty.

**If an error or timeout occurs during apply, DO NOT retry**. D1 may
have committed one or both statements. Run only `--verify` and
reconcile the actual state. No automatic rollback is attempted
because dropping unexpected data is unacceptable.

## STEP 4 — independent read-only verification

```powershell
npm.cmd run work:hq:quote:d1:verify
if ($LASTEXITCODE -ne 0) {
    throw 'STOP: WORK quote D1 post-migration unverified'
}
```

Both new tables must exist and be empty, core merchant tables must
still be present, and the Worker must remain v34. Save the **sanitized
PASS/HOLD lines only** (never the SQL export or Cloudflare credentials)
for the project certification log.

## What this migration does NOT do

Quote Save/Reload UI remains **hard OFF** in Worker ingress and app
routes. No quote is saved by this migration. A later, **separately
approved** WORK app version/traffic switch and customer-facing
workflow are needed. LIVE, KEEP, real Shopify payments, account
rewards, media R2 and any infrastructure billing remain unchanged.

**Owner Windows results not yet provided:** this documentation and
GitHub CI cannot certify live Cloudflare billing, a full private
backup, or real remote quote schema changes on their own.

## 2026-10-17 correction — Wrangler size field and fail-fast execution

The Owner's real WORK diagnostic proved the database UUID/name match,
but Wrangler JSON supplies **database_size**, not **file_size**.
The original inspect, backup, apply and verify all stopped before any
remote schema write. Free-tier review and migration consent were
not confirmed; subsequent green PowerShell Write-Host messages did
**not** demonstrate backup or migration success.

The corrected parser accepts strict Wrangler database_size or REST
file_size, preserving exact identity and conservative size bounds.
Inspect now prints database-only 24h D1 metrics. These are not
account-wide usage or billing proof; Dashboard verification of the
**Workers Free plan and all D1 usage** remains mandatory.

### ONE command for safe read-only inspection

```powershell
cd C:\Users\itzen\JILL-WEB
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-work-quote-d1-owner.ps1 -Mode Inspect
```

### ONE command for approved migration (only after cost review)

```powershell
cd C:\Users\itzen\JILL-WEB
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\run-work-quote-d1-owner.ps1 -Mode Migrate
```

The one-shot Windows script performs clean Git fast-forward, offline
guard tests, read-only inspection, genuine Free-tier/usage confirmation,
private full local backup, separate migration confirmation, one
two-table schema apply and read-only verification **in that order**.
Any failed subprocess immediately stops the script with exit 1;
the next step cannot run and no misleading PASS is printed.

Do not enter FREE VERIFIED unless billing/usage were actually
confirmed in Cloudflare Dashboard. Never retry a possibly committed
schema change. The only release affected is the WORK D1 schema;
the deployed Worker and LIVE/KEEP remain unchanged.

Windows CI checks PowerShell script syntax **without executing**
any Cloudflare command or migration.
