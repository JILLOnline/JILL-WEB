# JILL HQ — approved WORK v35 0% deployment and v34 recovery

## Narrow owner authorization

October 17, 2026: Owner explicitly approved one **WORK-only**
deployment containing **v34 at 100% and v35 at 0%**, with
authorization to recover to v34 100% if checks fail.

Worker: `jill-order-desk-canary-work`.
v34: `4973b74d-d479-41da-897c-e36129303279`.
v35: `dbc6341f-de7f-41de-8e97-6bf971201eeb`.
Existing v33 rollback:
`204d66c3-3296-430d-8288-39c354876600`.
Uploaded v35 source SHA:
`4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b`.

**0% is still a real Worker deployment configuration change.**
v35 remains reachable through Cloudflare's explicit Version Overrides
header even if normal traffic allocation is zero. Never represent
it as isolated or impossible for external parties to call.

## Owner Windows execution

Only the authorized Owner's local Wrangler login can make the
deployment. GitHub CI runs **offline fixture tests only**.

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes present' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:hq:quote:v35:deploy-zero
if ($LASTEXITCODE -ne 0) { throw 'STOP: Rollout or recovery needs review; do not retry' }
```

This operator uses the pinned source, existing v34 100%, v33
rollback and v35 upload metadata, exact WORK D1 quote tables,
WORK-only D1 UUID and existing secret/binding parity. Unknown or
concurrent deployment changes cause a STOP.

The one permitted traffic configuration mutation uses documented
Wrangler positional syntax:

```text
versions deploy 4973b74d-d479-41da-897c-e36129303279@100% dbc6341f-de7f-41de-8e97-6bf971201eeb@0%
```

Run `--dry-run` first and require exact readback of both percentages
from Cloudflare **deployments list --json** afterward.
A read-only anonymous smoke uses the true WORK hostname and
`Cloudflare-Workers-Version-Overrides` with the exact version ID.
It sends only GET, does not attach cookies or bearer tokens, never
submits a customer ID or any quote data, and does not follow
redirects. v34 must still reject `/app/requests/quote-draft` with
`503 quote_drafts_not_enabled`; v35 must reach an authenticated
Owner boundary, returning a refusal or login redirect rather than
disclosing data. No authenticated session QA is claimed.

**When verification fails:** if the deployment is proven to contain
only v34/v35, the script uses the separately approved rollback
`versions deploy v34@100%` and independently verifies a 100% v34
deployment. If the latest state is unreadable or includes any
unknown concurrent version, it refuses to overwrite that deployment
and requires a human to inspect the state before recovery.

**Do not rerun the 0% deploy command** after any ambiguous result.
An explicit read-only inspection and safe recovery are required.

## Recovery command — only if needed

If the first execution reports a known failed deployment and
cannot certify rollback, use the guarded recovery after reviewing
the sanitized state and confirming the Worker still belongs to
this WORK rollout:

```powershell
npm.cmd run work:hq:quote:v35:recover-v34
if ($LASTEXITCODE -ne 0) { throw 'STOP: Recovery unverified; investigate before any further deployment' }
```

The recovery command refuses unknown competing deployments and
does not restore database contents. It only changes WORK Worker
traffic routing. No version upload, LIVE/KEEP, R2 or billing changes.

## Remaining authorization boundaries

**Not approved:** promoting v35 to ordinary WORK traffic above 0%;
performing signed-in merchant Save/Reload actions on the two actual
customer requests; sending quotes/approvals or Shopify Draft Orders;
activating R2; changing LIVE/KEEP or enabling any paid infrastructure.

The authenticated Work customer flow still needs permission and
an agreed dedicated test record. Full remote binary/asset byte parity
also remains unproven by metadata alone.

Wrangler documentation: 
https://developers.cloudflare.com/workers/wrangler/commands/workers/

Cloudflare Version Overrides:
https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/

## 2026-10-17 Owner execution — 0% deployment followed by safe rollback

Owner synced WORK to `44a8114` and ran the approved one-shot
`npm run work:hq:quote:v35:deploy-zero` on Windows.
The preflight passed. Cloudflare successfully created deployment
`0020dec4-c97a-49a0-add1-96835e207861` containing
**v34 100% / v35 0%**. The subsequent anonymous smoke failed
with `quote_v35_zero_v34_quote_lock_not_proven`,
**before certifying v35**. The operator then performed the
previously authorized recovery and independently reported
`WORK ROLLBACK VERIFIED: restored_v34_100`. No quote customer
payload, authorized Shopify mutation, paid services, R2, LIVE or
KEEP work was performed by the operator.

**DO NOT RE-RUN** `work:hq:quote:v35:deploy-zero`. The one-time
permission was exercised. After rollback, an override to v35 is
no longer available unless another deployment is separately
authorized.

### Root-cause hypothesis and next safe action

The smoke demanded an exact `503`
`{ok:false,error:'quote_drafts_not_enabled'}` from the ordinary
WORK route. However, **v34 predates the route introduced for
v35**. A v34 404, Shopify authorization redirect, or another
legacy denial response could be expected even though the
deployment was correct. This explanation is a hypothesis, not
an observed HTTP result; the smoke logs recorded only the
failed assertion.

The independent, read-only diagnostic checks that **v34 is
still at 100%**, sends only anonymous GETs to `/healthz` and
`/app/requests/quote-draft`, sanitizes HTTP statuses, known
denial codes and redirect categories (without printing any
body, location query, OAuth state or tokens), then checks the
allocation again:

```powershell
cd C:\Users\itzen\JILL-WEB
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:hq:quote:v34:diagnose-readonly
if ($LASTEXITCODE -ne 0) { throw 'STOP: Read-only response diagnosis unverified' }
```

Following this measurement, any change to the original
smoke acceptance logic must be justified by actual WORK v34
behavior and verified independently. A second 0% deployment
or promotion requires **fresh explicit Owner authorization**,
separate from the exhausted first attempt.
