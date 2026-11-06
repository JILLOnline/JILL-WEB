# JILL My JILL — Custom Orders → Messages handoff (source-only)

October 22, 2026. Independent account-component preview branch
`jill/myjill-message-handoff-preview-20261022`, rooted at verified
`jill/rewards-work` baseline `b53b9f7f1146a0bad4b734a8e7f48c3ee66309f8`.

## What this builds
- A customer can use **View in Messages** from an authenticated Custom Order.
- The navigation carries a **local-only request selection hint**. It never
  adds an email, customer GID, request ID or JWT to a URL or backend lookup.
- The destination loads a **fresh signed Shopify session account list**, then
  selects the hinted request **only** if that owned request ID is returned.
- Resuming an in-flight draft after switching screens now **requires a receipt
  check** with the same operation ID. A stale busy flag cannot leave the reply
  composer locked, and a malformed/mismatched command cannot be retried.
- Custom Orders and Messages share **one in-memory reply draft/operation ledger**,
  preventing loss of the original idempotent operation ID after an uncertain
  send when navigating between tabs. The backend receipt-checking contract
  remains unchanged. Each fresh account read prunes drafts to authorized IDs.
- Failed customer account reads clear the in-memory ledger. No draft is stored
  in localStorage, sessionStorage, a database, or a second message service.
- My JILL Messages now distinguishes **verified requests/status-only history**
  from actual verified v2 conversation threads. No unread/delivery claims.

## Release boundary
- This branch **does not modify or disable** M1/M2 source locks, seven protected
  historical files, or previous WORK deployment records.
- This account-side source change is **NOT** an authorized Shopify extension
  deployment, Google gateway activation, Cloudflare upload, LIVE/KEEP change,
  or customer-message write.
- A separate extension build, signed Customer A/B tests, active Google WORK
  published-source proof, and release acceptance remain required.
- Current WORK HQ stays at `f80335de-98ea-4831-b00e-87cd1a397596` /
  `44ad4a81-55ad-4f49-9965-61260cc2294d` @ 100% unless independently
  verified otherwise. Messaging provider flag remains OFF.

## Offline test
`node scripts/test-work-customer-message-navigation.mjs`
`node scripts/test-work-message-inboxes.mjs`
`node scripts/test-work-conversation.mjs`

Do not replay spent Cloudflare upload or activation receipts or use LIVE customer
accounts for exploratory writes.

## Customer-account source release gate
- `node scripts/audit-work-myjill-message-extension-source.mjs` validates the
  Shopify extension target, `api_access=true`, `network_access=true`,
  exact WORK Cloudflare host, same-host reply endpoint, signed customer
  account reads, and the default OFF conversation writer.
- Negative tests reject LIVE host references, changed extension capability,
  foreign reply endpoints, unconditional writer activation, and unsigned
  request selection. No network calls or provider mutations occur.
- A passing source contract is **not** evidence the declared permissions
  have been published or approved in the currently running Shopify extension.

## Customer reply availability: independent authenticated WORK capability

- Timeline-v2 status alone never authorizes a send. A signed customer-account
  response must now include Worker-derived `reply_enabled: true` before
  the My JILL composer enables a **new** message. Missing/legacy flags default
  to **OFF** so the already deployed gateway still reads requests normally.
- The WORK Worker calculates `reply_enabled` from its own
  `JILL_WORK_CONVERSATION_ENABLED==='true'` flag only **after** Shopify JWT
  authorization and Google public projection checks. The Google backend
  cannot grant this capability by inserting fields into its reply.
- The existing `loadWorkCustomerCustomOrders` array interface remains
  compatible; a new signed `loadWorkCustomerConversationState` returns
  `{orders,replyEnabled}` for My JILL messaging screens.
- Receipt verification of an already-submitted stable operation remains
  available even if new sends are currently disabled, to avoid abandoning
  an unconfirmed message.
- Independent releases are still REQUIRED: merging/publishing a customer
  extension does not automatically change the running WORK Cloudflare
  Worker, Google QA source, or any flags. This source change authorizes
  none of those mutations.

