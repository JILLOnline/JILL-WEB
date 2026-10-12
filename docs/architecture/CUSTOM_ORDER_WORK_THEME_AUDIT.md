# Custom Order WORK theme dependency audit — 2026-10-12

## Evidence and pinned sources
* Website reference: `jill/theme-core` at `b7556fd9723f40e2abfde03f9643b190cabc2d90`.
* WORK account/service reference: `jill/rewards-work` at `4077f3812d8e29d74468352285ae56206b17a1eb`.
* Shopify WORK admin returned only two pages (Contact, Privacy Choices), with `test-data` as MAIN. There is no active Custom Order storefront page.
* Shared `theme/templates/page.custom-order.json` matches byte-for-byte between website and account lanes (blob `848efc8a16064052aacf44dc172da44b7c01cf9c`).
* `theme/sections/main-custom-order.liquid` differs (`53ecbdb93e60c3af6e46c6017523f84d1c273ff5` on website versus `4b7d5dcff74a67f37dabfde11b1e78db94f16019` on WORK). The WORK section adds the `verified_submission_endpoint` setting and reads customer context.
* `theme/assets/jill-custom-order.js` also diverges. Do not wholesale replace the website version; review ingress-specific changes, retaining product and submission semantics.

## Direct dependencies from inspected WORK source

Template → `main-custom-order` section.

The section directly renders:
`ui-field`, `custom-order-item-title`, `ui-quantity`, `product-capability-fields`, `custom-order-capability-profile`, `ui-textarea`, `ui-icon`.

The WORK `theme/layout/theme.liquid` loads shared style/interaction assets, including:
`jill-foundation.css`, `jill-ui.css`, `jill-storefront.css`, `jill-forms.css`, `jill-product-capabilities.js`, `jill-form-engine.js`, `jill-product-options.js`, `jill-personalization.js`, `jill-personalization-ui.js`, `jill-quantity.js`, `jill-commerce-adjustments.js`, `jill-commerce-cart.js`, `jill-product-commerce.js`, `jill-variant-allocation.js`, `jill-custom-order.js`, and `jill-custom-order-catalog-groups.js`.

This is a *direct* dependency inventory, not a complete recursive dependency closure. Snippets, locale keys, CSS asset imports, dynamic resource references, and shop data must be recursively validated before theme upload.

## Critical runtime risks

1. The section's **default `submission_endpoint` is a Google Apps Script URL carried from the website theme**. Do not use that fallback in WORK. Configure `verified_submission_endpoint` = `/apps/jill-custom-order` and verify the actual rendered endpoint and error handling before any request. Do not submit until confirmed routed to WORK QA.
2. An unpublished Shopify theme can preview but does not independently supply Shopify catalog data, customer accounts or app proxy settings; WORK data/theme settings must be verified.
3. WORK storefront currently password-protected: unauthenticated curl is redirected to `/password`. Do not disable the password gate for this integration. Use signed-in browser session and inspect signed app-proxy behavior.
4. An empty My JILL account history in development preview is encouraging, but is not proof of an owned request or A/B isolation.
5. Shopify customer-account extension is an app artifact, not a theme page; neither copying the form nor publishing a theme should release the account app.

## Safe execution sequence (not yet performed)

1. On a *new unpublished* WORK theme, deploy an audited, complete theme artifact sourced from the website lane; confirm theme ID/role never MAIN during QA. Do not overwrite published `test-data`.
2. Reconcile the narrow verified-owner/proxy changes from WORK against canonical website source through reviewed changes; keep canonical frontend owner at `jill/theme-core`.
3. Validate recursively: snippets exist; Liquid parses; all theme `asset_url` files exist; locale translations resolve; JS test suite passes; endpoint selectors and Cloudinary configuration point only to QA.
4. Create a WORK-only page assigned to template suffix `custom-order`, preview its unpublished theme, and run a **non-mutating** form/navigation check.
5. Submit one explicitly synthetic request from a signed-in WORK customer A **only after** verified QA endpoint, current Shopify account authentication, and consent. Confirm Google `CustomOrderOwners` and timeline; then verify customer B cannot see A, and legacy guest remains unowned.
6. Preserve independent web, account and backend release manifests and rollback references. No LIVE deployment or app release implied.

## Remaining implementation tasks

* Implement deterministic recursive theme dependency auditor.
* Compare exact Custom Order JS and Liquid patches and reconcile on website owner branch.
* Prepare a clean WORK-theme build + dry-run upload with exact target store/theme guards.
* Wire release boundary guard into isolated governance CI only after local and GitHub CI tests.
