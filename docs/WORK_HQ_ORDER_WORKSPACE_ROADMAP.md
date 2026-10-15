# JILL HQ WORK — low-latency Custom Orders and complete quote-to-order lifecycle

**Scope:** `jill-work.myshopify.com` and the isolated JILL HQ Worker. Nothing in
this document grants a production scope, rotates secrets, issues an invoice,
creates an order, updates Shopify LIVE, or sends email.

## Verified implementation today (2026-10-15)

- Merchant inbox already authenticates Shopify online Admin, verifies WORK
  D1 Owner permission, then fetches a signed, nine-field projection from
  Google Custom Orders QA. Google is still the canonical status/events
  authority. Merchant status changes were reported by owner to be saving
  correctly across the tested surfaces.
- Existing request intake transport in
  `contracts/custom-order-api.schema.json` supports **items, product/variant
  IDs, allocations, personalization attributes and groups, reference_ids,
  date needed, fulfillment, and customer details**. It is NOT necessary to
  replace the working submission form to show these details in JILL HQ.
- Current merchant workspace deliberately contains only nine summary
  fields; it does NOT have an authorized full-detail reader or original
  uploaded file resolver.
- Current My JILL account reader is read-only, verifies the signed Shopify
  customer JWT and scopes source results by verified Shopify customer ID.
  It cannot yet accept a quote or upload revisions.
- Email note commands currently append customer-visible canonical events
  and queue mail. **Queued does not mean sent.**
- Original 20-second Cloudflare per-isolate source cache cannot guarantee
  fast reads from a different Worker isolate. The Google POST has a 15s
  request timeout, so an observed **60+ second** route delay could also
  involve Shopify embedded navigation/auth retries or sequential router
  work. This needs actual Network timing data.

## Phase 0 — immediate performance correctness and evidence

1. Retain PR #84's canonical **one server-only inbox data loader**; never
   add another route/index loader pointing at Google.
2. Expose only numeric `Server-Timing` for Shopify session verification,
   WORK D1 Owner authorization, canonical Google read and total time. Keep
   `x-jill-feed-cache` (miss/hit/joined), preserve no-store responses.
3. Measure cold HQ→inbox, warm inbox→workspace/back, expired navigation,
   30 rapid back/forth transitions, post-status-save refresh and direct URL.
   Include any 200-but-blank/React Router error response or OAuth redirects.
   No speculative one-minute latency claim without a real timing trace.
4. If slow stage is Google: build a bounded, shared **WORK D1 materialized
   inbox index**, containing only nine validated fields and an atomic
   generation/version. Always run Shopify+WORK D1 Owner authorization
   **before** reading it; canonical Google remains source of truth. A successful
   write must invalidate/update the shared index, with race-safe generation
   checks. Require separate WORK-only D1 migration and release flags. Do not
   show stale/unverified values silently as canonical, and never store raw
   customer names, emails, notes, files or tokens in the index.
5. If slow stage is Shopify/session/router: fix that measured path, not
   longer Google caching. Avoid JS reload hacks, animation masks or repeated
   hidden prefetch waterfalls.

## Phase 1 — real merchant detail source

Introduce a **new, exact-ID, Owner-authorized server-side detail operation**
on the dedicated WORK QA project. It must verify the Shopify Admin online
Owner session and WORK D1 role before signing a backend read. The Google
handler must require the dedicated merchant-read secret and exact shop;
retrieve only one immutable `raw_payload` using `submission_id`, validate
against the canonical transport contract, verify it corresponds to that same
submission, and return a bounded whitelisted detail.

Merchant screens:
- Inbox: fast cards showing item title, quantity, deadlines, statuses and
  quote progress from a small verified index — **no full media downloads**.
- Workspace: item-by-item variants and quantities, customer instructions,
  common and per-unit personalization groups (P1/P2 etc), reference-file
  manifest/preview, exact full original request, status timeline, production
  notes, files, pricing, versioned quotes and order links.

The source payload is immutable after intake; any approved customization
change requires a distinct revisioned merchant/customer change record, NOT
overwriting raw intake or canonical event history. A customer cannot browse
another customer's request by guessing IDs or contact data.

## Phase 2 — private two-way attachments

