# JILL WORK — Unified HQ / My JILL / Shopify milestone plan
**Prepared:** 2026-10-23 · **Status:** SOURCE PLAN, not deployed · **Budget:** free-tier only; no paid provisioning without explicit approval.

## One product, three connected surfaces
**Storefront** collects requests and public inquiries. **My JILL** shows ONLY what the signed-in Shopify Customer Account truly owns, including request history, conversation, quote decisions and linked Shopify purchase/fulfillment state. **HQ** is the authorized merchant workspace for triage, communication, catalog, quote building, invoice/order management, attachments, shipping and staff roles. **Shopify** remains authoritative for Customers, Products/Variants, Discounts, Orders, money, taxes and Fulfillments. Existing signed Google WORK QA intake is canonical for original Custom Order forms/status; WORK D1 is merchant-index/draft metadata, not a duplicate customer directory.

No browser-entered email/name/phone/order number or Liquid `customer` hint is authentication. Never autoclaim a guest inquiry by contact details. No duplicate permanent message histories or shadow payment/order tables.

## Evidence-based starting point (as of 2026-10-23)
| Feature | Confirmed source/runtime | Remaining |
| --- | --- | --- |
| HQ requests / M1–M2 | Historical WORK merchant inbox and read workspace previously Owner-verified. Protected preview version remains separate. | New edition's deployed UI and access must be independently accepted. |
| Custom Order storefront | Guided Custom Order form and signed WORK intake/Google canonical ledger exist. | Verify current end-to-end request-to-HQ-to-My JILL for signed Customer A, Customer B and guest. |
| My JILL | PR #156 contains Custom Orders → Messages navigation, guarded drafts, signed account reads; dedicated preview CI passed, draft/unmerged. | Independent extension and gateway certification, real Customer A/B accounts, two-sided message readback. |
| HQ quotes/catalog | PR #157 includes saved quote ↔ exact Shopify Catalog source preflight, draft/unmerged, hard OFF. | One verified Owner integration, safe calculation, customer quote presentation/acceptance, invoice/order. |
| Ownership | Google WORK owner-ledger proof source, HMAC/nonce checks and Shopify Customer ID reader prepared. | Real Google QA signed published endpoint, CI/canonical source certification and exact Customer lookup. |
| Contact Us | Theme `{% form 'contact' %}` posts natively to Shopify; reason/fields/validation currently exist. | **There is NO verified durable HQ ticket or My JILL record from this form.** Do not claim it is integrated. |
| Product catalog | Read-only verified variant/price pathway exists in draft branch. | Authorized CRUD, inventory, media and synchronization controls, with Shopify authoritative. |
| Orders / payments / tracking | Shopify-native planning and fail-closed preflight only. | Real customer approval, Shopify native totals/taxes, invoice/payment/order and fulfillment status links. |

## Unified event and authority contract
Every record has a **kind**, **canonical stable ID**, **source/version/revision**, **integrity proof**, **created/updated metadata**, **Shopify shop context**, and optional immutable verified Shopify Customer GID. A privacy-filtered projection supplies each UI; never expose HMAC secrets, private media, raw signed payloads or internal notes in My JILL.

1. `custom_order`: canonical Google WORK signed intake + immutable `CustomOrderOwners` ledger + status events. Signed customer session controls My JILL ownership. Guest stays HQ-only until a separately authorized verified claim process exists.
2. `contact`: current native Shopify contact notification is **not** a signed/stable customer ticket. Build a dedicated WORK server intake to produce a durable ID, idempotency receipt and verified HQ entry. Preserve the existing Shopify contact form UX/spam protections until replacement has equivalent controls, acceptance proof and explicit release. An email notification alone is not a durable ticket nor a Shopify Order.
3. `message`: original request/thread or verified contact ticket canonical ID; merchant-side Shopify admin + staff D1 auth; customer-side Shopify session JWT + exact owner match; same conversation timeline and idempotent operation IDs. Contact guest response by controlled merchant channel, never exposed as a claimed My JILL thread.
4. `quote`: WORK D1 saved merchant draft bound to canonical signed intake revision; Shopify exact variant, price and Customer GID, customer-approved delivery/shipping and Shopify native tax/total calculation before presentation.
5. `approval`: explicit signed customer decision bound to **exact immutable quote revision/total/currency**, idempotent and audit logged. This is not equivalent to sending an email or opening a quote link.
6. `commerce`: after approval, owner-authorized Shopify draft order/invoice/real order and webhook/state reconciliation. Shopify authoritative; My JILL reads the linked Shopify order via authenticated account surfaces; HQ reads authorized Shopify Admin. Never record `paid` from a reply or unverified callback.
7. `fulfillment`: Shopify fulfillment/tracking or verified merchant pickup events. Display customer-visible status and the verified tracking link only. Do not fabricate shipment/delivery or read receipt.

