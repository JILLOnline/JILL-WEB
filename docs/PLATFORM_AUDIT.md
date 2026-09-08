# JILL Production Platform Audit

This document records the current production/reference system that Theme Core is replacing. It is evidence, not canonical implementation ownership.

Audit date: September 8, 2026.

## Production storefront state

The current live JILL theme is Dawn-derived and contains extensive JILL custom behavior layered across Dawn assets, sections and snippets.

The site is functional and contains many UX decisions worth preserving, but the implementation has accumulated overlapping patches that make visual consistency, first-render correctness and safe editing increasingly difficult.

Theme Core therefore starts clean and migrates behavior contract-first.

## High-confidence architecture debt observed

### Patch-style visual/UX sections

Examples observed in the live theme include:

- `jill-allocation-visual-cleanup.liquid`
- `jill-contact-visual-continuity.liquid`
- `jill-copy-cleanup.liquid`
- `jill-final-polish.liquid`
- `jill-final-ux.liquid`
- `jill-final-visual-qa.liquid`
- `jill-form-enhancements.liquid`
- `jill-form-refinements.liquid`
- `jill-pers-fixes.liquid`
- `jill-review-note-polish.liquid`
- `jill-section3-simplify.liquid`
- `jill-ux-polish.liquid`
- `jill-visual-continuity.liquid`

These names indicate additive correction layers rather than singular ownership. Theme Core explicitly forbids this pattern.

### Feature sections with mixed responsibility

Observed production feature sections include:

- `jill-smart-form.liquid`
- `jill-product-options.liquid`
- `jill-product-option-status.liquid`
- `jill-personalization-allocations.liquid`
- `jill-personalization-authority.liquid`
- `jill-pinata-snack-allocations.liquid`
- `jill-pinata-style.liquid`
- `jill-review-flow.liquid`
- `jill-review-layout.liquid`
- `jill-media-upload.liquid`
- `jill-email-validation.liquid`
- `jill-marketing-optin.liquid`
- `jill-shipping-optional.liquid`
- `jill-success-screen.liquid`
- `jill-google-script-bridge.liquid`
- `jill-po-bridge.liquid`
- `jill-po-quantity-cap.liquid`

Many of these represent valuable behavior, but Theme Core should decompose the behavior into canonical engines/primitives rather than preserve one-file-per-adjustment ownership.

### Personalization authority fragmentation

Production snippets include:

- `jill-personalization-authority-css.liquid`
- `jill-personalization-authority-js-1.liquid`
- `jill-personalization-authority-js-2.liquid`
- `jill-personalization-authority-js-3.liquid`
- `jill-personalization-authority-js-4.liquid`
- `jill-personalization-authority-js-5.liquid`

This is exactly the numbered-fragment architecture Theme Core forbids.

The old personalization implementation also uses inline `<style>`, `!important`, DOM compatibility relocation, delayed refreshes and MutationObservers to neutralize legacy owners. Those techniques are not migration candidates.

### Asset-level patch/overlap signals

Observed JILL-specific assets include:

- `jill-apparel-sizes.css` / `jill-apparel-sizes.js`
- `jill-contact-hover.css`
- `jill-contact-reason-copy.js`
- `jill-personalization-gate.css`
- `jill-shared-dropdowns.css` / `jill-shared-dropdowns.js`
- `jill-subscriber-prefill.js`
- `standard-actions-override.js`

The presence of `standard-actions-override.js` is a clear example of the override model Theme Core replaces with semantic primitive ownership.

## Mature production behavior worth preserving

### Product customization

- progressive required-field flow
- product-family-specific capabilities
- visible price/quantity/Add to Cart with required-customization validation
- line-item property persistence
- date planning
- reference media
- responsive controls

### Product Options

- dynamic options based on selected product
- clear incomplete/complete status
- stable completed state
- allocation/quantity reconciliation

This behavior remains a protected reference until Theme Core certifies a replacement.

### Personalization

- none/same/different modes
- per-item/unit allocation
- exact total allocation against selected quantities
- immediate availability reconciliation
- fields based on product capability

The contract is preserved; implementation is rebuilt.

### Custom Order

- multi-product selection
- product options
- dates/fulfillment
- personalization
- reference media
- review gating
- request submission
- confirmation/success flow
- backend persistence/customer sync

### Account / rewards

- richer Dashboard concept
- Coupons surface
- shared action/status semantics
- tier states and redemption interaction
- backend reconciliation/watchdog safety

These remain outside the sellable theme where Shopify platform/business authority requires it.

### Header/mobile polish

- account/cart icon weight
- social destinations
- language/country controls
- no session loss when opening social links
- cart badge/icon stability
- no flicker during route/navigation state changes

## Production defects explicitly not to preserve

- duplicate text/controls
- old/new UI visible together
- flicker/ghost controls
- UI hidden only after JavaScript runs
- specificity escalation via `!important`
- CSS embedded in Liquid feature sections
- JS embedded in Liquid feature sections
- broad DOM observers acting as compatibility authorities
- repeated timer-based refresh/neutralization
- product-family clones of the same validation/personalization logic
- page-specific button/field/pill appearance
- legacy names such as final/fix/polish/cleanup/override

## Migration interpretation rule

When an old file is inspected, classify each meaningful line/behavior into one of four outcomes:

1. **Shopify platform contract** — preserve through proper Shopify architecture.
2. **JILL design behavior** — migrate to design-system primitive/composition.
3. **JILL feature behavior** — migrate to a canonical feature engine/contract.
4. **Legacy workaround/debt** — do not migrate.

If classification is uncertain, stop implementation and resolve ownership before copying code.

## Current clean replacement

Theme Core now owns a minimal clean Shopify-valid foundation under `theme/` with:

- canonical foundation/UI/storefront CSS owners
- minimal header/footer/content composition
- Theme Editor settings
- repository architecture guard
- Shopify Theme Check CI
- Constitution, domain ownership, feature contracts, migration procedure and QA certification

The purpose of this audit is to keep the new system informed by production experience without allowing production debt to become the new source tree.