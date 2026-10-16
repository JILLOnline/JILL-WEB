# JILL HQ WORK — Private Media Authorization Foundation (source-only)

Status: **WORK source foundation and regression tests only; NOT deployed,
NOT connected to a private storage registry, and NO media download/preview
route exists.** This file does not authorize a Cloudflare deployment,
secret rotation, customer-file modification, Shopify publication, or
LIVE/KEEP change.

## Why this phase exists

The real Shopify WORK Owner detail panel for Request #3190A3B7
displayed Google QA @9's verified revision 2, customer/event information,
one Coloring Books product, and an original reference value. The
existing storefront upload flow writes a Cloudinary `secure_url` directly
into the original `reference_ids` array. Cloudinary metadata confirms
the specific QA PNG uses standard `upload` delivery without an explicit
asset access-control restriction. Neither HTTPS nor a saved URL establishes
private access or ownership. Existing reference URLs must be preserved
as immutable source evidence, not copied into unguarded clickable previews.

The original WORK Owner detail panel remains trusted for *reading request
information*, but private media delivery is a separate trust boundary.
The test request used no per-unit personalization, so the P1/P2 cases
below are synthetic, not new real customer submissions.

## Implemented access-intent contract

`services/jill-order-desk/work-private-media-intent.mjs` exposes
`inspectWorkOwnerMediaIntent` and `chooseWorkOwnerReference`. Neither
is wired to HTTP, downloads files, sends a Cloudinary request, builds a
URL, creates a signed grant, writes D1, or mutates Google.

Callers must supply verified server-held Shopify Admin session context,
a server-side Owner authorizer that checks **online Shopify staff + WORK
D1 permission**, and the certified exact-ID Google @9 reader. Authentication
must happen before reading any protected request details. The module
requires a response bound to the WORK shop, exact submission ID, Owner
role and server-auth source; this is a *defense-in-depth contract* and
**not a replacement for those actual verification services**.

Attachment selection accepts only `{scope:'request',index}` or
`{scope:'item',itemId,index}`. The actual reference value is always
taken from the authorized, immutable, canonical request. It refuses
caller-supplied URL, href, media ID, guessed item, out-of-bounds index,
foreign request, altered source projection or missing Owner authorization.
Response is a frozen, bounded **disabled-intent descriptor**; never a raw
URL, public asset ID, file blob or signed download link.

Reference categories:
- Legacy Cloudinary image URL: `preview_disabled`, reason
  `legacy_public_delivery_requires_migration`.
- Opaque reference ID: `preview_disabled`, reason
  `private_asset_registry_not_connected`.
- Unknown external URL or malformed reference: `preview_disabled`,
  reason `unverified_reference`.

These labels are explanations, not grants. Do not treat the module's
`source` field or its pure predicate as cryptographic authorization;
wire it only behind the real existing WORK Shopify/D1 server auth path.

## Synthetic acceptance tests

`npm.cmd run test:work-hq-private-media-intent` validates:

- Two selected items and a synthetic custom Coloring Books quantity 2
  with **P1 Ava/unit-1** and **P2 Mia/unit-2**, preserved exactly in the
  existing verified full-request projection.
- Request-level legacy Cloudinary URL and two item-level references
  resolve only to disabled, safe, non-URL metadata.
- Refusal of copy-pasted link selectors, foreign requests, guessed item IDs,
  forged/absent Owner grants, wrong shop or missing server authentication.
- Crucially, **no Google detail source call before the Owner grant**.
- No Cloudinary, D1, Google, Shopify or Worker network calls in the test.

## Required before a first private preview can be switched ON

1. Establish Cloudinary account boundary and current upload-preset policy
   for WORK and LIVE. Do not assume the connected Cloudinary account is
   uniquely scoped to WORK. The original QA PNG is *not currently
   demonstrated private*. No automatic moves/renames/deletes.
2. Choose verified provider storage for **future private originals**:
   Cloudinary `authenticated`/private delivery or a distinct WORK R2
   bucket. Configure and audit separate, dedicated WORK secrets and storage
   metadata outside the current original intake.
3. Add persistent per-request asset registry with unique
   `(shop,submission_id,scope,item_id,reference_index)` ownership,
   immutable provider asset ID, content hash, MIME/type validation, creation
   source, and visibility. Link existing URL references through an
   explicit owner-approved verified migration, never a URL guess.
4. Add WORK-only server media route that authenticates **Shopify Admin
   online Owner and D1** before asset lookup and each short-lived grant,
   prevents SSRF/redirects and uses provider-authenticated delivery;
   forbid public URL passthrough.
5. Deny unverified assets, wrong-shop/wrong-request/stale or revoked
   grants, alternative staff roles, overly large/bad MIME files, executable
   SVG/HTML, and customer-only routes. Keep private artwork and credentials
   out of browser payloads and logs.
6. Independently certify a disposable WORK request with two real
   personalization groups and owned attachments, before any actual
   preview activation. Preserve original canonical Google status/events.

**Do not run a Worker deployment on the strength of these synthetic
tests.** This is a source-level trust contract for the next isolated
WORK media integration, not a completed media service.
