# JILL HQ WORK — Migration 0003 release readiness (NOT an approval)

**State:** Source-only release plan. No remote D1 migration, backup restore,
Cloudflare Worker switch, Shopify/Google mutation, secret provisioning, image
preview, LIVE/KEEP/Rewards change or migration history edit.

## Verified owner read-only baseline

WORK D1 account and active Worker were independently verified:

- Worker: `jill-order-desk-canary-work`, active v34
  `4973b74d-d479-41da-897c-e36129303279`, 100% traffic.
- WORK database: `jill-order-desk-work`,
  `3f17c186-c794-4e00-8f20-017191373a19`.
- Existing `jill_*` tables: `jill_merchant_authority`,
  `jill_merchant_grants`, `jill_merchant_audit`,
  `jill_shopify_sessions`.
- D1 migration ledger: **two** recognized records (0001 and 0002),
  no 0003 record.
- `jill_work_verified_inbox_index`: **absent**.
- `jill_work_private_media_registry`: **absent**.
- Read-only Wrangler response had `rows_written: 0`, `changed_db: false`.
- Google QA @9 signed Owner exact detail and @7 inbox/status isolation
  remain independently certified. The authenticated Owner UI displayed
  exact details in Shopify WORK after v34 activation.

This evidence is time-scoped. **Rerun the read-only preflight immediately
before any explicitly authorized schema change.** A previous PASS is not a
substitute for current state.

## 0003 is independent of media registry

The ONLY intended 0003 schema operation:
- `CREATE TABLE IF NOT EXISTS jill_work_verified_inbox_index`, with a
  WORK-only primary key and constraints preventing wrong-shop/negative or
  invalid cache metadata.
- `INSERT ... ON CONFLICT(shop) DO NOTHING` of one initially empty
  cache metadata row (`generation=0`, null verified payload, zero expiry).
- No customer data, file reference, email, external media provider identity
  or private key in the seed.

The feature flag `JILL_WORK_HQ_FAST_INBOX_ENABLED` is **absent** from
the existing active WORK Worker version; applying a table alone must
**not** enable shared D1 caching or change the existing Google-backed inbox.
Enabling that flag is an independent reviewed Worker release and is
**NOT** part of migration 0003.

Do NOT combine 0003 with 0004: the latter remains a **non-executable
proposal** under `migration-plans/`, absent from active Wrangler migrations.

## Offline rehearsal

`npm.cmd run test:work-hq-inbox-0003-readiness`

This executes 0001 and 0002 and their synthetic example records in
an **in-memory SQLite** database with a simulated ledger listing 0001
and 0002, then executes ONLY the unmodified 0003 SQL twice to check
idempotence. It validates the five-table result, one empty WORK seed,
CHECK/PK constraints and unchanged Owner/session data. The ledger is
**synthetic**, and local SQL execution is not a simulation of Wrangler
recording migration history.

This test does NOT contact a real database, install a secret, or apply a
Cloudflare migration.

## Required hold points before *any* real migration

1. Reconfirm `jill/rewards-work` is clean, current and CI green.
   Read-only `npm.cmd run work:hq:media:d1:inspect` must still confirm
   active v34, exact WORK D1 ID, four core tables, absent 0003 table and
   only 0001/0002 ledger entries. Abort on concurrent updates or drift.
2. Independently verify the configured Wrangler migration directory is
   precisely `services/jill-order-desk/migrations` with files
   0001/0002/0003. Do not include 0004 or unreviewed SQL.
3. Establish recoverability for the actual WORK database: check
   Cloudflare D1 Time Travel availability and obtain a **pre-change
   bookmark** or equivalent audited recovery anchor, under owner control.
   Time Travel restoration is a **whole-database** recovery operation
   that can also undo other committed writes since that bookmark. It
   must never be invoked automatically by a migration script.
4. Establish an owner-approved low-write window, the exact command,
   explicit typed confirmation and operator who can inspect both
   Cloudflare and Shopify WORK if the outcome is ambiguous. Confirm no
   unknown extra migrations or database identity ambiguity.
5. Only after a separate owner request/approval, build a deployment
   script that confirms the above gates **again**, performs 0003 exactly
   once on the named WORK D1, then independently verifies the ledger
   shows 0001/0002/0003, the exact schema + empty seed, and v34 remains
   active. If anything fails after a write, STOP and inspect the actual
   DB state before retry. Never blindly rerun or auto-drop a table.

## Recovery principles

Cloudflare documents D1 Time Travel for production-storage databases;
it provides a point-in-time restore mechanism, but restoration can
reverse unrelated activity. Refer to the official documentation:

- https://developers.cloudflare.com/d1/reference/time-travel/
- https://developers.cloudflare.com/d1/wrangler-commands/

Review backend storage version and currently supported recovery methods
before treating this mechanism as available for this exact database.
An automatic `DROP TABLE` or direct edit of `d1_migrations` is NOT a
valid generalized rollback. Reverting the Cloudflare Worker also would
not revert a D1 schema change. A schema recovery is a distinct,
owner-approved, audited operation.

## Current operator action

Run the **offline rehearsal only** after syncing WORK Git. Share the
result. There is deliberately NO release/apply command in this PR.
After it passes, review the pre-change recovery anchor and request
explicit approval for a later 0003-only D1 action. **0004/media previews
are still blocked.**

## Phase 2 — Recovery capability inspection only (no bookmark export)

Cloudflare documents two separate read-only Wrangler operations:
`d1 info <database> --json` reports database backend information,
and `d1 time-travel info <database> --json` retrieves a current
bookmark if supported. The `d1 time-travel restore` operation is
**destructive** and is never exposed by this script.

`npm.cmd run test:work-hq-0003-recovery-readiness` is an offline
synthetic regression. After syncing the certified WORK branch,
`npm.cmd run work:hq:inbox:0003:recovery:inspect` will:

- Re-run the proven read-only preflight and require active v34,
  exact WORK UUID, *four* existing JILL tables and a two-record
  migration ledger with 0003 not recorded. Newer or ambiguous state
  is an automatic stop.
- Verify `jill-order-desk-work` uses D1 backend
  `version: production`, which supports Time Travel.
- Check that a current Time Travel bookmark can be retrieved.
  **The bookmark itself is never printed, persisted or exported.**
- Re-run the WORK read-only preflight to detect a concurrent change
  before printing a success receipt.

This is NOT a backup. A Time Travel bookmark is a short-lived reference
to past database state. Cloudflare's Time Travel documentation specifies
a retention window based on plan. To actually prepare for a separately
approved migration, the owner must record a **fresh pre-change bookmark
locally under owner control**, privately and immediately before changing
the database. Never put it in a Git commit, CI log, chat or public file.
Even a valid bookmark does not make a restore safe: restoring can erase
unrelated writes since that point and should require an independent
owner-reviewed recovery plan.

Current official sources:
- https://developers.cloudflare.com/d1/wrangler-commands/
- https://developers.cloudflare.com/d1/reference/time-travel/

**Still prohibited:** D1 migrations apply, Time Travel restore,
database export containing customer/session records, Cloudflare Worker
release, activating the fast-inbox feature, adding the media registry
or provisioning a new secret. This phase checks capability only.
