# Production JILL catalog — read-only source audit (2026-10-12)

Authorized Shopify connection: **JILL** / jillonlinestore.com (not JILL WORK). No production mutation performed.

## Counts and catalog outline
* 15 active products; all returned in single paginated page.
* 7 collections: `catalog` (Party Favors; rule-based, 3 products), `pinatas` (4), `apparel-gifts-dtf-sublimation` (5), `kid-activities` (2), `party-supplies` (1), `jill` (rule-based, 15), `shop-the-party` (4).
* 20 tee variants (Color x Size), 15 hoodie variants, 10 crewneck variants, 4 tote variants; remaining products each have one variant.
* Exact source handles are captured in Shopify and should be queried again at import time to prevent stale copies. No production product IDs or sensitive metafield values are written to this report.
* Current JILL WORK has 17 unrelated Shopify snowboard/other test products and three sample collections. It is not a catalog mirror.

## Relevant custom personalization data
Most products carry `jill.personalization_profile` (metaobject_reference) and `custom.jill_product_capabilities` (json). Some piñatas also carry `custom.jill_product_page_capability_override` (json), `custom.jill_custom_order_label` (single_line_text_field), and `custom.jill_custom_order_excluded` (boolean). Shopify taxonomy attributes in `shopify.*` include list.metaobject_reference types; their IDs cannot be copied across shops. Products also have third-party/SEO fields such as `shuttle.*`, `mm-google-shopping.*`, `mc-facebook.*`, `global.*`; these do not automatically belong in WORK and require per-namespace review.

## Required migration invariants
1. Never copy source product/variant/metaobject IDs literally as WORK references. Create/reuse destination objects, then remap references.
2. Preserve category-to-product assignments, variant option matrices, prices, theme-visible media, and precisely the custom personalization/capability fields needed by canonical JILL theme.
3. Exclude real customers, orders, transactions, credentials, third-party integrations/identifiers by default.
4. Generate source-to-destination handle/ID mapping and dry-run create/update/skips/conflicts; no duplicate products on retry.
5. Do not automatically publish imported products or alter WORK published theme; preview and validate with QA theme `156005007495`.
6. Before import, read complete metafield/metaobject definitions and reference graphs; determine whether each can be reproduced losslessly or safely omitted.
7. Preserve explicit independent LIVE deployment certification; this is a one-way read-only source inventory pending approval for WORK writes.

Source verification performed through the live Shopify Admin API, no customer or payment records requested.