### Cross-surface acceptance matrix
| User action / event | Storefront | My JILL (customer) | HQ (merchant) | Shopify authority |
| --- | --- | --- | --- | --- |
| Custom Order submitted | Immutable receipt/ID | Signed owner's request, timeline & items | Inbox row/detail, reply and status | Signed Customer ID only if verified; product variant links |
| Contact Us submitted | Verified ticket ID after NEW intake rollout | Only authenticated owner-linked ticket; guest has no automatic claim | Contact inbox, category, staff assignment & response | Contact source/Customer ID only when independently verified |
| Merchant replies | Customer history in My JILL after authorization | Same canonical thread, refresh/recovery | Same thread and reply status | Customer identity only, not separate message ledger |
| Quote prepared | Not a checkout/order | Read-only exact quote revision | Saved draft, pricing/fees/shipping checks | Live products/prices/tax totals |
| Quote accepted/declined | No implicit order | Signed explicit decision/revision | Visible response and audit | No order until authorized conversion |
| Invoice / payment | Shopify-controlled payment flow | Native order/payment status | Authorized invoice/order view | Shopify order/payment authoritative |
| Production / delivery | Normal storefront unaffected | Verified timeline + Shopify tracking | Work queue + fulfillment controls | Fulfillment and tracking authoritative |

## Integrated milestones and hard acceptance gates
- **U0 — Source truth and release inventory:** identify the installed Shopify WORK app/extension, Google QA versions, Cloudflare deployment and D1/R2 bindings; retain protected M1/M2 receipts. No speculative LIVE routing.
- **U1 — Unify verified request read models:** publish an internal, source-only discriminated `custom_order|contact` inquiry contract and read-only per-surface projections. Unit tests for guest, Customer A/B, malformed events, duplicate IDs and wrong stores. In this draft, `work-unified-inquiry-bridge.mjs` implements only an HMAC receipt/visibility policy, not a backend or form adapter.
- **U2 — Contact Us durable intake:** design authenticated/anti-spam storefront endpoint, idempotent durable ticket, staff classification, bounded attachments with private upload separately, and Shopify form compatibility/replacement. Verify persisted ticket in HQ; customer-owned contact tickets only after signed session exact GID binding. No double-delivery or false success.
- **U3 — Complete Custom Order Customer ownership:** certify Google WORK signed owner/nonce proof and Shopify exact Customer read; submit Customer A & B and guest scenarios; no email-based claims. Keep shipping agreement distinct.
- **U4 — Shared inbox and messages:** every signed custom order and customer-owned contact inquiry appears in My JILL; both appear to authorized HQ staff. Single timeline, replies, retries, server IDs and readback; no fake unread or delivery labels. Staff access must be assignment-aware before broad release.
- **U5 — Quote review:** complete exact Shopify Catalog read, P1/P2 personalization and attachments mapping, owner pricing edits/draft revision, discounts/rewards validation, shipping consent and native tax/total calculation. Source-only preflight must pass before route enable.
- **U6 — Customer quote decisions:** show complete revision-bound quote in My JILL, explicit accept/decline/request-changes actions; reconcile identical decision back to HQ; no money/order mutation until signed approval and approved terms.
- **U7 — Shopify commerce:** explicit owner-mediated invoice/draft-order/order creation after U6, idempotency, webhooks, failure recovery and correct Shopify taxes/discounts/shipping. Only Shopify payment/fulfillment statuses may show paid/shipped.
- **U8 — Shopify tracking and customer history:** link exact Shopify Order/fulfillment to source ticket, display in HQ and Shopify native Orders/My JILL without leaking unrelated orders. Pickup is verified separately.
- **U9 — Catalog & media operations:** authorized product/variant/inventory edits, reusable personalization schemas, private artwork/PDF quarantine, controlled media grants, and bounded syncing. No fees beyond free-tier approved capacity.
- **U10 — Rewards and membership integration:** unified customer identity across points, coupon-wallet and checkout without duplicate discounts. Rentals/memberships planned as a later separate lifecycle, not silently treated as shippable products.
- **U11 — End-to-end WORK acceptance and release:** Customer A / B / guest + unauthorized staff; every form, messaging, quote, order and tracking path; visual/mobile EN/ES checks; negative permission/race/replay tests, successful source CI and real WORK smoke tests. Only then request explicit approval to publish or move toward LIVE.

### Parallel development lanes (do not conflate with releases)
**Lane H: HQ/Shopify** = PR #157, `jill/hq-quote-catalog-preflight-20261022`, based on protected M1/M2 preview. Scope U0–U3 and U5–U9. **Lane C: My JILL** = PR #156, `jill/myjill-message-handoff-preview-20261022`, based on Rewards WORK. Scope U1, U3–U4, U6–U8 and rewards. A future integration branch must reconcile BOTH source trees under their existing historical guardrails; no direct cross-merge or source-lock bypass.

**Next exact implementation sequence:** (1) finish signed private owner-proof tests and Google QA staging plan; (2) implement **Contact Us** server durable ticket model and read-only HQ inbox adapter while preserving existing live native form; (3) implement My JILL authenticated contact ticket list/projection without guest autoclaim; (4) join both inboxes and conversation routes under one source revision; (5) quote decision and Shopify order lifecycle; (6) verify deployed WORK + customer A/B + mobile/ES/EN; (7) explicit release.

### Release safety (mandatory)
No hidden deploy, merge, paid service, LIVE/KEEP change, customer reply flag, draft order creation, invoice issuance or file exposure. CI is source proof, **not** provider deployment certification. All integration changes must be idempotent and default OFF; fail closed if identity, ownership, source, catalog, consent or staff permission is unknown. No historical receipt replay, no old @9 Google detail endpoint repurposing, no changing billing limits.
