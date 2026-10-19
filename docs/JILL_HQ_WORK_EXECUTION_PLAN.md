# JILL HQ WORK — integrated execution plan

## Current continuation — authenticated reads and independent source

See `WORK_OPERATIONAL_HANDOFF_2026-10-19.md` for the exact completed source,
read-back evidence, missing failed-operation correlation and Owner credential/
consent gates. Fresh authenticated Google QA reads verify existing rows,
received events and immutable owner hashes; they do not yet identify the
original uncertain operation. Current Shopify grants still have the five
reviewed gaps. Catalog collections/inventory/locations now have bounded
Owner/scope-gated source and UI; not activated in HQ. Agreement recovery now
survives expiry without repeating a create. Full WORK acceptance remains open.

## Superseding Owner receipt — 2026-10-19

The Owner completed the corrected diagnostic from runner `432f2bc4923bc6f794c2a8b65351574d60a76ecc`.
Source package SHA-256: `eb8561c1f1b5a4e229db7800cc75e67aed1619e7aac15ac7bb044dea62604de3`.
Gateway deployment `4fad4b6f-3596-4797-83a3-05edb7f89097` retains ordinary candidate
`9322193f-5e87-4479-88c9-39229dddb5f2` at 100% and corrected diagnostic
`b6237ad9-3343-4c8b-8b65-7a0194ddc50e` at 0%. The signed response identified
that exact corrected version and verified the Google signature. No customer
order was created or Shopify submission tested; ordinary traffic, old receipts
and secrets were unchanged. Owner-to-edge interval: −458..+687 ms, RTT 146 ms.
The isolated Google QA audit/key preflight passed; the numeric revision was
not in the final receipt and remains to be retrieved read-only when needed.

**The diagnostic failure is closed. The original uncertain intake / earlier
409 remains unreconciled. Full WORK acceptance remains NOT PASSED.** This is
Owner-supplied runtime evidence, not a new signed probe by this executor.
Structured receipt: `docs/evidence/work-gateway-zero-byte-owner-success-2026-10-19.json`.

**All old and new upload/deployment receipts are spent. Never rerun
`work:gateway:empty-post:release-once`, reset receipts or replay historical
upload/recovery/deployment commands.** Only `work:gateway:empty-post:inspect`
may be used for necessary read-only deployment read-back; it sends no signed
POST. Do not restart secret-mismatch diagnosis or rotate keys.


Current execution evidence and exact remaining work:
[`WORK_CONNECTED_ACCEPTANCE_2026-10-19.md`](WORK_CONNECTED_ACCEPTANCE_2026-10-19.md).
The old diagnostic upload/recovery/0% deployment receipts are spent. No command
in a historical stage supersedes the read-only current-deployment collector.
Independent conversation/catalog/quote-recovery/Rewards source and local tests
have advanced; full WORK acceptance remains blocked and must not be claimed.

Updated 2026-10-18. Scope is the existing WORK app/store, My JILL, Shopify commerce, isolated Custom Orders QA and WORK D1. No physical machines, paid infrastructure, LIVE or KEEP release. This plan follows `JILL_HQ_WORK_SYSTEM_MAP.md`, `JILL_HQ_MY_JILL_CUSTOMER_HANDOFF.md` and `JILL_REWARDS_WORK_FLEX_REDEMPTION.md`.

## One identity and one record per business fact

| Fact | Authority | HQ / My JILL responsibility |
| --- | --- | --- |
| Product, variant, collection, price, stock | Shopify | HQ gives native Admin links now; later a scoped read projection and reviewed writes. My JILL uses native Shopify storefront/cart. |
| Customer identity, order, payment, discount | Shopify | HQ uses verified online staff and WORK D1 grant. My JILL uses the verified customer session. Both join on Shopify GIDs, never typed contact details. |
| Original Custom Order, messages and production events | Isolated Google QA source, verified owner ledger | HQ merchant thread and My JILL owner thread use the same submission ID and append-only event writer. |
| Quote acceptance and cross-system handoff | Versioned quote plus WORK D1 operation receipts | HQ freezes terms, rewards code and Shopify calculation. My JILL accepts the exact version. One idempotent draft/invoice/order link is reconciled by Shopify reads. |
| Rewards earn, wallet and coupon | One versioned canonical Rewards backend; Shopify paid order and discount truth | My JILL chooses the exact amount, HQ can display/attach that coupon, both see the same wallet. No independent playground wallet. |
| Private artwork and files | WORK R2 quarantine/registry only after certified limits | HQ and verified customer see authorized short-lived media; no public artwork URL or duplicate upload archive. |

