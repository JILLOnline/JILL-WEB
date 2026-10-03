# JILL Rewards Engine v13

This document describes the source-of-truth Rewards architecture shipped from `JILLOnline/JILL-WEB`.

## Canonical policy

- Earn: **1 point per $10** of eligible merchandise spend.
- Eligible spend: Shopify line-item totals **after discounts and before tax**, excluding refunded/removed quantities and gift cards. Shipping is excluded.
- Tiers: **10 -> $5 OFF / $25 minimum**, **20 -> $12 OFF / $50 minimum**, **35 -> $25 OFF / $100 minimum**, **50 -> $40 OFF / $150 minimum**.
- Coupons: customer-specific, single-use, 30-day expiration, no order/product/shipping discount stacking.
- Canonical configuration: `rewards.config.json`.

## Canonical UI state machine

Persistent states are `REDEEM`, `USE_COUPON`, `NEXT_REWARD`, and `LOCKED`. Transient overlays are `CONFIRMING`, `CREATING`, and `ERROR`.

Expanded order is **Creating -> Next Reward -> Redeemable -> Use Coupon -> Locked**. Collapsed mode shows the current `NEXT_REWARD` whenever one exists, even if lower tiers are redeemable.

Only `NEXT_REWARD` displays the remaining-points copy. `REDEEM` is interactive and semantic green, `USE_COUPON` is interactive and semantic info/blue, and later `LOCKED` tiers are neutral/non-interactive. Shopify Customer Account UI extensions inherit Shopify/merchant styling rather than arbitrary custom CSS colors.

## Coupon and ledger invariants

The customer wallet is reconciled against Shopify discount source-of-truth. For active coupons v13 verifies:

- discount exists and is an amount-off basic code,
- active status or recorded usage,
- exact code, tier value, and minimum order,
- customer targeting,
- all-item entitlement,
- 1-use limit and once-per-customer behavior,
- no discount combinations,
- 30-day expiration alignment.

A missing or materially altered unused coupon is revoked and its reserved points are released. This includes an admin shortening an unused coupon's expiration before the canonical 30-day date. A coupon with recorded usage becomes `used`; used points are never restored. Coupons that reach their normal canonical expiration remain historical committed point spend. Malformed wallet JSON fails closed rather than silently crediting points.

## Refund/cancellation solvency

Order paid/refund/cancel/edit events recalculate the order's eligible merchandise subtotal from Shopify's 2026-07 `LineItem.priceAfterAllDiscountsBeforeTaxesSet`, which excludes refunded and removed units and tax. The order metafield `jill_rewards.credited_cents` makes reprocessing idempotent.

If a refund/cancellation reduces earned points below committed points, unused active coupons are revoked **newest first** until the account is solvent or no unused coupons remain. Used and expired rewards are never clawed back; any residual deficit is absorbed by future earning while spendable balance remains floored at zero.

## Redemption transaction

The Customer Account writes a tier + nonce request. The backend reconciles wallet truth, checks spendable balance, atomically claims the nonce, creates the Shopify code, then writes wallet/points/request completion. The final write deliberately does not rewrite the claimed nonce with a stale compare digest. If coupon creation or the final state write fails, the newly created discount is deleted and the pending request is cleared.

## Self-healing layers

1. Shopify webhooks: paid orders, refunds, cancellations, edits, customer updates, discount deletion.
2. Apps Script minute sweep: pending reward requests and coupon integrity reconciliation.
3. Apps Script infrastructure self-heal: webhook subscriptions and trigger repair.
4. GitHub Actions watchdog: validates public backend response and engine version.
5. Dashboard/My Coupons: refresh every 25 seconds while open.

## Production lock criteria

Do not label the engine locked until all of the following pass:

- `node scripts/check-rewards-engine.mjs`
- `node scripts/test-rewards-engine.mjs`
- Shopify Customer Account config validation/build/deploy
- live watchdog reports `ok: true`, `watchdog: true`, `engine_version: "13"`
- live redemption creates a real Shopify coupon and the Dashboard changes to `USE_COUPON`
- admin deletion of an unused coupon revokes it and releases points
- deletion of a used coupon does not release points
- partial/full refund behavior matches the solvency rules

