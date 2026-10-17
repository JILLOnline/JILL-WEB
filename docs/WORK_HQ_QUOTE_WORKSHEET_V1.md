# WORK JILL HQ — Custom Order Quote Worksheet v1

## What this delivers

The **Custom Order request workspace** now includes a merchant-only
USD quote worksheet below the already authenticated **original request**.
The existing Shopify online session + WORK D1 Owner permission and
signed Google QA exact-detail read remain the sole source of item
identities, titles, and submitted quantities.

The worksheet supplies **per-item unit prices**, plus manual
materials, labor, shipping, other charges, discount and estimated
tax. It computes the estimated total using integer cents (never
floating-point price addition). No customer input changes are
saved to the canonical Custom Order event history.

**This is a front-end prototype in source, not a deployed feature.**
The active WORK Worker remains pinned to v34 until a separate release
decision and provenance/security review. CI validates the candidate
app and math offline.

## Controls and limitations

- Quote fields are held in React browser memory and intentionally
  vanish on navigation or reload. No cookies, localStorage, IndexedDB,
  D1, Google Sheets, R2, Shopify API, clipboard or external calls.
- Fields are visible only after the verified original detail matches
  the current authenticated request ID. A failed/offline detail read
  displays no prices or unverified data.
- Cancelled and completed requests cannot be newly estimated.
- Each confirmed unit price is required, even if it is explicitly
  zero; blank is **incomplete**, not a misleading $0 subtotal.
- Valid USD input is 0 through 99,999.99, at most two decimals,
  with no signs, currency symbols, thousands separators or exponent.
- The worksheet rejects source quantities outside 1–999, duplicate
  or unsafe item IDs, more than 50 source lines and totals above
  $1,000,000. A discount greater than charges before tax is denied.
- Tax is **manual estimate** only; Shopify may ultimately calculate
  a different tax depending on address, product taxability, shipping
  and applicable law. This does not generate a tax invoice.
- No customer-facing quote, email, proof approval, deposit, Shopify
  Draft Order, checkout link or payment is created. Input is
  visibly labeled **NOT SAVED · NOT SENT**.
- Customer reference IDs and legacy Cloudinary strings remain
  **descriptors**, not artwork links or implicit storage authority.

## Future integration — separate approval gates

1. Finish secure Owner-scoped private artwork preview/upload with
   proven provenance, sanitized media, bounded quotas and a
   **separately approved** WORK R2 Standard storage activation.
2. Add a durable versioned quote record in WORK D1, tied to the
   verified request and immutable original item snapshot. The
   migration is **not** authorized or executed by this worksheet.
3. Add quote revisions, proof approvals and customer acceptance
   with explicit owner/customer identity checks and idempotent
   mutation receipts. My JILL should show only owner-scoped quotes.
4. Create Shopify Draft Orders via the authorized WORK Shopify
   integration **after** separate permission/scope review and
   release approval. Keep Shopify responsible for actual checkout
   and payment. Payment status must come from verified Shopify
   events, not a browser-submitted success boolean.
5. Turn an approved, paid request into a production and fulfillment
   workflow with tracking and replay-safe event processing.

## Certification boundaries

- Offline test: `npm run test:work-hq-quote-worksheet`.
- Compiled App Home: standard WORK CI `typecheck` and canary `build`.
- No new routes, APIs, Worker flag, Cloudflare binding, access tokens,
  Google handler or source sheet. LIVE/KEEP and paid features untouched.
- The legacy **Phase 32 historical four-file source review** is not
  an approval of this new quote-route change; a future v35 rollout
  needs a new, comprehensive runtime diff and explicit owner decision.
