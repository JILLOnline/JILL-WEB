# WORK catalog draft import checkpoint — 2026-10-13

Shopify connector selected shop: JILL WORK `jill-work.myshopify.com`. LIVE source was read-only. No theme/page/product publication performed.

## Verified WORK read-backs
* ProductsCount: **15**, exact 15 canonical JILL handles, all DRAFT. LIVE source has exactly 15 products, 60 total variants; WORK productSet returned expected variant count for each imported draft, including 20 Tee, 15 Hoodie, 10 Crewneck and 4 Tote.
* Seven canonical WORK collections, all unpublished to Online Store. Manual memberships matched LIVE:
  `pinatas` 4, `apparel-gifts-dtf-sublimation` 5, `kid-activities` 2, `party-supplies` 1, `shop-the-party` 4.
* Smart `jill` collection has 15 products.
* Smart `catalog` (Party Favors) has **0** products although LIVE contains **3**. Rule is `TAG EQUALS "party favor"`. WORK product tags contain variants such as `party favor bags` and `personalized party favors`, not an exact `party favor` tag. Investigate LIVE smart collection semantics, index timing or source mismatch. Do NOT silently add a non-LIVE tag or change rule as a workaround.
* WORK returned **15 total products and 7 total collections** in final read-back. **Reconciled with user on 2026-10-13:** merchant explicitly confirmed they manually deleted all 17 preloaded Shopify sample products and 3 sample collections from WORK. This was an intentional merchant cleanup, not a migration-side data loss. Do not reinstate sample data.
* Every JILL draft carries correct capability identifier and destination-specific personalization profile reference.
* Initial import mutation returned fewer image media items than some earlier LIVE source media counts. This requires image-by-image inventory and parity check; do not claim gallery parity.
* The mug has 5 photos, SKU, matching tags, type and price. Full description needs reconciliation. LIVE media audit returned varying 5/6 media counts across queries, requiring a fresh source audit.

## Remaining gates
1. Resolve the Party Favors automated collection discrepancy (sample dataset cleanup is user-confirmed and closed).
2. Read back each of 60 variants (prices, selected options, SKU, policy), all media and descriptions; fix specific mismatches without duplicating products/media.
3. Complete pages, menus, SEO, locale, image/brand/theme settings parity (excluding account-owned LIVE URLs).
4. QA page/product publication is store-wide, not isolated by unpublished theme; ask before publication.
5. Full signed Custom Order proxy + My JILL ownership A/B + Rewards/Coupons regression tests.
6. No production LIVE mutation, theme publication, or Account release.
