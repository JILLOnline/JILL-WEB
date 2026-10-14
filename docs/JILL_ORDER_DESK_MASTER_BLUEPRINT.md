# JILL Order Desk — Master Architecture and Delivery Contract v1

Status: P0/P1 SERVER-SIDE AUTHORIZATION FOUNDATION IMPLEMENTED IN WORK SOURCE ONLY; embedded Shopify admin host, grant mutations, D1 database created/migrated and isolated WORK Worker deployed; Shopify hosted App Home and live Owner bootstrap NOT COMPLETED. Date: 2026-10-14.
Environment: JILL WORK Shopify development store, branch jill/rewards-work.
No LIVE operations or Shopify connector use are authorized by this document.

## 0. Goal, constraints and existing proof

Deliver one merchant-only JILL Order Desk inside Shopify Admin, tied to the existing customer My JILL Custom Orders view. A request must remain the same immutable JILL submission through review, quote, Shopify draft, invoice, payment, production, fulfillment and customer tracking.

Existing, proven: Shopify WORK app proxy to Cloudflare to isolated Google QA intake; Submissions + CustomOrderOwners + append-only CustomOrderEvents; authorized Google-operator CustomOrderDesk transition engine; signed-in Shopify Customer Account read using JWT; owner-bound WORK customer request displayed in My JILL; source CI passing on 18b381c44c90f51bac2b07f586301dbdb110b086.

Existing constraints:
- Google CustomOrderEvents is the *only* production/status event authority. Never replace it with a D1 status column.
- Shopify is the *only* invoice, money, transaction, order and fulfillment authority.
- Existing Rewards v13 and My JILL wallet/redemption code are untouched.
- Customer identity comes from a verified Shopify customer account, not typed email, matching phone, or invoice payment.
- Shopify native Orders cannot be hidden or converted to a different resource type. My JILL can show the linked purchase as a Custom Order while native Orders still shows the Shopify order.
- WORK and LIVE must use distinct app IDs, OAuth credentials, databases, endpoints, webhooks, Sheets and secret bindings. KEEP is currently a Git rollback branch, NOT an independently verified Shopify deployment.
- No duplicates, shadow APIs, source-of-truth copies, competing CSS or multiple independently writable production states.

## 1. User journeys and screens

Merchant App Home (hosted embedded admin app, NOT customer-account extension):
- Inbox: Received / Needs quote / Awaiting customer / In production / Ready / Closed views; assigned operator, age, event-needed date, fulfillment type, priority and warning flags. Scope filtered on server.
- Request detail: immutable identity, verified ownership badge, request item quantities, safe reference-image links, date needed, colors/theme/notes, production event history, staff-only notes, Shopify links, permissions-aware actions and current source health.
- Quote builder: native Shopify variant lines where possible, custom lines where necessary; taxes, discounts, shipping and deposit terms read from actual Shopify calculations, never estimate tax as authoritative.
- Review/send invoice: confirmation summarizing recipient, currency, lines, tax/shipping, discount, status and permission; merchant-initiated action only.
- Payment / Fulfillment: verified Shopify financial status, balance, refunds, fulfillment orders and carrier tracking. Never offer manual 'paid' toggle in JILL.
- Team & Access: Owner-controlled, verified existing Shopify staff grants; audit and revoke controls; no invitation to non-Shopify identities.
- Activity/Audit: append-only user actions, denial logs, source event references, reconciliation issues and version/provenance.

Customer My JILL (reuse one existing page):
- One Custom Order card with persistent internal submission ID and friendly alias; event history joins production milestones with verified commerce/fulfillment observations in timestamp order with source labels.
- Do not expose staff notes, internal stages, risk flags, merchant identity/emails, private Google identifiers, or unrestricted Shopify edit links.
- Display a real invoice checkout link only if ownership verified, Shopify confirms draft belongs to the request, and merchant sent invoice. Never leak a customer's invoice URL to another account.
- Guest request linking remains separate one-time verification work; email/payment alone never claims ownership.

## 2. Unique identifiers, labeling and link contracts

Canonical submission_id: preserve current jill:UUID string. Never change its value or replace the CustomOrderOwners row.
Friendly display alias v1: JILL-CO-[first 12 hexadecimal characters of the UUID], derived deterministically. Collision check in merchant link registry; if collision occurs, fail closed and require unique alias allocation. Not a Shopify Order number and not a payment reference. Prefer this reversible-display convention over a new sequential counter that could block intake; optionally migrate to atomic human sequence later.

