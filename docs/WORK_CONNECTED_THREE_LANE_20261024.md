# JILL WORK — three-lane connection rehearsal (October 24, 2026)

## What is happening
This is a **new source-only, non-deploying integration lane** that tests the
existing work together rather than asking the Owner to run PowerShell or
switch production versions.

| Source lane | Draft | Authority/goal | Current release status |
| --- | --- | --- | --- |
| HQ custom orders, Shopify Catalog, draft quotes, Contact Us D1 handlers | #157 (`jill/hq-quote-catalog-preflight-20261022`) | Merchant Shopify Admin session + Owner D1 role; only verified source requests and native Shopify truth | HQ shell/catalog/request read deployed to WORK separately; Contact/conversation/quote save disabled |
| My JILL customer account and message navigation/contact claim clients | #156 (`jill/myjill-message-handoff-preview-20261022`) | Signed Customer Account JWT + exact Customer GID; no email-based claim | Draft; **not published** as a customer extension |
| HQ interface typography, request details and quote disclosure | #158 (`jill/hq-visual-polish-source-20261024`) | Changes display only, preserving request actions and quote logic | Draft; **not** deployed to serving WORK |
| Cross-lane source integration | THIS branch | Synthetic hard-OFF/customer A/B/guest acceptance and combined HQ TypeScript/build in an ephemeral worktree | Source/CI only; **not released** |

### Concrete seams exercised
`scripts/test-work-connected-three-surface-contract.mjs` and the
existing `scripts/test-work-cross-pr-contact-integration.mjs` verify
actual modules from BOTH source branches after an ephemeral Git merge:

1. A signed canonical WORK inquiry receipt grants Owner view and
   Customer A view only for exact Customer A GID; B and guest remain held.
   Forged, cloned and incorrectly signed receipts are refused.
2. Existing My JILL Contact client remains hard OFF before a real
   approved customer-specific endpoint. **Zero session token calls or
   network fetches** in OFF mode.
3. A synthetic, server-projected HQ contact thread passes the actual
   My JILL client projection with identical ordered public messages,
   but staff IDs, operation receipts and private email are excluded.
4. My JILL and HQ both interpret the **same Custom Order** public v2
   conversation timeline; no separate message store, fake unread count,
   read/delivery receipt, or automatic guest account attachment.
5. Raw typed Shopify customer identities or unsigned Owner binding data
   cannot make a quote publish, invoice or order-ready.
6. The visual layer from #158 and its Quote Save/Reload no-persistence
   warning are included in the combined source build.
7. The combined HQ React routes typecheck/build and original quote
   regression suite execute without contacting real providers.

### Non-negotiable deployment protections
- The **running HQ WORK** should remain version
  `d1f4e07f-8c9b-4b40-97a4-0c13d2c5149a`,
  deployment `5d996637-73b4-427e-92a0-a36a12581172`,
  pending separate Owner rollout decision.
- Gateway, LIVE and KEEP must be unchanged. No Shopify Theme change,
  no Cloudflare Worker or D1 write, no customer email/SMS, no reward
  redemption, no draftOrderCreate, and no paid cloud resources.
- This workflow **may create temporary merge commits in a disposable
  CI worktree only**. They are never pushed, merged to protected
  branches or deployed. A failed merge is a HOLD, not permission to
  force files through.
- Shopify authority remains the sole source of Products, Customers,
  taxes, payments and Orders. Google signed intake remains canonical
  for original Custom Order source/status; HQ D1 is not a shadow
  customer directory.
- No feature flags are enabled by these synthetic tests. Actual signed
  Customer A/B/guest browser sessions, Owner session refresh, data
  persistence, Shopify app proxy routing, private media, and quota/cost
  gates **still require real WORK acceptance**.

## What comes next after green source reconciliation
1. Create a reviewable, conflict-free **source integration PR** combining
   the three branches. Do not merge existing drafts blindly; preserve
   protected release history, backend ownership, Storefront and rewards.
2. Certify verified Custom Order account/source mapping with real signed
   Customer A/B sessions; only then enable a WORK Owner/customer
   conversation *read* path.
3. Commission Contact Us server-to-server gateway/HQ trust boundaries
   after D1 and Shopify app proxy checks; do not wire the native form
   until full intake idempotency and abuse protections are accepted.
4. Turn on durable Owner quote Save/Reload only after fresh Owner D1
   write/readback and separate approval. Quote acceptance, Shopify-native
   tax/discount/approval, draft-order/invoice and tracking are independent
   later gates.
