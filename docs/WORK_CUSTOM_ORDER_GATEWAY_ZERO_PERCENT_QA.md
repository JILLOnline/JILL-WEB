# JILL WORK Custom Order gateway — 100% original / 0% repair

## Narrow authorization

On October 17, 2026 Owner approved ONE **WORK-only**
Cloudflare deployment retaining original Custom Order gateway
at 100% and adding the already uploaded repaired gateway at
0%, with permission to restore 100% original on failed verification.

- Cloudflare Worker: `jill-work-custom-orders-qa` (not JILL HQ).
- Original gateway: `408bdf7c-eb20-4b6e-97dd-3d3b293c6120` @100%.
- Repaired candidate: `225cdbb4-46f5-492e-801d-6726bea2703e` @0%.
- Candidate uploaded from Git commit:
  `2263c1ecf131127961ebc2612274ebb830caceee`.
- Both versions preserve the same Worker code/limiter structure;
  only the WORK Google QA signing secret and upstream URL were staged.

The prior active gateway and the JILL HQ Worker
`jill-order-desk-canary-work` are **separate deployments**.
The existing JILL HQ allocation v34@100% / v35@0% is unchanged.

## Owner Windows command — ONE TIME ONLY

```powershell
cd C:\Users\itzen\JILL-WEB
$ErrorActionPreference = 'Stop'

if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes present' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:custom-order:gateway:deploy-repair-zero
if ($LASTEXITCODE -ne 0) { throw 'STOP: Do not retry. Review deployment/rollback output.' }
```

The Owner command checks synced WORK Git, exact pinned Worker
code and TOML, all active/candidate gateway secret **binding
metadata** and existing Durable Object limiter/runtime, the
known signed-source upload marker, original Cloudflare 100%
allocation, and the absence of concurrent deployments.

Because the WORK Custom Order gateway uses a separate hostname,
the script performs a **pre-deployment anonymous health GET**
requiring HTTP 200 and the exact
`WORK_CUSTOM_ORDERS_QA` environment response. The hostname
is derived from the known WORK account workers.dev subdomain,
not guessed at deployment time. If the preflight fails,
**no deployment is attempted**.

The command dry-runs the exact documented split syntax:

```text
wrangler versions deploy 408bdf7c-eb20-4b6e-97dd-3d3b293c6120@100% 225cdbb4-46f5-492e-801d-6726bea2703e@0%
```

After independently confirming the baseline again, it atomically
reserves one-use authorization in an Owner-local private receipt
under `%LOCALAPPDATA%\JILL-WEB\private-release-receipts`,
then performs **one** Cloudflare `versions deploy` call.
It never uploads a Worker version or changes secrets, Cloudflare
plan, D1, R2, Shopify, Google Apps Script or LIVE/KEEP.

## Limited read-only functional smoke

Once Cloudflare confirms the 100/0 deployment:

1. GET anonymous `/healthz` on the ordinary gateway;
   require HTTP 200 with exact WORK environment JSON.
2. Repeat GET `/healthz` with the exact Cloudflare
   `Cloudflare-Workers-Version-Overrides` header pinned to
   the repaired 0% version; expect the same 200.
3. POST an **EMPTY** request (NO body, NO JWT, NO customer ID,
   NO session cookie) to `/jill-custom-order-account` pinned
   to 0% repaired version. Require HTTP 401 and the precise
   `unauthenticated_account` response. This is only an
   authentication-denial probe, not an order submission.
4. Recheck Cloudflare deployments JSON and original 100% status.

**Limits of evidence:** Because original and repaired Workers
share the same application code and response logic, the HTTP
200/401 responses alone **CANNOT establish** that the version
override was actually honored. Cloudflare documentation explicitly
warns that an unapplied override falls back to the regular
traffic split. No version metadata binding or paid Logpush is
enabled. Therefore a 0% PASS proves exact Cloudflare allocation
and safe anonymous behavior, **not** repaired secret equality,
Google signature acceptance through this Worker, or functional
Custom Order submission. Do not report the latter as verified.

Unlike a Version URL, 0% override testing is available for
Workers with Durable Objects. The existing Durable Object code
was preserved by source and binding checks; no migration or
new class is authorized. Worker deployment can still cause
runtime lifecycle effects and is not treated as risk-free.

## Failure and rollback

On any failure after the deployment request, the operator
attempts the Owner-authorized rollback to the original 100%
**only if** Cloudflare confirms the current split still matches
the known original 100% / repaired 0% versions.
It must NOT overwrite an unknown or concurrently changed
release. A failed Cloudflare call might have committed;
even after safe rollback the one-use receipt remains. NEVER
run this command twice. Read-only investigation is the next step.

## Not approved

No repaired gateway promotion to nonzero normal traffic,
Shopify Custom Order submission/resubmission, signed receipt
data write, customer-account session testing, customer or
merchant email, Shopify Draft Orders or payment, R2,
LIVE/KEEP or paid cloud capacity. Further action needs
separate Owner approval.

Official docs:

https://developers.cloudflare.com/workers/wrangler/commands/workers/
https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/
https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/
