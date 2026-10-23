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

## Executed source deliverables — 2026-10-23 (NOT A RELEASE)

**HQ side, draft PR #157:** created `0004_work_contact_tickets_source_only.sql`,
a constrained WORK-only Contact Us ticket schema with no automatic Shopify
Customer GID ownership. Created `backend/work-contact-ticket-intake.mjs`:
default OFF, verifies the WORK Shopify app-proxy signature, shop, origin,
content type, bounded JSON, rate limit, and a server-normalized idempotency
hash; a repeated identical submission returns its original ticket reference,
and a conflicting repeated ID is rejected. Only after a future distinct
approved Shopify app-proxy routing release can this write to WORK D1.
Unlike Shopify's existing native form, this candidate is NOT connected and
is not a replacement until anti-spam and acceptance review.

Created `services/jill-order-desk/work-contact-ticket-inbox.mjs`:
Owner-only HQ D1 source reader, permission gate BEFORE database access,
whitelisted status metadata only, no email/phone/message in list responses.
Registered an HQ `/app/contacts` candidate with navigation and a truthful
not-connected state; its environment flag `JILL_WORK_CONTACT_INBOX_ENABLED`
is **absent/OFF** by default. The D1 migration has not been applied and
no Shopify source has been changed.

**My JILL side, independent PR #156:** planned signed-account-only
Contact Us ticket reader, customer navigation and `Contact Requests`
screen (hard `enabled={false}`), no guessed ownership, no account JWT or
network call while OFF, no fake delivery/unread/reply affordances.
The existing native Shopify Contact Us form remains unchanged and is not
a verified account inbox source. Signed Customer A/B testing and the real
contact-account backend are still missing.

**Source-only test additions:** intake signature/guest/idempotency,
Owner-only HQ projection, route gate, fake/cross-customer receipt denial,
My JILL contact reader and new account page guards. Passing unit tests do
not prove native Contact Us flow integration.

**Critical remaining U2/U4 wiring:** an approved and rate-limited WORK
storefront form adapter that preserves Shopify spam controls; real WORK
database migration after binding audit; D1 ticket detail and canonical
staff/customer conversation events; verified Shopify Customer JWT owner
claim; signed read projection from WORK D1 through an independently
certified account gateway; real end-to-end Customer A/B/guest smoke tests.
Only afterwards can the WORK flags be safely enabled. No LIVE/KEEP or
paid resource authorization is implied.

## U2→U4 source candidate: Contact Us app-proxy routing and proof-of-possession

As of 2026-10-23 the **draft-only**, unmerged HQ tree now has:
- `theme/assets/jill-contact-work-contract.js`: strict field/conditional
  mapping for existing Shopify contact form; `main-contact.liquid` carries
  immutable `data-jill-work-contact-mode="off"`. The existing Shopify
  native form still submits normally by default. `jill-contact.js`
  intercepts submission **only** in a separately approved QA mode,
  only for `jill-work.myshopify.com` and a fixed same-origin
  `/apps/jill-custom-order/contact` endpoint, with NO dual send/fallback.
  Ambiguous delivery retries reuse the exact ticket ID **and claim code**.
- Existing WORK Custom Order Cloudflare Worker now has a distinct exact
  signed app-proxy child route `/jill-custom-order-proxy/contact`, hard
  OFF unless `JILL_WORK_CONTACT_INTAKE_ENABLED==='true'`. Its D1 binding
  is intentionally ABSENT in the published manifest. The 0004 schema
  remains SOURCE ONLY. Existing custom-order routing remains separate.
- The contact intake accepts a newly generated random 256-bit
  `claim_token`, stores only domain-separated `claim_sha256`,
  never persists/returns the plaintext token, and returns the ticket ID
  after an exact DB idempotency/digest check. A confirmed QA receipt
  displays the private code to the customer to save; storing it in browser
  URLs, cookies, localStorage or logs is prohibited.