- In the account UI, a verified v2 timeline with a disabled reply capability now displays a **read-only history** banner rather than offering Send. Explicit verified replies become available only with the signed WORK enablement flag.\n
## Shared reply ledger concurrency gate — stale callback protection

- Every customer-draft update now carries the `expectedOperationId` observed
  by the composing screen. A null expectation may start a new reply only when
  there is no active command; a non-null expectation must exactly match the
  current immutable operation ID.
- The mounted My JILL hub applies updates ONLY to request IDs still in its
  freshly authenticated account-owned ledger. A late response after logout
  or customer-account change cannot recreate a removed request.
- Late success/error/finally callbacks from a prior screen can no longer
  overwrite a different or already-resolved reply command. Every actual
  completion clears `busy` atomically with that same command's outcome;
  unmounted screens are safe to ignore.
- Existing lost-ack delivery checks and retries continue using the original
  operation ID. No duplicate send, new provider or persisted browser storage.
- Synthetic tests simulate concurrent sends, a pending operation surviving
  a navigation, a later acknowledgement after return, and stale callbacks
  after confirmed delivery, logout, or creation of a newer operation.

**This is source-only.** CI acceptance does not authorize customer messaging
or any LIVE/KEEP, Google, Cloudflare or Shopify release.

## Honest offline composer

- If the signed WORK Worker has replies OFF and an eligible user has typed
  but not sent a message, My JILL shows a read-only copy of the draft marked
  **not delivered** in English or Spanish. It is held in mounted session
  memory only, not persisted and not sent.
- The ledger forbids `sent`, `unconfirmed`, `missing` or `busy` state
  claims without the matching immutable operation. Pending operation text
  cannot be changed while the receipt is outstanding.

## Customer-account read cancellation (source-only)

- **Custom Orders** and **Messages** now each use an `AbortController`
  per signed WORK account read. On navigation away or a new request attempt,
  cleanup invalidates the screen and aborts its in-flight fetch.
- The canonical customer reader combines the cancellation signal with the
  existing 20-second timeout. It rejects cancellation before token retrieval,
  after a delayed session-token read, and after parsing a delayed response.
- Both screens already check an active render generation before writing
  display state. Aborting additionally terminates the old network read,
  rather than letting it race into the next screen. Every successful data
  response still requires the Shopify-authenticated account list and
  server-derived reply capability.
- This does **not** prove that a customer sign-out/sign-in within a still
  mounted Shopify page is independently detected. The actual browser/account
  lifecycle remains an explicit WORK Customer A/B acceptance gate.
- Offline regression: `node scripts/test-work-customer-read-cancellation.mjs`.
  No remote endpoint, fake customer record, storage or release mutation.

## Shared My JILL account display validation (October 23; source-only)

The common `loadWorkCustomerConversationState` reader now runs the same
verified inbox contract before returning ANY account orders. Thus both
Custom Orders and Messages reject duplicate request IDs, invalid request
identifiers, malformed public timeline revisions, untrusted message actors,
and invalid activity timestamps. An invalid response fails closed; neither
screen receives a partial account list or enables a reply composer.
The separate `test-work-myjill-account-response-integrity.mjs` checks
legitimate v1/v2 histories and synthetic malformed records, and is now
included in the dedicated My JILL preview workflow. This is defense in
depth after the server-side Shopify JWT/Google ownership verification;
it does not replace or relax either authority. No real customer data,
extension publication, Worker release, or message delivery occurred.

## Verified customer navigation and strict timeline shape (October 23)

The Messages screen now gives status-only customers an explicit **View
tracking in Custom Orders** action. Customers with no verified requests can
also open their Custom Orders page without being directed to a nonexistent
conversation. This is client-only My JILL navigation; it does not send a
message, request a new backend identity, or change any customer record.

The shared customer account reader now **rejects** malformed public timeline
fields, oversized notes, non-string notes, and invalid public thread metadata
instead of silently coercing or clipping them. The offline integrity tests
include these denial cases alongside valid legacy and v2 histories.