## Build and activation order

| Stage | Work | Acceptance before next stage |
| --- | --- | --- |
| 1. HQ home and request workspace | Keep existing online staff/D1 gate; replace static home with a clear WORK launchpad and native Shopify links. Preserve Owner-only request workspace and its source states. | Authenticated Owner opens inbox; denied staff see no request link/data; Products, Collections, Customers and Orders links stay pinned to WORK. No fabricated metrics. **Source built in this change.** |
| 2. Source health and speed | Read existing allocations/bindings/flags using `work:runtime:inventory:owner`; do not rerun the spent deployment. The old diagnostic rejects a zero-byte HTTP stream before Google; its source correction passes real local workerd HTTP tests. Pin metadata/rollback before reviewing a NEW exact-version gate. Reconcile the original uncertain request by its actual receipt/ID. Keep indexed-read authorization and overflow denial. | Existing traffic unchanged; exact-version signed read-only connection and original intake reconciliation still required. Measure authenticated 20-run performance separately from public health RTT. |
| 3. Catalog and customer reads | Audit current WORK scopes/version and real products, collections, variants, customer permissions. Add `read_products`/inventory only through a reviewed WORK app version; expose bounded Shopify GID projections with server-side staff policy. | Product/collection counts and price/stock agree with fresh Shopify reads; customer A/B privacy and staff revocation pass. Native Admin remains edit authority until a reviewed command exists. |
| 4. One conversation | Version public request events; authenticated customer reply verifies Customer GID and owner ledger. HQ writes through existing merchant command boundary, with internal notes separate from customer messages. Guest claim requires independent proof. | Merchant→My JILL→merchant round trip, duplicate/timeout recovery, denial for another customer, and no message sent to a contact-only email account. |
| 5. Quote and Shopify order | Exact product variant/quantity/price/address/shipping/tax calculation; customer accepts immutable quote version; one linked Draft Order is created, HQ explicitly invoices, Shopify checkout creates Order. | Changed totals invalidate acceptance; duplicate clicks create one draft; uncertain writes reconcile by operation ID and read-back; paid/refund/fulfillment observations match Shopify. |
| 6. Universal Rewards | Migrate v13 whole-point ledger to tenths and preserve issued coupons. Earn 0.1 point per eligible paid $1; 1 point = $1 off with $10 eligible subtotal per $1, no 50-point unlock. Scope discounts to eligible products, once/order, non-stacking. | WORK website cart and HQ draft honor identical amounts, refunds and unused-code expiry reconcile, multi-line baskets do not clip reward, no second deduction in HQ. |
| 7. Playground catalog | Create real Shopify admission/party/snack/drink/merchandise SKUs with reviewed margins and eligibility. Sell through Shopify, join verified purchasing adult to the same Rewards wallet and HQ order view. | Small snack, admission, party, guest and cancellation cases pass without collecting child identity for Rewards. No parallel cash/order system. |
| 8. Roles and observability | Grant least-privilege staff views/actions one domain at a time; expose source freshness, operation receipts and unresolved exceptions from real records. | Owner can audit every quote, invoice and reward transition; revocation works; no analytics number is shown without a verified source/time range. |

## WORK release discipline

- Build and test source first. Read current Shopify app scopes/version and Cloudflare Worker deployment before any release; a Shopify app version includes the three My JILL extensions and proxy, so review their diff together.
- Customer messages, coupons, invoices, drafts and orders are external writes. Use a disposable verified WORK customer, exact operation receipts and read-back for each gate. Never retry a 409 or ambiguous write blindly.
- Keep the active v13 coupon terms for already issued codes. A new policy needs a versioned migration and customer-facing explanation before any customer balance changes.
- Each new screen distinguishes **connected**, **source unavailable**, and **planned**. HQ does not invent customer records, revenue, counts or readiness from a heading.
