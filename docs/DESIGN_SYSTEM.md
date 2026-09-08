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

Current primitives:

- `.jill-button`
- `.jill-card`
- `.jill-pill`
- `.jill-field` family
- `.jill-choice`
- `.jill-quantity`

Canonical form markup owners:

- `snippets/ui-field.liquid` — text-like HTML inputs including text/email/date/number as configured
- `snippets/ui-textarea.liquid` — multiline text
- `snippets/ui-select.liquid` — select/options
- `snippets/ui-choice.liquid` — checkbox/radio
- `snippets/ui-quantity.liquid` — quantity input
- `snippets/ui-file.liquid` — file selection

These snippets share the same label, required, help, disabled, focus and error language. Product pages, Custom Order, future content forms and merchant-specific compositions must render these owners rather than reproducing their markup or visual states.

Future shared primitives are introduced only when a real feature requires them, such as `.jill-notice` and `.jill-dialog`.

### Storefront

`jill-storefront.css`

Owns compositions such as site header/footer and page/section structures. It consumes UI primitives and cannot restyle them locally.

## Form rule

Form controls are semantic primitives, not page-specific components.

A composition may configure:

- label/help/error content
- HTML input type
- required/disabled state
- semantic constraints such as min/max/maxlength
- option values
- file accept/multiple behavior

A composition may not create a separate visual field system, duplicate required/error styling, infer validity from CSS, or change the ordered quantity from a personalization allocator.

Browser-native semantics remain the baseline unless a later behavior owner has a justified need to enhance them. Enhancement must preserve keyboard, focus, mobile and no-JavaScript-safe behavior wherever Shopify/platform contracts permit it.

## Variant rule

A variant describes meaning, not location.

Good: primary, secondary, success, info, destructive, disabled, pending.

Bad: dashboard-button, purple-button, product-page-pill, footer-special-button.

## State rule

Every interactive primitive defines required states at its canonical owner: default, hover/focus-visible where applicable, active, disabled, loading/pending and success/error semantics where applicable.

## No override policy

There is no `!important`, no override file and no page-specific redefinition of a primitive. If a composition needs a legitimate variation, create a semantic variant in the primitive owner and reuse it everywhere that meaning applies.
