# JILL WORK — three-lane connection rehearsal (October 24, 2026)

## October 26 — connected Shopify WORK read-only provider evidence

Read-only Shopify account and Admin GraphQL reads independently verified that the
connected store is **JILL WORK** (`jill-work.myshopify.com`), currency
**USD**, plan label **Basic App Development**. This is the intended
testing store, not a LIVE checkout certification.

A bounded Catalog query returned **15 total products** (exact count);
the three newest sampled made-to-order products (custom tote bag,
18-inch piñata and DTF hoodie) each reported product `totalInventory = 0`.
A product-level reported zero does not prove that its variants track stock,
that physical inventory is unavailable, or that JILL cannot make the item
to order. HQ inventory presentation must remain conservative and
variant-tracking/fulfillment truth must be read independently.

The WORK store's current Shopify Admin `appInstallations` read contained
an installed app **JILL HQ — WORK** (handle `jill-work-rewards`) with
**16 granted access scopes**, including `read_products`,
`read_inventory`, `read_locations`, `read_customers`,
`read_orders`, `write_draft_orders`, `read_app_proxy` and
`write_app_proxy`. This confirms the **store's installed-app scope
inventory** from a fresh provider read. It **does not** verify the active
published extension version, current Owner online session, proxy destination,
WORK Worker/D1 bindings, real quote saved-draft readback, Shopify
`draftOrderCalculate` results, invoice consent, native customer sign-in
or LIVE readiness. No private customer or order rows were read.

No Shopify API mutation, credential change, order, invoice, customer
message, discount, upload, paid service or Cloudflare operation occurred.
All real WORK end-to-end and release gates remain **HOLD**.

## October 26 — started-read lease integrity + customer attention (next source QA)

- HQ #177 exact source `3e795f71103c44d15023e5292eaec97bbad53015`: bounded request viewport prefetch now **does not free an active slot merely because its row was canceled/unmounted**. A started read holds its lease until fetcher completion, or a 30-second safety deadline if the component disappears; queued jobs cancel immediately. Explicit Owner row expansion remains immediate. Source unit tests include a deterministic fake clock; **this is not proof of actual WORK network latency**.
- My JILL #178 exact source `11477272445e6d0081532c46dd8bc0877db5a055`: one read-only Home "request to check" from already verified signed requests—on hold, ready for pickup, awaiting approval by strict priority and last activity. The existing safe next-step text does **not** imply available quote approval, payment, messages or fulfillment.
- The CI joins these exact immutable sources in a disposable worktree, exercises race/ownership/presentation/quote/Contact/Catalog/Rewards synthetic regression, HQ typecheck/app build and Worker bundle. Earlier #176 source proof remains unchanged.
- No Shopify authenticated Owner or Customer A/B/guest WORK browser acceptance, no provider verification, no Cloudflare/D1/R2 rollout, no Shopify app publication, customer message, invoice, Rewards mutation, LIVE/KEEP or paid usage.

## October 26 — bounded Owner detail prefetch + My JILL Home context (isolated QA)

**Source-only, not an authorized WORK rollout or measured performance certification.**

- HQ #174 exact pin: `3aec81fa5fc935b6b65b17edd7efb652983a8bc0`. The existing Requests viewport-based name/detail lookup uses a two-slot FIFO queue per verified inbox component instance instead of unrestricted parallel automatic reads. Explicit row expansion bypasses the queue; unused queued rows can cancel; failed starts do not block future rows. This may reduce Owner request-load contention, but real 20-run authenticated WORK cold/warm p50/p95 measurement remains required.
- My JILL #175 exact pin: `4b11fc9f8db467b194122da197cd391e953db6c8`. The source-backed recent Custom Orders on the Home screen show total requested quantity, the customer's needed-by date, and original pickup/shipping preference, when verified. No new account identity, API calls, storage, Rewards or promise about paid/shipped/delivered state.
- CI must SHA-check both exact lane heads before ephemeral merging, run queue/FIFO/abort synthetic tests and signed recent customer-account projection tests, together with A/B/guest messaging, quote, Contact, Catalog, HQ TS/build, Worker entrypoint. No GitHub remote branch merge or provider mutation.
- The previous PR #173 source receipts remain separate evidence. Shopify staff/customer signed runtime, app extension publication, WORK bindings, D1/R2/Cloudflare, quote sends, payments, LIVE/KEEP, operating costs and actual UI/p95 acceptance remain HOLD.

