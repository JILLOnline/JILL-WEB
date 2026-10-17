# JILL WORK Custom Order — 409 upstream_rejected / gateway_required

## Observed failure, 2026-10-17

Owner's WORK Custom Order screenshot shows: `WORK 409 / upstream_rejected /
gateway_required`, **request not confirmed**. One synthetic request
was attempted while testing WORK HQ Quote Save+Reload.

**Do not resubmit, regenerate a request ID, or use a real customer
record while troubleshooting.** The Google QA source rejects before
the Custom Order row or receipt event if the signed gateway request
is invalid. `409` from the Cloudflare gateway is its mapping of
Google's nonretryable rejection; this does NOT prove v35 failed.

Possible origins of `gateway_required` include different gateway HMAC
keys, a Cloudflare gateway URL pointing at the wrong Google project,
an incorrect/missing/expired timestamp, altered payload/owner GID,
or a Google QA runtime that is not the published sandbox.
Do not switch off `JILL_CUSTOM_ORDER_REQUIRE_GATEWAY`, bypass the
app proxy, or enable insecure direct POST as a workaround.

## Exact WORK component boundaries

- Shopify WORK storefront: `jill-work.myshopify.com`.
- Independent Cloudflare gateway Worker: `jill-work-custom-orders-qa`
  (NOT the JILL HQ v34/v35 Worker).
- The gateway requires `SHOPIFY_WORK_APP_SECRET` and
  `JILL_CUSTOM_ORDER_GATEWAY_SECRET` as distinct private bindings.
- Upstream `JILL_CUSTOM_ORDER_QA_BACKEND_URL` should match the
  certified isolated Google QA /exec source pinned in
  `services/jill-order-desk/work-google-merchant-read.mjs`.
- Isolated Google QA Script Property
  `JILL_CUSTOM_ORDER_GATEWAY_SECRET` must match the independent
  Cloudflare Custom Order gateway secret, NOT the Rewards or HQ
  merchant read/write secrets.

## Safe read-only diagnostic

An isolated receipt query using a NEW, deliberately nonexistent
`jill:qa-gateway-diagnostic:<UUID>` is sent by a local Owner script
to the already verified Google QA project. This action is **not an
intake submit** and cannot create a Custom Order, quote or email.
The response is strictly interpreted:

- `receipt_not_found`: local WORK secret is accepted by Google QA;
  this **does not prove** it matches the deployed Cloudflare secret.
- `unauthorized_receipt`: local WORK secret does not match Google's
  currently published isolated QA Script Property.
- Any other response: STOP, do not guess.

The script also reads Cloudflare WORK gateway version metadata
to verify binding **names** and, if the URL is plaintext, exact
upstream Google QA identity. It never requests or prints
Cloudflare secret values. If the upstream URL is stored as a
secret, it reports unverified rather than inventing a match.

## Vault requirement, no secret display

Use the Owner's existing local file:

```text
C:\Users\itzen\JILL-PRIVATE\JILL-SECRETS.txt
```

Only in the existing `[WORK.GOOGLE_CUSTOM_ORDERS_QA]` section,
store exactly one line:

```text
JILL_CUSTOM_ORDER_GATEWAY_SECRET=<value verified from the isolated WORK Google QA project>
```

This must be the exact value from **Script Properties** of the
isolated project `JILL WORK Custom Orders QA` (not LIVE, KEEP,
WORK Rewards or JILL HQ). If you cannot verify the project/owner
and provenance, STOP and do not move a key from any
`[UNASSIGNED...]` or `[LIVE...]` section. Never paste the
secret in chat, terminals, GitHub, screenshots or logs.

After confirming the value and saving the private local file:

```powershell
cd C:\Users\itzen\JILL-WEB
if ((git branch --show-current).Trim() -ne 'jill/rewards-work') { throw 'STOP: Wrong branch' }
if (git status --porcelain --untracked-files=no) { throw 'STOP: Tracked files changed' }
git pull --ff-only origin jill/rewards-work
if ($LASTEXITCODE -ne 0) { throw 'STOP: Git sync failed' }
npm.cmd run work:custom-order:gateway:diagnose-readonly
if ($LASTEXITCODE -ne 0) { throw 'STOP: Do not resubmit. Share only the short STOP code.' }
```

If Google QA MATCHES the locally verified key and Cloudflare's
upstream URL is correct but the storefront still returns 409,
the **deployed Cloudflare gateway secret** or signed envelope
remains suspect. Wrangler cannot reveal an existing secret value.
Any change to the Cloudflare gateway's secret must be separately
reviewed and explicitly approved because it can create an updated
Worker version and impact request traffic. Do NOT run
`wrangler secret put`, `deploy`, or edit Google properties as part
of this diagnostic.

If the local secret DOES NOT MATCH Google QA, correct the local
provenance check or obtain permission for a carefully scoped
WORK-only credential synchronization after verifying both sides.
No secret rotation or remote property modification is approved
by this read-only source change.

## Future acceptance

Only after gateway identity/signature correctness is verified,
return to the **single approved synthetic QA request**. Preserve
the initial request ID if the form retains it. Do not create
multiple test orders, send real customer emails, select marketing
consent for a synthetic test, or alter actual customer requests.
A real QA PASS requires a verified signed Google receipt and
independent Owner inbox readback before any quote Save+Reload.

**LIVE, KEEP, normal v34/v35 traffic, R2, paid infrastructure,
Shopify customers and historical requests are outside scope.**
