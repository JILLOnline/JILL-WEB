# JILL WORK catalog import — verified checkpoint (2026-10-12)

## ACTUAL Shopify WORK mutation completed
Connected shop verified as `jill-work.myshopify.com` before writes.

Created definition:
* Type: `jill_personalization_profile`
* WORK definition ID: `gid://shopify/MetaobjectDefinition/25766559879`
* Fields: `name` and `code` (required single_line_text_field).

Created and read back all six reusable WORK profiles:
* `pinata-number` — Piñata — Number
* `pinata-round` — Piñata — Round
* `pinata-shape` — Piñata — Mold / Shape
* `party` — Party / Kids
* `apparel-gift` — Apparel & Gifts
* `none` — None / Standard Product

WORK records have destination-specific IDs. They must be resolved by handle at import time, NEVER by LIVE Metaobject ID. Read-back confirmed all six handles and `code` values.

The 17 existing WORK sample products and 3 WORK collections were unchanged. No production store mutation was performed. No customer/order data copied.

## Source-only migration machinery
The guarded code includes:
* `scripts/export-jill-safe-catalog.mjs` — read-only, field-allowlisted private export, with profile definition/records and variant options.
* `scripts/plan-work-catalog-parity.mjs` — read-only handle-based comparison, conflict detection, canonical capability drift validation.
* `scripts/build-work-catalog-operations.mjs` — draft-only ordered operations plan; never executes a Shopify mutation.
* `scripts/export-jill-safe-site-shell.mjs`, `scripts/plan-work-site-shell.mjs` — storefront pages/menus (no customer-account menu).
* Source of truth: `merchant/jill-catalog-capabilities.mjs`, one capability profile per canonical product handle.

## Remaining gates
1. Update WORK snapshots and plan now that six profiles exist; confirm no existing products or collections conflict.
2. Independently validate exact LIVE product capability JSON and WORK draft create payload compatibility (including 20/15/10-variant apparel).
3. Import in small batches to WORK with explicit destination checks and read-backs; remap product/metaobject/collection references; no automatic publication.
4. Verify media, collection memberships and product personalization features.
5. Rebuild QA theme `156005007495`, verify form reads JILL-only collection, then authenticate and test owner A/B.
6. Maintain independent website, Accounts and backend release manifests; no LIVE promotion implied.