The independent My JILL message-handoff preview CI passed on commit
`3749693` (run
https://github.com/JILLOnline/JILL-WEB/actions/runs/39983510932).
This is **not** the older branch-locked My JILL WORK account release
certificate. Publishing the Shopify extension and enabling replies remain
separate approval gates; no remote customer A/B acceptance was performed.

## Unified Contact Us and Custom Orders customer account track (2026-10-23)
HQ and My JILL must present one customer-visible lifecycle with Shopify,
not two independent inboxes. The integrated U0–U11 master plan lives in
draft HQ PR #157:
`docs/WORK_UNIFIED_INTEGRATION_MILESTONES_20261023.md`.

**Contact Us reality:** `theme/sections/main-contact.liquid` currently uses
Shopify's native `form 'contact'`. It creates a Shopify contact notification
but NOT a canonical signed JILL ticket, HQ message thread or My JILL item.
No customer ownership may be inferred from a contact form's email/phone or a
typed Shopify order number.

**Source-only preparation:** `shared/customer-contact-tickets.mjs` models a
future strictly bounded signed-account read of CONTACT tickets at a distinct,
not-yet-deployed WORK-only Cloudflare path. It is NOT referenced by an
extension page, is disabled by default BEFORE any JWT or network operation,
and whitelists only status metadata after exact verified customer ownership
has been enforced by a future authenticated Worker + canonical ticket source.
Guest contacts stay HQ-only unless explicitly verified/claimed. No message
composer, read receipt, body, customer GID, email, payment or order is shown.
`test-work-myjill-contact-ticket-contract.mjs` covers these denial and
privacy gates in dedicated preview CI. The pinned endpoint is a **planned
contract**; DO NOT enable this reader or represent it as currently working.

**Required next:** independently authenticated and idempotent Contact Us
server intake, persistent source receipts, Owner-only HQ tickets, exact
Shopify Customer session/GID linkage, My JILL customer A/B/guest acceptance,
shared conversation events, and then explicit reviewed WORK extension release.
Do not bypass historical branch-lock certification.

## My JILL Contact Requests customer screen — source-only (2026-10-23)

The same My JILL extension now includes a **Contact Requests** navigation item
and `ContactRequests.jsx`, reachable from Overview. It is mounted with
`enabled={false}` and displays a truthful not-connected state. It never
shows Shopify native Contact Us email as an owned account ticket.
If a future signed owner-only WORK contact-account endpoint passes both
Customer A/B, the page is prepared to render strictly whitelisted private
ticket metadata. The first WORK release would require a distinct app/gateway
deployment certification and cannot simply turn on the prop in production.

The HQ parallel PR #157 now contains a **draft** WORK-only Contact Us ticket
table `0004_work_contact_tickets_source_only.sql` and a bounded authenticated
Shopify app-proxy intake handler; neither is applied/routed/published. The
current Shopify `form 'contact'` remains unchanged. Future storefront routing
must be validated to preserve anti-spam protection and avoid duplicate sends.

Preview tests `test-work-myjill-contact-page.mjs` and
`test-work-myjill-contact-ticket-contract.mjs` enforce no JWT/network while
OFF, correct navigation, no owner guessing, no fake delivery and restricted
per-account metadata.

## Private proof-of-possession Contact Us linking (source-only; 2026-10-23)

My JILL's new `shared/customer-contact-claim.mjs` validates a fixed WORK
claim endpoint and a `jill:contact:<uuid>` ticket ID plus a private 256-bit
code. It acquires a fresh Shopify customer session JWT only after the
feature gate is enabled, sends no email or caller-selected Shopify Customer
GID, bounds responses, and requires a receipt for the exact ticket before
showing success. Interrupted requests are retried with the original claim.
`ContactRequests.jsx` now contains the corresponding opt-in claim input
and retry status, but **AccountHub mounts it with `enabled={false}`**.
No JWT, account D1 read, mutation or customer request is made by the
currently disabled page.

The HQ parallel PR #157 contains the matching signed Worker handlers:
`/jill-contact-claim` and `/jill-contact-account`, a WORK-only D1
`claim_sha256` schema and form-side random code generation. All are
OFF/unpublished. The native Shopify Contact Us form remains active. After
approval of new WORK routing, stored ticket integrity, anti-abuse and
independent JWT/ownership, a successfully claimed ticket may appear as
status-only history in My JILL. It is **not** evidence that public
Contact Us messages, two-sided conversation, delivery, paid orders or
tracking are already connected.

Source-only test `test-work-myjill-contact-claim.mjs` checks disabled
network, exact ID/receipt and no secret disclosure. The HQ side adds
Customer A/B/takeover and D1 conditional-write tests; their fresh CI
conclusion is checked independently.

## Contact Requests status filtering and cross-system tracking

The planned Contact Requests customer page now filters **All / Active /
Resolved** purely on the bounded verified customer-account ticket list.
It shows the current status and source revision from the exact Shopify
Customer GID D1 read. No client cache, email matching, payment status,
fake unread indicator, shipment status, reply option or guessed timeline
was added.

The HQ draft PR #157 simultaneously adds Owner-only Contact Us status
commands and atomic SQLite audit triggers; its passed source-only CI run
`39996666381` demonstrates that one D1 row projects the same customer
status/revision to both HQ and My JILL without leaking staff or contact
secrets. **This is not a deployed, working conversation system**:
Customer A/B acceptance, signed ticket claims, Google Custom Order bridge,
contact source migration, full two-way message readback and explicit WORK
extension approval are still required.

## My JILL readback: claimed Contact Us public conversation (source-only)

Contact Requests now includes a **View verified conversation** panel, with
`shared/customer-contact-thread.mjs` requesting the separate
`/jill-contact-thread` WORK endpoint using a fresh Shopify Customer Account
session. The server confirms the ticket belongs to the **exact** signed
Customer GID and projects at most 50 ordered, bounded merchant messages.
The UI deliberately hides private form content, staff IDs and secrets, and
does not offer customer replies, fake unread indicators or read receipts.

The panel has a separate `threadEnabled=false` gate in addition to the
Contact Requests `enabled=false` gate. Both remain OFF in the mounted
AccountHub. The isolated WORK Shopify canary now copies
`ContactThread.jsx` and `customer-contact-thread.mjs`. The dedicated
My JILL preview CI checks hard OFF, bogus thread IDs/authors, duplicate
sequence, oversized text, cancellation and private-metadata stripping.
The companion HQ PR #157 owns the private D1 message ledger and authorized
merchant public-message writer, also disabled by default.

This is source implementation, **not** a customer-delivered message,
Shopify Inbox send, quote invoice, order or deployed synchronization.
A real end-to-end Customer A/B readback and independently approved WORK
release must precede activation.

## Paired HQ + My JILL Contact Us contract integration (October 23)

The independent source-only workflow
`.github/workflows/jill-cross-pr-contact-integration-preview.yml`
checks out the HQ draft under `hq-work-source` and executes
`scripts/test-work-cross-pr-contact-integration.mjs`. Unlike isolated
screen/backend tests, this test imports the ACTUAL source handlers from
HQ PR #157 and the ACTUAL My JILL list, claim and thread clients from
PR #156, using fake signed Shopify Customer A/B JWTs and an in-memory
D1-shaped store. It also calls HQ's authenticated Owner public-message
writer, verifies that a single saved message reaches only Customer A's
My JILL thread, and checks replay refusal and stripped private fields.
Both source commit IDs are recorded in CI logs; there is no provider call.

**Passing source evidence:** cross-PR run `40000391748` and My JILL
preview run `40000391658`. This does NOT supersede the protected
WORK account release workflow, which has separate branch/source and
gateway-release checks. All Contact Requests, merchant message,
claim, and signed customer-thread flags remain OFF and both PRs stay
draft. No customer message, paid plan, LIVE/KEEP change, or Shopify
extension/Worker release occurred.

Before activation, require WORK D1 binding + 0004 migration inspection,
true Shopify signing/proxy/online Owner acceptance, verified customer
A/B/guest sessions, no duplicate native Contact Us submits, and real
two-way readback. Do not merge either branch to resolve a failed source
lock automatically.
