# JILL WORK — Custom Orders GitHub theme preview (2026-10-13)

## Shipped into ACCOUNT (Shopify-GitHub connected WORK preview)
- Store: `jill-work.myshopify.com`, unpublished GitHub theme ID `156044165255`.
- Canonical form: `sections/main-custom-order.liquid` and `assets/jill-custom-order.js`.
- Dedicated Shopify template: `templates/page.custom-order.json`, expects page handle `custom-order` and secure WORK-only path `/apps/jill-custom-order`.
- Optional HOME preview: `templates/index.json` contains `work_custom_order_preview` section (type `main-custom-order`) **disabled by default**. In Shopify's ACCOUNT theme editor, select homepage → enable `Custom order` section → save/refresh preview. Do not publish the page or theme. The content remains a QA-only preview.
- Canonical JS ownership: `snippets/jill-custom-order-runtime.liquid` is the single script loader shared by the dedicated page (in layout) and homepage preview (in the section). No legacy Google `no-cors` transport.
- WORK catalog source `collections['jill']`; five category allowlist. Missing published products produce a visible QA catalog notice; no fake product data.
- The old `Our Story` form loading bug stays fixed; scripts are only loaded on Custom Order page or the deliberately enabled QA homepage section.
- Header and homepage Custom Order buttons still target `/pages/custom-order`. That URL is currently not a normal storefront route because the WORK page record remains unpublished.

## Certified at GitHub source level
GitHub Actions: `https://github.com/JILLOnline/JILL-WEB/actions/runs/38440984025`.
Both jobs passed:
- WORK theme root and homepage-preview contract test, recursive dependency audit, official Shopify Theme Check.
- Customer-account app contracts, signed app-proxy configuration and negative tests for account ownership, Rewards/Coupons regression.

## Remaining Shopify WORK runtime gates, not implied by CI
1. The WORK `custom-order` Shopify Page record is **unpublished**; theme files cannot publish/create storefront pages. Deliberately preview via the optional homepage editor section.
2. All 15 WORK products are still Shopify **DRAFT**, so actual product/category pickers will be empty until a separate WORK-only product visibility/publication decision. Preview notice is a QA guard, not a solution for actual product data.
3. Real authenticated browser submission to WORK's app proxy, QA backend receipt, My JILL order visibility, customer A/B privacy and Rewards/Coupons must still be verified end-to-end.
4. This code-only operation did not deploy customer-account extensions, create Shopify pages, change any products, publish any theme, or touch JILL LIVE.

## Next QA step
Theme editor: `https://jill-work.myshopify.com/admin/themes/156044165255/editor`. On homepage, enable the disabled **Custom order** section. Save and refresh for scripts to initialize. Verify layout and warning. Do not submit a real customer request or Publish. Re-disable after inspecting if desired.