5. Visually accept #158 in Shopify Admin, including desktop/mobile, full
   row request accordion and quote disclosure preserving unsaved values.
6. Only with fresh explicit owner approval stage/deploy a reversible
   WORK-only candidate. LIVE/KEEP remain entirely separate.

**Status: SOURCE ONLY / NOT ACTIVATED. CI success is not an authenticated
provider or real-customer acceptance receipt.**

## Source slice U4a — verified unified Owner read queue (October 24)

Added a **real, registered but hard-OFF** Owner JSON route candidate
`GET /app/queue/unified`, separate from the established
`GET /app/queue` and `/app/requests`. This route does not replace
existing HQ screens or change their state.

- `services/jill-order-desk/work-unified-owner-queue.mjs`:
  bounded/strict projection and orchestration for Google-signed
  Custom Order merchant-list metadata plus authorized WORK D1 Contact
  ticket metadata. It discards customer names, emails, private notes,
  phone, raw Contact bodies, staff/owner IDs and message contents.
  Stable ordering by verified update time, Custom Orders first at
  identical timestamps, and then canonical ID.
- `services/jill-order-desk/app-home/app/routes/app.queue-unified.tsx`:
  calls both **existing** independently Owner/D1-authenticated readers.
  `authenticateWorkAdminOnce` shares the exact same request-scoped
  Shopify SDK result without sharing authorization across requests.
  It never accepts a caller-supplied shop, customer GID or email.
- `routes.ts` registers the resource route; `workers/app.ts`
  refuses it with 503 **before Shopify SDK and D1** unless a new,
  separately owner-authorized `JILL_WORK_UNIFIED_QUEUE_ENABLED=true`
  is installed. **That flag is absent in the current WORK manifest.**
  Even with this future flag enabled, Contact is read only if
  `JILL_WORK_CONTACT_INBOX_ENABLED=true` is separately approved.
  Neither flag gives message, quote, invoice, order or Contact intake
  write authority.
- A verified Custom Orders source and Contact OFF gives `state=partial`
  with `contact_state=not_connected` (not "zero tickets"). If the
  Contact source is explicitly enabled but unverified, partial/paged,
  inaccessible or malformed, the **combined list is held with no
  records** instead of falsely claiming completeness.
- Contact JSON response is bounded at 24KiB before parsing and
  validates strict UTF-8. Duplicate IDs, missing provenance, cross-shop
  records, impossible revisions/times or forged delivery flags hold.
- `scripts/test-work-unified-owner-queue.mjs` exercises both valid
  queues, no PII, deterministic sorting, hard OFF (zero sources read),
  false Contact readiness, unauthorized Owner and source errors.
  The three-lane ephemeral workflow runs the tests and builds the
  registered React Router route.

**Limitations:** This is a source-only read integration, not an
activated unified HQ inbox or a reason to re-route Shopify's native
Contact form. Real requests are still authoritative in their current
separate displays; customer messaging, Contact intake and quote drafts
remain under their pre-existing hard-OFF controls. Test this optional
read-only route in WORK **only after** a fresh account/Owner approval,
D1 and source proof, and separate deployment decision. The currently
working 100% WORK Worker is unchanged.

### Owner screen candidate (still disabled)

The same integration branch also has
`app/routes/app.inquiries.tsx` and isolated `hq-inquiries.css`.
This is a **real React Router read-only Owner page** at
`/app/inquiries` registered alongside the JSON resource route.
Both URLs share the exact same **absent-by-default**
`JILL_WORK_UNIFIED_QUEUE_ENABLED` Worker ingress block, before any
Shopify OAuth or database read. No navigation entry points to this
route yet; the currently accepted Requests page is untouched.

The page shows only canonical ID, kind, source status, last activity,
and verified Custom Order item/date or Contact reason. It links to
the existing restricted detail routes; it never shows names, emails,
private data, message contents, paid/fulfilled status, or fictional
read receipts. If Contact is OFF it states that *only verified Custom
Orders* are being shown and explicitly refuses to interpret that
as no Contact inquiries. Responsive layout and keyboard focus
are isolated to the new page; no global UI overrides.

The synthetic test additionally checks registration, both exact
route ingress guards, no enabled manifest flag, read-only rendering,
and a blocked Shopify/customer/browser storage surface. CI typechecks
and builds this page together with My JILL and the accepted visual
polish. It remains **source-only** until a separate Owner-authorized
WORK deployment and real end-to-end acceptance.