Shopify Draft Order creation:
- Tag: JILL_CUSTOM_ORDER (merchant filter, NOT authentication).
- Draft-order metafields: jill.custom_request_id = exact canonical submission ID; jill.custom_order_ref = friendly alias; optional jill.quote_revision and jill.contract_version after schema/permission review.
- Custom attributes or note may carry a non-sensitive display alias for merchant support but no privileged actor credentials.
- Link row stores (shop domain, submission_id, draft_order_gid, phase, quote_revision, created_by_staff_id, created_at); unique(shop, submission_id, active draft revision), unique(shop, draft_gid).
- After conversion, use DraftOrder.order.id / Shopify authoritative inspection to record order_gid and write-and-read-back equivalent order metafields and JILL_CUSTOM_ORDER tag. Never assume draft metafields/tags transferred.
- unique(shop, order_gid): one Shopify order cannot belong to two JILL requests. First release: one active draft and one primary commercial order per request. Multi-order deposit/replacement cases require an explicit subsequent contract.
- Manually created Shopify drafts/orders are NOT Custom Orders unless an authorized owner/admin executes a reviewed, verified link operation; matching email/name/tag alone is insufficient.

## 3. Authentication and staff roles

Merchant embedded App Home:
1. Shopify App Bridge provides fresh ID token for every protected admin API call.
2. Existing trusted backend or a single new merchant service verifies JWT signature, aud/iss/dest/expiry and exact WORK app/shop; exchange per official Shopify authentication contract for an *online* access token.
3. Obtain verified associated_user.id, account_owner, and associated_user_scope. Staff email is display metadata only, not the access-control key.
4. Check a single server-side JILL role grant (store + Shopify staff ID + active + permission + optional assigned scope + expiry).
5. Check Shopify permission intersection for the requested Shopify operation, preconditions, idempotency key and any high-risk second authorization.
6. Deny 401 for absent/invalid login, 403 for insufficient staff grants/Shopify scopes; do not trust frontend visibility or any caller-supplied role/actor.

Owner binding: during explicit owner-initiated bootstrap, verify Shopify online associated_user.account_owner, bind one immutable owner staff ID per store, and audit the bootstrap. Do not infer owner by email or permit an admin to change the binding. Owner succession requires separate physical/Shopify-account-backed break-glass protocol and independent review.

Staff role defaults (backend policy, with granular grants):
- Owner: all JILL operations; protected owner/team settings; invoice/refund approvals and emergency operations, subject to actual Shopify permissions.
- Administrator: view/manage all requests, prepare and approve quotes, send invoices, manage production and fulfillment as explicitly granted; cannot assign Owner or change infrastructure secrets.
- Order Manager: read requests, update public production notes/status and prepare quotes; cannot send invoice, refund, change team grants or impersonate a customer by default.
- Production: read assigned jobs, update permitted internal stages/production notes only; cannot access payment/billing/PII beyond minimum job context.
- Viewer: view authorized redacted merchant request summaries only; no mutations.
- No Shopify staff membership, Shopify app access, or JILL role = no merchant API access.
- Staff removal/inactive role takes effect before next mutation, regardless of cached UI. Restrict existing Google project editors/Sheets so they cannot bypass the app.

All access actions record: actor Shopify staff ID, shop, permissions, action, target, prior revision, request operation ID, result, time, external Shopify resource ID and source SHA. Never log tokens, HMAC keys, full addresses, payment details or private artwork contents.

## 4. Permissions and exact trust boundaries

Shopify granted app scopes are necessary but NOT enough. Online staff permission intersection and JILL role both required.
Initial research: WORK app already has read_orders and write_orders but earlier installed-scope audit did NOT show write_draft_orders. Phase 4 must request and explicitly authorize relevant read_draft_orders + write_draft_orders in WORK, then verify staff permissions and Shopify Plan/API constraints. Further fulfillment/refund scopes must be discovered at implementation time, not assumed, and granted separately.
An offline token is for webhook reconciliation and backend-only service operations, never to bypass a human staff's missing permission or JILL denied role. Before any staff-requested write that uses an offline token, independently enforce the initiating staff's *online* permission and immutable approval record.
Every administrative API includes exact shop pinning, versioned schema, server-side rate limiting, body size limit, short timeout and no-store for private reads.
Do not put privileged merchant endpoints under the public customer account read or Shopify storefront app-proxy routes.

## 5. Canonical domain owners and persistence

A. Existing Google QA Apps Script and Sheets: Submissions; CustomOrderOwners; CustomOrderEvents; Google-authorized manual CustomOrderDesk. Production events append only, expected_revision CAS, allowed transitions and idempotent operation IDs stay canonical.
B. Shopify Admin: DraftOrder, Order, Payment/Refunds, Fulfillment/Tracking, actual charges, taxes, invoice email dispatch.
C. A single protected merchant registry (proposed Cloudflare D1 bound ONLY to WORK merchant service): staff grants, immutable shop/owner binding, draft/order links, quote approval metadata, command idempotency, webhook inbox, reconcile checkpoints, audit journal, outbound work queue. NEVER persist an independent editable payment state or production-state truth.
D. Existing customer account private reader: validates JWT ownership via current Google owner ledger and combines ONLY whitelisted, independently verified Shopify commerce projections for that same immutable submission ID.

