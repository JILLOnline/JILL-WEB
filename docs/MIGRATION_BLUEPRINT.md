# JILL → Theme Core Migration Blueprint

This document owns migration procedure. It does not own feature behavior or design rules.

## Objective

Move the good, proven JILL experience into clean Theme Core architecture without importing the live Dawn-derived theme's accumulated patch code.

The live JILL site is a reference implementation and visual baseline. Theme Core is the new canonical implementation.

## Non-negotiable migration rules

1. Do not copy the entire live theme into `theme/`.
2. Do not treat old `jill-*` files as canonical owners.
3. Preserve behavior and intentional visual decisions, not historical implementation techniques.
4. Never introduce an `override`, `fix`, `final`, `cleanup`, compatibility shim or second owner to make a migration appear complete.
5. The production theme remains operational while Theme Core is built and certified on an unpublished target.
6. A legacy implementation is considered replaced only after the Theme Core owner passes its contract and QA gates.
7. Product Options remains a protected behavioral reference until its replacement is certified.

## Reference capture protocol

Before rebuilding a mature production area, capture evidence of what intentionally works today.

For each area record:

- desktop screenshot/reference
- mobile screenshot/reference
- visible content hierarchy
- interaction sequence
- required/optional states
- loading/pending/success/error states
- keyboard/focus behavior
- logged-in/logged-out differences where relevant
- Theme Editor controls that matter
- known defects we explicitly do not preserve

Evidence belongs in the QA/migration process, not as copied production CSS/JS.

## Known legacy defects not to preserve

- overlapping `jill-*` polish/fix/cleanup/authority layers
- inline `<style>`/`<script>` feature blobs
- `!important` specificity escalation
- hidden duplicate/legacy controls
- compatibility bridges that relocate obsolete DOM
- delayed hiding or first-paint flicker
- multiple MutationObservers competing for authority
- repeated per-product/per-collection logic
- patch filenames and numbered authority fragments
- giant sections that combine markup, CSS, state, API calls and business rules

## Migration order

### Phase 1 — Foundation and shell

Build/certify:

- design tokens
- typography
- spacing/radii/motion vocabulary
- global page width
- buttons/fields/pills/cards/notices/dialog primitives
- header
- footer
- localization controls
- accessibility baseline

Exit criteria: a generic merchant can brand the shell from Theme Editor without creating visual forks.

### Phase 2 — Core commerce pages

Build/certify:

- home/content sections
- collection/listing
- product card
- product page foundation
- variant/price/quantity
- cart/drawer/notification
- search
- common empty/error states

Exit criteria: standard non-custom products can complete a Shopify purchase path without JILL-specific business modules.

### Phase 3 — Product capabilities and validation

Introduce one product-capability model and one progressive/validation engine.

Build/certify:

- required-state model
- progressive disclosure
- Add to Cart boundary validation
- capability-driven fields
- quantity ownership
- reference upload adapter

Exit criteria: multiple configured product families behave differently without cloned engines.

### Phase 4 — Product Options

Rebuild the protected Product Options behavior as one canonical engine driven by capabilities/configuration.

Exit criteria:

- complete/incomplete behavior matches contract
- no unrelated reopening/regression
- allocation reconciles correctly
- no collection-specific implementations
- visual/status primitives are shared

Only then is Product Options considered unlocked from the legacy reference.

### Phase 5 — Personalization

Rebuild same/different personalization from canonical application state.

Exit criteria:

- allocation totals are exact
- no duplicate unit allocation
- upstream quantity changes reconcile safely
- fields reflect selected capabilities
- no DOM compatibility bridge or observer-based authority

### Phase 6 — Custom Order

Compose existing product capabilities, validation and personalization into request mode instead of creating a second form architecture.

Exit criteria:

- multi-product selection
- Product Options
- event/date/fulfillment
- personalization
- references/consent
- review
- request submit
- success state
- backend payload contract

### Phase 7 — Customer Account / Rewards integration

Unify semantics between storefront and Shopify Customer Account extensions while preserving platform boundaries.

Exit criteria:

- Dashboard/Orders/Coupons/Contact JILL/Settings/Log Out flow is coherent
- rewards state renders from authoritative backend/account data
- redemption confirmation/pending is deterministic
- theme contains no rewards accounting

### Phase 8 — JILL merchant migration

Configure Theme Core as JILL:

- JILL branding/tokens
- catalog templates/capabilities
- policy/content
- header/footer/navigation
- social/localization settings
- custom-order configuration
- integrations

Compare against production visual/interaction references and certify every key route before promotion.

## Per-feature extraction procedure

When using old JILL as reference:

1. Identify the visible/user-facing contract.
2. Identify the data/platform contract.
3. List known defects and patch techniques to discard.
4. Find the Theme Core canonical owner.
5. If no owner exists, define it in `DOMAIN_OWNERSHIP.md` before coding.
6. Implement the smallest complete owner.
7. Add/update guards/tests.
8. Compare behavior against the reference.
9. Certify all required states/viewports.
10. Record migration status and decision if architecture changed.

## Migration status registry

Use only these states:

- `REFERENCE` — production behavior documented; Theme Core owner not built
- `BUILDING` — canonical owner exists but is not certified
- `CERTIFIED` — contract and QA gates pass in Theme Core
- `MIGRATED` — JILL merchant configuration is running on the certified owner

A feature does not become `CERTIFIED` because it looks correct in one screenshot.

## Initial status

| Domain | Status | Notes |
| --- | --- | --- |
| Foundation CSS/tokens | BUILDING | clean core exists; design breadth still minimal |
| Shared storefront UI primitives | BUILDING | initial button/card/pill owners exist |
| Header/footer shell | BUILDING | minimal clean shell exists |
| Core commerce templates | REFERENCE | to be built from Shopify contracts |
| Product capabilities | REFERENCE | behavior known; canonical config/engine not built |
| Validation/cascade | REFERENCE | mature behavior known; clean owner not built |
| Product Options | REFERENCE | protected legacy behavior |
| Personalization | REFERENCE | allocation contract captured |
| Custom Order | REFERENCE | multi-product contract captured |
| Customer Account | BUILDING | existing app extensions/shared primitives live outside theme |
| Rewards backend | BUILDING/EXISTING | JILL-specific authority remains outside sellable theme |
| Rewards presentation | REFERENCE/BUILDING | existing account work is reference for final semantics |

## Promotion rule

Theme Core is never promoted because a deadline arrived. Promotion happens when all critical JILL routes and contracts are certified and rollback remains available.