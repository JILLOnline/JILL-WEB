# JILL-WEB Contributor Boot Contract

This file is intentionally short. It tells humans and AI agents what must be read before changing Theme Core.

## Required read order

Before editing `theme/`, read:

1. `docs/JILL_THEME_CONSTITUTION.md`
2. `docs/DOMAIN_OWNERSHIP.md`
3. `docs/THEME_ARCHITECTURE.md`
4. `docs/FEATURE_CONTRACTS.md`
5. `docs/DESIGN_SYSTEM.md`
6. `docs/THEME_EDITOR_CONTRACT.md`
7. `docs/PROJECT_CONTEXT.md`
8. `docs/MIGRATION_BLUEPRINT.md`
9. `docs/QA_CERTIFICATION.md`
10. `docs/DECISIONS.md`

When migrating or comparing behavior from the current production JILL storefront, also read `docs/PLATFORM_AUDIT.md` before inspecting legacy theme code.

## Before writing code

Answer:

- What domain am I changing?
- What file is its canonical owner?
- Does an existing implementation already satisfy part of this requirement?
- Would this create a second owner, selector, state machine, helper, setting, component or business rule?
- Can this be configuration instead of new code?
- What dependencies/regressions can this change affect?
- What obsolete code becomes removable?
- Which automated/manual certification gates apply?

If ownership is unclear, define/update `DOMAIN_OWNERSHIP.md` before implementation.

## Absolute Theme Core prohibitions

- duplicates
- `!important`
- styling outside canonical CSS assets
- patch/override/fix/final/cleanup/polish architecture
- ghost UI or delayed cleanup
- dead/debug/temp code
- hidden legacy controls as compatibility owners
- duplicated product-family engines
- privileged business truth in theme presentation
- direct production-theme shortcuts while Theme Core is under construction

## Protected behaviors

- Existing JILL Product Options is a protected behavioral reference until Theme Core replacement certification.
- Custom-order, personalization and rewards behavior must follow `FEATURE_CONTRACTS.md` rather than historical implementation details.

## Required finish

A task is not complete until:

`implementation → housekeeping → repository guard → Shopify Theme Check → applicable contract/visual/accessibility/Theme Editor certification → clean commit`

Do not work ahead into unrelated domains.