- `/jill-contact-claim` is a separate hard-OFF Customer Account Worker
  endpoint (`JILL_WORK_CONTACT_CLAIM_ENABLED`), requiring a valid signed
  Shopify Customer JWT AND the possession code. It uses one atomic D1
  conditional update, exact ticket ID, matching code digest and a
  90-day claim window, preventing Customer B from hijacking Customer A's
  ticket. Duplicate confirmation by the same verified customer recovers
  safely. Email/phone/order reference cannot authorize claims.
- `/jill-contact-account` is another hard-OFF JWT-only read:
  `JILL_WORK_CONTACT_ACCOUNT_ENABLED`. It filters D1 **by verified
  Shopify Customer GID** and returns a strictly whitelisted status list.
  No message body, private customer information, read receipts, payment
  status or Shopify order linkage is presented.
- HQ /app/contacts and per-ticket detail are gated by
  `JILL_WORK_CONTACT_INBOX_ENABLED` and merchant Owner/D1 auth. A ticket
  legitimately claimed into My JILL stays available to the merchant,
  with its customer ownership shown only as a verified Boolean.
- My JILL PR #156 has a future Contact Requests list, a claim-code
  client and an opt-in-only claim UI, all mounted with `enabled={false}`.

### Release prerequisites not satisfied
1. Explicit review of Shopify app-proxy subpath forwarding to the Worker.
2. Independent WORK D1 binding/migration 0004 audit; apply on WORK only
   after approval. The current Worker has no contact D1 binding.
3. Spam/rate-limit equivalence to Shopify's native Contact Us protection,
   security review of URL/secret exposure and 90-day claim semantics.
4. Real signed Shopify JWT Customer A/B/guest tests, repeated and
   uncertain submissions, takeover/cross-account denial, mobile and ES/EN.
5. Resolve My JILL historical release certification and reconcile PR #156
   and #157 against their distinct protected base branches.
6. Explicit release decision for *each* flag; do not silently enable a
   browser interception or decommission Shopify native Contact Us.

There has been **no deployment, Shopify form replacement, D1 migration,
customer claim, message send, invoice, order creation or LIVE/KEEP change**.

## Contact Us status → My JILL tracking: verified draft source (October 23)

New `work-contact-status-change.mjs` is an **Owner-only** WORK HQ
candidate requiring a trusted Shopify online admin session, D1
`requests.write` authorization, an exact ticket ID and bounded JSON
command, and the separate `JILL_WORK_CONTACT_STATUS_ENABLED==='true'`
flag (absent/OFF). It compares expected status and revision in one
conditional SQL UPDATE and supports receipt recovery only for the exact
same merchant staff ID, operation ID, revision and resulting status.
Unauthorized staff, stale tabs, forged actors, ambiguous repeats and
payment/fulfillment-like statuses cannot produce a successful change.

The draft D1 0004 migration now adds an **immutable Contact status-event
table** and SQLite triggers: the initial `received` event is written
when a ticket is created, and every revision-checked merchant status
change writes an event atomically with the ticket update. A claim to a
verified My JILL Customer GID does not create fake status events.
The customer-facing status remains read from the **same canonical WORK
D1 row** through a signed Shopify account JWT; it is never inferred from
a merchant email or duplicate private timeline store.

The WORK HQ private ticket-detail page contains status buttons, revision
and bounded failure states, gated by both `JILL_WORK_CONTACT_INBOX_ENABLED`
and `JILL_WORK_CONTACT_STATUS_ENABLED`. It never sends messages,
creates orders or invoices. My JILL's Contact Requests list in separate
PR #156 offers Active/Resolved filtering and displays verified revision.
The source-only cross-surface test proves status/revision consistency and
does not claim a real customer readback.

**CI:** `39996666381` passed HQ source tests, actual SQLite migration
and triggers, embedded-app TypeScript and build. **Not yet complete:**
WORK D1 migration and Workers binding, released Shopify contact adapter,
enabled signed-account gateway and Customer A/B/guest browser acceptance.
The historical My JILL release branch lock remains intact. No deployment,
paid resource, LIVE/KEEP edit or user notification was made.
