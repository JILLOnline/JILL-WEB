# Shopify WORK metadata provisioning — verified 2026-10-12

Destination identity checked before mutation: `jill-work.myshopify.com`.

Existing reusable profile definition: `gid://shopify/MetaobjectDefinition/25766559879`. All six WORK profile records previously verified.

Created and read back these WORK PRODUCT metafield definitions:

| Namespace.key | Type | WORK definition ID |
| --- | --- | --- |
| `custom.jill_product_capabilities` | `json` | `gid://shopify/MetafieldDefinition/286375116935` |
| `jill.pinata_shape_options` | `list.single_line_text_field` | `gid://shopify/MetafieldDefinition/286375149703` |
| `jill.personalization_profile` | `metaobject_reference` | `gid://shopify/MetafieldDefinition/286375182471` |

The personalization metafield has `metaobject_definition_id` validation pointing at WORK profile definition `gid://shopify/MetaobjectDefinition/25766559879`, NOT LIVE.

Read-back confirmed 17 WORK products, 3 WORK collections, no catalog imports or publication.

Next gate: validate canonical production capability payloads and the full draft variant import contract. The catalog source stays read-only; an actual product import requires safe source values, destination shop checks, and per-product read-back.