Proposed D1 entities (scoped by environment and shop):
- store_authorities(shop PRIMARY KEY, app_client_id, owner_staff_id, owner_bound_at, policy_version, environment)
- staff_grants(shop, staff_id, role, privileges_json, active, created_by, updated_at, revoked_at, version; PRIMARY KEY(shop, staff_id))
- request_commerce_links(shop, submission_id, alias UNIQUE, draft_gid UNIQUE NULL, order_gid UNIQUE NULL, quote_revision, link_status, customer_gid_hash_or_ref, created_at, updated_at; PRIMARY KEY(shop,submission_id))
- merchant_commands(shop, command_id PRIMARY KEY per shop, actor_staff_id, submission_id, action, expected_revision, payload_digest, state, linked_resource_id, result_ref, created_at, updated_at)
- webhook_inbox(shop, webhook_delivery_id UNIQUE per shop, event_id, topic, resource_gid, received_at, hmac_verified, state, attempt_count, next_attempt_at, error_code)
- commerce_observations(shop, observation_id, submission_id, source_shopify_gid, source_version_or_updated_at, kind, public_fields_json, confirmed_at, observed_at, payload_digest; UNIQUE(shop,source_gid,kind,source_version_or_updated_at))
- admin_audit(shop, audit_id, actor_staff_id_or_service, action, target_id, decision, source_receipt, timestamp, policy_version, request_id)
- outbox(shop, job_id UNIQUE, action, payload_digest, state, attempts, next_attempt_at, created_at)

This store is an index/authorization/reconciliation log, not a duplicate request database or shadow Shopify ledger. Adopt D1 only after checking platform fit and deployment/backup/retention limits; equivalent single durable store permitted after documented decision.

## 6. Safe Google merchant command bridge

Today jillCustomOrderMerchantUpdate(command) calls jillCustomOrderActor_(), which authorizes Google active-user allowlist. DO NOT call it remotely while pretending a Shopify staff ID is a Google Session email.

Refactor the SAME workflow authority so manual Google Desk uses Google operator authentication and the new merchant service uses a separate server-to-server signed command path:
- Merchant API authenticates online Shopify staff + JILL role + allowed transition and records command approval.
- Internal bridge signs exact environment/shop/submission/operation_id/expected_revision/action/fields/verified actor staff ID/issued_at/body digest with a DEDICATED merchant-bridge secret, never the customer-list or storefront gateway key.
- Apps Script validates signature, timestamp, replay/idempotency, environment and shop; obtains actor only from verified signed envelope; invokes the SAME validation/locking/event append transaction. Do not build a second event writer.
- Response: committed revision / idempotent replay / conflict / forbidden / unavailable, with no internal details in the public account path.
- Keep Google operator Desk as a controlled break-glass path until merchant command bridge has full parity and tested rollback.
- Failed Google commit must not make a customer-facing event. Unknown network outcome is reconciled by operation_id/read-before-retry.

## 7. Lifecycle and allowed writes

Request created: verify intake signature; commit immutable Google submission/owner and received event; no draft/invoice.
Merchant reviews: append appropriate reviewing event via validated merchant command. Production state controlled by JILL.
Quote prepared: store versioned intent and pricing inputs; calculate monetary totals with Shopify authoritative DraftOrder calculations.
Create draft: merchant confirmation + idempotency reservation; create Shopify DraftOrder with identifying tag/metafields; read back and verify; atomically attach link; prevent duplicate after timeout via lookup/reconciliation, never blind retry.
Send invoice: only Owner or explicitly authorized Administrator, with online write_draft_orders permission; inspect draft recipient/amount/currency/terms, confirm; draftOrderInvoiceSend; record confirmed receipt/attempt; never auto-resend because webhook late.
Checkout/payment: Shopify draft -> Order link verified from DraftOrder.order; Webhook signals order changes; backend refreshes financial status via Admin GraphQL, computes public-safe observation. No JILL manual paid flag. Partial/refund/void/cancel change financial state; do not overwrite production state.
Production updates: staff authorizes valid transitions and internal stages; no proof approval claims until customer approval captured; customer reads only whitelisted public text. Payment requirements before starting production are configurable and enforced as a policy gate, not a fake status transition.
Fulfillment: Shopify authoritative fulfillment orders/fulfillments; carrier, tracking number and tracking URL only after confirmed; pickup has no fabricated package tracking. Shipping scans are only as real-time as carrier/Shopify data permits.
Customer timeline: merge confirmed append-only production events and verified commerce observations, ordering by timestamp with stable tie-break, unique event IDs and privacy projection. Customer status is separate from commerce/fulfillment status.
Guest checkout/account mismatch: never grant ownership by email or paid invoice. If Shopify order customer differs from immutable CustomOrderOwners customer, quarantine merchant link and hide unverified commerce details from account reads. Guest claim flow requires separate OTP and owner-approved contract.

