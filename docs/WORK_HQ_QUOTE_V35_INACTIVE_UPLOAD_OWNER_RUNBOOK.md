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

## Owner Windows upload completed successfully — October 17, 2026

Owner-provided Windows log certifies source commit
`4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b`.
The one-shot upload reported **inactive candidate**
`dbc6341f-de7f-41de-8e97-6bf971201eeb`.
The upload tool independently confirmed that WORK v34
`4973b74d-d479-41da-897c-e36129303279` stayed 100% active,
the original four WORK secrets, D1 binding and other existing
bindings were preserved, and only the quote feature flag was
added to the inactive candidate. Owner's local quote security
tests, typecheck and build passed. **No traffic switch occurred.**

## Independent read-only inspection — do not upload again

After the owner syncs this inspection-only documentation and script,
run from Windows:

```powershell
cd C:\Users\itzen\JILL-WEB
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:hq:quote:v35:inspect-inactive
if ($LASTEXITCODE -ne 0) { throw 'STOP: Read-only audit failed' }
```

This script **does not upload or deploy**. It checks the exact active
v34 100% status both before and after inspection, confirms inactive
v35 has the exact source commit marker, checks rollback v33 still
exists, audits WORK v34/v35 version bindings and runtime settings,
requires the unique latest candidate, and checks that the two
WORK D1 quote tables are still present via metadata-only SELECT.
It prints no secrets, customer details, raw versions JSON, or
private backup contents.

**Evidence boundary:** Cloudflare version metadata, etags and an
upload source marker do not prove that every remote script byte or
inactive static asset matches the local build. We record this
as an explicit HOLD, not an invented certification. The candidate
has not been exercised via authenticated WORK HTTP traffic.

**Release approval remains separate.** Do not invoke Wrangler
`versions deploy`, shift traffic, send customer messages, invoice,
or modify LIVE, KEEP or paid infrastructure based only on this audit.

## WORK v35 HTTP inspection without changing traffic

An independent source review found an intentional Worker host pin:
`workers/app.ts` returns HTTP **421 wrong_host** if an incoming
request's origin is not the canonical
`jill-order-desk-canary-work.jill-work-custom-orders.workers.dev`.
A Cloudflare Version URL has a different hostname, so it **cannot**
exercise authenticated quote Save/Reload. This is the correct
OAuth-origin safety behavior, not an app defect.

Cloudflare documents Version URLs as public when enabled. The
optional diagnostic below sends exactly two **anonymous GETs**:
one to v35's version URL `/healthz` expecting 421 wrong_host, and
one to the current canonical WORK `/app/requests/quote-draft`
expecting HTTP 503 quote_drafts_not_enabled from v34. It never
follows redirects or sends cookies, authorization, request IDs,
POST data or secrets. If Version URLs are disabled/inaccessible,
the diagnostic stops; **do not enable public Version URLs**
without separate security/cost review.

```powershell
cd C:\Users\itzen\JILL-WEB
npm.cmd run work:hq:quote:v35:preview-readonly
if ($LASTEXITCODE -ne 0) { throw 'STOP: v35 anonymous preview unavailable or changed' }
```

The result is only a limited hostname/anonymous denial check,
NOT proof of byte-for-byte remote script/asset parity and NOT
an authenticated quote workflow test.

## Next conditional rollout plan — NOT YET APPROVED

To test v35's *actual authenticated WORK hostname* before
serving normal traffic, Cloudflare's version-override mechanism
requires including the candidate in a deployment. A controlled
deployment allocation of **100% v34 and 0% v35** would allow
the Owner to send explicitly version-pinned requests on the
canonical WORK host while keeping ordinary traffic on v34.
**This is still a deployment configuration change** and is
not authorized by the prior inactive-upload permission.

The exact planned versions are:

- 100% v34: `4973b74d-d479-41da-897c-e36129303279`.
- 0% v35: `dbc6341f-de7f-41de-8e97-6bf971201eeb`.
- Existing v33 rollback retained: `204d66c3-3296-430d-8288-39c354876600`.

After **separate explicit Owner authorization**, a single guarded
WORK-only rollout would check the version IDs and bindings again,
require 0% v35 plus 100% v34, read back allocation, send
only unauthenticated read-only version-override GET requests and
verify that v35 security behavior differs from locked v34.
Crucially, Cloudflare may ignore the override if not applied,
so tests must distinguish a real v35 response from v34 fallback;
a failed/ambiguous result is a STOP, not a traffic promotion.

A rollback to v34 is a **new deployment operation**; explicit
permission to recover 100% v34 must accompany rollout approval.
0% v35 can be manually targeted with an override header by
any capable requester, so treating it as totally inaccessible
would be incorrect. Shopify Owner, signed Google detail,
same-Origin and D1 checks remain mandatory.

Only after a separate 0% QA and another traffic permission
should any ordinary WORK traffic be sent to v35.
No LIVE/KEEP, real customer request mutation, customer messages,
payments, R2 or paid capacity is approved by this runbook.
