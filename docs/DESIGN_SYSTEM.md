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
- `snippets/ui-quantity.liquid` — quantity stepper markup
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

## Customization choice language

Product Options and Personalization use the same visual language for discrete radio choices across every product. A radio choice renders as a full-width selectable card inside its choice group, with the same border, hover, selected-accent and focus behavior whether the values are `Empty / Filled`, `Yes / No`, `Same for all / Different by item`, or another capability-defined radio set.

Rules:

- capability meaning determines the labels; product identity never determines the visual treatment
- selected state is communicated by the real checked radio control plus the shared accent treatment
- the choice remains a semantic radio input and keeps keyboard/focus behavior
- browser-default fieldset framing is normalized away so only the canonical JILL field/choice presentation is visible
- Product Options allocation groups and Personalization allocation groups both use the canonical `.jill-card` surface; no empty Personalization card may remain visible when no personalization group exists
- Product Options and Personalization status pills and add-group actions share the same composition treatment

This consistency is owned by shared customization composition rules, not product-specific CSS.

## Canonical quantity stepper

`snippets/ui-quantity.liquid`, the `.jill-quantity` family in `jill-ui.css`, and `assets/jill-quantity.js` together own the reusable quantity interaction.

The customer-facing control is always presented as a single field with three visible parts: decrement button, editable numeric value, increment button. Native browser spinner chrome is not a JILL quantity UI.

Rules:

- decrement and increment controls stay visible, including when disabled at a boundary
- the numeric input remains directly editable and keeps native numeric keyboard/arrow-key semantics
- min, max and step are semantic constraints supplied by the consuming domain; the quantity primitive only enforces them
- increment/decrement buttons have meaningful accessible names and reference the input they control
- redundant step buttons stay outside the primary Tab sequence while the editable input remains keyboard reachable
- touch targets are at least 44 CSS pixels in the quantity stepper even when a merchant configures a shorter general button height
- mouse-wheel scrolling over a focused quantity input must not silently change the value
- dynamic allocation count controls clone the canonical quantity markup and configure it through `JILLQuantity`; they may not hand-build a second numeric control
- the quantity primitive never owns Shopify commerce quantity, customization-unit multiplication, Product Options allocation arithmetic or Personalization allocation arithmetic

This primitive applies to Shopify merchandise quantity, cart quantity and every Product Options/Personalization count control that asks a customer how many units belong to an allocation group.

## Variant rule

A variant describes meaning, not location.

Good: primary, secondary, success, info, destructive, disabled, pending.

Bad: dashboard-button, purple-button, product-page-pill, footer-special-button.

## State rule

Every interactive primitive defines required states at its canonical owner: default, hover/focus-visible where applicable, active, disabled, loading/pending and success/error semantics where applicable.

## No override policy

There is no `!important`, no override file and no page-specific redefinition of a primitive. If a composition needs a legitimate variation, create a semantic variant in the primitive owner and reuse it everywhere that meaning applies.