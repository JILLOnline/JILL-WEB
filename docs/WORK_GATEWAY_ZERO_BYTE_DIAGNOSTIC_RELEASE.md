# WORK zero-byte diagnostic release

## Superseding Owner receipt — 2026-10-19

The Owner completed the corrected diagnostic from runner `432f2bc4923bc6f794c2a8b65351574d60a76ecc`.
Source package SHA-256: `eb8561c1f1b5a4e229db7800cc75e67aed1619e7aac15ac7bb044dea62604de3`.
Gateway deployment `4fad4b6f-3596-4797-83a3-05edb7f89097` retains ordinary candidate
`9322193f-5e87-4479-88c9-39229dddb5f2` at 100% and corrected diagnostic
`b6237ad9-3343-4c8b-8b65-7a0194ddc50e` at 0%. The signed response identified
that exact corrected version and verified the Google signature. No customer
order was created or Shopify submission tested; ordinary traffic, old receipts
and secrets were unchanged. Owner-to-edge interval: −458..+687 ms, RTT 146 ms.
The isolated Google QA audit/key preflight passed; the numeric revision was
not in the final receipt and remains to be retrieved read-only when needed.

**The diagnostic failure is closed. The original uncertain intake / earlier
409 remains unreconciled. Full WORK acceptance remains NOT PASSED.** This is
Owner-supplied runtime evidence, not a new signed probe by this executor.
Structured receipt: `docs/evidence/work-gateway-zero-byte-owner-success-2026-10-19.json`.

**All old and new upload/deployment receipts are spent. Never rerun
`work:gateway:empty-post:release-once`, reset receipts or replay historical
upload/recovery/deployment commands.** Only `work:gateway:empty-post:inspect`
may be used for necessary read-only deployment read-back; it sends no signed
POST. Do not restart secret-mismatch diagnosis or rotate keys.


Prepared after the Owner's read-only inventory at 2026-10-19 00:28 UTC.
Historical preparation record follows. The superseding Owner receipt above
confirms deployed diagnostic verification. Full WORK acceptance remains open.

## Verified baseline and exact scope

Gateway `jill-work-custom-orders-qa` deployment
`3c025657-0c60-482d-bb41-4987d87bd848` serves
`9322193f-5e87-4479-88c9-39229dddb5f2` at 100% and the old diagnostic
`1201c7c0-9086-4d4e-89a6-3f2bc0a74c5f` at 0%. The Owner's inventory
verified the old diagnostic's exact override health, original five bindings,
stable allocation before/after, and an edge-clock interval near zero. It did
not prove Worker isolate time or a secret mismatch.

The previous empty-POST source rejects non-null zero-byte streams. Genuine
HTTP into local workerd reproduces that behavior with a correct key/time.
The correction accepts bounded EOF after verifying the existing HMAC, still
rejects real bytes, and rechecks the unchanged 60-second time window.

`prepare-work-gateway-diagnostic.mjs` selects the exact certified old source
`4e1af98dd9643bda3742601f974d54d98f97b49f` and only changes these files:

| File | Change |
| --- | --- |
| `backend/custom-order-gateway.mjs` | Reviewed zero-byte validation, existing HMAC/time/quota/upstream receipt logic retained. |
| `backend/empty-http-body.mjs` | Canonical bounded stream reader. |
| `services/custom-order-cloudflare/handler.mjs` | Only the diagnostic block gains an exact response version header from `CF_VERSION_METADATA`. |

All other submission/account/limiter/runtime/config bytes come from the old
source. New conversation routes and newer account projections are **not**
part of this release. The source-package SHA-256 is
`eb8561c1f1b5a4e229db7800cc75e67aed1619e7aac15ac7bb044dea62604de3`.
This identifies source inputs, not deployed binary parity or bundler version.
The exact package passes Wrangler `versions upload --dry-run` (34.57 KiB)
and the real Workers HTTP regression with synthetic secrets and no upstream
network. Current full-source HTTP tests pass separately.

## Historical execution — SPENT, do not run

Use the existing PC Cloudflare and clasp logins. No secrets are displayed or
uploaded. The existing private WORK key catalog is read locally only to sign
the already supported QA receipt checks.

The historical mutating command has been removed from this handoff. Its one-use
upload and deployment receipts are spent.

The runner checks the clean synced source, exact current deployment/latest
old diagnostic/bindings and pinned health/Owner edge clock. It audits Google
QA HEAD and the immutable published revision, verifies the local key against
one nonexistent receipt directly in that sandbox, then dry-runs the minimal
package. Unknown source, remote drift, QA revision, auth or clock stops it.

It reserves a **new** upload receipt atomically before one inactive upload
with `--keep-vars` and no secret file. It reads the new version back and
checks unchanged bindings/runtime. It then dry-runs and reserves a separate
**new** deployment receipt before attaching the new diagnostic at 0%, keeping
the same ordinary candidate at 100%. The old 0% diagnostic remains in version
history. No Version URL is assumed for this Durable Object Worker.

Pinned health precedes one signed empty diagnostic POST. That POST must
itself return the exact new runtime version header and the unchanged success
body (`gateway_google_signature_verified`, `order_created:false`). The
existing rate limiter is consumed once; Google receives a nonexistent-receipt
read. No customer request, notification, coupon, D1 schema/data, R2, secret,
paid service, Shopify app release, HQ traffic or LIVE/KEEP change is performed.
Current gateway allocation is read again after the probe.

The new local files in the existing private receipt directory are:

- `work-gateway-zero-byte-v1-upload-once-20261019.json`
- `work-gateway-zero-byte-v1-deployment-once-20261019.json`

Neither is ever overwritten. The old 20261018 receipts are never opened,
deleted, reset or reused. Re-running the mutation command after an attempt
stops before another upload or deployment.

## Failure and continuation

If anything stops after an attempt is reserved, **do not retry the release**.
Use the new read-only inspector:

```powershell
npm.cmd run work:gateway:empty-post:inspect
```

It reads source/package, allocations, exact marker/bindings, health/clock and
new receipt-presence booleans. It sends no signed POST and performs no remote
mutation. It supports an upload that committed before attachment, or an
attachment that committed before probe acknowledgement. Unknown/newer
versions or traffic drift stop inspection instead of guessing recovery.

Return only its safe JSON or fixed STOP lines. A 403 means the challenge
remains unverified; there is no automatic secret change. A 503 means the
Google connection remains unverified; a 429 means the existing quota denied
the probe. Do not turn a failure into a submission test or a second create.

After success, reconcile the original uncertain request from existing private
history before any new intake. Then finish the existing quote Save/Reload
browser proof, actual calculation/acceptance/commerce adapters, same-owner
Rewards migration and remaining acceptance matrix. The HQ 0% quote flag is
not evidence that normal HQ traffic supports quote drafts. Customer-facing
LIVE promotion remains a separate reviewed release.

Platform references checked: Cloudflare [version overrides](https://developers.cloudflare.com/workers/versions-and-deployments/version-overrides/)
and [gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/).
