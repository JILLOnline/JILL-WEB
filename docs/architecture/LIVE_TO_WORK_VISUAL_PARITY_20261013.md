# LIVE to WORK — original JILL brand migration (2026-10-13)

Source: JILL LIVE published theme, shop jqtdgr-1y.myshopify.com; Shopify source read-only.
Target: GitHub ACCOUNT branch, connected to JILL WORK unpublished theme 156044165255. Neither published theme nor the LIVE THEME GitHub branch was modified.

## Original media copied as binaries to GitHub ACCOUNT assets
- jill-brand-logo.png ← LIVE LOGO_2025.png
- jill-brand-favicon.png ← LIVE FAVICON.png
- jill-home-hero.jpg ← LIVE IMG_3114.jpg
- jill-home-pinatas.jpg ← LIVE piñata product image
- jill-home-party-favors.jpg ← LIVE surprise-bag product image
- jill-home-kids.jpg ← LIVE coloring activity product image
- jill-home-party-supplies.jpg ← LIVE cake-topper product image
- jill-home-apparel.jpg ← LIVE T-shirt product image

Vendor workflow: scripts/vendor-jill-live-brand-media.mjs, .github/workflows/account-vendor-brand-media.yml. Source images are public JILL property and verified PNG/JPEG. Images used through Shopify theme asset_url; no runtime LIVE CDN dependency.

## Work theme files updated
- sections/header.liquid and assets/jill-storefront.css: exact JILL logo and sizing; About JILL anchor route.
- layout/theme.liquid: favicon.
- sections/jill-home-showcase.liquid: actual hero and all five category photos, while preserving Theme Editor image overrides.
- templates/index.json and sections/rich-text.liquid: LIVE About Us text on homepage, linkable with JillStory anchor.
- templates/page.about-us.json, templates/page.our-story.json, sections/main-page.liquid: LIVE About Us and Our Story copy as fallback. Fixed erroneous Our Story mapping to Custom Order form.
- sections/footer.liquid: LIVE JILL Team thank-you copy. Verified Instagram, Facebook, YouTube settings preserved.
- scripts/check-account-theme-root.mjs: certifies original media, secure WORK proxy, story mapping and deliberate WORK-only theme differences.
- GitHub CI latest passing run: https://github.com/JILLOnline/JILL-WEB/actions/runs/38435424824.

## Not yet ported / separate Shopify data
WORK About Us, Our Story, Welcome Shopify Page records must be created/published deliberately; theme templates do not create pages. WORK catalog products remain drafts, so storefront products still require independent visibility approval. Menus, footer newsletter 10% discount workflow, account app extensions, backend routing and customer ownership tests are separate store-owned features; no unsafe cross-store copy was attempted. LIVE's legacy theme has 421 files with obsolete custom code; do not copy it wholesale.

Preview only: https://jill-work.myshopify.com/admin/themes/156044165255/editor. Do not Publish.
