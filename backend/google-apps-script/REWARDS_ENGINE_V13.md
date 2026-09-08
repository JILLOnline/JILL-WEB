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