## October 26 — HQ item preview + My JILL order summary (source only)

These two **independent** UI increments implement existing master plan #152 / HQ #163 / My JILL #164 commitments without new data sources.

- HQ draft #171 pinned to `52ec09aee09e4e9fa071eeb6f65d106a65bf8e20`: the previously verified exact-ID Owner request detail now renders requested item titles/quantities, selected variation quantities, item options and expandable P1/P2 personalization within the existing row accordion. It does not display raw reference IDs or media URLs, alter the original full-detail page, staff rights, Messages/Status actions or business writes.
- My JILL draft #172 pinned to `7e1513ac53dbdb389d70fb60af3fa328327a9ba4`: original signed Customer Account Custom Order cards show item-line count, total requested quantity, needed-by calendar date and chosen pickup/shipping when verified. This does not imply an invoice, payment, confirmed shipping or delivery ETA.
- Same isolated source-join workflow **fails closed on either source drift**, runs signed projection privacy/guest A/B/Contact/message/quote/Rewards/Catalog synthetic checks, both focused UI tests and HQ typecheck/build. No remote branch merge.
- Historical PR #167 and PR #170 source receipts remain separate evidence. **CI is not a WORK provider/browser acceptance**: exact Shopify app version/UIDs, Cloudflare headroom and current bindings, actual owner/customer permissions, phone/desktop visuals, D1 migrations, message sends, quote approval and commerce are all HOLD.

## October 26 — exact recovery UX follow-up (source QA only)

- HQ #168 exact reviewed source `c86f286a6457a4fefaf70f76485148bd0867147a`: on the established Owner-scoped request row, a failed/empty details fetch no longer leaves an endless loading indicator; same signed exact-ID route may be retried. Row accordion and two direct actions remain.
- My JILL #169 exact reviewed source `53c92371522bbad5ef1d5452d68f48cbe898d4ab`: a navigation hint from verified Recent Requests/Custom Orders clears the prior inbox folder filter so a finished owned conversation can open; the reader still verifies the exact account before selecting.
- This ephemeral rehearsal rejects either moved head before merging, keeps the prior #167 verified source ledger intact, reruns synthetic customer A/B/guest, quote/Contact/message tests, the focused HQ retry and My JILL filter/deep-link regression, and HQ compile/bundle.
- **No WORK provider session or deployment happened.** Live account/browser presentation, actual Owner detail error recovery, current flags, Cloudflare/Shopify QA, payments, sends, data migration, LIVE and KEEP remain independent approval gates.

## October 26 — independent HQ + My JILL increments joined (new draft)

**Source-only, pinned multi-branch rehearsal; NO release.**