## 8. Webhook security and automatic reconciliation

Use only supported Shopify webhook topics/API version confirmed for WORK (likely draft_orders/update, orders/create, orders/updated, orders/paid, orders/cancelled, refunds/create, fulfillments/create/update; verify exact topic names/scopes).
HMAC over RAW bytes; app secret isolated per environment; verify shop and topic; dedupe by X-Shopify-Webhook-Id, correlate Event-Id, persist inbox; promptly ACK after durable queue/receipt and process asynchronously.
No order-state changes solely from webhook payload: fetch latest actual Shopify resource and link metadata via server API, then reconcile. Shopify does not guarantee event order.
On missing webhook, scheduled bounded reconciliation polls only linked drafts/orders using stored cursors and last verified timestamps. Failure gives stale/unavailable badge, never Paid/Delivered guess.
Run separate source-health checks, dead-letter retries and operator-visible alerts for stuck commands, missing link, duplicate draft, untrusted Shopify record and API denial.

## 9. Notification, privacy, records

Shopify sends draft invoices and any native Shopify order/fulfillment notices it is configured to send. JILL's optional production update notifications are outbox-driven, post-commit, deduped and transactional only. Respect consent and distinguish transactional vs marketing.
PII never in public log/query parameters/URLs, no cardholder fields in JILL, no customer email as auth, private notes excluded from My JILL and public APIs. Images remain protected and referenced through authenticated access; use least privilege and retention/deletion plan. Meet applicable Shopify privacy/data-protection obligations before LIVE.
Unknown/corrupt owner ledger, revoked staff, inconsistent draft link or stale OAuth scope must fail closed.

## 10. Detailed file ownership (proposed paths; create only when phase begins)

KEEP as canonical:
- theme/assets/jill-custom-order.js, theme/sections/main-custom-order.liquid
- backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs
- backend/custom-order-gateway.mjs; backend/custom-order-account-read.mjs
- services/custom-order-cloudflare/{handler,worker}.mjs: ONLY storefront and customer read routes, no privileged merchant administration
- extensions/jill-account-dashboard/src/pages/CustomOrders.jsx
- shared/customer-custom-orders.mjs
- Rewards v13, Rewards/Coupons extensions and engine

CREATE after design/test gate:
- services/jill-order-desk/ : one dedicated merchant embedded-App-Home host, merchant API, auth, durable state binding, and Shopify webhook receiver; WORK config first
- backend/jill-merchant-auth.mjs : verify authenticated Shopify ID/online user/store/scope context (reuse installed Shopify SDK; not homemade OAuth)
- backend/jill-merchant-policy.mjs : sole role/grant/permission decision owner
- backend/jill-custom-order-command.mjs : single signed server-to-server bridge/command adapter into existing Google workflow
- backend/jill-shopify-commerce.mjs : one Shopify GraphQL Draft/Order/Invoice/Financial/Fulfillment adapter
- backend/jill-custom-order-link.mjs : one immutable request↔draft↔order linkage registry and conflict control
- backend/jill-shopify-reconcile.mjs : authenticated, idempotent webhook/current-resource convergence
- shared/jill-custom-order-projection.mjs : public-only merged event view; no privileged fields
- contracts/jill-merchant-auth.schema.json; jill-commerce-link.schema.json; jill-merchant-command.schema.json; jill-commerce-observation.schema.json
- scripts/test-jill-merchant-{auth,roles,commands,link,webhooks,commerce,privacy}.mjs (one per contract)
- docs/JILL_ORDER_DESK_MASTER_BLUEPRINT.md: this single build contract, updated each completed phase

Do not edit Shopify WORK app release configs or grant new access scopes as a side effect of documentation/code-only phases.
Review whether single existing JILL WORK Rewards app can safely host a new embedded App Home without disturbing active customer extensions. Prefer same Shopify app identity only after runtime compatibility/isolated WORK staging checks; no duplicate customer-facing app or rival Rewards authority. Reuse existing Cloudflare account and isolated worker resources, but privilege/admin host is not the public gateway.

## 11. Milestones and irreversible gates

