# WORK Quote → Shopify calculation → invoice: safe source continuation

**Status:** Committed to the WORK source branch; **no release or live action**. The customer-facing quote, approval, invoice, payment and Shopify order are NOT enabled. Do not run a historical one-time release.

## What this increment actually implements

`services/jill-order-desk/work-quote-commerce-handoff.mjs` introduces `inspectWorkQuoteCommerceHandoff`, a *pure, internal* transformation from an **already verified WORK saved draft and its exact signed original request** into the existing native Shopify `prepareWorkQuoteCalculation` intent. It performs NO Shopify GraphQL, no D1 writes or reads, no GET/POST, no local/browser storage, no invoice/customer notification and no order create. A positive result means **ready to ASK Shopify to calculate**, not quote publishable/approved/invoiced.

The existing quote draft UI in `WorkQuoteWorksheet` remains gated OFF on ordinary WORK HQ traffic. No schema/flags/secrets/deployment/billing changes are authorized here.

## Fail-closed boundaries

The handoff checks matching submission ID/source revision, saved draft hydration and exact cents, customer GID from an **independently trusted server-side authority**, current WORK fulfillment, and fully verified delivery address and shipping label. The original signed Google QA record's city/ZIP alone is insufficient for the address requirement. It explicitly blocks:

- Native Shopify variant absence, duplicate variant IDs, split/unverified variant allocation or item count above the native twenty-line limit
- Per-unit personalization, options, item/order notes, reference images/files pending a lossless reviewed mapping; never discard a customer's custom instructions
- Materials, labor or miscellaneous charges until representable as approved Shopify line items; cannot turn them into a price surcharge silently
- Manual estimated taxes; actual Shopify-calculated tax and currency must be verified
- Manual discount without canonical Rewards reservation/code and native amount check
- Pickup with a shipping charge, shipping service not approved, missing address, missing trusted customer identity, source/version changes, or inconsistent totals

All denied decisions return fixed non-PII reason codes, null calculation intent, and `can_publish=false`, `can_invoice=false`, `can_create_order=false`. A successful response also explicitly leaves all three permissions false and marks a new authoritative Shopify calculation as necessary. Nothing here authorizes the caller. Authentication/scope/canonical owner verification must happen in the existing Owner/SDK-bound route before invoking it.

## Tests

`npm.cmd run test:work-quote-commerce-handoff` uses synthetic customers and orders to check the exact amount, trusted intent, pickup/shipping, original/source mismatch, personalization/fee/discount/tax/address blocks, and no network, D1, invoice or Shopify create. CI also reruns the existing `test:work-quote-calculation` to retain native Shopify 2026-07 calculation projection protections.

## Next critical work

1. Implement and independently test an exact, **lossless** mapping for JILL's original customization attributes, P1/P2 unit allocations, option sets, reference-media manifests, material/labor fees and approved native variant/line prices. Do not invent variants or rely on product titles for mapping.
2. Connect the Owner-authorized saved draft/source reader to this pure handoff in a new **disabled-by-default** consuming route. Verify WORK app installation/online staff scopes, D1 quote save/read source revision and the exact Shopify customer's identity before any calculation.
3. Collect a genuinely complete trusted delivery address and merchant-approved shipping; execute a fresh native `draftOrderCalculate` and reconcile currency/tax/discount/totals without an actual order creation.
4. Integrate quote publication/customer view/acceptance and immutable canonical Google event. Then implement one-create, owned Shopify read-back, and a separate explicit invoice-send command with idempotency and recovery; do not call `draftOrderCreate` or `draftOrderInvoiceSend` in a preview.
5. The original uncertain request submission from October 19 still lacks an exact private operation ID/outbound payload. Do not replay synthetic intake or use a different request as a substitute. Resolve that original correlation and Owner's current quote canary/migration/feature flags before real Save → leave → Reload or commerce acceptance.
6. Only after these gates and authenticated WORK validation: fresh read-only provider inventory, distinct one-use WORK release and separate, explicit LIVE review. Previous Archive/Search and compact request table receipts remain spent.

This is a source-only safety increment. It does not make invoices operational yet.
