# WORK-only Shopify Catalog → Quote exact variant bridge (not deployed)

## Scope

The user approved ongoing source construction, **not deployment**. This increment adds an **internal read-only variant proof** adjacent to HQ's existing Shopify Catalog and quote worksheet. No HTTP route, UI button, D1 or R2 write, app flag activation, new OAuth scopes, customer message, invoice, draft order, checkout, payment, Shopify admin product change, or Cloudflare publish has occurred.

Code: `services/jill-order-desk/work-quote-shopify-catalog-bridge.mjs`

- `readAuthorizedWorkQuoteCatalog`: off by default; requires a verified WORK Shopify Admin online session and D1 owner permission `catalog.read`. Accepts only 1–20 unique exact Shopify ProductVariant GIDs, assumed supplied by the prior verified source (not query parameters); calls a single bounded GraphQL `nodes(ids: $ids)` read with one attempt, timeout, exact WORK shop and WORK app key verification.
- `projectVerifiedWorkQuoteCatalog`: rejects missing, duplicate, out-of-order, non-ProductVariant, wrong-shop/app, non-USD, malformed price, bad product status or unexpected source shape. Stores the observed price in exact USD cents and retains GIDs/product/status/SKU only. Does not claim inventory or custom production capacity.
- `reconcileWorkQuoteWithCatalog`: compares the *already verified, saved and source-revision-aligned* quote handoff against the matching Shopify variant snapshot. Snapshot must be younger than five minutes (and not from the future). Only identical ordered variants and prices for ACTIVE Shopify products can advance to **ready for native Shopify calculation**. A price mismatch, absent variant, stale snapshot, inactive product or changed quantity/source means **HOLD for manual review**. No automatic price override, auto-discount, or customer approval.
- Even a positive result leaves `can_publish=false`, `can_invoice=false`, `can_create_order=false`, and requires the subsequent, independent exact `draftOrderCalculate` currency/tax/address/discount/customer verification. The customer must accept immutable terms before the separate safe invoice/order operation.

This module has **no registered route** and is **not yet called by the merchant worksheet**. The merchant worksheet is not permitted to treat saved unit prices as Shopify-verified. Product-based quotes with unknown/missing GIDs stay blocked. Complex custom P1/P2 allocations, reference images, manual fee lines, taxes, and manual discounts still require independent lossless mapping and do not pass the earlier `work-quote-commerce-handoff.mjs` boundary.

## Verification and release boundary

Offline tests: `npm.cmd run test:work-hq-catalog-quote-bridge` and `npm.cmd run work:hq:catalog-quote:check`. They test product/variant order, exact USD cents, WORK app identity, online Owner authorization, denied sessions, source outages, stale snapshot, price mismatch and zero invoices/orders. CI runs the real Shopify App Home build and Cloudflare dry-run.

The current **36-file** reviewed edition layers the new module over the earlier frozen 35-file Catalog/Messaging/Quote edition. All prior successful deployments, receipt stems and pins remain immutable. No deployment artifacts/rollout scripts are authorized yet; the next approved push needs fresh WORK runtime fingerprint, Owner review, quote-canary 0% preservation, explicit one-use release, and authenticated visual acceptance.

## Next safe milestones

1. Integrate this read within a **separately gated** Owner quote preview route, only after exact canonical request + draft identity verification, with Shopify Admin work scopes and no persistence. It must not accept arbitrary variant prices or GIDs from the browser.
2. Add a merchant-visible **Shopify current price vs entered quote price** comparison with explicit decision to revise the draft; no silent auto-reprice.
3. Losslessly model P1/P2 personalization across exact physical line quantities, including reference images and custom charges. One immutable agreement fingerprint per accepted quote.
4. Connect customer-visible quote publication/approval, then separate idempotent invoice and Shopify order stages, all after operational WORK acceptance. LIVE remains separately held.

## P1/P2 review increment — merchant-only, also unreleased

The quote worksheet now contains a native collapsible "Unit & P1/P2 review" under verified items that have variant allocations or personalization groups. `work-quote-unit-review.mjs` strictly validates the already Owner-verified original item's units and preserves the *exact* source `unit_id`, original variant reference, P1/P2 group ID, attribute values and reference **counts**. It rejects duplicates, unknown unit IDs, inconsistent allocation quantities, invalid group data and excessive inputs. Incompletely assigned units are explicitly flagged; no units are silently dropped or reassigned.

These original references may be legacy IDs such as `shopify-variant:456` and an allocation-specific `456`, **not** certified Shopify ProductVariant GIDs. The review NEVER tries to equate them to Shopify products or prices. The independently authenticated Catalog bridge requires exact validated Shopify GIDs; a future Owner-authorized resolver must prove the mapping using Shopify source, never merchant-entered IDs or title guesses.

The disclosure shows the actual per-unit assignments for merchant review only. It does **not** add a price per unit, alter saved draft lines, approve customer terms or make an invoice possible. The additional security and review tests are `npm.cmd run test:work-hq-quote-unit-review`; the **37-distinct-file** WORK review package (36 prior pins, two reviewed replacements and one new module) is guarded by `npm.cmd run work:hq:quote-units:check`. Prior reviewed 36/35/32-file editions remain immutable and still do not authorize a release.
