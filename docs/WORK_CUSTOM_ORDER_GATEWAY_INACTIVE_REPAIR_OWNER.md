# WORK Custom Order gateway — Owner-approved inactive HMAC/URL repair

## Exact authorization and independent services

On 2026-10-17 Owner explicitly approved **preparing and uploading one
inactive WORK Custom Order gateway repair** using the locally verified
WORK Google QA signing secret and certified isolated QA endpoint.

The affected Cloudflare Worker is **`jill-work-custom-orders-qa`**,
NOT `jill-order-desk-canary-work` (JILL HQ v34/v35). The latter
remains at its existing 100% v34 / 0% v35 distribution; do not
rerun any version-deploy command.

The WORK Customer Order storefront reported HTTP
`409 upstream_rejected / gateway_required` on a synthetic test
submission and **no verified receipt**. The subsequent diagnostic
proved:

- isolated WORK Google QA published Apps Script sandbox identity PASS;
- local `[WORK.GOOGLE_CUSTOM_ORDERS_QA]`
  `JILL_CUSTOM_ORDER_GATEWAY_SECRET` accepted by Google QA;
- Cloudflare WORK gateway secret binding names exist;
- deployed Cloudflare gateway upstream URL is a secret, so its
  current value is **not readable or independently verified**;
- deployed Cloudflare gateway HMAC secret value is likewise hidden.

The cause has not been conclusively isolated. This approved
candidate stages the verified WORK pair WITHOUT affecting the
deployed version. Do not interpret version metadata as proof of
secret value parity or a functional form submission.

## Single Owner Windows command

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes exist' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:custom-order:gateway:upload-repair-inactive
if ($LASTEXITCODE -ne 0) { throw 'STOP: Do not rerun; inspect Cloudflare versions read-only' }
```

The command refuses wrong Windows branch, untracked code drift
in the tracked source, changed `wrangler.toml`, missing local
Wrangler, unknown deployed Worker or unexpected secret/DO bindings.
It certifies published isolated Google QA source and confirms the
**existing** local signing key cryptographically through ONE
random, nonexistent signed receipt lookup (no intake, no customer
data, no order write) before any upload.

It then stages exactly **two** JSON secret entries in an ephemeral
private folder under `%LOCALAPPDATA%\JILL-WEB\private-release-tmp`:

1. `JILL_CUSTOM_ORDER_GATEWAY_SECRET` — same verified value from
   the local `[WORK.GOOGLE_CUSTOM_ORDERS_QA]` vault section;
2. `JILL_CUSTOM_ORDER_QA_BACKEND_URL` — pinned certified isolated
   Google QA `/exec` URL in the checked-in WORK merchant source.

**No other secret** is staged. `SHOPIFY_WORK_APP_SECRET` is an
unrelated WORK Shopify HMAC and must remain unchanged. Cloudflare
documents that unmentioned secrets are preserved by
`wrangler versions upload --secrets-file`.

The operator runs a dry run first, then one upload via:

```text
wrangler versions upload --config ./wrangler.toml --name jill-work-custom-orders-qa --strict --keep-vars --secrets-file <private-temp-path> --message <exact-source-marker>
```

**This is NOT `wrangler deploy` or `wrangler secret put`**. The
normal active WORK gateway must remain at exactly its previous
100% version and Cloudflare deployment ID; source script runtime,
the original Shopify secret binding and the existing SQLite
Durable Object `RATE_LIMITER` binding are checked for parity.
Read-only version-list/readback identifies the inactive version
by exact Git source marker and reports only version IDs and safe
status. The operator deletes the private temporary secrets file
on successful completion or failure. No secrets, signed payload,
response body or Cloudflare config JSON are printed.

Immediately before the actual version upload, an atomic one-use
local receipt is created under
`%LOCALAPPDATA%\JILL-WEB\private-release-receipts`.
That marker is NOT deleted by automatic cleanup. If Cloudflare
times out, fails or an inactive version was created but not
read back, **never retry the upload**. Inspect versions
read-only instead. No automatic traffic switch or release.

## Follow-up decision, requiring separate Owner approval

If the inactive candidate validates, a separate permission is
required to expose it through a controlled WORK-only version
deployment and perform a **single preserved synthetic request**
with a verified signed receipt. Do not resubmit the existing
failed form until the active gateway configuration and request
identity are reconciled. A new status or Draft Save test is not
authorized by this inactive-upload permission.

No LIVE, KEEP, actual customer records, contact notifications,
Shopify invoices/payments, R2, paid services, or normal JILL HQ
traffic modification is permitted.

Cloudflare references:

https://developers.cloudflare.com/workers/configuration/secrets/
https://developers.cloudflare.com/workers/wrangler/commands/workers/
