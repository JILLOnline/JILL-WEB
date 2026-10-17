# JILL WORK — One synthetic Custom Order acceptance gate

Status: **PREPARATION / OFFLINE ONLY**. The source-only rehearsal is `scripts/test-work-custom-order-acceptance-local.mjs`.

## What was actually implemented

A local in-memory test of the current `createCustomOrderWorkProxyRoute`, `handleWorkCustomOrderAccountRead` and `receiptSignature` implementations. It uses deliberately synthetic Shopify and Google keys, a fake Shopify-signed app-proxy query, one unique request ID, and an in-memory Google QA double that verifies the real HMAC format. It checks:

1. Signed WORK proxy submission with `logged_in_customer_id` -> real gateway HMAC.
2. Google QA double accepts exactly one synthetic submission and stores an Owner association **in memory only**.
3. Separate gateway receipt HMAC and independent receipt read succeed.
4. A signed WORK Customer Account JWT selects the same customer's projection, with no caller-provided email/order filter.
5. Anonymous account read returns 401 and makes zero Google calls.
6. One request ID, one stored record, one signed receipt.

No external networking, no Cloudflare override, no Shopify, no R2, no D1, no Google Apps Script, no notification. **The Owner HQ inbox is not exercised by this test** because it has a separate OAuth+D1 Owner authority and Google merchant HMAC; that requires independent WORK-only acceptance readback after the real submission.

## Run — offline only

On Owner Windows, with tracked Git files clean:

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked changes exist' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
node .\scripts\test-work-custom-order-acceptance-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'STOP: Synthetic acceptance rehearsal failed' }
```

Do not report **real end-to-end PASS** from an offline green test.

## Real acceptance (NOT YET AUTHORIZED)

Current Cloudflare Custom Order Worker `jill-work-custom-orders-qa` remains original version `408bdf7c-eb20-4b6e-97dd-3d3b293c6120` at 100% and repaired version `225cdbb4-46f5-492e-801d-6726bea2703e` at 0%, deployment `f6809b0e-c8b7-47b6-9cc9-13d071d1ecbb`. The original cannot be promoted/changed by this test.

**Unresolved release blocker:** no independently verified way has yet been established to steer a single authenticated Shopify WORK app-proxy POST into the repaired 0% version. A browser adding `Cloudflare-Workers-Version-Overrides` does not establish that Shopify forwards it. Identical-code health/401 results do not demonstrate version attribution. Do not treat override tests as proof of repaired secrets.

Only after a **separately reviewed routing mechanism** and explicit Owner authorization:

- Recheck exact versions/allocation and isolate test identity and preserved request ID. Avoid real personal data and marketing consent.
- Send at most one synthetic WORK submission with a genuinely Shopify-signed app proxy request and test customer identity. STOP on 409, 503, network ambiguity or unknown version attribution. Do not retry or create another ID.
- Verify real `custom_order.submit.result` HTTP 200 `verified:true`, matching ID, and independently persisted signed Google receipt.
- Independently inspect JILL HQ WORK Owner inbox using existing verified Shopify Owner authority. **Do not** bypass or self-issue an Owner token.
- Sign into the same WORK test customer account; check the actual My JILL UI lists that request. Do not equate matching email with verified customer ownership.
- No paid capacity, LIVE/KEEP, R2, Draft Orders, customer email, payments, or marketing notifications.

This document is a plan, **not** permission for any remote submission, secret update, Worker upload/deployment or traffic change.
