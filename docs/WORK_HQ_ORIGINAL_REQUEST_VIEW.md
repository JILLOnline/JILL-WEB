# JILL HQ WORK — complete original request view (staged architecture)

## Current source-only state

The original Custom Order transport already saves items, quantities,
selected variants, per-unit P1/P2 personalization, request attributes,
fulfillment planning and opaque file reference IDs in the isolated QA
Google sheet's immutable `raw_payload`.

PR #95 introduced the **QA-only exact-ID signed read operation** and
strict server-side full-detail projection. This change adds an Owner-only
WORK request workspace reader and UI:

- The **fast nine-field inbox does not change** and continues to use
  the one Shopify/D1/Google summary loader.
- The child `/app/requests/:submissionId` route requests exact detail
  separately; it uses the same incoming-fetch Shopify Admin session
  promise but **always checks WORK D1 Owner permissions again**.
- With certified private detail data it displays item quantities,
  product/variant identifiers, custom options, variant allocations,
  P1/P2 unit assignments, original instructions and WORK Owner-visible
  customer/event details.
- `reference_ids` render as **text-only manifests**, never unverified
  image URLs, direct object URLs or customer-visible links.
- No price, quote, shipping calculation, tax, Shopify order or approval
  state is inferred from immutable customer intake.

## Security gate — OFF by default

`JILL_WORK_HQ_DETAIL_ENABLED` is not present in any current WORK
Wrangler configuration. It must be **exactly `true`** and
`JILL_WORK_HOST_STAGE` must be `canary` to allow the private
detail source operation. Off/disabled returns a small no-store
`not_connected` model, not a 15-second network request.

**Do not enable this flag yet.** The pinned WORK QA v7 `/exec`
supports list and command operations but has not been redeployed with
the exact-ID detail endpoint. The read helper deliberately pins the
existing endpoint and will return unavailable until a new certified
detail-enabled WORK QA deployment is selected in a separate reviewed
code change. Never overwrite an existing pinned URL blindly.

## Commissioning sequence

1. Confirm current deployed WORK HQ v4 and verify the previously
   pending `requests.data` route is usable. Record source timings.
2. Build and deploy a new distinct Google QA script version from the
   canonical source, check exact-ID HMAC and source/current revision
   against disposable WORK QA data.
3. Pin the verified **detail-specific** QA endpoint, leaving list/
   status writes on the last independently verified source version.
4. Stage an inactive WORK Worker with only the verified detail endpoint
   and an opt-in flag; preserve four original secrets, WORK D1,
   owner restrictions, OAuth and status writes, and review any extra
   binding before release.
5. Run signed-in browser tests: exact original details for QA Owner,
   unknown request 404, unauthorized staff denial, unchanged nine-field
   inbox, no customer cross-access, correct revision after status update,
   and secure handling of missing file IDs.
6. Only then enable and approve WORK-only traffic. LIVE, KEEP, Rewards,
   existing Google v7 list/command, My JILL, checkout and customer email
   remain untouched.

## Next modules

Actual file upload/image preview/PDF delivery needs a private per-tenant
file store and one-time authorized download permissions. Price editing,
carrier-backed shipping, immutable quotes, customer approvals and
Shopify Draft Orders/checkout each require separate authenticated
commands and idempotent Shopify scope grants. These are not shipped
by this source-only UI.

No remote Cloudflare, Google Apps Script, database, Shopify order or
customer mutations occur on merge.