P0 Foundation / scope inventory: record exact WORK app client, released version, app-home integration feasibility, current scopes, customer ownership proofs, Google operator preflight, Cloudflare/D1 capabilities. Design review and immutable spec. Exit: all sources identified, no WRITE scopes added.
P1 Staff authentication: implement embedded merchant shell + fresh ID token verification + online token exchange + protected Owner bootstrap + D1 role grants + denial logs. Exit: owner can enter, customer/viewer cannot; admin cannot self-escalate; revocation immediate; cross-shop token denied.
P2 Read-only Order Desk: paginated requests, filtered assigned jobs, public/internal field boundaries, no mutations. Exit: current WORK requests visible to authorized merchant, no customer PII leak, customer account unaffected.
P3 Merchant status bridge: same Google workflow, signed internal service account, revision checks, valid transition/mismatch/replay rejection, private/public notes. Exit: update one synthetic request via staff, My JILL owner sees revision 2; Customer B sees nothing; no second writer.
P4 Draft/quotes: explicitly grant read/write_draft_orders WORK scopes, review staff privileges, versioned quotes, create 1 test draft and read-back link; no invoice email until separate approval. Exit: exactly one identifiable draft per submission even across retries.
P5 Invoicing/payment: owner-authorized send, Shopify test invoice/checkout, verify draft.order mapping and order metafields, paid/pending/partial/refunded status and failure behavior; do not assume checkout payment capability without store-specific verification. Exit: customer shows actual verified payment only.
P6 Fulfillment: verify shipping/pickup workflows, partial shipments, tracking edits and refund/cancel edges; exact fulfillment scopes granted only when needed. Exit: real tracking URL tied to correct Shopify order; pickup never displays shipment.
P7 My JILL merge and notifications: project commerce safely into same Custom Orders card; read after session refresh; customer mismatch, guest, privacy and TTL gates; Shopify native emails vs JILL outbox. Exit: one coherent customer timeline and no duplicate invoice/shipping messages.
P8 Certification and rollout: complete access/scopes/secret inventory, D1 backup/export/restore, webhook replays, zero duplicates, strict A/B, mobile/desktop, performance/load, error transparency, accessibility, owner acceptance. Stage unreleased app version, record rollback and deploy manifest; keep LIVE untouched until explicit owner approval.
P9 After MVP: guest verified claim; deposits/multiple linked orders; proof approval; carrier integration; advanced staff assignment; communications. Each requires its own contract and test gate.

## 12. Negative/acceptance test checklist

Required passing tests:
- Anonymous storefront/customer session and wrong-Shopify-shop ID token cannot access merchant API.
- Shopify staff with no JILL role, expired or revoked grant, mismatched user/shop/aud/dest, wrong Online access scopes: 403/401 and zero effects.
- Regular JILL Admin cannot assign Owner, widen own privileges or perform forbidden refund/payment/financial override.
- Two operators changing same revision: exactly one append; loser receives conflict and must reload.
- HMAC forged/stale/duplicate Google merchant commands: rejected; replay of exact committed command returns same receipt.
- Two simultaneous Create Draft presses and timed-out Shopify response: at most one linked draft; uncertain result is reconciled, never blindly re-created.
- Quote changes after invoice send require explicit owner review; no silent invoice amount drift.
- Shopify draft conversion manually in admin still reconciles to correct request via DraftOrder.order; customer mismatches quarantine.
- Webhook duplicate, missing, stale, reordered, forged, different shop, cancelled, partially paid/refunded: correct verified projection or hold; no fabricated Paid/Shipped.
- Staff and customer A/B privacy: no cross-account order, invoices, source notes, staff emails, Google sheet data or raw signed tokens.
- Refund/cancel does not rewrite historic production events. Invalid completion or shipment without handoff/fulfillment proof denied.
- Google/Shopify/D1 unreachable: safe stale states, no mutation acknowledgment without committed receipt; backlog repaired when restored.
- No touching LIVE app, theme, token, customer, product, order or webhook during WORK certification.

## 13. Rollback and operations

Release manifest: commit SHA, app extension version, WORK/LIVE Shopify app IDs, Cloudflare Worker versions and bindings, Google Apps Script deployment IDs, D1 migration IDs, scopes, webhook topics, expected health/owner tests, monitoring thresholds, manual release approver.
KEEP is only a Git baseline until independently deployed; do not call it a separate working Shopify environment.
Rollback UI/services by pinned versions; schema migrations additive and reversible/expand-contract; never delete paid Shopify orders, historic Google events, owner mappings or confirmed payment receipts. Webhooks continue to queue safely while reconciliation paused. Provide re-runbook for updating the customer projection after restoration.
Manual JILL Google merchant desk remains break-glass, restricted to authorized operators and audited. App does not create a second source of truth.
Explicit user approval required for any production Shopify scope change, customer-facing app release, refund/payment operation, data migration or switch to LIVE.

## 14. External API source references

- https://shopify.dev/docs/apps/build/app-home
- https://shopify.dev/docs/apps/build/authentication-authorization/id-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
- https://shopify.dev/docs/apps/build/authentication-authorization/cli-app-authentication
- https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/draftOrderCreate
- https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/draftOrderInvoiceSend
- https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/draftOrderComplete
- https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DraftOrderInput
- https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Order
- https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
- https://shopify.dev/docs/apps/build/webhooks


