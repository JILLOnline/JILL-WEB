# JILL HQ — WORK | Merchant Management Center

For the cross-domain WORK system map, current proof boundaries and data joins, see `JILL_HQ_WORK_SYSTEM_MAP.md`. For the customer Inbox, quote approval and Shopify handoff, see `JILL_HQ_MY_JILL_CUSTOMER_HANDOFF.md`. Physical machines and capacity are outside this release. The dated rollout notes below record the state when each phase was written.

Status: WORK branding + management shell SOURCE CANDIDATE ONLY (2026-10-14).
App identity: existing WORK Shopify app client ID `f8e1ebdbae84490dc8ea5b133637e6c0` on `jill-work.myshopify.com`.
LIVE is intentionally excluded.

## Naming and deployment boundaries

- Shopify Admin left Apps navigation: **JILL HQ — WORK**, configured via `name` in the ignored local `shopify.app.work.toml`. Do not change the `handle`, app ID, application URL, scopes, extensions or other store configuration to achieve this rename.
- Embedded App Home and Owner setup: **JILL HQ — WORK**, owned by the WORK React Router routes and server model.
- `scripts/prepare-rewards-work-config.mjs` migrates only the linked, identity-verified WORK app name from legacy `JILL WORK Rewards` to `JILL HQ — WORK`, retaining the existing write_orders scope normalization. It is local-only until Shopify's new app version is explicitly released.
- Shopify CLI `app deploy --config work` creates/releases an app version, potentially including all extension configurations. Inspect Shopify version diff and explicitly authorize WORK-only release; no automated deploy in this patch.
- Renaming does not change app ownership, reinstall app, merge LIVE and WORK, broaden OAuth scopes, enable Owner bootstrap, or enable merchant writes.

## Scope: eventual integrated merchant management dashboard

1. Overview — operational counters and alerts from certified upstream sources; never make up metrics.
2. Custom Orders — canonical Google QA Submissions and append-only CustomOrderEvents; secure staff inbox and details, production transitions only through signed canonical command path.
3. Customers — Shopify-authoritative customer profiles and commerce history, customer-account owner verification, privacy minimization and role-scoped display.
4. Rewards and Coupons — existing JILL Rewards canonical logic and customer wallet; no duplicate balances or unapproved adjustments.
5. Products and Inventory — Shopify-authoritative catalog, variants, stock and fulfillment locations.
6. Sales, Drafts, Invoices and Fulfillment — Shopify-authoritative prices, taxes, checkout, payment, refunds and tracking; high-risk operations require explicit gates.
7. Team and Access — trusted Shopify online staff session, JILL D1 grants, Owner governance and revocation.
8. Activity, Analytics and Reconciliation — audit events, freshness, source health, exception queues; no shadow mutable order-status store.

## Privacy and role gate

- Access is **not** blanket access to all customer data. Read eligibility is decided server-side on every request from Shopify's authenticated online identity, requested scope, staff role/grant and per-record authorization. Least-privilege outputs; no secrets, session tokens or private customer artwork URLs in UI logs.
- Owner commissioning has already completed in WORK and must remain disabled. Invoicing, refunds, employee invitations, production writes and any bulk customer export remain disabled until separately authorized and certified.
- No external system should be considered connected merely because its module heading appears on the dashboard.
- Do not reuse customer-account `custom_order.account.list` as an all-customer merchant feed. The Google merchant signed read bridge and PR #44 inbox authorization are separate work items.
- No LIVE, KEEP, My JILL customer extension, or production storefront changes in this branding patch.

## Acceptance

1. Verify WORK Client ID and original application handle/URLs before and after local TOML name migration.
2. Node tests and WORK CI certify the frontend label and WORK config guard.
3. Deploy corrected frontend to WORK canary only with OAuth enabled and bootstrap disabled; verify authenticated Shopify Admin behavior.
4. Release a distinct WORK Shopify app version with its current known-good app URLs, scopes and extensions held constant apart from the app name; verify Shopify Admin sidebar label.
5. Smoke-test Rewards, Coupons, Customer Account and Custom Orders after a Shopify app-version release; rollback by releasing prior known-good WORK app version if any regression occurs.

## P2 Custom Orders inbox (Owner-only source candidate)

- Embedded WORK route: `/app/requests`, linked from the authorized HQ page. All direct navigations rerun Shopify SDK online authentication and WORK D1 authorization; a browser link or a customer-supplied ID is never permission.
- Initial full-list access: verified Owner ONLY. Granted staff without assignment-aware, field-level policy are denied.
- Source: **NOT YET CONNECTED**. The Google QA `Submissions` and append-only `CustomOrderEvents` remain authoritative. A signed merchant-wide read must be designed and certified separately; never reuse customer-owned `custom_order.account.list` or impersonate a Google operator.
- No invented zero count: missing source results in `source_not_connected`. A verified complete, bounded upstream list may return zero records. Missing/corrupt data fails closed.
- Projection: opaque ID, revision, customer/internal status, submitted/updated dates, need-by date, fulfillment, item count. No email/phone/address, artwork URLs, internal notes, API tokens or raw payload.
- No D1 migration, Google read token, runtime deployment, staff grants, refund, invoice or order mutation in this phase. Tests are required before shipping; browser review remains a separate gate.

## WORK HQ Google QA merchant list bridge (source-only, pending runtime activation)

- Canonical Google source is the isolated WORK Custom Orders QA Script (`Submissions`, `CustomOrderEvents`), not the LIVE sheet and not Rewards Apps Script. The new `jill_order_merchant_list=1` POST path is unreachable in LIVE and ordinary WORK Rewards because `JILL_CUSTOM_ORDER_SANDBOX` must be true.
- HQ Worker signs each private server-to-server request with a fresh nonce, timestamp, and a **separate** 32+ character `JILL_HQ_MERCHANT_READ_SECRET`; it is **not** the customer-list HMAC key, Shopify API secret or Rewards redemption secret. Signing covers the fixed WORK shop and action.
- Google verifies the HMAC under a two-minute maximum skew before accessing its QA spreadsheet. Read path only calls `getSheetByName/getRange/getValues`; no sheet creation, append, updating events or owner claims. Catches all source errors without leaking customer data.
- Before the Worker secret is provisioned the HQ inbox renders `source_not_connected`; partial/incomplete data never substitutes fabricated zero orders. Shopify SDK + D1 + Owner role always precede any Google call. The Worker pins the known isolated QA `/exec` deployment, blocks arbitrary destinations, enforces 15s timeout and a 64 KiB response cap, then whitelists metadata.
- The first feed is strictly bounded to **50 complete submissions and 500 canonical events**. If the QA data grows beyond those bounds, source must return a safe unavailable state until independently designed cursor pagination is certified. No silent truncation.
- Activation (not performed here): separately provision the same high-entropy secret into isolated Google QA Script Properties and as the **WORK canary** Cloudflare secret; update the existing isolated QA deployment using certified source and project/sheet ID checks; deploy the canary with Owner bootstrap OFF; verify one known request and denial for unauthenticated, non-owner, foreign-shop, expired-signature, malformed, and overflow cases. Verify no signed key in code, URL, logs or customer account.
- No LIVE apps, account extensions, Shopify app versions, customer coupons, production form, refunds, invoices, staff grants or merchant mutations are included in this source candidate.
