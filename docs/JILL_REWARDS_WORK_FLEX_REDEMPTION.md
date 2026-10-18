# JILL Rewards WORK — 50-point flexible redemption proposal

Updated 2026-10-18. This is a source-only commercial and integration proposal for the existing JILL Rewards v13 owner, My JILL and JILL HQ. It does not change `rewards.config.json`, the backend, existing balances/coupons, Shopify discounts or any released app version. Indoor playground admissions and parties are a future product family; no actual booking SKUs, price or margin have been verified.

## Proposed customer rule

- Earn **1 point per $10 of eligible paid purchase value**, which is **0.1 point per $1**. Reconcile exact USD cents from the Shopify order after discounts; refunds/cancellations reduce eligible spend. No double points from a deposit and its later balance payment. Taxes, shipping, gift cards and excluded fees do not earn. The existing engine already accumulates `eligible_spend_cents` but awards only whole points by flooring total cents / 1000. The target rule credits spendable **tenths** after each whole $1, carrying sub-dollar eligible cents forward. Store integer `point_tenths` and money in cents; never use floating-point point accounting or reissue already earned whole points during migration.
- Retain smaller choices so a family can use a reward on an admission instead of waiting for a large party order. Proposed **newly issued** reward minimums keep each discount at or below 20% of eligible item subtotal:

| Points spent | Reward | Minimum eligible subtotal | Example |
| ---: | ---: | ---: | --- |
| 10 | $5 | $25 | Small admission or merchandise |
| 20 | $12 | $60 | Multi-person admission or products |
| 35 | $25 | $125 | Larger basket or package |
| 50 | $50 | $250 | Party package or merchandise |
| 50.1+ | $1 per point, including 0.1-point steps | At least five times reward dollars | 50.9 points → $50.90 off $254.50+ |

The current 50-point tier is **$40 off $150**; changing it to $50 off $150 would permit a 33.3% discount on that purchase. The 20% limit is a conservative launch rule, **not** evidence of profitability. At the proposed earn rate, a customer accrues 50 points from $500 of eligible spend, creating up to $50 of future face-value discount (10% of that earning spend). Margins, fulfillment cost, playground staffing/insurance and repeat-purchase behavior must be measured before enabling the policy. Existing valid coupons retain the terms they were issued with; a new policy must not rewrite or devalue them.

Interpret “past 50” as **50.0 points or more**: once eligible, the customer can choose a redemption of at least 50.0 points, up to their available balance and the purchase-size limit, in 0.1-point steps. For example, 50.9 points can become $50.90 off a $254.50+ eligible purchase, or 50.0 points can become $50 off $250+ while 0.9 point remains. The flexible value in cents is `point_tenths × 10`, and the minimum eligible subtotal in cents is at least `reward_cents × 5`. A chosen value becomes **one exact-value, one-use coupon**, reserved once by the canonical Rewards owner, rather than an open-ended wallet spend at checkout. Current v13 supports only four fixed whole-point tiers, with 50 currently worth $40. This target needs a versioned tenths ledger, coupon issuance and customer redemption request; it is not active today.

## Playground and custom-order boundaries

For a future Shopify-sold indoor playground, let paid admission/party-package **line items** earn at the base rate only after the order is paid and linked to the purchasing adult's verified customer account. A $25 admission could accept the existing $5/10-point reward; a $50 reward needs at least $250 of eligible subtotal. No child's identity, age, visit history or other child data is needed for the Rewards ledger. Exclude refundable deposits, gift cards and memberships/recurring charges initially, and distinguish a package's final paid amount from any deposit so the same purchase is credited once. This is a proposed eligibility policy, not a claim that JILL currently sells playground bookings through Shopify. Memberships and rentals need their own purchase/refund rules before Rewards eligibility. Restrict the discount to the eligible Shopify products/collections and recheck the eligible subtotal server-side; an unrelated product must not make an excluded admission qualify.

In an ordinary Shopify cart, the canonical Rewards engine issues a customer-targeted, one-use, non-stacking code; My JILL shows its wallet and the native checkout path. For an HQ-approved custom-order quote, apply the **same canonical reward code** to the Shopify Draft Order during `draftOrderCalculate`/`draftOrderCreate`, verify that Shopify actually applied the intended discount and then freeze the accepted quote total. Shopify does not allow a customer to enter discount codes at a draft-invoice checkout by default, so My JILL must not advertise a reward that the invoice cannot honor. Never apply both a code and a separate manual $ amount for the same points. If the reward expires or is ineligible before invoice/payment, hold the invoice and recalculate/reapprove the quote rather than changing the total silently.

The current engine reserves points when it issues a coupon and treats expired coupons as consumed. Before variable flexible rewards ship, explicitly decide the customer-facing expiry policy and adjust the **single** v13 reconciliation/accounting owner if unused expired rewards should return points; this is especially important while a quote awaits acceptance or invoice. Preserve the existing one-use/30-day/non-stacking behavior unless a separately verified migration changes it. Do not issue a second coupon or deduct points again when HQ attaches an already issued code to a draft. On payment, use the same verified Shopify order and discount ID/code to mark the existing reward used once; on refund, let canonical reconciliation handle solvency and any reversal.

## WORK proof before activation

1. Snapshot the WORK Rewards version, balances, eligible-spend cents, active coupons, fixed tiers and customer metafield access. Define a versioned integer-tenths balance and request contract, a one-time migration from whole points and eligible-spend remainder, plus the unused-expiry policy. Prove the historical whole points, cents carried and outstanding coupon reservations reconcile exactly; do not backfill old orders without an audited plan.
2. Configure proposed new tiers and flexible amounts in **one** canonical policy, updating backend, `shared/rewards.mjs`, UI and drift guard together. Keep issued coupons unchanged. Test $1/$9.99/$10/$500 accrual, 50/50.9/51 point balances, 0.1-point redemptions, insufficient points, minimum purchase, one active flexible reward, concurrent requests, expiry and refunds. Do not overload v13's integer `redeem_request_points` contract with decimal text; version the customer command.
3. Test normal WORK cart redemption and a single synthetic HQ quote/draft with reward code applied **before** invoice; inspect Shopify's calculated amount, discount warnings, invoice checkout and final order. Verify customer A/B isolation, no stacking, no second points deduction, and no double earning on a deposit.
4. Only after real playground prices and costs exist, add its eligible SKU/product rule and test admissions, party packages, cancellations and refunds. No paid app, new infrastructure or LIVE release is implied.

Shopify references:

- https://help.shopify.com/en/manual/fulfillment/managing-orders/create-orders/discounts
- https://help.shopify.com/en/manual/discounts/discount-types/percentage-fixed-amount
- https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DraftOrderInput