## 15. Implementation log — 2026-10-14 P0/P1 source

Implemented:
- backend/jill-merchant-auth.mjs: a strict WORK-only adapter for a Shopify SDK-verified, online staff session; validates the pinned shop, pinned public WORK app ID, verified associated_user numeric ID, account-owner flag, online effective scopes, and optional session expiry. This code cannot validate arbitrary browser tokens by itself: the Shopify-managed authenticate.admin server route remains mandatory before calling it.
- backend/jill-merchant-policy.mjs: one operation/role registry and fail-closed permission evaluator; protected owner binding; revocation checks and assigned-only access for Viewer/Production.
- services/jill-order-desk/merchant-access.mjs: D1 parameterized, server-only owner/grant reads and explicit opt-in owner-bootstrap logic; no public HTTP routes or deployed configuration. Work shop only; first immutable owner wins. No Shopify API mutation.
- services/jill-order-desk/migrations/0001_staff_authority.sql: WORK-only owner/staff/audit tables, NOT executed against any database. Shopify still owns money and Google still owns production history.
- scripts/test-jill-merchant-auth.mjs: wrong shop, expired/offline/unverified session, missing scope, owner revocation, staff grants, double-owner collision and idempotent owner bootstrap tests. CI/postinstall validates the source without contacting Shopify.
- docs/DOMAIN_OWNERSHIP.md now records three distinct owners.

Intentionally BLOCKED:
- No embedded Shopify App Home route exists yet. The SDK and online token exchange must be linked to the EXISTING WORK app via its verified App Home configuration before a merchant identity can be trusted.
- No D1 WORK database provisioned/migration applied; bootstrap requires merchant-owned action after confirmation. No staff grant write endpoint exposed. All production, quote, invoice, refund, fulfillment, team grant/revoke and ownership-transfer actions default DISABLED in the policy.
- No private Google operator privileges inferred from Shopify staff authentication; P3 signed service-command bridge must be separately authorized and tested.
- No LIVE Shopify connector, WORK app release, new API scopes, Cloudflare deploy, Sheets write, coupon/reward changes or Shopify customer/order changes were made.

Next P1 runtime gate: confirm existing WORK Shopify app App Home host capacity and staff session online token exchange. Provision isolated D1, run additive migration, explicitly bootstrap verified WORK account owner once, then prove owner/authorized-role/unauthorized-staff denial under real Shopify Admin. Grant writes only after signed admin route and full audit test.

## 16. WORK Shopify app-host discovery and source-only loader

- Merchant supplied `shopify app info --config work`: app `JILL WORK Rewards`, public client ID `f8e1ebdbae84490dc8ea5b133637e6c0`, dev store `jill-work.myshopify.com`, 3 existing account UI extensions, and `Update URLs: Not yet configured` as of 2026-10-14. **Clarification:** the last flag describes Shopify CLI development URL-update configuration, not definitive proof that `application_url` is absent. No hosted embedded App Home is proven by this repository yet; inspect the gitignored local WORK TOML and actual running host before changing app URLs.
- Official Shopify guidance recommends hosted React Router App Home for multi-page server-side merchant workflows. This will reuse the current WORK app ID rather than creating another Shopify app. The host must configure `useOnlineTokens:true` and call Shopify's trusted `authenticate.admin(request)` before any access evaluation.
- Created `services/jill-order-desk/admin-home.mjs` read-only gate: requires a real authenticated server loader adapter, reads only the prepared isolated D1 authority, responds with no-store view models, returns 401 for offline/invalid staff, 403 for ungranted staff, and 503 when D1/Owner is uninitialized. No admin endpoint, OAuth implementation, executable hosted site, app URL, new scopes or D1 deployment has been created.
- Created `scripts/test-jill-order-desk-home.mjs` and added the check to source CI and postinstall. It verifies all-deny cases, genuine owner grant, read-only behavior, Shopify SDK redirects and no financial mutation paths.
- Next: prepare an official supported hosted app codebase for the **same** WORK app using its existing CLI config; provision an exact WORK HTTPS URL and isolated session storage with authorized merchant setup. Only then safely bootstrap Owner with real Shopify session and enable read-only merchant inbox.

## 17. WORK Cloudflare D1 resource provisioned; source binding prepared

