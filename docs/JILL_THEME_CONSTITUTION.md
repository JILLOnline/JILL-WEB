# JILL Theme Core Constitution

JILL Theme Core is a reusable Shopify theme product. JILL Online Store is its first merchant implementation, not the architecture itself.

## Rule 1 — No duplicates

No behavior, visual rule, selector owner, component, state machine, constant, schema responsibility, helper, integration adapter, or business rule may have more than one canonical owner.

Before adding code, find the current owner. Extend or replace that owner. Never create a parallel implementation.

## Permanent laws

1. **No duplicates.** One concept, one owner.
2. **No `!important`.** Specificity problems are architecture problems and must be solved at the owner/cascade level.
3. **All styling lives in CSS assets.** No `style` attributes, `<style>` tags, `{% stylesheet %}` blocks, JavaScript-injected CSS, `cssText`, or runtime style mutation.
4. **No patch architecture.** Files named `fix`, `final`, `cleanup`, `polish`, `override`, `patch`, `temp`, `copy`, `old`, `legacy`, or version fragments are prohibited in Theme Core.
5. **No dead code.** No unused assets, snippets, blocks, settings, scripts, compatibility shims, commented-out implementations, temporary runners, or debug code.
6. **No executable inline JavaScript.** Behavior belongs in JavaScript assets. Structured-data JSON is the only intended inline script-data exception.
7. **Configuration over duplication.** Product families and merchant choices are data/configuration, not copied feature implementations.
8. **Presentation does not own business truth.** UI renders authoritative state; it does not reproduce accounting, pricing, rewards, fulfillment, or privileged backend rules.
9. **Theme Editor first.** Merchant-facing choices are exposed through deliberate global settings, sections, and blocks without allowing local settings to fracture the visual system.
10. **Accessible and responsive by default.** Keyboard, focus, touch targets, reduced motion, translated content, empty/loading/error/success states, and small screens are part of done.
11. **Housekeeping is part of every edit.** A touched path must finish cleaner than it started.
12. **No ghost UI.** No delayed cleanup, competing observers, hidden duplicate controls, flash-of-old-state, or scripts fighting for DOM/state authority.
13. **One task, one owner, one certified change.** Architecture check → implementation → housekeeping → automated guards → QA → commit.

## Dependency direction

`Shopify platform contracts → Design system → Internal primitives → Merchant blocks → Sections → Templates`

Business modules may consume the layers to their left. They may not create a second design system or bypass platform contracts.

## Definition of done

A change is done only when the requested behavior works, the canonical owner remains singular, the Theme Editor contract remains intact, superseded code in the touched path is removed, automated guards pass, and no temporary implementation remains.
