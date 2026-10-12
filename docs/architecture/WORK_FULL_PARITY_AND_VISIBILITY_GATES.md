# JILL WEB → JILL WORK completeness gate

## Verified source facts (read-only)
* LIVE has 15 active products; 7 collections; 7 pages and three menus.
* Product variants: 20 T-shirt, 15 hoodie, 10 crewneck, 4 tote, and 11 default-title variants: 60 total.
* LIVE JILL capability IDs and six referenced personalization profile handles were verified on all 15 items.
* JILL WORK contains 17 unrelated Shopify sample products; six new personalization profiles and three required product metafield definitions are installed and verified. No LIVE data changed.
* GitHub WORK integration staging now filters product selection via `collections['jill']` and the allowlisted five storefront collections; it does not remove existing WORK sample items from the rest of the site.

## Critical QA visibility dependency
Shopify products with `DRAFT` status are not available to storefront Liquid product/collection searches, including an unpublished theme preview. Therefore a draft-only import is **not the same** as a working customer-facing QA catalog.

Required two-phase gate:
1. Stage every imported product as WORK DRAFT, verify fields, option/variant counts and prices, images, capabilities, profile references, and collection assignments by Shopify Admin API. Do not touch sample products.
2. Under a separate WORK-only publish approval, make precisely the 15 verified imported products available to the WORK Online Store channel, and verify the QA preview renders them. Because product publication is store-scoped, they could be visible through the existing published WORK theme; confirm WORK store's password/access protection and limit side effects first. Never assume unpublished theme isolates product publication. No LIVE mutations.
3. Keep the WORK Custom Order `custom-order` Page unpublished until the site/page visibility strategy is explicitly approved, as page publication is also store-scoped.
4. Require real authenticated Customer A/B owner checks via signed Shopify app proxy and My JILL, plus guest request takeover/replay tests. Theme preview alone does not certify transport.
5. Apply a separate Accounts/Rewards zero-regression gate and require verified media, menus, pages, shipping/pickup options, brand settings and translation parity before any LIVE release.

## No silent workaround
Do not mark the QA wizard done while all 15 products are drafts. Do not publish the theme, products, or page merely to make a screenshot work. Stop at the explicit exposure gate and ask for approval after presenting the store-visible consequences.

## Source audit
`scripts/build-work-catalog-operations.mjs` now distinguishes Shopify default-title variants from explicit option matrices, avoiding duplicate/invalid default option creation.
