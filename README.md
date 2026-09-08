# JILL-WEB

JILL-WEB is the product repository for JILL's Shopify storefront platform.

It now has three explicit boundaries:

- `theme/` — clean, reusable JILL Theme Core intended to become a merchant-customizable Shopify theme product
- `extensions/` + `shared/` — JILL Shopify Customer Account/app presentation
- `backend/` + rewards modules — JILL-specific privileged business authority and integrations

The current live Dawn-derived JILL storefront is a production/reference implementation. It is not the source code for Theme Core.

## Start here

Before changing Theme Core, read `AGENTS.md`.

The canonical product-system documents live in `docs/`:

- `JILL_THEME_CONSTITUTION.md` — permanent laws
- `DOMAIN_OWNERSHIP.md` — one canonical owner per domain
- `THEME_ARCHITECTURE.md` — file/layer structure
- `FEATURE_CONTRACTS.md` — required storefront/form/account behavior
- `DESIGN_SYSTEM.md` — shared visual language
- `THEME_EDITOR_CONTRACT.md` — safe merchant customization boundary
- `PROJECT_CONTEXT.md` — durable JILL history and proven requirements
- `MIGRATION_BLUEPRINT.md` — production JILL → Theme Core migration procedure
- `QA_CERTIFICATION.md` — proof-of-done gates
- `DECISIONS.md` — dated architecture decisions and rationale
- `PLATFORM_AUDIT.md` — current production JILL evidence/debt map for migration work

## Rule 1

**No duplicates.**

One behavior, visual rule, selector owner, state machine, helper, setting, component, integration adapter or business rule gets one canonical owner.

Theme Core also rejects `!important`, styling outside canonical CSS assets, executable inline JavaScript, patch-style filenames, ghost UI and other architecture violations through `scripts/check-theme-core.mjs`.

## Development checks

Install dependencies and run all repository postinstall guards:

```bash
npm install
```

Run Theme Core architecture guard directly:

```bash
npm run check:theme
```

Run Shopify Theme Check:

```bash
npx shopify theme check --path theme
```

GitHub Actions runs Theme Core architecture validation and Shopify Theme Check for Theme Core changes.

## Current Theme Core branch

Active clean-build branch:

`jill/theme-core`

Production JILL should not be modified as a shortcut while Theme Core is being built. Migration happens feature-by-feature after contract and QA certification.

## Existing JILL app/account systems

Customer Account extensions remain in `extensions/`, with shared presentation primitives in `shared/customer-account-ui.jsx`. Shopify Customer Account platform restrictions remain authoritative; arbitrary storefront CSS is not injected into account surfaces.

Rewards accounting/reconciliation/coupon creation remains outside the sellable theme. Storefront/account UI consumes authoritative reward state rather than reproducing the accounting engine.

## Working loop

`architecture check → canonical owner → implementation → housekeeping → automated guards → interaction/visual certification → clean commit`
