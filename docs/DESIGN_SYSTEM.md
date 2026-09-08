# JILL Design System

## Principle

The website should look consistent because every surface consumes the same primitives, not because similar CSS was copied until it looked close.

## CSS owners

### Foundation

`jill-foundation.css.liquid`

Owns CSS layer order, merchant-driven custom properties, box sizing, document defaults, typography, focus baseline, page container and global spacing vocabulary.

### UI

`jill-ui.css`

Owns reusable primitives. A primitive is defined once and extended only through semantic variants.

Initial primitives:

- `.jill-button`
- `.jill-card`
- `.jill-pill`
- `.jill-field` family when forms are introduced
- `.jill-notice` when feedback is introduced
- `.jill-dialog` when dialogs are introduced

### Storefront

`jill-storefront.css`

Owns compositions such as site header/footer and page/section structures. It consumes UI primitives and cannot restyle them locally.

## Variant rule

A variant describes meaning, not location.

Good: primary, secondary, success, info, destructive, disabled, pending.

Bad: dashboard-button, purple-button, product-page-pill, footer-special-button.

## State rule

Every interactive primitive defines required states at its canonical owner: default, hover/focus-visible where applicable, active, disabled, loading/pending and success/error semantics where applicable.

## No override policy

There is no `!important`, no override file and no page-specific redefinition of a primitive. If a composition needs a legitimate variation, create a semantic variant in the primitive owner and reuse it everywhere that meaning applies.
