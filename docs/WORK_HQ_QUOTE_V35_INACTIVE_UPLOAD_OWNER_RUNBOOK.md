# JILL HQ WORK quote v35 — owner-approved inactive upload

## Approval and boundaries

Owner explicitly approved **uploading one new WORK Worker version for
inspection only** on October 17, 2026. This approval **does not**
authorize serving any production or WORK customer traffic from it.

Current known WORK Worker is `jill-order-desk-canary-work`,
v34 `4973b74d-d479-41da-897c-e36129303279`, 100% active.
Rollback v33 `204d66c3-3296-430d-8288-39c354876600` remains untouched.

Owner installed and verified two quote draft tables in WORK D1
`jill-order-desk-work` (`3f17c186-c794-4e00-8f20-017191373a19`),
with an independently checked local private backup.

## Executed only on Owner Windows — single guarded command

Run after syncing `jill/rewards-work`. The script checks a clean
synced branch, active v34 and its four existing secret bindings,
exact WORK D1 tables, current quote security/math tests and a clean
React Router app build; it then uploads one inactive version.

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes present' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:hq:quote:v35:upload-inactive
if ($LASTEXITCODE -ne 0) { throw 'STOP: Upload/inspection incomplete; do not rerun' }
```

The isolated Owner command is `scripts/stage-work-hq-quote-inactive-v35.mjs`.
It invokes **only** `wrangler versions upload` for the WORK Worker,
not `wrangler deploy`, `wrangler versions deploy`, `triggers deploy`,
or an automatic traffic rollout.

Existing secrets are preserved by Wrangler when not specified
in `--secrets-file`; none are read from or written to the private
vault. The generated temporary manifest adds ONLY the WORK
`JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED=true` flag, in addition to the
existing known OAuth, detail and merchant write flags. It does not
add R2, KV, image bindings, queues, routes or any paid service.

The inactive flag intentionally makes the **candidate** ready for
a future separately approved release. It does not activate that
feature on the currently deployed v34.

## Post-upload checks

Read-only Cloudflare `versions list`, `versions view` and
`deployments status` check that:

- The newly uploaded version is uniquely identified by the exact
  Git commit marker and is the latest WORK version.
- All original v34 Worker bindings, D1 UUID, four secret names,
  OAuth, merchant writes, detail and bootstrap policy are preserved.
- Only one additional plain-text flag exists, for quote drafts.
- The Worker entrypoint, other runtime settings and static asset
  routing semantics have not unexpectedly changed. Compiled code
  etag must differ, because the quote feature was added.
- **v34 is still 100% active**, and no route or paid service
  was changed.

Never print `versions view` JSON; it may include configuration and
other sensitive metadata. The command prints only validated
version IDs and safe short status lines.

If the upload command times out or the post-upload readback fails,
an inactive version **may already exist**. **Do not retry** the upload
without a separate read-only inspection. Do not try to roll back
traffic, since the upload was not authorized to change traffic.

## Next decision (separate permission required)

After owner-provided inactive upload and readback PASS, independently
inspect bundled source / asset fingerprint and current remote WORK
configuration before requesting explicit authorization for a WORK-only
traffic switch. No customer Custom Order records should be mutated
for testing. The two historical existing requests are real customer
records and must not be used as disposable QA targets.

Separately approve customer quote notification, My JILL approval,
Shopify invoices/payments, any R2 storage and any possible billing
change. LIVE and KEEP are never targets of this script.