Use a private WORK file store (e.g. Cloudflare R2), not unauthenticated
public URLs, to hold original art, proof images and PDFs; R2 is a proposed
design and **is not provisioned yet**. Add a table of attachment metadata
scoped by WORK shop, exact submission ID, Shopify-verified customer or
authorized merchant actor, upload intent, visibility, file state and
content SHA-256.

- Staff can upload design proof/media and mark it private or
  customer-visible; customers may upload reference/revision files through
  a **customer-JWT-verified**, owner-scoped route.
- Server creates short-lived one-file upload/download grants; enforce
  MIME + content sniffing, fixed image/PDF type allowlist, per-file and
  per-request limits, anti-malware policy, no executable SVG/HTML, filename
  sanitization and private access on every download. Show image previews and
  PDF download/preview only after authorization.
- Original `reference_ids` must be mapped to verified existing files; an
  arbitrary request-supplied URL must never become a trusted file link.
- Keep Google Sheets for lightweight reference/event metadata, not binary
  media or broad public URLs.

Shopify Admin `stagedUploadsCreate` plus `fileCreate` supports Shopify
file storage, including images and generic PDF files. Do not make customer
artwork public through Shopify Files without an explicit visibility decision.

## Phase 3 — quote engine and agreement

One versioned, immutable-at-approval quote per revision. Item line data
contains original item_id, variant ID if real Shopify variant, unit allocation
and personalization attributes, quantity, quoted USD unit price in cents,
discount, production/handling fees and price provenance. No float arithmetic
for totals. A quote needs shipping choice, packaging dimensions/weight and
a legitimate shipping destination to calculate carrier/Shopify rates.

- Pickup: explicit zero shipping when eligible.
- Shipped: calculate rate with a verified deliverable address, package
  specification and a valid Shopify/carrier shipping rate or a labeled
  merchant-approved custom shipping price. Never invent a live USPS rate.
- Taxes: let Shopify Draft Order calculation/tax rules determine tax;
  a local preview must mark any estimated/unavailable tax clearly.
- Lock a quote hash, customer ID, expiry, shipping option and exact
  revision at send/approval. Changes to items, pricing, media proof,
  shipping address or amount invalidate prior acceptance and require
  approval of a **new quote revision**.
- My JILL approval/rejection must verify fresh Shopify customer session
  JWT bound to the request's true owner; email/phone possession alone is
  not sufficient to claim or approve someone else's request.
- Use unique operation/idempotency keys and reconcile uncertain Shopify
  mutations via persisted external references. No double invoice/order.

## Phase 4 — real Shopify Draft Order then regular order

Use WORK Shopify GraphQL Admin scopes and staff permissions only after
independent scope review and WORK-only app reauthorization.

1. `draftOrderCalculate` for itemized totals, shipping/tax/discount preview.
2. `draftOrderCreate` for the frozen accepted quote. Prefer Shopify variant
   lines where applicable and explicit custom lines where JILL is making
   one-off products. Preserve personalization and quote/submission IDs
   in supported custom attributes/notes/metafields.
3. `draftOrderInvoiceSend` sends the **Shopify checkout invoice**;
   user confirmation of a quote is not proof of payment.
4. After customer checks out or a permitted merchant completes a draft
   using `draftOrderComplete`, record and verify the regular Shopify
   order ID/payment status. Do not create an independent duplicate order.
5. Show linked Draft Order, checkout state and final Shopify order in JILL
   HQ and the verified customer's My JILL. Track fulfillment/shipping through
   Shopify's canonical order status, not a handwritten sheet field.

No invoice is sent and no order is created during a code or QA dry run.
Require a disposable WORK customer/request and an explicitly approved
end-to-end test before switching any payment/Shopify-create flag on.

## Launch order and acceptance

**First**: fix measured >60s cold inbox, prove 30+ repeat navigations do not
break, no duplicate source reads. **Next**: exact-ID detail projection and
display existing personalization/attachments. **Then**: controlled private
uploads and a quote engine. **Finally**: customer approval, WORK Shopify
Draft Order + invoice + actual Shopify order reconciliation. Production
LIVE/KEEP promotion is separate and requires approval plus a full security,
permission, tax, shipping, duplication and payment audit.

Current implementation status: phase 0 source timing is under development.
Phases 1-4 here are architectural requirements, **not yet deployed features**.