- Merchant-provided Wrangler output confirms newly created `jill-order-desk-work` in ENAM, ID `3f17c186-c794-4e00-8f20-017191373a19`, initially zero tables. Cloudflare's `version=production` identifies the database engine, not the JILL LIVE store.
- New `services/jill-order-desk/wrangler.toml` binds this exact isolated database. A permanent fail-closed `worker.mjs` denies merchant routes (HTTP 503) until the authenticated Admin host is implemented; its health indicator shows `admin_ready:false`. This source is not deployed.
- The normal next step is an explicit remote **versioned D1 migration**, with a migration-list confirmation, tables-only verification, and `owner` count zero. See `services/jill-order-desk/README.md`. No manual staff/owner insertion and no public gateway changes.
- Both WORK source and runtime registration must stay isolated from Shopify LIVE, Rewards, Google Custom Orders ledger and the storefront Cloudflare Worker.

## 18. D1 remote migration confirmed and health gate tightened (2026-10-14)

- Merchant ran `wrangler d1 migrations apply jill-order-desk-work --remote --config ..\\jill-order-desk\\wrangler.toml`; migration `0001_staff_authority.sql` succeeded on isolated database `3f17c186-c794-4e00-8f20-017191373a19`.
- Remote introspection returned exactly `jill_merchant_audit`, `jill_merchant_authority`, and `jill_merchant_grants`; Owner count 0. **These are actual runtime observations, unlike previous source-only checks.**
- Before a separate Worker deployment, tightened `services/jill-order-desk/worker.mjs` health to verify all three actual bound D1 tables. It returns 503 for missing/incomplete/unreachable database; all merchant actions still return 503 until official Shopify Admin authentication is linked. No Owner ID, database UUID, staff grants or privileged data are exposed by health.
- The next executable gate is the separate WORK Worker deployment and real health verification, followed by the Shopify SDK-hosted embedded App Home. None of these authorizes a LIVE app release or any financial operations.

## 19. Dedicated WORK Worker deployed and public runtime audit prepared

- Merchant's Wrangler deployment receipt confirms URL `https://jill-order-desk-work.jill-work-custom-orders.workers.dev`, version `9d83e689-9d7f-4496-b460-179d6cece4c2`, and binding to WORK D1 database `jill-order-desk-work` only.
- The Worker responds with D1-schema-aware `/healthz` and denies all merchant routes until authenticated Shopify App Home is ready. **A successful deployment is not proof the live health check returned HTTP 200.**
- New uncredentialed runtime command: `npm.cmd run custom-orders:work:merchant:remote:audit`; its offline unit test is `test:work-merchant-runtime-audit`. Both are strict WORK-hostname only; the remote command uses only safe GET methods.
- Do not modify `shopify.app.work.toml` to embed an app until the real hosted App Home and online Shopify authentication/session storage are ready. Public Shopify client ID does not prove account-owner identity.

## 20. Shopify Admin SDK integration source prepared (2026-10-14)

- Official Shopify guidance confirms that App Home iframe apps can be hosted in an independently operated web framework, and that `shopifyApp({useOnlineTokens:true})` plus `authenticate.admin(request)` obtains staff-scoped online sessions. Cloudflare React Router Workers are supported by Cloudflare but the official Shopify React Router SDK presently documents a Node adapter; runtime packaging and session storage compatibility must be **proven** before deploying the embedded host.
- Created WORK-only `services/jill-order-desk/shopify-host/sdk-config.mjs`: pinned app/client/shop/origin, SDK dependency injection, online tokens and durable session storage required, with fail-closed validation. `app-home-route.mjs` wires the official SDK-authenticated session into the existing merchant Owner/role D1 reader. No merchant route is publicly served by these files.
- Added `scripts/test-jill-shopify-host-wiring.mjs` to CI/postinstall, covering unsafe host/app config, missing SDK/storage, 401 wrong shop, 503 unavailable D1, Owner read-only response, and official auth redirects.
- P1 runtime remains unfinished: Shopify-hosted App Home, real SDK token exchange, session database, secret binding, WORK app embedded config, real Owner bootstrap and staff A/B tests. Any of those are separately gated; do not infer completion from source CI.

## 21. Durable encrypted Shopify sessions — prepared (WORK source only)

- `0002_shopify_sessions.sql` adds `jill_shopify_sessions` to the existing dedicated WORK D1. This is a **pending migration**, not runtime data. Shopify online+offline token payloads are AES-256-GCM encrypted with unique nonces, an app-specific secret key, and authenticated session ID/shop binding; no raw access token or API secret is written to the role tables.
- The adapter implements the Shopify SessionStorage contract with the SDK Session serializer and preserves owner flag and staff-scoped online access information. Deterministic no-network tests cover read/store/delete/shop queries, expiry and tamper rejection.
- Before activation: validate real Shopify SDK Session class compatibility, Cloudflare Workers packaging under Node compatibility, secret provisioning, Shopify auth callback/session flows, Owner role binding and shop-scoped leak denial. User authorization required for D1 migration and Shopify app URLs.

## 22. Candidate embedded Shopify React Router App Home (unreleased)

