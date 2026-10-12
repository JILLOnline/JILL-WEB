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
