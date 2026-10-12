# LIVE product metafield definitions → WORK migration

Read-only verification on JILL LIVE (`jillonlinestore.com`) as of 2026-10-12:

| Namespace.key | Type | WORK action |
| --- | --- | --- |
| `jill.personalization_profile` | `metaobject_reference` | Define PRODUCT metafield in WORK referencing WORK `jill_personalization_profile` definition ID; attach WORK metaobject IDs by handle only. |
| `jill.pinata_shape_options` | `list.single_line_text_field` | Mirror definition as appropriate; check whether values are used in current canonical form. |
| `custom.jill_product_capabilities` | `json` | Define in WORK before importing canonical capability payloads. |

Production `jill.personalization_profile` validation points to LIVE definition ID `gid://shopify/MetaobjectDefinition/22178922739`. **NEVER COPY THIS ID TO WORK.** Verified WORK definition ID is `gid://shopify/MetaobjectDefinition/25766559879`.

The source includes additional product-specific `custom.*` overrides/labels/exclusion keys that may be unstructured metafields. Those require exact namespace/key/type review before import; never silently discard values or overwrite unrelated WORK test data.

The API import gate must create definitions first, then upsert draft products by handle (no source product IDs), then assign destination-specific profile references. Product media and full variant matrix require read-back verification. Run `scripts/test-work-catalog-operations.mjs` in CI, now wired.

LIVE data was read only. No products imported or published.
