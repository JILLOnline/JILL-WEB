# JILL-WEB Contributor Boot Contract

This file is intentionally short. It tells humans and AI agents what must be read before changing Theme Core or JILL backend functionality.

## Required read order

Before editing `theme/`, read:

1. `docs/JILL_THEME_CONSTITUTION.md`
2. `docs/DOMAIN_OWNERSHIP.md`
3. `docs/THEME_ARCHITECTURE.md`
4. `docs/FUNCTIONAL_ARCHITECTURE.md`
5. `docs/FEATURE_CONTRACTS.md`
6. `docs/DESIGN_SYSTEM.md`
7. `docs/THEME_EDITOR_CONTRACT.md`
8. `docs/PROJECT_CONTEXT.md`
9. `docs/MIGRATION_BLUEPRINT.md`
10. `docs/QA_CERTIFICATION.md`
11. `docs/DECISIONS.md`

Before editing `backend/`, rewards execution, webhooks, persistence, integrations, upload transport, or any privileged operation, at minimum read:

1. `docs/JILL_THEME_CONSTITUTION.md`
2. `docs/DOMAIN_OWNERSHIP.md`
3. `docs/FUNCTIONAL_ARCHITECTURE.md`
4. `docs/FEATURE_CONTRACTS.md`
5. the relevant domain-specific backend contract/document
6. `docs/QA_CERTIFICATION.md`
7. `docs/DECISIONS.md`

When migrating or comparing behavior from the current production JILL storefront, also read `docs/PLATFORM_AUDIT.md` before inspecting legacy theme code.

## Before writing code

Answer:

- What domain am I changing?
- What file is its canonical owner?
- Is this browser state, Shopify authority, backend authority, a command, a query, or an event?
- Does an existing implementation already satisfy part of this requirement?
- Would this create a second owner, selector, state machine, helper, setting, component, adapter or business rule?
- Can this be configuration instead of new code?
- If durable state changes, what makes retries idempotent?
- If multiple systems are involved, what is the failure/rollback strategy?
- What dependencies/regressions can this change affect?
- What obsolete code becomes removable?
- Which automated/manual certification gates apply?

If ownership is unclear, define/update `DOMAIN_OWNERSHIP.md` before implementation.

## Absolute Theme Core / platform prohibitions

- duplicates
- `!important`
- styling outside canonical CSS assets
- patch/override/fix/final/cleanup/polish architecture
- ghost UI or delayed cleanup
- dead/debug/temp code
- hidden legacy controls as compatibility owners
- duplicated product-family engines
- privileged business truth in theme presentation
- secrets/privileged credentials in browser/theme code
- durable commands without safe retry/idempotency semantics
- trusting webhooks as the only reconciliation path for financial/durable truth
- direct production-theme shortcuts while Theme Core is under construction

## Protected behaviors

- Existing JILL Product Options is a protected behavioral reference until Theme Core replacement certification.
- Custom-order, personalization and rewards behavior must follow `FEATURE_CONTRACTS.md` rather than historical implementation details.
- Existing production Rewards and Custom Order backends remain operational while clean ownership is extracted; do not casually rewrite them during unrelated Theme Core work.

## Required finish

A task is not complete until:

`implementation → housekeeping → repository/domain guards → applicable platform validation → contract/failure tests → visual/accessibility/Theme Editor certification when relevant → clean commit`

Do not work ahead into unrelated domains.