## Deployment provenance

The canonical backend delivery owner is `.github/workflows/deploy-rewards-backend.yml`. It deploys the existing Apps Script project and existing web-app deployment only after the Rewards guards and redemption transaction tests pass. The workflow first pulls the remote Apps Script project and refuses to overwrite it if unexpected production-only source files exist.

Repository source retains the literal `__JILL_REWARDS_BUILD_SHA__` marker. Deployment replaces that marker in the staged copy with the exact Git commit SHA. The runtime watchdog reports both `engine_version` and `build_sha`; deployment certification requires the live `/exec` endpoint to report the exact commit that was deployed.

Manual Apps Script editor changes are not a canonical delivery path after this lane is activated. The existing web-app deployment ID is updated in place so JILL does not create a second backend authority or change the public Custom Order/Rewards endpoint.


## Resumable customer sweep

The minute Rewards worker traverses customers with a persisted Shopify pagination cursor instead of restarting at customer 1 on every invocation. Each run processes at most 5 pages of 100 customers. Progress is persisted only after a page has been fully handled; the end of the Shopify connection clears the cursor and marks the cycle complete. If Shopify rejects a stored cursor before any page is processed, the worker clears that non-authoritative traversal marker and retries once from the beginning. Individual customer failures remain isolated and do not discard progress for the rest of the page.


## Deleted-discount durable queue

The Shopify `DISCOUNTS_DELETE` webhook never scans the customer population synchronously. It idempotently enqueues the deleted discount ID in Script Properties and returns. The minute Rewards worker processes the oldest queue job in bounded pages, persisting the Shopify cursor only after each page has been handled. Repeated webhook delivery for the same discount ID reuses the existing job. A stale Shopify cursor is cleared and retried once from the beginning. The queue entry is removed only after the full customer connection has been traversed (or Shopify proves the discount still exists). Unused matching Rewards coupons are revoked with `admin_deleted` and their points are released; used or expired coupons remain committed.


## Maintenance and monitoring separation

The minute Apps Script trigger is the sole owner of operational repair and reconciliation. It verifies Rewards webhook/trigger infrastructure, keeps Public Promotions healthy, processes pending redemptions, normalizes wallets, advances the resumable customer cursor, and processes the deleted-discount queue.

The public `?jill_rewards_watchdog=1` endpoint is read-only. It reports webhook/trigger health, the age and summary of the most recent successful minute sweep, Public Promotions freshness/trigger state, deletion-queue depth, engine version, and deployed Git build SHA. An external watchdog can therefore detect drift without causing business-state mutations merely by polling health.


## Webhook ingress security

The current Apps Script web-app transport cannot inspect Shopify's HTTPS webhook headers, so it cannot truthfully implement Shopify's standard `X-Shopify-Hmac-SHA256` verification at this endpoint. The active Apps Script fallback therefore uses a topic-scoped 48-character derived secret in each webhook URI, rejects unknown topic keys before payload processing, compares the supplied secret with constant work, and keeps event handling idempotent/reconcilable. The public health response explicitly reports `webhook_auth_mode: topic_scoped_query_secret_v2` and `standard_hmac_verified: false` so operational health never masquerades as standard Shopify HMAC authentication.

A future header-capable ingress may replace this boundary only when it is a real deployed canonical owner. It must verify the raw-body Shopify HMAC, expected shop domain/topic, and Shopify delivery ID before forwarding an authenticated event. Do not add an undeployed placeholder ingress or a second competing webhook authority.


## Retired legacy reward schema

The former single-coupon customer definitions `jill_rewards.active_coupon_code`, `jill_rewards.active_coupon_value_cents`, and `jill_rewards.active_coupon_points` are retired. A live-store audit on October 3, 2026 found no values for any of the three fields across all 75 customers, and the unused Shopify definitions were deleted without deleting associated customer metafields. The canonical coupon state is the `jill_rewards.coupons` wallet only. Repository guards prevent these retired keys from being reintroduced into Dashboard, Coupons, shared Rewards state, or the backend.
