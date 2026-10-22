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
- Internal-only: **no new HTTP route or Shopify Admin call**. The caller
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

**Before a real rollout**: a separately scoped future, disabled-by-default
Owner route must read each authoritative source under online Shopify and
D1 Owner permission and revalidate after return; then an independently
approved one-use WORK activation and authenticated visual acceptance.
Real customer quote publication, native calculation, invoice and checkout
remain #155's later gates.
