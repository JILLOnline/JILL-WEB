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


## WORK Rewards transactional evidence — October 11, 2026

The merchant's signed-in WORK preview confirmed navigation among Overview,
Rewards, Coupons, native confirmation modal, and post-redemption Use Now.
An independent connected Shopify WORK Admin API reconciliation subsequently
confirmed the exact synthetic customer's authoritative state:

- 30 points earned, 10 redeemed, **20 available**, request points **0**,
  consumed request nonce.
- Wallet contains one active **$5 / $25-minimum** discount from the 10-point
  redemption, 30-day expiration ending **2026-11-10**.
- Corresponding Shopify discount exists with status ACTIVE and customer-specific
  `DiscountCustomers` context, NOT all-customer public promotion scope.
- User confirmed Use Now navigates to the Shopify cart. **Discount applied
  in a qualifying checkout has not yet been independently certified.**
- No additional QA points were redeemed or discount codes created by the
  source/deployment audits described below.

## Upcoming Offers — opted-in WORK staging

WORK already contained two Shopify **SCHEDULED** all-customer campaigns:
Black Friday (starts 2026-11-27) and Summer BOGO (starts 2027-06-01).
Both were retitled in the **WORK store only** with the opt-in
`[JILL UPCOMING] ` marker; their original codes, audience, values,
activation and expiration were NOT changed. No duplicate discounts were
created. Nothing was written to production Shopify.

Canonical `JILL_Public_Promotions.gs` now queries ACTIVE and SCHEDULED
discounts independently, but projects scheduled records only when their
merchant-controlled title includes the opt-in marker, context is all buyers,
one code exists, and the launch schedule is valid. The optional
`upcoming` collection is added to the existing v1 public snapshot without
codes, discount IDs, buyer IDs or early redemption URLs. The active
`offers` collection and compatibility reader are unchanged. Missing
upcoming records remain a valid empty state.

The new My JILL Coupons page shows **Upcoming offers** with a start date,
description and explicit "Coming soon" text; **no Use Now** for upcoming
records. Malformed upcoming records cannot hide active public offers.
The active and personal feeds remain independent.

**Current deployment boundary:** The GitHub source and Shopify scheduled
discount titles have been updated, but the Google WORK Apps Script deployment
is not updated by a GitHub source commit. The current live WORK shop metafield
will not expose the `upcoming` array until the existing WORK Google web-app
deployment is updated and the next promotion synchronization succeeds.

Only from the merchant's existing verified local WORK checkout:

```powershell
git switch jill/rewards-work
git pull --ff-only
npm.cmd install
npm.cmd run rewards:work:backend:update
```

This helper verifies the WORK app/store and Google project identities, an
unmodified tracked worktree, exact `origin/jill/rewards-work` SHA and the
**existing** WORK Apps Script deployment ID. It uploads only the two
canonical .gs files and updates the *same* deployment, with no duplicate
web-app URL. Do not use the production Apps Script commands or production
Shopify credentials.

After backend update, verify its `?jill_rewards_watchdog=1` response
references the exact deployed commit/engine v13, and inspect the WORK Shopify
shop metafield `jill_promotions.active_public_codes` after the next minute
worker. It must contain `offers` plus two opt-in `upcoming` items with
future start dates and **no `code` property**. Refresh Coupons in a signed-in
WORK account to validate UI. If the record stays old or the watchdog is
stale, keep the release blocked and inspect Google triggers/Script Properties.

## Transfer safety reconciliation

WORK branch release YAMLs have been synchronized to the protected
`jill/theme-core` release baseline. The production account app and
Apps Script backend no longer auto-deploy on a Git push; both require an
explicit manual dispatch, exact certified commit SHA and release environment.
The Theme Core pipeline remains pinned to the verified UNPUBLISHED
`JILL WORK` theme on the **production** store, with clean-JSON push
certification and **never** `--allow-live`. The separate `jill-work`
Shopify dev store is not this theme.

`npm run check:account-transfer` now fails source CI if any of those
ownership/release boundaries drift.

Before LIVE Accounts transfer, still verify on the production Shopify
connection: all seven `jill_rewards` Customer Account field permissions,
the PUBLIC_READ promotions definition, the installed production app scopes
and extension UIDs, the precise production Apps Script deployment identity
and credentials, balance integrity, old Coupons-page navigation retirement,
customer-by-customer isolation, and real qualifying/nonqualifying checkout.
The storefront theme can remain unpublished during Account release, but
**Shopify customer account extensions are live customer-facing software**:
release can affect current account navigation without a theme publish.


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


## My JILL visual refinement — WORK-only (October 14, 2026)

- A merchant-provided signed-in WORK browser preview displayed the genuine owner-bound Custom Order with its `received` public status and revision 1. This certifies **one positive customer-facing read**. A second WORK test customer, guest non-claim check, Shopify released-version check, and post-status-update timeline read remain separate gates.
- The visual polish uses existing Shopify 2026-07 Preact web components: single My JILL navigation registry, clearer Overview, status-specific badges, request reference, summary details when available, readable dates, and a timeline reflecting **persisted events only**.
- The canonical Custom Order reader still obtains a fresh Shopify session token for each read; the account page owns one query lifecycle and retry/refresh action. Rewards/Coupons transactions and all backend services are untouched.
- Celebrations and Saved for You remain explicitly **not connected**. No storage, reminders, or account claims are implied.
- Regression: `npm.cmd run test:my-jill-presentation` runs in standard postinstall/CI. The WORK canary generator copies the one collocated formatter with the canonical CustomOrders screen.
- Source CI alone is not release proof: browser-check 390px / 768px / desktop, keyboard/focus, long notes and references, language expansion, and customer A/B privacy. WORK app release is separately gated; LIVE untouched.
