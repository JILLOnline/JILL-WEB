# JILL Theme Editor Contract

The merchant can customize JILL Theme Core without breaking JILL Theme Core.

## Global settings may control

- primary typography
- background, foreground, accent and semantic status colors
- page width
- spacing scale/density
- global button radius/height
- global field radius
- global card radius
- motion preference/intensity when introduced
- supported global color schemes when introduced

These values become CSS custom properties in `jill-foundation.css.liquid` and are consumed everywhere else.

## Sections may control

- content
- media
- block order
- layout choice from supported semantic layouts
- alignment
- visibility where appropriate
- a named color scheme/semantic variant
- spacing presets only when they map to global spacing tokens

## Sections may not control

- one-off button radius, field radius or card radius
- arbitrary CSS
- duplicate color systems
- private font systems
- private button/field/card markup
- business calculations
- hidden behavior flags that bypass canonical validation/state engines

## Blocks

Blocks are merchant-editable composition units. They render internal canonical snippets rather than owning their own visual system.

## Custom Liquid

Custom Liquid remains available for Shopify/app compatibility, but Theme Core itself never uses it as a substitute for a proper canonical feature owner.
