# JILL MASTER HQ — WORK execution gates (2026-10-20)

Status: WORK planning / source coordination only. No release authorization; no LIVE mutation.

## Ground truth (read-only owner inventory at 2026-10-20 17:57:32Z)
- Git branch `jill/rewards-work`, commit `27e9ffa471748bede979d6aa576e7b41cbee732e`, tracked clean.
- HQ ordinary runtime `f224e8f5-3919-45e3-8fb6-bf85f6e482f5` at 100%, health 200.
- HQ quote candidate `dbc6341f-de7f-41de-8e97-6bf971201eeb` at 0%; never silently allocate traffic.
- Gateway ordinary runtime `9322193f-5e87-4479-88c9-39229dddb5f2` at 100%, diagnostic `b6237ad9-3343-4c8b-8b65-7a0194ddc50e` at 0%, both health 200.
- Ordinary HQ flags: catalog TRUE; detail TRUE; OAuth TRUE; merchant writes TRUE; conversation FALSE; quote drafts FALSE; owner bootstrap FALSE.
- Active Shopify app version/scopes/staff roles, Google published revision and usage/budget are UNVERIFIED. Healthy HTTP is not functional acceptance.
- R2/private media activation held; no paid service or LIVE rollout.

## Release train — separate stages, each independently approved
### R1: Requests row disclosure only
1. Preserve seven-column contract; six info fields are one accessible button, actions are outside the opener. Expanded verified original request in normal flow. Direct Message customer / Update status, no Quick Actions dropdown.
2. Rerun `npm.cmd run test:work-hq-row-disclosure`, `npm.cmd run test:work-hq-inbox-ui`, `npm.cmd run test:work-hq-customer-name`, `npm.cmd run work:hq:row-disclosure:runtime:check`. Complete real Admin build/CI and check new isolated release profile reflects ONLY the four reviewed HQ row files.
3. Recheck owner runtime inventory immediately before any release. Confirm 0% quote canary unchanged. Review one-use receipt and proposed routes/bindings. Only with distinct explicit approval deploy to WORK; then authenticated Owner mouse/keyboard/mobile/action and read-only verification. No previous spent receipts.

### R2: HQ two-sided messages
1. Source includes `/app/messages`, My JILL Messages and canonical public thread projection. No separate chat store.
2. Run `npm.cmd run test:work-message-inboxes`, `npm.cmd run work:hq:messaging:check` plus WORK app build, extension architecture and customer A/B authorization tests.
3. Check real Google signed timeline v2, authenticated HQ Owner, account A/B isolation, legacy v1 behavior, operation-ID lost-ack recovery; then separately review flags and extension publish. No unread or delivery badges without cursor/provider receipts.

### R3: Catalog + Quotes
1. Catalog current Shopify data is read-only. Exact variant ID/WORK shop/ACTIVE status/USD price verification required; never map from title, SKU or legacy `456` ID without proven authorized resolver.
2. Run `npm.cmd run test:work-hq-catalog-quote-bridge`, `npm.cmd run test:work-hq-quote-unit-review`, `npm.cmd run test:work-quote-commerce-handoff`.
3. Implement separately gated Owner preview route with trusted canonical saved draft and exact original source revision; no browser-supplied pricing authority. Merchant must explicitly reconcile prices and each P1/P2 unit, attribute, attachment, labor/material charge, delivery and tax.
4. Native Shopify calculation must be fresh and verified before publishing immutable quote terms. Draft Order calculation is not invoice/order creation. Source quote flag presently FALSE; 0% canary not an authorized traffic migration.

### R4: Customer approval → Invoice → Order
1. Customer views signed immutable quote revision inside My JILL; exact authenticated acceptance recorded once with operation ID in canonical thread/state machine.
2. New idempotent owner-only Shopify order creation and read-back recovery, followed by separately confirmed invoice-send action and provider outcome. No automatic retry after uncertain writes.
3. Tracking/status reconciles to Shopify authoritative order; customer only sees own order. Rollout first in WORK with real A/B tests, then separately approved LIVE release.

## Operating guardrails and stop conditions
- Do not run older one-use release/rollback scripts, alter 0% pinned candidate allocation, or blanket-publish the entire new Git HEAD.
- No D1 migration, Apps Script publishing, R2 activation, Shopify extension release, OAuth scope change, production customer message, secrets movement, paid Cloudflare/Shopify services or LIVE changes without their own reviewed gate and authorization.
- Stop on unknown Shopify deployed app version/permissions, failed tests, unverified signed Google source, lost receipt, missing source-to-draft correlation, ambiguous customer ownership, or unknown billing impact.
- Unknown original October 19 submission must be correlated to the actual private operation ID; synthetic replay is not evidence.
- Prefer source tests and read-only provider inventory first, then explicit user-reviewed WORK preview/push, then runtime acceptance.

## Acceptance outcomes
- R1: every summary row opens details; actions operate independently, page scrolls naturally.
- R2: messages sent by HQ and customer appear in exactly one authorized public request timeline; unauthorized account sees nothing; uncertain writes recover safely.
- R3: catalog and custom quotes compare exact saved price vs Shopify current price with no silent repricing, missing P1/P2 attributes or unapproved taxes.
- R4: exactly one approved Shopify order and invoice workflow per immutable accepted quote, with customer-visible tracking and audit trail.

This matrix coordinates existing source documents; it makes no claim that any unreleased feature is live.