- Created a standalone full-stack React Router v7 + Cloudflare Vite candidate App Home under `services/jill-order-desk/app-home/`, using the existing WORK shop/client, Node compatibility for the Shopify SDK, authenticated `/app` and `/auth/*` routes, Shopify App Bridge, and the existing D1-backed owner/roles gate.
- Its Worker configuration uses the same planned WORK merchant hostname and D1 binding but is **not deployed**. The existing fail-closed Worker remains active; only a reviewed replacement can change it.
- A dedicated GitHub source build job performs real npm dependency install and React Router bundling (not an SDK mock). Successful builds are not proof of real OAuth or owner registration. The encrypted session migration `0002` and Shopify secret remain unprovisioned.
- User-approved runtime sequence: certified build → SDK/Cloudflare compatibility → versioned D1 migration and separate key secret → authenticated canary → WORK-only Shopify application URL/embedding change → real owner binding → A/B operator QA. See the candidate README.

## 23. Second WORK D1 migration and protected Owner onboarding

- Merchant's Wrangler output verified `0002_shopify_sessions.sql` executed successfully on remote `jill-order-desk-work` with 3 SQL commands. Real remote session count 0, Owner count 0. Both schema migrations are now applied; do not reapply.
- Added `services/jill-order-desk/owner-bootstrap-route.mjs` and embedded `/app/setup-owner` route. The official authenticated online Shopify WORK store owner must explicitly confirm; server-only commissioning flag defaults disabled; same-origin POST and exact confirmation required; immutable owner binding/audit remains the single canonical D1 operation. Unauthorized staff cannot become Owner through typing an ID, email, or shop name.
- Added regression tests for fake shop, non-Owner, disabled flag, missing confirmation, CSRF-origin check, idempotent retries, owner-collision and preserved Shopify SDK auth redirects. These are source tests, **not** evidence that real Shopify login is configured.
- DO NOT deploy or enable owner registration until encrypted real Shopify session storage, Workers Node adapter and WORK App Home OAuth flow are runtime certified, the Worker secret is provisioned privately, and WORK-only application URLs are approved. No Shopify LIVE changes authorized.

## 24. Isolated WORK App Home canary build and host hardening

- Separate planned Cloudflare Worker `jill-order-desk-canary-work` defined in `services/jill-order-desk/app-home/wrangler.canary.jsonc`, sharing **only** the existing WORK D1. The already deployed fail-closed merchant Worker remains untouched.
- SDK app URL, OAuth Origin and Worker Host validation now derive exclusively from a stage-pinned, allowlisted Cloudflare environment binding, not from untrusted request headers; canary and WORK production hostnames cannot be interchanged.
- Canaries and release Worker configs default `JILL_WORK_OWNER_BOOTSTRAP_ENABLED=false`. Requests remain HTTP 503 without separately provisioned Shopify secret and encrypted session key; public health checks verify all four real D1 tables.
- Added CI source tests and two real independent App Home builds (normal + canary), neither deploys a Worker nor changes Shopify URLs. Do not treat an unauthenticated health result as evidence of Shopify OAuth readiness.

## 25. Deployed WORK canary receipt; pending live response certification

- Wrangler deployment confirmed isolated canary Worker URL `https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev`, version `b3a9ef0c-b6a5-4501-963d-36962630a00a`, WORK-only D1 binding, `host_stage=canary` and `owner_bootstrap=false`. Unlike earlier source tests, this is an actual Cloudflare deployment receipt.
- A separate fail-closed existing merchant Worker remains deployed. No Shopify app URL or extension changes were performed as part of this canary deployment.
- Added read-only remote runtime audit `custom-orders:work:canary:remote:audit` (five GET calls) with no credential headers and a local unit test. Do not treat successful builds or deployment as proof the live D1 health or staff auth works until this audit is run.
- Next security gates: remote canary health/denials; SDK Session serializer compatibility and durable encryption; canary-only secrets provisioned privately; real Shopify WORK URL/embedded authentication release and Owner test. Owner bootstrap remains disabled.

## 26. Private canary secrets and live denial audit verified (2026-10-14)

- Merchant uploaded **both** `JILL_WORK_SESSION_KEY_B64` and `SHOPIFY_API_SECRET` via Cloudflare Wrangler to `jill-order-desk-canary-work` only; `wrangler secret list` showed both secret names and no values. Nothing secret was copied into Git, D1 user tables, or this development record.
- Remote canary audit subsequently passed HTTP 200 on D1 `/healthz` and HTTP 503 on `/`, `/app`, `/auth/login`, and `/app/setup-owner`. OAuth and Owner setup have intentionally not been activated.
- Next gate is a read-only check of the existing WORK Shopify app config and active version, then safe candidate version with `--no-release`. Protect all three customer-account extensions from accidental reconfiguration and do not change LIVE. The secret's correctness still requires a real Shopify WORK authentication test.
