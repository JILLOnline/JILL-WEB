# JILL HQ WORK — Shopify Catalog browser and commerce master scope

**Status: GitHub WORK SOURCE ONLY. NOT DEPLOYED.** No PowerShell, Cloudflare upload, SHOPIFY app deploy, D1 migration, provider changes or LIVE mutation. Current scope is READ ONLY; all product, stock and price edits remain Shopify Admin actions.

## Product/commerce master plan addition

Catalog is the shared authority for HQ product browse, verified variant GIDs/price/SKUs, collections, locations, inventory, and eventually quote pricing / Shopify Draft Orders. Customer-facing My JILL remains isolated from Owner Admin catalog APIs. Do not introduce a duplicate inventory database or conflate physical stock with JILL production capacity for custom-made goods.

**Existing connected integration reused:** `app.catalog.tsx` invokes `handleWorkCatalogRead` using the Shopify React Router SDK's `workShopify(env).authenticate.admin`; the merchant owner-scoped `readWorkMerchantPermission` policy checks the exact WORK shop, online staff credentials, D1 authority and Shopify scopes. Catalog is enabled only when the existing `JILL_WORK_CATALOG_ENABLED==="true"` flag is explicitly set in WORK. Shopify Admin GraphQL provides product/collection/location/inventory data, scoped to a maximum of 20 records/page, 10 variants/product, 5 inventory stocking locations/variant. Shopify USD/other currency is not converted locally.

## New source-only increment

- Server-side, **bounded search** of Shopify product titles using the Products Admin GraphQL `query: $search` variable; 2–64 normalized letters/numbers/ordinary punctuation; raw search operators, wildcards, quotes and control characters are rejected. No raw user text is inserted into the GraphQL document. Product paging preserves the original search term in `?q=`.
- Product rows show Product name, Shopify status, vendor/type/handle, Shopify total inventory (unknown when unavailable), variant title, SKU and exact Shopify price; an explicit `variants_truncated` notice prevents false exhaustiveness. An embedded **Open in Shopify** link uses only validated WORK shop Product GIDs and navigates to the trusted Admin URL.
- Other existing views **Collections, Inventory and Locations** remain available, including per-location tracked-availability semantics; total Shopify stock is **not** custom-production capacity. All data is loaded on demand; none is copied to D1 or browser storage.
- The responsive `hq-catalog.css` owner shows rows on wide screens and compact stacked columns on narrow Shopify Admin windows, maintaining natural page scroll.
- Existing WORK Catalog flags and OAuth scopes are unchanged. No product create/update/delete, price update, inventory adjustment, theme publish or billing change.

## Offline checks and release boundary

The synthetic test `npm.cmd run test:work-hq-shopify-catalog-browser` exercises safe input parsing, real Admin GraphQL query shape, Owner verification, disabled feature, allowed product pagination/currency, product SKU/stock projection, existing inventory/collections/locations, and denied foreign-shop/malformed data. It performs **zero live network calls**.

The frozen `scripts/work-hq-shopify-catalog-browser-package.mjs` validates the prior reviewed **32-file** Messaging/Quote source and **3 Catalog files**, 35 files total. Source-only check: `npm.cmd run work:hq:catalog:check`. Historical compact-row, Archive/Search and prior one-use receipts remain untouched and spent. Do NOT run an old release profile or repin it.

Before deploying: obtain current read-only HQ WORK inventory and 0%-quote canary/version/health, verify GitHub's complete CI including App Home build and isolated workerd, create a new one-time isolated WORK-only release using this reviewed edition, verify authenticated Owner WORK Catalog/Shopify scopes and compare product results with actual Shopify WORK Admin. Never enable Catalog against LIVE or allow write privileges through this read-only endpoint.

## Next Catalog milestones (separate approvals)

1. Review real WORK Shopify data for actual customer product handles, variant SKUs/prices, inventory, collection classification and empty/partial records (no inventing SKUs or stock).
2. Add merchant-controlled product-to-quote mapping: exact Shopify ProductVariant GIDs, variant quantities, customer instructions, materials/labor, split personalization and reference-media manifests. Ensure lossless mapping and customer agreement fingerprints.
3. Plan a separately authorized **edit workflow** for product/variant descriptions, media and inventory with explicit Shopify GraphQL mutation scopes, review/confirmation and D1 audit. **No write code is enabled now**.
4. Connect published Shopify pricing and stock rules to My JILL's request/quote/invoice statuses without exposing staff-only Admin credentials or producing a duplicate product source.
