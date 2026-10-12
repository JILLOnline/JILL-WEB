# JILL WORK catalog parity checkpoint — 2026-10-12

Read-only Shopify verification:
* Connected shop: jill-work.myshopify.com (development).
* 17 products, 3 collections (Shopify Admin counts).
* WORK products are Shopify sample/test products (snowboards, ski wax, sample gift card), **not** the JILL handcrafted catalog.
* The canonical Custom Order Liquid uses `collections['all']`, iterates `collections`, and references store-specific product and collection objects; copying theme files does not transfer catalog data.
* QA Theme: 156005007495, unpublished. WORK MAIN: 155877572743, must remain unchanged.
* WORK Custom Order page handle: custom-order, still unpublished.
* Main JILL production catalog has not been read through an authorized connector in this checkpoint. Never infer catalog mapping from titles or Git source.
  
## Required non-destructive migration design
1. Obtain read-only inventory of the actual production store: products, full variants/options, images/media, tags, product metafields/metaobject dependencies, product publications, collections (manual vs rule-based), menus and page handles.
2. Generate a catalog parity manifest keyed by immutable *source* Shopify IDs plus stable handles. Destination Shopify IDs are new. Record an explicit mapping table; never pretend IDs match across stores.
3. Produce a dry-run diff with CREATE/UPDATE/SKIP/CONFLICT categories, handling nested metafields, option definitions and collection membership. Detect SKU/handle collisions and unsupported metafield references. No customer/orders/payment data.
4. Require explicit user approval of migration manifest and losslessness threshold before any WORK catalog write. Save WORK pre-migration inventory + rollback manifest.
5. Implement idempotent WORK-only import in batches with checkpoints, strict shop identity, zero automatic publication, and no duplicated products on retry. Preserve required images, option prices and personalization contract.
6. Validate Shopify publication in WORK against the target theme and full customer-form wizard, then the signed app-proxy endpoint and A/B ownership.
7. LIVE promotion remains an independent artifact, not a reversal of the catalog mirror.

## Current blocker
Shopify connector remains connected to JILL WORK. Main JILL catalog is not yet authenticated in this session; Shopify switch authorization must be completed by the account holder. Do not export/copy production customer data or substitute remembered product details for source inventory.
