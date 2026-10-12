# JILL storefront page and navigation parity — 2026-10-12

Read-only Shopify Admin comparison starting from LIVE `jillonlinestore.com`.

## LIVE pages
* `contact` — published, template `contact`
* `data-sharing-opt-out` — published, default template
* `about-us` — published, template `about-us`
* `our-story` — published, template `page`
* `welcome` — published, template `welcome`
* `quote` — published as Custom Orders, but template suffix currently `our-story`; legacy route and template mismatch must not be copied blindly
* `coupons` — published, default template

WORK pages already present: `contact`, `data-sharing-opt-out`, and `custom-order` (unpublished, suffix `custom-order`).

## LIVE menus
* `main-menu`: Welcome, Home, Catalog, Custom Orders, Contact us, About us.
* `footer`: Search, Your Privacy Choices.
* `customer-account-main-menu`: Dashboard, Orders, Coupons, Contact JILL, Settings, Log Out. **Account-owned**: do not copy production account page IDs/URLs into WORK.

## Migration decisions
1. Reuse `contact` and `data-sharing-opt-out` as existing WORK pages; do not duplicate.
2. Stage About us, Our Story, Welcome, and storefront Coupons content as **unpublished WORK pages** after auditing external links and template availability.
3. Keep the existing QA-only `custom-order` page, and point navigation to `/pages/custom-order`. Never create a competing `quote` form.
4. Rebuild/verify WORK `main-menu` and `footer` using relative links and resolved WORK page/collection IDs; never import absolute `jillonlinestore.com` links.
5. Treat customer-account menus, Rewards and Coupons extensions as separate app-owned infrastructure. No copied production customer-account URLs, IDs, data, or app releases.
6. Audit actual content/templates of `about-us`, `welcome` and `page` before claiming full website parity.
7. Keep existing published WORK theme `155877572743` and QA theme `156005007495` on independent release paths; do not publish either without explicit approval.

This document is a read-only source inventory, not a certification of WORK page parity.
