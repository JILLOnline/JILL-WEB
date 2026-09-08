# JILL Rewards Engine v12

This document records the production Rewards engine rollout so the Customer Account UI, Shopify discount layer, Google Apps Script backend, and watchdog can be audited as one system.

## Canonical reward tiers

| Points | Reward | Minimum order |
| ---: | ---: | ---: |
| 10 | $5 OFF | $25 |
| 20 | $12 OFF | $50 |
| 35 | $25 OFF | $100 |
| 50 | $40 OFF | $150 |

Earn rate: **1 point per $10 of eligible JILL merchandise spend**.

## v12 Apps Script artifact

- Engine version: `12`
- Prepared artifact: `JILL_Custom_Order_Automation_REWARDS(12).gs`
- Size: `76101` bytes
- SHA-256: `c2cc3710a63f0631adfd5a951c9217d8bd7bd6b567f78b3e5577c95503eaebdc`

The live Apps Script watchdog response must report `engine_version: "12"` before this rollout is considered complete.

## State rules

Each tier has one persistent Customer Account state:

- `redeem`: customer has enough spendable points and no active coupon for the tier.
- `redeemed`: an active usable Shopify reward coupon exists for the tier.
- `next`: the first unreached tier. Exactly one tier maximum.
- `locked`: any other unreached tier.

Transient overlays are `confirming` and `creating`.

Expanded order is: **Creating -> Next Reward -> Redeemable -> Redeemed -> Locked**.
Collapsed order favors the highest redeemable reward, otherwise Next Reward.

## Coupon invariants

New v12 coupons are:

- customer-specific,
- single-use,
- valid for 30 days,
- configured for the tier's exact value and minimum,
- non-stackable with order, product, or shipping discounts.

The reconciler verifies active wallet coupons against Shopify source-of-truth state. Missing, disabled, or materially altered unused reward discounts are removed from the wallet only after Shopify confirms they cannot remain usable; points are then restored. A Shopify discount with recorded usage is preserved as `used` and its points are not restored.

## Refund / cancellation solvency

After an order edit, refund, or cancellation reduces earned points below lifetime redeemed points, unused active reward coupons are revoked newest-first until the account is solvent or no unused coupons remain. Used rewards are never clawed back. Any residual deficit is absorbed by future earning because available points remain floored at zero.

## Self-healing layers

1. Shopify reward webhooks handle paid orders, refunds, cancellations, edits, customer updates, and discount deletions.
2. A Google Apps Script minute worker processes pending redemption requests and reconciles wallets.
3. Apps Script periodically checks/recreates its own webhook and trigger infrastructure.
4. GitHub Actions pings the public watchdog every 15 minutes and now fails loudly on invalid/unauthorized responses.
5. The Dashboard and My Coupons refresh reward data every 25 seconds while open.

## Production verification checklist

The rollout is not complete until all are true:

- Customer Account deployment passes the rewards config parity guard.
- Apps Script v12 is deployed to the existing production `/exec` web app.
- Web app execution is set to the owner and access permits the unauthenticated GitHub watchdog request.
- `setupJillRewards()` is run once after v12 deployment to install/repair the minute trigger and Shopify subscriptions.
- Watchdog returns valid JSON with `ok: true`, `watchdog: true`, and `engine_version: "12"`.
- A manually deleted unused reward coupon disappears from an already-open account view and its points are restored.
- A used reward remains used and never returns points.