- HQ Catalog truth (#165) source pinned: `3641d156a6b8b1d63e7af86f25dc10fb968d5c91` — distinguishes Shopify *reported* product inventory totals, especially 0 or untracked, from verified available stock. Preserves Admin read permissions, existing product/variant queries and route UI.
- My JILL Messages filters (#166) source pinned: `54c03aa6982d881365ec9093115075e0f7bee01f` — filters only verified owned Custom Order conversations by canonical active/finished statuses. Keeps original signed account identity checks, conversation writer, operation receipts, contact flags and Rewards untouched.
- The integration workflow refuses SHA drift **before** ephemeral merges and reruns cross-surface A/B/guest, public-thread, Quote/Contact/Shopify Catalog synthetic tests, HQ typecheck/UI build, and new pure inventory truth tests.
- Preserve the independently successful original #160 and #162 pinned integration checkpoints. This draft does NOT merge branches into release, publish My JILL, migrate D1, send messages, activate WORK flags, operate Shopify APIs, alter Cloudflare traffic, LIVE or KEEP.
- Separate real authenticated WORK merchant and customer phone/desktop acceptance, current identity/rollback/budget audit and explicit Owner approval remain required.



## October 26 source provenance hold (separate draft; never a release)

The ephemeral three-lane GitHub rehearsal now **fail-closes on upstream
source drift**, rather than automatically trusting whatever each open
draft branch points to on the day of a rerun.

- My JILL customer source + privacy-safe signed account retry (draft #161, based on #156): `8085051cdf4534c22216858a71419edd3e09fb28`.
- HQ visuals source (draft #158): `0c7d006c12274390878ae2c327efb3111a30d2cd`.
- HQ/catalog/conversation integration uses the currently checked-out
  branch and requires its independent draft/CI review (#157 and #159).

On any drift, the job prints `HOLD` before ephemeral merges, Node tests,
dependency installation or compilation. To accept newer source, review
the Git differences, privacy/authentication and hard-OFF guarantees,
update these exact pins intentionally, then rerun source-only CI.
A passing run identifies the exact integrated revisions but **does not**
authorize Contact or quote activation, D1 migrations, extension publishing,
Cloudflare traffic allocation, WORK provider acceptance, or LIVE/KEEP changes.

## October 26 — recovery revision in joined HQ + My JILL rehearsal (nested draft)

This source-only rehearsal explicitly upgrades the pinned customer branch to
the independently reviewed **My JILL verification retry** draft #161 while
keeping the exact approved HQ visual revision. The prior QA PR #160 stays
unchanged as a permanent baseline. A failed Shopify account identity check
continues to hide the entire customer-owned content subtree, with an explicit
customer-initiated **Try verifying again** action that requests a new
authenticated Shopify principal; it cannot unlock records from UI state.

- Customer source: `8085051cdf4534c22216858a71419edd3e09fb28`, pinned
  and drift-rejected before the ephemeral merge.
- HQ visual source: `0c7d006c12274390878ae2c327efb3111a30d2cd`, pinned.
- Joined tests rerun the actual customer account-switch/identity-retry source
  guard, synthetic A/B/guest isolation, message/Contact and quote contracts,
  and combined HQ compile, without a remote merge or provider mutation.

A green CI result is source/build compatibility only. Browser-visible retry
behavior, live Shopify token expiry, WORK account A/B/guest navigation,
extension publication, D1 migrations and Cloudflare runtime remain HOLD until
separately authorized and independently observed. No change to Rewards,
existing storefront, LIVE/KEEP, source ownership or free-tier budget.

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

## Quote Save/Reload: actual SQL + handler acceptance, still offline

Added two **executable integration tests** to the same three-lane source
rehearsal (using Node.js 22's in-memory SQLite, NOT Cloudflare D1):

1. `scripts/test-work-quote-sqlite-roundtrip.mjs` executes the **exact
   audited SQL plans** from `planLocalWorkQuoteDraftSave` in an isolated,
   transactional SQLite database. It asserts original amounts and total
   in integer cents, the idempotent original operation receipt, no second
   receipt on a repeat, optimistic-revision conflicts on stale write,
   correct second revision, unique-operation rollback preserving the
   previous row, and cryptographic rejection of corrupted price hashes,
   foreign shops and changed signed source revisions. It passes a verified
   D1-shaped row through the **actual** server projection and UI
   `hydrateVerifiedWorkQuoteWorksheet`, proving the same cents and
   item identities survive Save → Read → Restore.
2. `scripts/test-work-quote-http-sqlite-roundtrip.mjs` calls the **actual
   Owner HTTP Save and Read handler functions**. Their D1 interface is
   backed by disposable SQLite with a synthetic WORK Owner authority
   and Shopify-SDK-shaped online session, not a real Shopify token.
   It proves the capability OFF state reads neither Shopify nor the
   signed source, Owner/WORK D1 authorization precedes business data,
   Save/Read produces a server-verified draft, replay reports a
   duplicate rather than a second write, stale revisions return 409,
   legitimate CAS updates increment once, foreign shop/non-owner/
   wrong Origin cannot write, source revision drift refuses both
   Save and Reload, corrupted stored hash cannot leave the server,
   and no provider mutation occurs.

The scripts are **tests of real application code**, not a simulated
UI “Save succeeded” label. However they do **NOT** certify live
Cloudflare/D1 schema state, real OAuth expiry, worker ingress,
network delivery, payments or external customer acceptance.

### Separate Owner release gate to enable quote drafts later

- Keep `JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED=false` in all currently deployed
  WORK versions and leave LIVE/KEEP unchanged.
- Verify WORK D1 migration/table/unique operation receipt identity and
  free-tier usage on the exact existing account, fresh authenticated
  Shopify Owner session, and signed Google QA request/source revision.
- Check locked existing Workers' bindings/secret names, publish a
  separately authorized **inactive** WORK candidate, inspect exact
  version bindings and rollback version, and separately authorize any
  traffic promotion. No assumptions from source CI.
- Owner then tests one synthetic request Save → Reload → page refresh →
  second edit → Save → Reload, plus two simultaneous tabs,
  stale source revision and denied non-Owner session. Observe actual D1
  readback and ensure no quote sent, draft Shopify order generated,
  invoice sent or customer messaged.
- **Do not enable** quote publication, invoice, Shopify order creation
  or customer approvals as a side effect of persisting merchant drafts.

**Current result: source/SQLite synthetic acceptance only; HQ WORK
quote Save/Reload remains OFF until a distinct Owner authorization.**

## Contact merchant message readback — source-only acceptance

Added executable `scripts/test-work-contact-sqlite-customer-readback.mjs`.
This runs the **actual** `persistWorkContactMerchantMessage` SQL
against an isolated transactional SQLite schema and the actual
`readWorkCustomerContactThread` signed Customer Account JWT verifier.
Its server result then passes through My JILL's existing
`projectOwnedContactThread` public client projection.

Tests establish: hard OFF performs zero D1 operations, unclaimed
Contact tickets cannot be messaged, Owner-only authenticated writes,
idempotent operation receipts, stable sequential messages (1, 2),
unchanged content on duplicate submissions, cross-ID conflicts,
Customer A-only exact claim, Customer B/guest/forged-token denial, and
exclusion of staff IDs, operations, hashes, owner GIDs and private
Contact details from customer-visible records. The D1 is **only**
Node's disposable in-memory SQLite. No actual WORK resource is read
or modified.

The existing HQ Contact detail page previously discarded merchant
draft text immediately on an acknowledged write, without a fresh
public-thread readback. Added a pure
`verifyWorkContactMessageReadback` policy and updated source-only
`app.contacts.$ticketId.tsx` to retain the typed message and
operation ID until a separate authenticated Owner detail revalidation
returns the **same ticket, exact sequence, exact message text and
public author**. A late server response must also echo the **exact
idempotency operation ID**: a stale acknowledgment cannot confirm a
different/newer draft. The editor shows an explicit Verify saved
message action when the readback is pending. After exact confirmation
the editor clears; the UI explicitly distinguishes stored message
visibility from customer reading, email delivery and push
notifications. The test file
`scripts/test-work-contact-message-readback-policy.mjs`
covers wrong ticket, stale receipt, crossed operation, altered text,
wrong author, incomplete thread and duplicate matches.

**This does not enable customer-authored replies to Contact tickets.**
That is a separate protocol/database/schema design. It also does
not deploy Contact intake, claims, merchant sends, My JILL publishing,
quote saving or conversation flags. These are source-only negative
and happy-path tests in GitHub's ephemeral three-lane CI, not live
OAuth/Customer A/B browser acceptance.

## Contact Us two-way customer replies — source-only V2 (October 24)

Created an **additive** Customer Contact reply protocol. Existing
merchant-only `jill_work_contact_messages` and its Owner actor
requirements remain unchanged. There is **NO deployed schema migration,
app extension publishing, or feature activation**.

New files:
- `services/jill-order-desk/migrations/0005_work_contact_customer_replies_source_only.sql`
  — separate immutable customer reply table with exact claimed Customer
  GID, unique operation receipt, sequence 1–50, bounded body/hash and
  foreign key. SQLite triggers deny other account owners, unclaimed or
  resolved tickets, over-50 combined threads, and mutation/deletion of
  recorded customer messages. **Never run migration without separate
  explicit WORK Owner approval.**
- `backend/work-contact-customer-reply.mjs` — signed Shopify Customer
  Account JWT, strict 2.2 KB POST input bound, exact Customer GID-to-ticket
  ownership query, operation replay identity, optimistic expected reply
  sequence, database-checked combined count and denied guest/B/forged
  tokens. No email/notification/status/Order/quote side effects.
- `backend/work-contact-conversation-v2.mjs` — separate signed
  customer-only V2 read handler merging verified merchant and customer
  ledgers into a bounded, strictly ordered, *public* two-author thread.
  Server projections discard staff IDs, customer GID, operation receipts
  and hashes; unread, delivered and read receipts remain unverified.
- `shared/customer-contact-conversation-v2.mjs` — bounded JWT-authenticated
  My JILL V2 reader and explicit customer reply command with an
  immutable operation ID. Both helpers default OFF and never claim
  a successful POST proves a customer read or delivery.
- `services/custom-order-cloudflare/handler.mjs` and
  `services/jill-order-desk/work-contact-private-bridge.mjs` —
  **new exact** `/jill-contact-reply` and
  `/jill-contact-conversation-v2` routes. Public gateway remains
  D1-free; each request is bounded/sanitized and goes through existing
  Durable Object quota and the private HQ service. BOTH workers must
  separately set the entirely new, currently absent
  `JILL_WORK_CONTACT_CUSTOMER_REPLIES_ENABLED=true`. V2 reads
  ALSO require existing `JILL_WORK_CONTACT_THREAD_ENABLED=true`.
- `services/jill-order-desk/work-contact-ticket-detail.mjs` —
  adds a strictly Owner-authenticated/claimed-only customer reply
  projection behind the same new OFF flag and existing merchant message
  authorization. The HQ Contact detail UI can render customer and
  merchant messages together, without modifying the existing exact
  merchant readback/operation confirmation protocol.
- `scripts/test-work-contact-customer-reply-sqlite.mjs` and
  `scripts/test-work-contact-owner-customer-replies.mjs` —
  execute the **actual 0004+0005** SQLite migration and real
  gateway/private HQ handlers with signed synthetic Customer A/B JWTs,
  CAS/replay, quota, forgery, status close, immutable schema and
  customer→HQ→My JILL readback. Owner projection rejects wrong GIDs,
  broken sequences, hidden customer/private metadata and dangerous text.

Important limits: A green ephemeral test suite is NOT proof of a
production Shopify Customer Account JWT, provider quota operation,
real WORK D1 migration or exact account claim, nor a published My JILL
composer. The V2 helpers are now wired into My JILL's
source-only `ContactConversationV2` component in draft #156, but
the AccountHub still passes `ContactRequests enabled={false}`, and
the V2 reply gate defaults OFF. They cannot be used by real customers
without a separate approved extension release and authenticated
Customer A/B/guest acceptance. Existing V1 Contact read is preserved.
No Contact Us form intake or customer reply feature is active on
deployed WORK; LIVE/KEEP are strictly untouched.

### Commissioning prerequisites (distinct Owner decisions)
1. Fresh, authenticated read-only WORK baseline: HQ/Gateway versions,
   bindings, original Cloudflare/free budget, secrets **names**,
   disabled feature flags, D1 schema/migration status and rollback pin.
2. Explicit independent WORK-only D1 `0005` migration authorization;
   validate application against actual D1 SQLite semantics and
   inspect constraints/indexes without exposing customer data.
3. Explicit new inactive Worker upload authorization, exact version
   binding parity/Version URLs disabled, and separate traffic deployment
   authorization. Neither follows from source CI.
4. Real Work Customer A/B/guest/expired JWT, quota, Contact claim,
   Owner login and false-read/notification negative tests; then
   independently opt in to published My JILL account composer and
   V2 reader. No email/phone account matching.
5. Continue safeguarding against paid infrastructure and preserve the
   existing Shopify-native Contact Us form until intake is certified.

## October 24 — My JILL customer-first UI joined and certified (source-only)

My JILL draft **#156** now adds:
- A redesigned Overview built around real, signed Customer Account
  requests, their status and a limited three-item recent-activity panel.
  Error/empty/loading are distinct; missing rewards points are unknown,
  not invented zero. Existing Rewards redemption and Coupons are untouched.
- All nine existing Shopify account deep-link routes grouped into
  activity/rewards/personal categories. The shared in-memory Custom
  Order message draft and route ownership remain unchanged.
- A gated V2 Contact conversation and reply composer, sourced from
  the same V2 client defined in this HQ integration branch.
  Uncertain sends retain the exact message and operation ID;
  an independently reauthenticated V2 read must contain the same
  customer author, source sequence and text before clearing the editor.
  No read/delivery claim. V1 Contact is unchanged.
- Source and preview copy tests:
  `scripts/test-myjill-customer-home.mjs`,
  `scripts/test-myjill-contact-v2-source.mjs`,
  the existing My JILL account/message/Contact regression tests,
  and the source-only Preact build in
  `.github/workflows/jill-myjill-customer-home-preview.yml`.
  Its last checked source run passed, while a separate broad
  `My JILL WORK account certification` workflow has legacy
  branch-specific Owner/HQ source pin failures on this draft branch.
  Those broad failures must not be mistaken for approved remote
  functionality or for a reason to bypass guards.

The WORK three-lane CI now executes the two new My JILL tests
inside its disposable HQ #157 + My JILL #156 + visual #158 merge,
with the combined React Router HQ build. The source joins cleanly.
This establishes **source compatibility only**: it does not activate
the disabled WORK Contact/customer reply flags or publish a Customer
Account extension.

**Separate next Owner steps:** customer-account visual preview across
phone and desktop; exact signed Customer A/B/guest browser testing;
one real QA request progression; Shopify extension publishing
authorization; V2 D1 migration and private gateway authorization.
Keep LIVE/KEEP, original WORK HQ deployment and Cloudflare free-tier
protections in place.

### My JILL signed Contact draft resilience — latest draft #156

The latest source-only My JILL component uses the hub's in-memory
`customer-contact-draft-ledger.mjs` rather than discarding an
unconfirmed send on section navigation. A fresh signed Contact ticket
list is mandatory to restore the text/operation for that ticket.
Foreign and invalid lists fail closed; old callbacks cannot resurrect
the ticket. The customer sees accurate unsent/pending badges.

Confirmation now needs **two independent observations**: (a) the
exact idempotency operation ID and sequence acknowledged by the
customer reply handler, and (b) a fresh signed Customer A-only V2
thread containing the exact author, source sequence and text.
Identical concurrent messages from another tab cannot produce a
false confirmation after an uncertain POST. Without an acknowledged
receipt, My JILL preserves the operation and requires manual
same-ID retry. No duplicate auto-sends, email or read claims.

The three-lane CI invokes
`scripts/test-myjill-contact-draft-navigation.mjs` as a part of
the source-only My JILL branch merge, exercising forged receipts,
wrong-ticket restoration, signed history mismatch and stale callbacks.
WORK/LIVE/KEEP, Shopify extension publishing and D1 remain unchanged.
Real account A/B reassignment and Owner-authorized release QA are
still separate hard gates.

### Customer-first mobile Custom Orders and Rewards source integration

My JILL draft #156 now provides a compact, signed-account Custom
Orders tracker: verified current status and last update stay visible;
complete timeline, submitted items/date/fulfillment and reply
composer are disclosed on demand. All/Active/Completed & cancelled
filters and status counts are computed from the **existing** signed
Customer Account order source and do not fetch new external identity
data or imply quote approval, shipping ETA or unread messages.

The My JILL Overview's **Track details** passes a selection hint,
but Custom Orders opens the exact card only after an independent
fresh signed account list returns the same canonical submission ID.
The original Custom Order→Messages navigation and receipt-safe
message draft code remain intact.

Rewards gains mobile-friendly introductory guidance and quick
navigation to Coupons and Custom Orders, without changing
`RewardsCard`, the wallet reader, point calculation, redemption
confirmation or Shopify coupon application. Overview and selected
Custom Orders details use non-cramped single-column presentation.

The ephemeral three-lane workflow now includes
`scripts/test-myjill-mobile-orders-rewards.mjs`, alongside the
existing HQ quote, Contact A/B, request privacy and My JILL tests.
Source CI success does **not** replace account/mobile visual
acceptance, real Rewards redemption QA or Owner approval for WORK
customer extension publishing. WORK/LIVE/KEEP stay untouched.

### October 25 — Shopify principal recheck before exposing My JILL account screens

The My JILL source-only WORK draft adds a separate authenticated
`loadAccountHubScopedSummary` and fail-closed
`reconcileMyJillAccountScope`. The Shopify Customer Account API
`customer.id` is verified independently on initial mount, account
navigation, and when the page returns to the foreground. A suspended
identity check withholds account-owned screens; stale async checks
cannot overwrite a newer result.

The ephemeral My JILL hub is **keyed to the verified Shopify
principal**. Same customer A→A can retain legitimate in-memory
Custom Order/Contact drafts. A→B or A→guest/error destroys the prior
hub instance and its draft/selection state. This is a secondary
front-end privacy safeguard, never a replacement for the server's
signed JWT/exact owner checks. No customer ID is written to the URL,
logs, browser storage, Shopify metafields or Contact commands.

The joined CI now runs
`scripts/test-myjill-account-switch-fence.mjs` and
`scripts/test-account-hub-summary.mjs`, plus the existing mobile
Rewards/Custom Orders and Contact negative tests. Actual Shopify
Customer A/B sign-out/sign-in and same-tab navigation/visibility
behavior still require the separate *real browser* WORK acceptance
before account extension publication. No worker uploads, D1 migrations,
live data mutation, paid infrastructure or LIVE/KEEP change.

### Source-only My JILL mobile messaging improvement

After joining the Shopify principal recheck, the My JILL draft adds
a one-column Messages screen. Instead of a fixed two-column grid with
up to 20 tall account-request buttons, a native, labeled Shopify
`s-select` chooses among **only authenticated account-owned** request
threads. Foreign selection hints fail through the existing
`selectOwnedMessageRequest` policy. A visible Track this request
shortcut routes to Custom Orders, which independently re-verifies
the target request before expanding its history.

The core message sender, idempotent receipt guard, safe draft
recovery, direct navigation hints and Contact V2 OFF flags were not
relaxed. The three-lane CI runs
`scripts/test-myjill-mobile-inbox.mjs` in addition to the account
switch, quote, customer A/B, Shopify Catalog and visual source tests.

No screenshot or authenticated phone browser has been certified.
This change remains draft/source-only with no Shopify customer account
extension publication, WORK Worker traffic changes, D1 migration,
LIVE/KEEP writes or paid infrastructure.

### Signed My JILL WORK browser entry — not the hub shell

The old `rewards:work:hub:preview` command starts `--hub`, whose
canary entry mounts `AccountHub` without the signed Shopify
`ConnectedHub` owner loader. Since My JILL account-owned screens are
now strictly hidden until customer verification, this old preview is
only a shell/navigation smoke test. It is **not** real account visual QA.

The My JILL draft adds a distinct fail-closed
`myjill:work:preview:preflight` and separately approved
`myjill:work:preview:signed` command. The latter requires
a verified locally ignored WORK app link, prepares only the
sentinel-owned WORK canary with `--read` / `ConnectedHub`, then
starts an explicit Shopify WORK CLI dev session. **Neither command
has been executed in an actual Shopify session here**. The signed
command is never run by GitHub CI.

A new pure test `scripts/test-myjill-signed-preview-command.mjs`
is included in the disposable three-lane merge and verifies exact
WORK-only store targeting, preflight order, no LIVE/app deploy,
the signed-account entrypoint, disabled Contact and truthful
browser-acceptance flags. See draft #156
`docs/WORK_MYJILL_PREVIEW_RELEASE_GATE_20261025.md`.

Require an explicit separate Owner authorization before *starting*
Shopify CLI dev. Real Customer A/B/guest and phone/desktop acceptance
remains open; do not clear the broad legacy account certification
or publish any extension on the basis of source-only CI.

### Exact signed Shopify WORK canary module-closure guard

The canonical My JILL `Dashboard.jsx` bundled in CI, but the
isolated sentinel-owned WORK-only `--read` canary previously omitted
two imported shared modules:
`custom-order-conversation-view.mjs` and
`customer-message-selection.mjs`. Both are required by the
mobile Messages / Custom Orders source. Without them, an actual
WORK developer preview could fail to compile despite a green
normal-source build.

My JILL draft #156 now owns a manifest of copied page/shared
modules and uses it to construct the isolated canary. New
`scripts/test-myjill-work-canary-module-graph.mjs` traverses
the real generated signed `--read` import tree and rejects
every missing/extra/unreviewed relative dependency before Shopify CLI.
In the first successful My JILL CI run, all **35 reached modules**
and **3 reviewed package imports** resolved. The full
HQ/My JILL/visual source merge independently passed afterward.

Source tests still cannot demonstrate real browser layout,
Customer Account JWT acceptance, Customer A/B/guest switching,
Rewards redemption or WORK preview runtime behavior.
No Shopify session has been opened and no release gate has been
waived. Separate Owner permission remains required to launch
the **connected** Shopify WORK development preview.

### October 25 — My JILL native visual refinement

My JILL draft #156 now has a warmer native Shopify Customer Account
Overview hierarchy (welcome → signed recent request status →
Rewards/Coupons → honest future features), a compact labeled
nine-route selector plus Home/Custom Orders/Messages shortcuts, and
clearer JILL/You conversation cards with original event content.

This is **presentation-only**: canonical signed customer ownership,
hard-OFF Contact V2, RewardsCard redemption state machine, account
switch fence, custom-order selection, message operation receipts and
Shopify-native account navigation all stay intact.

The source-only three-lane rehearsal now runs
`scripts/test-myjill-visual-polish-source.mjs` and validates native
navigation, status author labels, guarded route selection, no new
browser storage or provider writes, and complete My JILL + HQ builds.
There is **no authenticated screenshot** yet. More details in
My JILL #156 `docs/WORK_MYJILL_VISUAL_POLISH_20261025.md`.
No Shopify extension publication, WORK traffic, D1 or LIVE/KEEP change.

### October 25 — My JILL customer next-step experience

The protected My JILL source now explains what to do next based only
on the signed Custom Order's **canonical status**. A presentation-only
`customOrderNextStep` in the existing copied presentation module
provides clear, non-transactional guidance for all eight states:
received, reviewing, awaiting approval, in production, ready pickup,
on hold, cancelled, completed.

That same copy is shown with the verified status in Overview's
Recent Requests, Custom Orders status cards, and the selected
Messages conversation. Awaiting-approval guidance explicitly says
there is **no in-page quote approval or payment**, ready-pickup
guidance asks customers to confirm collection arrangements, and
completed/cancelled never imply refund or delivery. No speculative
ETA, fake unread count, customer permission bypass, or notification
claim is added.

Customer-facing empty/error screens now avoid internal WORK-gateway
language. They explain verified account-only visibility and guest
separation in approachable terms; on unverified account identity,
private screens remain hidden. Real signed request/messaging readers,
idempotent replies, RewardsCard, HQ quote persistence, original
hard-OFF Contact V2 and LIVE/KEEP all remain unchanged.

A new source test
`scripts/test-myjill-customer-next-step-journey.mjs` runs in the
ephemeral three-lane CI and the dedicated My JILL build, confirming
all eight state messages and safe lack-of-permission claims.
This is source readiness only; real signed Shopify WORK phone/desktop
customer acceptance and rollout approval are still pending.
