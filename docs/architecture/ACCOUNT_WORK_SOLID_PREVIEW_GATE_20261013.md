# JILL WORK — Shopify GitHub preview checkpoint (2026-10-13)

## Branch and release boundary
- WORK preview source: `JILLOnline/JILL-WEB` branch `ACCOUNT`.
- Connected **unpublished** JILL WORK theme: `156044165255`, store `jill-work.myshopify.com`.
- JILL LIVE storefront/theme and `THEME` branch were not modified during this checkpoint. No Shopify connection switches, production deployments, merges, page publication, or customer/order mutations.

## Preview-visible brand parity
- All eight JILL-owned photographs/logo/icon are committed as true GitHub binary theme assets.
- Header uses original `LOGO_2025.png` fallback, layout uses `FAVICON.png`, homepage uses original `IMG_3114.jpg` and five product-family photos.
- WORK homepage category imagery is selected by a stable `media_key` on each block (`pinatas`, `favors`, `activities`, `supplies`, `apparel`). It **does not depend on a published Shopify CollectionDrop** and remains visible while WORK products/collections are drafts.
- All five cards have no prefilled hardcoded links to unpublished collections. When Shopify makes a populated collection available (or an editor explicitly supplies a working URL), its card automatically becomes clickable. Otherwise the card remains a visual preview with no dead href.
- Hero and other imagery remain editable via Theme Editor image picker; root brand asset fallback is deterministic.
- The homepage CTA defaults to the WORK route `/pages/custom-order` only, never the old LIVE quote route.
- About JILL anchor on homepage and header, About Us and Our Story fallbacks, JILL Team footer text and social links are preserved.
- Fixed `layout/theme.liquid`: **Our Story is no longer treated as a Custom Order form**; only the `custom-order` template loads Custom Order assets.

## CI certification
- `.github/workflows/account-work-theme-certification.yml` now has **two independent jobs**:
  1. Validate root theme structure, WORK-only proxy and navigation guards, image assets, and shared source; run Shopify's official `theme-check-action@v2` at error level; enforce Git tree cleanliness.
  2. Run account sources tests for My JILL canary, Rewards readiness and engine/redemption, Coupons wallet and customer coupons, signed WORK customer session, and app-proxy configuration.
- Latest successful dual-job source certification at time of writing: `https://github.com/JILLOnline/JILL-WEB/actions/runs/38437564404`.
- These tests **do not** deploy or simulate live Shopify customer-account extensions, or validate authenticated browser behavior. Do not label those as production ready.

## Explicit remaining blockers
1. WORK's 15 real product records are Shopify **DRAFT**, and the seven canonical collection records are unpublished. Brand photos now preview, but real collection/product selection and Custom Order catalog cannot work until approved WORK-only visibility changes.
2. WORK Shopify page records for About Us, Our Story and Welcome require explicit creation; GitHub theme templates are not Shopify Page records. `/pages/custom-order` remains unpublished, so normal storefront navigation there is not guaranteed.
3. Real Shopify GitHub theme synchronization, Shopfiy password protection and actual browser screenshots still need manual visual confirmation by the merchant; GitHub passing CI alone does not prove WORK page renders.
4. Shopify customer-account app extension builds/deployments, authenticated My JILL, Rewards/Coupons end-to-end, WORK signed app proxy and guest/customer A/B isolation require live-work runtime certification. Theme GitHub connection cannot deploy extensions.
5. `THEME` and `ACCOUNT` intentionally diverge on WORK-only secure endpoint, asset staging and branding; do not blindly merge/force-push one branch to the other. Reviewed promotion only, and no LIVE publication without explicit approval.

## Review
- WORK account theme editor: https://jill-work.myshopify.com/admin/themes/156044165255/editor
- GitHub branch: https://github.com/JILLOnline/JILL-WEB/tree/ACCOUNT
