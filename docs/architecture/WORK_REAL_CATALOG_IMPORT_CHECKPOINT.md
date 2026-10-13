# JILL WORK live Shopify checkpoint — 2026-10-12

## Verified destination
* Exact Shopify destination: `jill-work.myshopify.com`, development store, never LIVE.
* Current product count: **18** (17 sample products preserved + 1 partial JILL DRAFT proof).
* Current collection count: **10** (3 original samples + 7 recreated JILL canonical collections).
* Canonical seven JILL collections, all verified unpublished to WORK Online Store:
  - Smart `jill` — vendor EQUALS `JILL`; matches draft mug in Shopify Admin; WORK ID `gid://shopify/Collection/327440892039`.
  - Smart `catalog` — tag EQUALS `party favor`; WORK ID `gid://shopify/Collection/327440924807`.
  - Manual `pinatas` (Piñatas); `apparel-gifts-dtf-sublimation` (Apparel & Gifts); `kid-activities` (Kid Activities); `party-supplies` (Party Supplies); `shop-the-party` (Shop the Party).
* All six `jill_personalization_profile` WORK records exist (previous checkpoint).
* All **six** JILL PRODUCT metafield definitions installed and read back:
  - `jill.personalization_profile` — `metaobject_reference`, restricted to WORK definition ID
  - `jill.pinata_shape_options` — `list.single_line_text_field`
  - `custom.jill_product_capabilities` — `json`
  - `custom.jill_product_page_capability_override` — `json`
  - `custom.jill_custom_order_excluded` — `boolean`
  - `custom.jill_custom_order_label` — `single_line_text_field`

## Product import contract proof
* Created **one WORK-only DRAFT** product: `custom-coffee-mug-photo-sublimation-74734`, WORK ID `gid://shopify/Product/8892626993287`.
* Verified title **Custom 11 oz Coffee Mug – Personalized Print**, variant **Default Title**, price **$12.99**, vendor **JILL**, one uploaded primary product image, `jill.personalization_profile` points to WORK `apparel-gift` profile, and `custom.jill_product_capabilities.id` equals `jill_mug_11oz`.
* **PARTIAL SOURCE PARITY ONLY**: full product description, remaining gallery images (LIVE audit: six total), SKU/tax/inventory-policy fields and any other merchant metadata still need exact LIVE-source reconciliation. Do NOT claim this draft is fully imported or activate/publish it.
* First attempted productSet with empty default options was correctly rejected, no product created; importer updated and tests pass for required `Title` productOptions on default variants.
* ProductSet without vendor defaulted to `JILL WORK`, breaking JILL smart collection; corrected existing mug vendor to **JILL** and verified smart collection matches.
* WORK product remained DRAFT throughout. Shopify LIVE never received a mutation.

## Remaining integration gates
1. Retrieve complete authorized LIVE product snapshot **without writing to a public repository**; capture only safe field allowlist, locally or in trusted private runtime. Do not reuse prod admin tokens across stores.
2. Reconcile the partial WORK draft mug against full LIVE source and ensure the importer supports idempotent repair (not duplicate), including all six media assets and full canonical payload.
3. Complete draft-only import for remaining 14 products, 60 LIVE variant matrix totals, tags/collections, and verify each variant/asset/metafield.
4. Attach manual collection memberships after verifying WORK product IDs; keep all new collections unpublished.
5. Stage source-matched pages, menus, translations, locales, brand settings, assets and Cart/Custom Order dependencies; no copy of live account-specific URLs.
6. WORK-only product/page publication is a separate explicit user-visible gate, because products and page publication are store-wide; unpublished theme is not an isolation boundary.
7. Authenticated Shopify → Cloudflare proxy → QA Google ledger → My JILL customer A/B ownership tests, plus Rewards and Coupons regression, before any LIVE changes.

## No premature completion
18 products in WORK **is not** equivalent to complete catalog parity; 17 samples still remain. 7 new collections exist but memberships (other than smart vendor rule) are not populated. Do not publish page, products or theme until verified and approved.
