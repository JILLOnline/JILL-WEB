# JILL WORK HQ — Owner Quote + Exact Shopify Catalog Preflight

**Source-only proposal, October 22, 2026.** This isolated branch was
created from the certified M1/M2 preview head. The M1/M2 source-lock manifest,
historical protected files, quote rollout receipts, and running WORK deployment
are unchanged.

## Connection built

The pure module `services/jill-order-desk/work-quote-catalog-preflight.mjs`
connects two EXISTING, separately tested WORK components:

1. `inspectWorkQuoteCommerceHandoff`: requires the exact source-revision
   signed original Custom Order plus an already saved/hydrated Owner draft,
   real Shopify customer GID and complete trusted address, exact variant,
   personalization and fee terms.
2. `reconcileWorkQuoteWithCatalog`: requires a recently verified, exact
   WORK Shopify Admin variant snapshot from the real Owner permission-bound
   reader, matching ordered variants, ACTIVE products and USD unit cents.

The result is a **PII-free Owner action plan**, not an order or a Shopify
calculation. It identifies a concrete hold stage and next action such as
`reload_saved_quote`, `map_per_unit_personalization`,
`refresh_shopify_catalog`, `compare_shopify_price`, or
`request_fresh_shopify_calculation`.

## Security and accounting boundaries

- Entire module **OFF by default** (`enabled!==true` returns HOLD).
- A **new GET-only Owner quote-preflight route exists in source**, but is
  OFF in the deployed WORK manifest and disabled without THREE switches:
  `JILL_WORK_HQ_QUOTE_CATALOG_PREFLIGHT_ENABLED` (new),
  `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED` (existing OFF) and
  `JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED` (not activated). There is no
  enabling flag change or deployment.
- The pure transformation has no HTTP/Shopify calls. The source-only
  route reads authentic WORK source and a single bounded, read-only
  Shopify Admin Catalog query **only after** Shopify Owner + D1 checks.
  The caller
  must separately prove the SDK online Owner session, D1 permission,
  original signed Google QA detail, saved draft revision, exact customer's
  identity and provider-read variant snapshot; this pure helper does
  NOT authenticate or establish provenance of injected objects.
- No price overrides: quote/catalog mismatches HOLD for manual review.
- P1/P2 per-unit personalization, reference files, request-wide notes,
  manual extra fees, tax and discounts that lack lossless native mapping
  HOLD instead of being silently discarded.
- A positive result means **ready to REQUEST a future Shopify native
  `draftOrderCalculate`**; that network calculation is still not called.
  `can_publish`, `can_invoice`, `can_create_order`, email and
  charge permissions **remain false always**.
- No payment link, draft order, inventory/product update, mail,
  customer quote publish/acceptance, D1 mutation, R2 activation, Google
  event, secret read or LIVE/KEEP traffic.
- Output contains no customer GID, complete address, original request
  notes, unit prices or calculation intent, preventing accidental PII
  leakage if a future Owner-only screen uses the summary.
- Never replay spent historical WORK stage/activate receipts.

## Verification

Run the dedicated GitHub source-only workflow
`jill-hq-quote-catalog-preflight.yml`: synthetic prepared WORK request,
quote and catalog; cases for source revision drift, wrong customer,
lossy customization, P1/P2, manual tax, stale Shopify snapshot,
inactive product, price mismatch, wrong variant and never any commerce write.

**Owner preview route in source now exists:**
`GET /app/requests/quote-preflight?submission_id=...`
checks exact query/origin, Shopify online Owner, D1 `requests.read`,
signed Google list then exact detail, D1 saved quote hash/source revision,
canonical ProductVariant IDs, and an independently `catalog.read`
Owner-verified exact WORK Shopify catalog. No client-submitted GID,
price, customer email/address or raw terms are accepted.
All responses include `can_publish=false`, `can_invoice=false`,
`can_create_order=false`, no charge/email capability and no PII.

Without an independently verified Shopify customer GID, complete address
and shipping service provider, its successful catalog/price check is
**HOLD: verify_shopify_customer**, not invoice/checkout readiness.
Read-only checks on a mismatch return **HOLD: compare_shopify_price**;
P1/P2 allocations HOLD for personalization review.
An injected trusted context is exercised only by offline tests and is
**not supplied by the registered runtime route**.

**Before a real rollout:** certify the new source edition and complete
React Router typecheck/build, provider inventory, fresh signed ownership,
separate explicit one-use WORK release and authenticated visual acceptance.
Never reuse previous M1/M2 staging/activation receipts.
Real customer quote publication, native calculation, invoice and checkout
remain #155's later gates.

Owner handler offline regression: `node scripts/test-work-hq-quote-owner-preflight.mjs`. It exercises fail-closed feature flags (zero provider reads), GET-only input, Owner denial, signed source/source-version checks, hashed D1 saved draft validation, catalog authorization/price mismatch and missing trusted customer/fulfillment context. No external calls.
