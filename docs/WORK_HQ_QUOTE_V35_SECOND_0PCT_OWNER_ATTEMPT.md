# JILL HQ — Second approved WORK v35 0% deployment, one-use only

## Fresh authorization, October 17 2026

After the first **v34 100% / v35 0%** deployment was created and
correctly rolled back, Owner independently measured canonical v34:

- `GET /healthz`: **200 JSON**, valid WORK D1 response.
- `GET /app/requests/quote-draft`: **410 HTML**, no redirect.

The original smoke wrongly expected new-v35 503 JSON from legacy
v34. PR #143 updated the test contract, while permanently disabling
the previous `work:hq:quote:v35:deploy-zero` operator.

Owner then **explicitly approved one NEW WORK-only 0% v35 attempt**
with v34 remaining 100%, and the same bounded v34 rollback on failure.
Neither the first approval nor this second approval authorizes
promoting v35 to nonzero traffic, reading/mutating real customer
requests, activating R2, payment flows, LIVE/KEEP, or paid services.

## Pinned identity

- WORK Worker: `jill-order-desk-canary-work`
- v34 active: `4973b74d-d479-41da-897c-e36129303279` @ 100%
- v35 candidate: `dbc6341f-de7f-41de-8e97-6bf971201eeb` @ 0%
- v33 fallback remains: `204d66c3-3296-430d-8288-39c354876600`
- v35 uploaded source: `4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b`
- WORK D1 UUID: `3f17c186-c794-4e00-8f20-017191373a19`

## One-time owner command

Run ONLY after CI passes and PR is merged to `jill/rewards-work`:

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes present' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git pull failed' }
npm.cmd run work:hq:quote:v35:deploy-zero-second
if ($LASTEXITCODE -ne 0) { throw 'STOP: Do not rerun; review rollback/Cloudflare state' }
```

Only the NEW `deploy-zero-second` is eligible for this second
permission. The original `deploy-zero` remains **hard-disabled**.

The new operator checks exact WORK identity and source, live
v34 100%, preserved v33, intact existing secrets, WORK D1 schema
and metadata. It performs fresh anonymous **GET-only** v34
health/legacy-quote checks before any deployment, a real Wrangler
`versions deploy ... --dry-run`, then rechecks allocation and source.

Immediately before the actual Cloudflare write, the operator
atomically reserves this single attempt on the Owner's PC at
`%LOCALAPPDATA%\JILL-WEB\private-release-receipts\
work-quote-v35-second-0pct-attempt-20261017.json`.
The receipt contains only safe version IDs, expected baseline
deployment ID and timestamp — no credentials, PII or SQL.
An existing receipt prevents a second attempt. The script never
deletes this receipt automatically even on failure.

After Cloudflare deployment, read-only metadata must report
v34 100% and v35 0%, and the v34 readback stays 100%.
Only anonymous GET requests are made: ordinary and pinned v34
must match the observed unavailable v34 route; pinned v35
must reach an approved authenticated Owner denial (403 JSON
`access_denied`) or valid Shopify sign-in redirect (302).
A v35 410 HTML, unknown redirect, anonymous success or v34
fallback response **never counts as success**.

On an ambiguous or failed test, the operator uses already
authorized rollback **only if** the current deployment includes
exclusively the pinned v34/v35 IDs. It verifies v34 100%.
If an unknown concurrent deployment exists, it refuses to
overwrite that change and requires human investigation.

**Do not run a second time**, even if a local assertion failed;
the approval covers only one actual deployment attempt.

## Scope and limits

GitHub tests are synthetic and offline, never deploying.
The Owner's actual Cloudflare login is local and used only
by the deliberate command. No authenticated Save/Reload QA,
remote byte-for-byte asset parity, Shopify customer/approval,
draft invoice or payment operation is demonstrated by the
0% smoke test. No R2 activation or paid plan is authorized.

Cloudflare references:

https://developers.cloudflare.com/workers/wrangler/commands/workers/
https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/
