# JILL Rewards WORK — universal redemption decision

Updated 2026-10-18. The merchant chose **1 point = $1**, retaining **50 points = $50**. This supersedes this document's earlier 20%-of-purchase proposal and four unequal suggested tiers. It is the target policy for My JILL, the website, JILL HQ, and future indoor-playground sales. It is **not yet the active v13 engine**: this source decision does not change balances, existing coupons, Shopify discounts, app versions, or LIVE/KEEP. Playground SKUs and margins have not been verified.

## One exact rule for every eligible purchase

Earn **0.1 point for each $1 of eligible paid items** (1 point per $10). The ledger carries paid cents below $1 forward; it awards spendable tenths only. Redeem in **0.1-point increments**, with **1 point = $1 discount** and **0.1 point = $0.10 discount**. The minimum qualifying purchase is **$10 of eligible items per $1 of points redeemed**. This caps a reward at 10% of the eligible item subtotal, even when the wallet holds more points.

All math uses nonnegative integer cents and integer tenths, never decimal floating point:

- `earned_tenths = floor(lifetime_eligible_paid_cents / 100)`; the sub-dollar remainder remains in the audited paid-spend ledger.
- `reward_cents = requested_tenths * 10`.
- `minimum_eligible_subtotal_cents = requested_tenths * 100`.
- `maximum_tenths_on_this_purchase = min(available_tenths, floor(eligible_subtotal_cents / 100))`.

The eligible subtotal is the USD price of qualifying Shopify items **after earlier item discounts, before this reward, tax and shipping**. Excluded items do not meet the minimum. Non-stacking means an existing offer such as a larger public discount is an alternative to the points reward, never an extra discount on top. Shopify's actual calculated discount and total must match the intent before the customer accepts an HQ quote or pays; store eligibility in Shopify's product/collection-scoped one-use discount and verify a changed cart again at checkout. The coupon's minimum purchase is a platform enforcement layer, not a substitute for this canonical calculation.

| Chosen points | Discount | Minimum eligible item subtotal | Example use |
| ---: | ---: | ---: | --- |
| 0.1 | $0.10 | $1.00 | Small snack |
| 0.3 | $0.30 | $3.00 | Drink or snack |
| 1.0 | $1.00 | $10.00 | Admission or merchandise |
| 2.5 | $2.50 | $25.00 | Admission |
| 10.0 | $10.00 | $100.00 | Mixed eligible basket |
| 50.0 | $50.00 | $500.00 | Party or large merchandise order |
| 50.9 | $50.90 | $509.00 | Large eligible basket |

There are **no unequal-value reward tiers** in the target policy and **no 50-point unlock**: a customer with a 50-point balance can choose 0.3 point for a $3 drink or save the rest. A $19.99 eligible purchase permits at most **1.9 points / $1.90 off** because redemptions use 0.1-point steps; never round that reward up to $2. Earning 50 points still requires $500 of eligible paid spend, but spending all 50 points also requires a separate $500 eligible purchase. The earn rate creates at most 10% of earlier spend in face-value rewards; a 10% redemption ceiling only limits each future transaction's discount, not the program's total liability. Confirm merchandise and playground contribution margins before activation.

## One wallet, two buying paths, one HQ view

| Purchase path | Customer action | Shopify/HQ authority |
| --- | --- | --- |
| Website cart | My JILL chooses the exact point amount and receives one targeted, one-use, non-stacking code | Shopify checkout enforces an eligible-product/collection discount and purchase minimum; HQ displays the resulting order and the canonical Rewards wallet. |
| HQ custom-order quote | Customer chooses the exact amount before the quote is frozen | HQ includes the same canonical code in `draftOrderCalculate`, verifies eligibility and total, then applies it in the one linked Draft Order after quote acceptance. Shopify invoice/checkout owns payment. |
| Future playground admission, party, merchandise, snack or drink | Purchasing adult signs in or is securely linked to the Shopify customer before earning/spending | Sell as Shopify items/orders, including any HQ-assisted sale. HQ reads and operates the same wallet and Shopify order; it does not create separate playground points, cash tenders or payment truth. |

The playground product/collection eligibility set includes admissions, parties, merchandise, snacks and drinks once their Shopify SKUs and costs are reviewed. Exclude gift cards, refundable deposits, tips, tax, shipping and recurring memberships until each has a separate financial contract. Earn only on the verified **paid net item value** after discounts, reconcile edits/refunds/cancellations from Shopify and credit a deposit plus balance **once** for the same underlying purchase. An anonymous playground purchase has no automatic account points; a later claim needs verified ownership. No child identity or visit history belongs in the wallet. All discount codes must be scoped to eligible items and apply once per order, so buying unrelated products cannot qualify or multiply a reward.

The canonical Rewards owner reserves the selected points **once** while issuing one exact-value coupon with an idempotent request ID. My JILL and HQ show the same coupon/status; HQ attaching it to a draft does not reserve more points. Expiry, an abandoned quote, a changed basket and refund must be reconciled in that owner. V13 currently consumes points when a coupon expires unused; the target customer experience should return unused reserved points after Shopify confirms the code is unusable and unredeemed. Implement that as an audited state transition, not a blind balance increment. A used or expired code cannot be silently moved to a new draft. Freeze the code/value with an accepted quote; if ineligible or expired before invoice, hold it, recalculate and obtain a new acceptance.

## Migration and WORK activation gates

1. Snapshot actual WORK v13 earned/redeemed/balance, exact `eligible_spend_cents`, wallet coupons, request nonces and Shopify discount objects. The current fixed terms are 10 points/$5 off $25, 20/$12 off $50, 35/$25 off $100 and 50/$40 off $150. Existing issued codes **retain their issued value and minimum**, even after the future rule changes. Version coupon integrity by issuance policy so the current table cannot revoke them as “unsupported.”
2. Version the ledger and customer command in the **single** canonical Rewards owner. Migrate whole-point lifetime balances/reservations to integer tenths exactly once and account for eligible-spend remainder without double-crediting historical orders. Do not pass decimals through the v13 integer `redeem_request_points` field. My JILL shows tenths and chooses an exact amount; HQ reads the same state through authorized server endpoints, never a second wallet.
3. Issue scoped, one-use, customer-targeted discounts with exact cents, 10× eligible minimum and no stacking; compare Shopify's calculation for the cart or draft. Test multi-line eligible baskets to ensure Shopify applies the full requested discount exactly once rather than clipping it to a single low-priced item; hold the release if the chosen discount type cannot do so. Reconcile code issuance timeouts, claims, one active request, duplicate submissions, expiries, refund solvency and changed cart/customer before enabling customer action. Test $1, $3, $9.99, $10, $19.99, $25, $100, $500 and $509 examples plus existing issued coupons in WORK.
4. Prove one synthetic WORK website checkout and one HQ quote → draft → invoice → Shopify Order with the same wallet and verified customer. Add representative real playground SKUs only after price/margin review; test adult account binding, admission, snack, party, refund and guest handling. No paid infrastructure, LIVE/KEEP release or playground claim is implied by this policy decision.

Shopify references:

- https://help.shopify.com/en/manual/discounts/discount-types/percentage-fixed-amount
- https://help.shopify.com/en/manual/fulfillment/managing-orders/create-orders/discounts
- https://shopify.dev/docs/api/admin-graphql/2026-07/input-objects/DraftOrderInput
