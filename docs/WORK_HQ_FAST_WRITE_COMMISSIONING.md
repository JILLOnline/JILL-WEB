# JILL HQ WORK — faster verified reads and private write commissioning

## Source, not deployment

All changes in this checkpoint are for `jill/rewards-work` and the
isolated `jill-work.myshopify.com` services only. Do not deploy to LIVE,
KEEP or WORK Rewards. Neither a PR merge nor GitHub Actions changes
Shopify, Cloudflare, the Google Apps Script /exec, or any credential.

### Speed

The authenticated WORK Owner and D1 authorization must finish BEFORE
any merchant source cache is accessed. The Cloudflare Worker already has
a 20-second per-isolate cache of only nine whitelisted request metadata
fields. This change adds a separate **15-second Google QA CacheService**
cache of the exact same signed merchant projection to avoid repeated
Google Sheet scans across Worker instances. A verified canonical event
append removes the QA cache key while holding the existing event lock.
A malformed cache is discarded; no raw payload, contact details,
private notes or credentials may be cached.

This is a short-lived derived view, **not a second status authority**.
The canonical `CustomOrderEvents` revision always wins. The client now
refuses another edit while awaiting its confirmed revised record, and
provides a manual Refresh latest status control if the previous Worker
snapshot is still visible.

### Private write key

A new `JILL_HQ_MERCHANT_WRITE_SECRET` is required on BOTH isolated
Google Custom Orders QA Script Properties and the Cloudflare
`jill-order-desk-canary-work` Worker. It must not be reused from
the existing HQ read secret, Shopify API secret or session key.

The owner may explicitly run `npm.cmd run work:hq:write-key:prepare`
on the **local Windows machine** only. It reconciles this new key across
the two WORK sections of the existing
`%USERPROFILE%\JILL-PRIVATE\JILL-SECRETS.txt` local plaintext vault,
preserving unrelated entries and LIVE sections. It creates a local
backup before changing the file. It never prints the key or uploads it.

After independent QA Script Property setup, the owner can explicitly run
`npm.cmd run work:hq:write-key:stage` locally. This uses Cloudflare's
**inactive** `wrangler versions secret put`, reads the WORK entry from the
private vault via stdin, verifies all original bindings, and refuses
LIVE, extra binding changes or active Worker traffic switches. It stages
only; it does NOT enable the write feature or deploy the new app code.

This helper does NOT install the Google Script Property, and it never reads
the vault except when the owner runs the named local command.
Never paste the key into chat, commit it to Git, or expose it in logs.

### Required remote commissioning gates (NOT YET COMPLETE)

1. Confirm 4/4 WORK source CI and freeze a reviewed commit; do not
   reuse the historical read-only UI rollout script for a write release.
2. With the exact isolated QA Sheet and script project verified,
   update **only** the existing WORK QA /exec from the reviewed source.
   Confirm the Google manifest still has no Mail/Gmail OAuth scopes.
3. Install the private write key in QA Script Properties and run
   `jillWorkHqQaWritePreflight()` from that QA script's editor. The
   diagnostic reports only boolean readiness, bounded request count
   and that delivery is OFF.
4. Stage the **same** dedicated key as a WORK-only Cloudflare secret.
   Independently verify WORK shop, app client, D1, all existing
   secrets, OAuth ON, Owner commissioning OFF, rollback version and
   anonymous command denial. Preserve the latest deployed Worker
   version rather than assuming a historical version ID.
5. Stage/review the WORK canary build with
   `JILL_WORK_MERCHANT_WRITES_ENABLED=true`, then explicitly approve
   that WORK-only release. Never enable this on LIVE or KEEP.
6. Test one disposable QA command in signed-in Shopify WORK Admin,
   verify revision CAS, duplicate replay, foreign-owner denial and the
   corresponding My JILL account revision. Confirm source refresh
   in inbox and request detail. Do not use a real customer message
   during commissioning.
7. Separately integrate and test a WORK-only email provider and
   authenticated dispatch/receipts. The QA mail outbox is QUEUED,
   never SENT or DELIVERED until independent provider confirmation.

## Release prohibition

`npm.cmd run work:hq:ui:deploy` is the **older read-only UI script**:
its pinned active Worker version and three-secret/no-runtime-change
release invariants cannot certify this new WRITE route or new key.
Do not bypass or patch out those checks manually. A separate reviewed,
version-pinned WORK command rollout is required.

All existing operational records, Shopify customer accounts, Rewards,
payments, invoices, and LIVE remain unchanged by this source work.
