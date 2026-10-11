# My JILL account cutover — WORK certification

## Exact environment ownership

- **Customer-account development store:** `jill-work.myshopify.com`
- **Development app:** `JILL WORK Rewards` / client `f8e1ebdbae84490dc8ea5b133637e6c0`
- **Development branch:** `jill/rewards-work`; PR #39 remains a draft
- **Production store:** `jqtdgr-1y.myshopify.com` / jillonlinestore.com — NOT a preview target
- **Production JILL WORK theme:** a separately staged UNPUBLISHED storefront theme — not the above development store
- **Canonical backend:** existing Apps Script Rewards v13. No second points engine.

The source release and Shopify browser runtime are independent certification gates.
The WORK branch must never deploy the production account app or edit the
production theme as part of this account migration.

## One owner per domain

| Domain | Canonical path |
| --- | --- |
| Customer-account extension entrypoint | `extensions/jill-account-dashboard/src/Dashboard.jsx` |
| My JILL shell/navigation | `extensions/jill-account-dashboard/src/hub/AccountHub.jsx` and `hub/routes.mjs` |
| Authenticated summary query | `shared/customer-account-api.mjs` |
| Rewards Customer Account read + request CAS | `extensions/jill-account-dashboard/src/rewards/account-transport.mjs` |
| Reward confirmation, state and wallet-authoritative success | `extensions/jill-account-dashboard/src/rewards/RewardsCard.jsx` |
| Reward points/tier/status/shareable cart policy | `shared/rewards.mjs` |
| Strict wallet/public offer read | `shared/customer-coupons.mjs` |
| My JILL Coupons presentation + native Use Now | `extensions/jill-account-dashboard/src/pages/Coupons.jsx` |
| Coupon issue/points ledger | `backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs` (v13) |
| Public promotion snapshot publisher | `backend/google-apps-script/JILL_Public_Promotions.gs` |

The existing separate `jill-account-coupons` extension stays temporarily
available until native account navigation and new hub Coupons parity are
proven. Do not simultaneously register a duplicate new Shopify extension UID.

## Current SHOPIFY WORK source checks

Connected Shopify Admin read on 2026-10-11 verified:
- `JILL WORK Rewards` app is installed with
  `customer_read_customers`, `customer_write_customers`,
  `customer_read_orders` and required Admin read/write scopes.
- Customer metafield definitions:
  `jill_rewards.points_balance`, `eligible_spend_cents`,
  `points_earned_lifetime`, `points_redeemed_lifetime`, `coupons`
  are customer READ; `redeem_request_points` and `redeem_request_nonce`
  are customer READ_WRITE.
- `jill_promotions.active_public_codes` is Storefront PUBLIC_READ.
- New My JILL account hub and Rewards runtime share a single request
  transport and UI state machine. The preview isolates the exact WORK app.

This **does not** establish merchant browser, worker transaction, cart,
checkout, or production readiness by itself.

## Preview the exact source in authenticated WORK

From a local Git checkout on `jill/rewards-work`:

1. `git pull`, `npm.cmd install`.
2. Run `npm.cmd run rewards:work:preview` for the actual extension source.
   This command verifies WORK config/client/store before invoking Shopify CLI
   development preview.
3. In Shopify Dev Console open **My JILL → Web preview** on the signed-in
   synthetic QA customer. Do not use the production account URL.
4. If the app fails to render, collect the **first** Shopify extension
   worker/console exception plus response/GraphQL error before changing code.
5. Use `npm.cmd run rewards:work:hub:template` only as a second, isolated
   diagnostic if a full-source preview fails. It must not become another
   canonical shipping implementation.

## Browser acceptance matrix — **must be recorded, not assumed**

1. Signed-in WORK QA customer: expected verified starting source-layer ledger
   (last known 30 available / 30 earned / 0 redeemed / wallet []). Recheck
   Admin before performing any controlled test; do not assume it stayed 30.
2. My JILL: Overview, Rewards, Coupons, other seven navigable screens,
   native Orders/Profile, cold load and reload; no blank/generic error.
3. Coupons: wallet empty displays an honest empty state; public offer is
   current, all-customer, nonstale; public-feed failure does not hide wallet;
   wallet error never claims zero coupons.
4. Customer isolation: two separate signed-in WORK identities cannot read
   another customer's coupons, points, saved details or checkout discounts.
5. Rewards: confirmation **No** performs no write; **Yes** writes one
   customer-owned CAS request; no duplicate on double click or tabs; stages
   show generating, setting up, and wallet-confirmed redeemed.
6. Worker authoritative result: points debit and matching customer-targeted
   discount are each exactly once; compare request nonce, ledger, coupon
   expiration (30 days), single-use limit, order minimum and nonstacking.
7. Use Now: opens Shopify's **WORK** cart with the verified code; test above
   and below the minimum, checkout eligibility and used/expired conditions.
   The native discount URL does **not** guarantee browser-session-only life.
8. Error recovery: invalid wallet JSON, missing scopes/metafields, worker
   failure, timeout, pending request, digest conflict, account switch, stale
   promotion and denied Customer Account mutations.
9. Visual: 390/768/1440 widths, focus/keyboard, overlays, clear busy status,
   checkout links and Shopify native account navigation.

## Release blockers

- **WORK browser rendering is not yet certified** for the current hub source.
- A real test redemption/checkout against the WORK backend is not yet certified.
- Custom Orders history, Celebrations and Saved Preferences lack verified
  customer-specific persistence/ownership and consent contracts. Never present
  placeholder state as a functioning saved customer record. Hide or finish
  incomplete modules before production exposure.
- The production app release is a distinct, manual exact-SHA workflow and
  **requires explicit release authorization after WORK certification**.

## Rollback

The previously released Shopify WORK app version remains independently
restorable. The Git commit before the unified entrypoint migration retains
the older Dashboard display, and backend v13 remains unchanged during these
UI-source changes. Do not reset customer points, delete wallet records,
rotate coupon codes or modify production storefront theme during UI rollback.
