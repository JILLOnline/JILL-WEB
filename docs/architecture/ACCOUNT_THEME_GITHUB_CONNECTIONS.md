# JILL: two Shopify GitHub theme connections, separate stores

## Branch assignments
- `THEME` in `JILLOnline/JILL-WEB` is the shared storefront code baseline, with standard Shopify theme directories at repository root. Connect **only to an unpublished draft theme** in JILL LIVE (store `jqtdgr-1y.myshopify.com`). Never connect to/publish over MAIN automatically.
- `ACCOUNT` in `JILLOnline/JILL-WEB` has the matching Shopify theme directories at repository root, plus `extensions/`, `backend/`, `scripts/` and other account app sources. Shopify GitHub theme integration ignores those non-theme directories. Connect **only to an unpublished draft theme** in JILL WORK (store `jill-work.myshopify.com`).
- Shopify GitHub integration synchronizes the theme files bidirectionally **within each store + connected branch**. It does not deploy customer-account app extensions, Workers, app proxy configuration, customer data, or another store's theme.
- The two Shopify installations stay physically separate: different theme IDs, store settings, product IDs, customer-account pages, app deployments, credentials, customers and checkout/cart state.

## Shared theme ownership
- `THEME` is the storefront-design source of truth.
- `ACCOUNT` root Shopify folders are its WORK-environment adapter, initialized from the same theme source. Existing nested `ACCOUNT/theme/` remains a legacy source snapshot for account repository tooling, **not a second deployable Shopify theme**. No independent feature editing inside `ACCOUNT/theme/`; reconcile source changes deliberately.
- `ACCOUNT` WORK adapters for Custom Order:
  - only `collections['jill']` and five allowed picker collections;
  - fail-closed verified `/apps/jill-custom-order` Shopify app proxy; no legacy `no-cors` or direct Google transport;
  - WORK Custom Order route `/pages/custom-order` in header, Contact page and homepage;
  - explicit proxy settings in `templates/page.custom-order.json`.
- Theme Editor store-specific settings (`config/settings_data.json`, menus, page settings, image pickers) can differ between LIVE and WORK. GitHub changes on `THEME` are **not yet automatically mirrored to `ACCOUNT`**. Future syncs should be reviewed and preserve the WORK overrides. Do not force-push or blindly merge the two branches.

## Current Shopify exposure limits
- `ACCOUNT` connection creates an unpublished WORK theme and does not publish it.
- WORK product catalog consists of 15 DRAFT products. Draft products are not storefront-visible even in a theme preview until a separately approved WORK-only activation/publication step.
- WORK `custom-order` page is unpublished; preview of the page and authenticated account/app proxy still needs Shopify QA.
- LIVE `THEME` draft preview uses LIVE catalog and LIVE account environment, not WORK extension data.
- Customer-account app deployments are independent, controlled by Shopify app config for WORK, and must be verified separately (including Customer A/B ownership and Rewards/Coupons regression).

## Certification
- GitHub Actions workflow `ACCOUNT Shopify WORK theme certification` tests the theme root and WORK-only secure transport.
- `node scripts/audit-theme-dependencies.mjs .` checks static required theme dependencies.
- Passing source tests means branch structure and guardrails pass, **not** a completed storefront or account runtime test.

## User connection steps
1. In **JILL WORK** (`jill-work.myshopify.com`): Online Store > Themes > Add theme > Connect from GitHub > `JILLOnline` > `JILL-WEB` > branch **`ACCOUNT`**. Keep the resulting theme unpublished.
2. In **JILL LIVE** (`jqtdgr-1y.myshopify.com`): Online Store > Themes > Add theme > Connect from GitHub > `JILLOnline` > `JILL-WEB` > branch **`THEME`**. Keep resulting theme unpublished. Do **not** connect against or publish the existing MAIN live theme.
3. Verify the new theme cards show their respective `ACCOUNT` and `THEME` branches; use the Preview button, not Publish.

Do not confuse Shopify theme GitHub synchronization with customer-account app deployment or a cross-store connection.
