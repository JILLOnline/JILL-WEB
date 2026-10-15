# JILL HQ WORK — original complete request, one signed ID at a time

## Why this separate operation

The existing WORK merchant list deliberately exposes only nine metadata
fields per request. This is suitable for a fast inbox, but not for
production of custom items. The immutable intake `raw_payload` in the
isolated WORK QA Google Sheet already contains the original customer
requirements: each item ID, product/variant IDs, quantities and
allocations, custom attributes, per-unit personalization groups,
event date, fulfillment and opaque reference file IDs.

**Never add these private fields to the inbox summary, Cloudflare D1 shared
index or public My JILL customer-list projection.** Load one order only
when its workspace needs those details.

## Implemented in source (NOT enabled remotely)

This change adds a separate `jill_order_merchant_detail=1` QA-only
`doPost` operation in the canonical Google source and a matching
private Node/Worker reader. The new signature is domain-separated
from the existing list read:

```
merchant_detail_v1
jill-work.myshopify.com
<exact submission_id>
<13-digit timestamp>
<32-character nonce>
```

The request includes the dedicated `JILL_HQ_MERCHANT_READ_SECRET`
HMAC, not a public Shopify customer session or provided email. The
QA handler rejects LIVE, WORK Rewards, missing/extra/duplicated
parameters, invalid time, malformed ID, wrong HMAC and any wrong shop.
It opens only existing sheets, validates headers and exact ID, checks
immutable payload ID and intake time, reads one bounded canonical event
history and returns the exact payload + **current canonical revision**
to the authenticated WORK server. It does not mutate sheets or
return internal merchant event notes.

The private Worker reader rejects responses with wrong operation/shop/
submission_id, malformed revision or oversized content, and immediately
runs the existing strict `projectVerifiedWorkMerchantRequestDetail`
whitelist. Browser code must never access the raw transport response.
Attachment `reference_ids` are **opaque**; no public URL is inferred.
They will be resolved later by a separate, authorized file service.

## Next commissioning gates — NOT part of this PR

1. Confirm the actual WORK Cloudflare v4 activation output and
   `requests.data` network timing. Stabilize the inbox first.
2. Build the QA Google script from the verified canonical source and
   deploy a **new separate QA script version**. Do not rewrite or
   blindly replace the pinned working v7 merchant list/command version.
3. Check the new WORK QA endpoint supports the detail operation,
   read-only behavior and signed exact-ID probe against a disposable QA
   request. Never send raw payload/customer PII to logs.
4. Stage an inactive WORK-only Worker that points **only** its new
   private detail service to that certified QA endpoint. Preserve
   existing list/write endpoint until independently validated.
5. Add a separate direct-route Shopify Owner + WORK D1 permission and
   exact-ID handler, with request-scoped authentication, CSRF/origin
   and content-size rules where applicable. Detail not found must
   return 404, not another customer's records. Direct links reauth.
6. Build UI sections showing item variants/quantities, P1/P2 group
   attributes, original request-level attributes, reference manifests
   and production note context. Do not preload private data into all
   inbox cards or into the 60s D1 index.
7. Verify negative auth, cross-shop isolation, canonical revision
   after a status save, browser performance, and no accidental
   media links before any traffic release.

**Explicitly out of scope now:** PDF/image upload and private file
delivery, quotes, Shopify Draft Orders, invoice sending, live
shipping estimates and catalog inventory editing. Those are separate
modules with appropriate storage, customer identity, Admin API scopes
and idempotency.

No LIVE, KEEP, Rewards, Worker secrets, Cloudflare deployment, D1
migration, customer record or Shopify order changes occur on merge.
