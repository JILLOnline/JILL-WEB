# My JILL Coupons — WORK navigation cutover

## Purpose
Remove the duplicate **Coupons** item from the **JILL WORK Rewards development
store's Shopify customer-account sidebar**, retaining Coupons as a screen inside
the single My JILL extension.

Store: `jill-work.myshopify.com` only. The production store
`jqtdgr-1y.myshopify.com` and the production **JILL WORK** unpublished
storefront theme are NOT involved.

## Confirmed WORK menu source (Shopify Admin API, 2026-10-11)

- Exact menu ID: `gid://shopify/Menu/252533768327`
- Handle: `store-default-customer-account-main-menu`
- Title: `Store default: Customer account main menu`
- Shopify default `customer-account-main-menu` is another menu with only
  Orders/Profile; do not edit it by mistake.
- Target's original four items, in order:

| Label | MenuItem ID | Target CustomerAccountPage |
| --- | --- | --- |
| My JILL | `gid://shopify/MenuItem/609423327367` | `gid://shopify/CustomerAccountPage/116739997831` |
| Profile | `gid://shopify/MenuItem/609423360135` | `gid://shopify/CustomerAccountPage/116739080327` |
| Orders | `gid://shopify/MenuItem/609423392903` | `gid://shopify/CustomerAccountPage/116739047559` |
| Coupons (legacy) | `gid://shopify/MenuItem/609423425671` | `gid://shopify/CustomerAccountPage/116740030599` |

All items have Shopify `CUSTOMER_ACCOUNT_PAGE` type, no nested entries.

## Intended WORK menu

My JILL / Profile / Orders, preserving the three original Shopify item IDs,
order and resource destinations.

The **legacy Coupons full-page extension stays installed and linkable** during
this compatibility period. Direct bookmarks still open it. It must not be
deleted merely to hide the sidebar entry. Shopify's menu is merchant-owned
configuration, independent of the account app's rendering code. Later,
after customer testing and release sign-off, the legacy page may be retired
as a separate explicitly approved change.

### Rollback
In WORK Admin > Content > Menus > Store default: Customer account main menu,
restore **Coupons** as a customer account app page after Orders. Its
CustomerAccountPage resource is
`gid://shopify/CustomerAccountPage/116740030599`.
Do not change the independent default `customer-account-main-menu` or any
production menu.

## Source parity gates
- `extensions/jill-account-dashboard/src/pages/Coupons.jsx` is the single
  canonical wallet/public/upcoming screen with structured card presentation.
- Wallet & public feed refresh each 25 seconds independently, with a stale
  status; stale coupon data remains visible as historical evidence but
  cannot generate an actionable Use Now URL.
- Never copy the legacy Coupons GraphQL queries or wallet parser.
- No duplicate Rewards backend; v13 remains authoritative.
- Before LIVE: verify production account menu identity separately, update it
  only with release approval, and confirm that no OLD Coupons link is present
  while existing customer URLs still work during the compatibility window.
- Full account UX certification and checkout still required before LIVE.

## Execution evidence — JILL WORK only

- The WORK Shopify `menuUpdate` mutation succeeded for menu
  `gid://shopify/Menu/252533768327` with no user errors.
- An independent Shopify Admin read verified its items are exactly
  `My JILL`, `Profile`, `Orders`, in their original order. The
  former `Coupons` menu item is absent.
- The old extension UID and Shopify Customer Account page were **retained**,
  preserving compatibility with direct bookmarks.
- The old extension source now imports the canonical My JILL Coupons
  component and renders it inside its original page shell: one data
  projection, one 25-second refresh owner, one coupon card implementation,
  and no copy of wallet or public-promotion GraphQL queries.
- The new Coupons screen uses native Shopify components, status badges,
  a visible code and qualifying order minimum, active/personal/upcoming
  separation, plus disabled actions on stale or missing store state.
- A source CI pass does not confirm the merchant browser has picked up
  the menu change or that Shopify CLI built both extensions. Verify each
  independently before the production account app release.

## WORK browser parity checklist

1. In `jill-work.myshopify.com`, reload signed-in customer accounts
   (hard refresh if cached). The account menu should contain exactly
   **My JILL / Profile / Orders**, no separate Coupons item.
2. Under My JILL > Coupons confirm the personal $5 WORK reward, live
   `FREESHIPPING2026`, and two code-free Upcoming Offers.
3. The personal code only becomes actionable while authenticated data is
   verified and the coupon status remains active.
4. Confirm no loading flicker/duplicate cards after at least 25 seconds
   (one background refresh); a stale response must show a warning and
   disable Use Now until refreshed.
5. Open the previous standalone Coupons bookmark; it must still render
   the canonical screen and offer a visible **Open My JILL** link.
6. Verify Rewards balance remains unchanged and previously issued coupon
   remains customer-restricted in Shopify.
7. Test 390px and desktop widths before setting the release candidate.

The `jill-account-coupons` extension should only be physically removed
after bookmarked route/merchant-menu usage is assessed at final release.
It is not a second API/parser/UI owner after this bridge change.
