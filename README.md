# JILL-WEB

JILL-WEB is the product repository for JILL's Shopify storefront platform.

It has three explicit boundaries:

- `theme/` — clean, reusable JILL Theme Core intended to become a merchant-customizable Shopify theme product
- `extensions/` + shared account presentation — JILL Shopify Customer Account/app presentation
- `backend/` + rewards modules — JILL-specific privileged business authority and integrations

The current live Dawn-derived JILL storefront is a production/reference implementation. It is not the source code for Theme Core.

## Start here

Before changing Theme Core or backend functionality, read `AGENTS.md`.

The canonical product-system documents live in `docs/`:

- `JILL_THEME_CONSTITUTION.md` — permanent laws
- `DOMAIN_OWNERSHIP.md` — one canonical owner per domain
- `THEME_ARCHITECTURE.md` — file/layer structure
- `FUNCTIONAL_ARCHITECTURE.md` — browser/Shopify/backend execution, commands/events/queries, persistence, retries and reconciliation
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

Backend work follows the same ownership rule: durable commands must be retry-safe/idempotent, privileged execution stays outside browser/theme code, and webhook-driven domains use reconciliation rather than assuming event delivery is perfect.

## Functional boundary

```text
Customer
  ↓
Theme / Customer Account UI
  ↓
Browser feature state
  ↓
Shopify platform OR JILL backend adapter
  ↓
Authoritative persistence / privileged execution
  ↓
Events + reconciliation
  ↓
Authoritative state returned to UI
```

Shopify owns ordinary commerce. Theme Core owns presentation and ephemeral interaction state. JILL backend code owns secrets, durable custom-order workflows, rewards integrity, privileged Shopify operations, integrations and reconciliation.

## Canonical Theme Core delivery lane

There is one storefront source and one Shopify development target:

```text
jill/theme-core
  ↓
.github/workflows/theme-core.yml
  ↓
validate
  ↓
package as a GitHub Actions artifact
  ↓
verify exact Shopify target
  ↓
preserve config/settings_data.json
  ↓
strict full-source push
  ↓
JILL Theme Core DEV — theme 165639192819 — DEVELOPMENT
```

The workflow refuses to write if the target ID, name or DEVELOPMENT role does not match. It never uses Shopify CLI `--allow-live`. The live JILL theme is not a deployment target.

`jill/theme-core-package`, `jill/theme-core-artifacts`, and `jill/storefront-system` are historical branches, not sources of truth. They must not receive new storefront work. Certified ZIPs now live on the workflow run itself instead of a generated branch.

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

GitHub Actions runs the same certification before packaging or deploying Theme Core. Existing rewards guards/tests remain part of repository postinstall validation.

## Current Theme Core branch

Active clean-build branch:

`jill/theme-core`

Production JILL should not be modified as a shortcut while Theme Core is being built. Migration happens feature-by-feature after contract and QA certification.

## Existing JILL app/account systems

Customer Account extensions remain in `extensions/`. Shopify Customer Account platform restrictions remain authoritative; arbitrary storefront CSS is not injected into account surfaces.

Rewards accounting/reconciliation/coupon creation remains outside the sellable theme. Storefront/account UI consumes authoritative reward state rather than reproducing the accounting engine.

The current Google Apps Script backend remains operational during migration. Its public behavior is preserved while Custom Order and Rewards ownership are progressively decomposed behind stable contracts.

## Working loop

`architecture check → canonical owner → implementation → housekeeping → automated guards/tests → failure/retry certification → interaction/visual certification where applicable → clean commit → canonical DEVELOPMENT deploy`
