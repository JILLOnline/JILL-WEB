# Custom Order Item Naming Contract

This document owns customer-facing item names inside JILL Custom Order.

Custom Order item labels are not Shopify product titles and must never rewrite Shopify product data. They are a concise request-composition label derived from Shopify title truth by one canonical formatter: `theme/snippets/custom-order-item-title.liquid`.

## Goal

Section 3 answers one question: **What individual product do you want?**

The label identifies the sellable/customizable product itself. Quantity is chosen separately. Product Options and personalization are configured later inside that selected product.

## Keep

Keep only details that materially distinguish the physical product identity before customization, for example:

- base product name
- physical size when separate Shopify products represent different sizes (`Piñata – 13 Inch Round`, `Piñata – 18 Inch`, `Piñata – 36 Inch`)
- capacity when it is part of the physical product identity (`11 oz Mug`)
- shape/form when it identifies a genuinely different product rather than a customization choice

## Remove

Remove wording that describes how the product is produced, packaged, marketed, bundled, or accessorized rather than what the product is:

- marketing prefixes such as `Custom`, `Custom Handmade`, `Personalized`
- production methods such as `DTF`, `Sublimation`, `Vinyl`, `Print`
- customization marketing copy such as `Photo, Text & Design`, `Made to Order`
- included extras such as `Includes Stick`
- pack/count wording such as `12 Count`, `13 Pieces`
- redundant party-favor marketing wording when it is not the base item identity
- accidental one-character suffix/noise segments such as `s`

## Examples

- `11 oz Mug – Print` → `11 oz Mug`
- `Tote Bag – Photo, Text & Design` → `Tote Bag`
- `Coloring Books – s` → `Coloring Books`
- `Piñata – 18 Inch – Includes Stick` → `Piñata – 18 Inch`
- `Piñata – 36 Inch – Includes Stick` → `Piñata – 36 Inch`
- `Piñata – 13 Inch Round` → `Piñata – 13 Inch Round`

## Architecture rules

- One canonical formatter owns this transformation.
- Never branch on product handle, product ID, collection, or hard-coded product family.
- Never change Shopify product titles, handles, feeds, product pages, prices, or variants to satisfy Custom Order display naming.
- Section 3 quantity always represents requested individual merchandise units; pack-count wording must not redefine quantity semantics.
- Product Options, Shopify-native variants, and personalization remain separate authorities and must not be encoded into the Section 3 item label.
- Cross-listed products still appear only once in Section 3.

When a new title pattern appears, extend the generic naming rule only if the rule is valid for the entire Custom Order surface. Do not add a one-off product exception.
