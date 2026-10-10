# JILL Theme Core Domain Ownership

This registry answers one question: **where does this behavior belong?**

| Domain | Canonical owner | May consume | Must never own |
| --- | --- | --- | --- |
| Global design tokens / reset / typography / motion vocabulary | `theme/assets/jill-foundation.css.liquid` | Theme settings | component/page exceptions |
| Buttons, fields, pills, cards, notices, shared states | `theme/assets/jill-ui.css` + matching `theme/snippets/ui-*` | Foundation tokens | page/business rules |
| Canonical quantity stepper markup, presentation and interaction | `theme/snippets/ui-quantity.liquid` + `.jill-quantity` in `theme/assets/jill-ui.css` + `theme/assets/jill-quantity.js` | semantic label/min/max/step/disabled constraints from the consuming domain | Shopify commerce quantity truth, customization-unit multiplication, Product Options/Personalization allocation arithmetic, page-specific stepper markup |
| Canonical quantity stepper tests | `scripts/test-quantity.mjs` | `JILLQuantity` public API, canonical quantity markup and Product Options renderer boundary | commerce or allocation business logic |
| Header/footer/page/product/collection/cart composition | `theme/assets/jill-storefront.css` + matching section | UI primitives | duplicated primitives |
| Merchant global visual controls | `theme/config/settings_schema.json` | Design tokens | per-section one-off styling |
| Page composition | `theme/templates/*.json` | Sections | CSS, JS, business logic |
| Merchant-editable content units | `theme/blocks/*.liquid` | Internal snippets | duplicate primitive markup |
| Internal reusable markup | `theme/snippets/*.liquid` | Shopify objects/settings | independent merchant configuration |
| Product capability profile shape | `contracts/product-capability-profile.schema.json` | feature contract semantics, including optional `customizationUnits` configuration | runtime state, merchant storage, product-title/count inference |
| JILL merchant catalog capability configuration | `merchant/jill-catalog-capabilities.mjs` | audited Shopify product IDs/handles, Product Capability Profile contract | sellable-theme defaults, Shopify-native variant duplication, browser product-family branching |
| Shopify product capability adapter | `theme/sections/main-product.liquid` reads the initial `custom.jill_product_capabilities` JSON metafield | Shopify product metafields and normalized capability schema | capability resolution, collection-name/product-family branching, a second active capability authority |
| Product capability resolution | `theme/assets/jill-product-capabilities.js` | normalized Product Capability Profile input | Shopify storage details, collection-name/product-family branches, form state; owns the canonical default of one customization unit per merchandise quantity when no multiplier is configured |
| Product capability resolver behavioral tests | `scripts/test-product-capabilities.mjs` | resolver public API and capability contract invariants | storefront rendering or Shopify storage integration |
| Universal browser state vocabulary, field validation and stage progression | `theme/assets/jill-form-engine.js` | Product Capability field contracts, normalized form values, declarative stage dependencies | product-specific validators, DOM-derived truth, separate product/custom-order cascade engines |
| Universal form engine behavioral tests | `scripts/test-form-engine.mjs` | `jill-form-engine.js` public API | storefront implementation or business-specific behavior |
| Product behavior | `theme/assets/jill-product.js` | Shopify product DOM/contracts, capability resolver, universal form engine, Product Options state, shared primitives | duplicated validation rules, privileged business truth, Product Options state/allocation rules, personalization internals |
| Product-page Product Options rendering/controller | `theme/assets/jill-product.js` + the single allocation mount emitted by `theme/snippets/product-capability-fields.liquid` | canonical `JILLProductOptions` state, resolved capability fields, Shopify quantity input, canonical UI classes and quantity stepper | Product Options state/reconciliation rules, a second validator, product-family branching, DOM-derived business truth, a second quantity-control markup owner |
| Product discovery card | `theme/snippets/product-card.liquid` | Shopify/remote product Liquid objects, localization, optional catalog summary presentation | Add to Cart forms, product customization validation, collection/search/catalog business rules |
| Catalog Hub discovery/composition | `theme/sections/main-catalog-hub.liquid` + `theme/snippets/catalog-product-summary.liquid` + `theme/assets/jill-catalog.js` | Shopify collections/products/native variants, Product Card, canonical capability metafield, product-page capability projection metadata, configured Custom Order URL | product configuration/purchase state, Shopify price authority, product-family branches, fake reviews, a second capability owner |
| Catalog outer-panel floral presentation | `theme/assets/jill-catalog-disclosure.css` + `theme/assets/jill-botanical-field.svg` | foundation-owned logo palette and SVG background token; existing isolated outer-panel stacking | description-bubble decoration, product-card layout, form styles or behavior |
| Catalog Hub behavioral guard | `scripts/test-catalog-hub.mjs` | Catalog Hub section/runtime/summary/Product Card and Custom Order handoff hooks | product-family-specific catalog engines or purchase validation |
| Collection discovery | `theme/sections/main-collection.liquid` | Liquid `collection.products`, Product Card, canonical pagination/UI primitives | Catalog Hub composition, product purchase logic, API-backed product duplication, separate product-card markup |
| Storefront search discovery | `theme/sections/main-search.liquid` | Liquid `search.results`, Product Card, canonical pagination/UI primitives | product purchase logic, client-side search truth, separate product-card markup |
| Discovery pagination | `theme/snippets/pagination.liquid` | Shopify `paginate` object | collection/search business rules |
| Native cart rendering/mutation boundary | `theme/sections/main-cart.liquid` + Shopify cart routes/form contract | `cart`, `line_item`, canonical UI primitives | product/customization business logic, parallel cart database, unnecessary AJAX owner |
| Cart enhancement behavior | `theme/assets/jill-cart.js` only if a future certified interaction requirement genuinely needs JavaScript | Shopify cart routes and native cart DOM | replacing Shopify cart truth or duplicating native form behavior |
| Product customization engine | `theme/assets/jill-customization.js` when introduced | product capabilities, universal form engine | duplicated per-product-family engines |
| Product Options state, allocation, reconciliation and normalized payload | `theme/assets/jill-product-options.js` | product capabilities, Shopify merchandise quantity, resolver-owned customization-unit multiplier/default, universal form engine | collection-specific option implementations, product-title/count inference, a second units-per-quantity rule, personalization state, DOM-derived truth |
| Product Options behavioral tests | `scripts/test-product-options.mjs` | `jill-product-options.js`, capability resolver and universal form engine public APIs | storefront rendering, product-family-specific test engines |
| Personalization state/allocation and normalized payload | `theme/assets/jill-personalization.js` | product capabilities, Shopify merchandise quantity, resolver-owned customization-unit multiplier/default, universal form engine | product quantity mutation, product-title/count inference, a second units-per-quantity rule, Product Options state, DOM-derived truth |
| Personalization behavioral tests | `scripts/test-personalization.mjs` | `jill-personalization.js`, capability resolver and universal form engine public APIs | page-specific personalization engines or commerce quantity mutation |
| Shopify native-variant allocation state/reconciliation | `theme/assets/jill-variant-allocation.js` | Shopify variant IDs/titles/availability, canonical merchandise quantity, stable product item identity | size/color/product-family parsing, price authority, Product Options state, personalization state, DOM-derived business truth |
| Native-variant allocation behavioral tests | `scripts/test-variant-allocation.mjs` | `JILLVariantAllocation` public API | Custom Order rendering, product-family-specific variant rules, Shopify price ownership |
| Reference/file upload browser adapter | one upload adapter owner when introduced | configured file constraints, backend/storage transport | independent upload systems per form |
| Custom Order catalog/composition | `theme/sections/main-custom-order.liquid` + `theme/templates/page.custom-order.json` | Shopify `collections['all']`, native Shopify variants, the canonical product capability metafield, shared product-form markup/primitives | copied product-family rules, copied Product Options/personalization engines, live-form mutation |
| Custom-order browser flow | `theme/assets/jill-custom-order.js` | the shared product runtime, capability resolver, native-variant allocation engine/payload, Product Options payload, personalization engine/payload, Custom Order transport contract, optional catalog product intent | a second product validator, product-family branching, a second quantity/allocation engine, backend persistence |
| Custom-order shared-engine integration guard | `scripts/test-custom-order-integration.mjs` | Custom Order section/runtime and shared customization/variant owner hooks | Custom Order business behavior duplication |
| Custom-order API transport contract | `contracts/custom-order-api.schema.json` | Custom Order feature contract and normalized browser state | backend implementation details or rewards data |
| Custom-order API contract guard | `scripts/check-custom-order-contract.mjs` | Custom Order API schema | theme or rewards validation |
| Backend execution architecture | `docs/FUNCTIONAL_ARCHITECTURE.md` | feature contracts/platform boundaries | feature-specific business rules |
| Backend HTTP routing | one web-app router/entry owner when extracted | command/query/event handlers | business logic for individual domains |
| Backend boundary validation | one backend validation utility owner when extracted | request schemas/domain rules | browser-only presentation validation |
| Privileged Shopify API transport | one backend Shopify client owner when extracted | credentials, Shopify Admin API | rewards/custom-order business rules |
| Custom-order persistence/workflow | backend custom-order authority; target `custom-order.gs` when extracted | validated request, notification/customer adapters | rewards accounting or storefront rendering |
| Custom-order customer/notification integration | custom-order domain adapter or shared integration only when genuinely reused | persisted custom-order state | primary submission ownership |
| Backend upload persistence/metadata | one storage-provider adapter when introduced | authenticated/validated upload request | product/custom-order-specific rendering |
| Backend command idempotency | command's canonical domain owner | operation identity, persistence state | UI-only click guards as business integrity |
| Backend event/webhook reconciliation | event's canonical domain owner | verified Shopify/source event, authoritative platform data | trusting event delivery as sole correctness layer |
| Backend operational health | each privileged domain's health contract + shared transport only when generic | version/infrastructure/reconciliation state | secrets or customer private data |
| Rewards backend deployment/provenance | `.github/workflows/deploy-rewards-backend.yml` + `JILL_REWARDS_BUILD_SHA` runtime marker | canonical Git source, existing Apps Script project/deployment, Rewards guards | manual editor changes as a competing source, creating a second production web-app deployment, unverifiable runtime source |
| Rewards WORK Customer Account preview target guard | `scripts/verify-rewards-work-target.mjs` + `package.json` WORK commands | Shopify CLI-linked local `shopify.app.work.toml`, verified WORK app Client ID and development store domain | reusing LIVE app credentials, running preview against LIVE, a second Rewards implementation, privileged coupon creation |
| SEO/meta/structured data | canonical SEO snippets | Shopify objects/settings | page-local duplicated metadata systems |
| Localization strings | `theme/locales/*` | canonical translation keys | hard-coded duplicated merchant/customer strings |
| Theme Editor lifecycle integration | feature owner requiring lifecycle support | Shopify section events | global reinitialization observers |
| Public Storewide promotion mirror | `backend/google-apps-script/JILL_Public_Promotions.gs` | active Shopify code discounts, paginated public-offer discovery, Shop metafield `jill_promotions.active_public_codes`, snapshot freshness, scheduled trigger health | personal Rewards coupons/accounting, subscriber/segment/customer-targeted codes, hard-coded campaign codes in Customer Account UI |
| Rewards accounting/integrity | backend/rewards authority | Shopify/admin data | storefront presentation files |
| Rewards customer state derivation | `shared/rewards.mjs` | backend response + `rewards.config.json` parity contract | reward accounting, extension-specific presentation ownership |
| Customer Account discount-to-cart URL | `shared/rewards.mjs` exported `discountCartUrl` | Shopify native `/discount/{code}?redirect=/cart` route, store origin and percent-encoded code | custom cart databases, assumed session-only expiration, separate Dashboard/Coupons link builders |
| Rewards Shopify discount adapter | rewards backend adapter/transport owner | privileged Shopify client | UI state ownership |
| My JILL full-page hub entrypoint and shell | `extensions/jill-account-dashboard/shopify.extension.toml` + `src/Dashboard.jsx` (thin entrypoint after migration) + `src/hub/AccountHub.jsx` (on introduction) | Shopify new Customer Accounts, navigation modules, normalized data | Rewards financial truth, native orders/profile/checkout, a second independently registered full-page target |
| My JILL internal navigation | `extensions/jill-account-dashboard/src/hub/routes.mjs` (create on first routed shell) | supported `extension://` and native Shopify account destinations | multiple route registries, hard-coded account page UUIDs, duplicate page targets |
| Customer Account authenticated API transport | `shared/customer-account-api.mjs` (create on first extraction) | Customer Account GraphQL reads and CAS-protected customer-owned mutations | privileged Shopify Admin data, separate per-screen fetch clients, assuming scopes imply metafield access |
| Customer Account JILL presentation primitives | `extensions/jill-account-dashboard/src/ui/AccountPrimitives.jsx` (create when used) | Shopify 2026-07 web components and semantic account state | storefront CSS injection, separate visual systems for each account screen |
| My JILL Rewards and personal Coupons presentation | `extensions/jill-account-dashboard/src/pages/Rewards.jsx` + `src/pages/Coupons.jsx` (create by extracting current owners) | `shared/rewards.mjs`, canonical wallet and sanitized promotion mirror | another points algorithm, coupon creation/repair, separate wallet truth |
| Native Profile shortcut to My JILL | `extensions/jill-account-home/src/AccountHome.jsx` | Shopify Profile extension target, hub route | recreating the full hub or durable customer settings engine |
| Customer Custom Orders/celebrations/saved UI | `extensions/jill-account-dashboard/src/pages/{CustomOrders,Celebrations,SavedPreferences,Settings}.jsx` (create after contracts) | authenticated customer data with verified ownership and consent | direct access to another customer's requests, duplicating storefront Custom Order form |
| Legacy standalone Coupons full-page surface | `extensions/jill-account-coupons/` until parity/menu migration, then retired | existing released page and links | permanent second Coupons owner or silently deleting an installed Shopify account route |
| Customer durable profile/preferences | one explicit Shopify-metafield or backend persistence owner when introduced | authenticated customer identity | arbitrary browser-supplied customer identity |
| Migration procedure/status | `docs/MIGRATION_BLUEPRINT.md` | feature contracts/QA evidence | implementation behavior |
| Certification requirements | `docs/QA_CERTIFICATION.md` | architecture/feature contracts | production business rules |
| Durable JILL product history/context | `docs/PROJECT_CONTEXT.md` | historical evidence | normative implementation ownership |
| Architecture decision history | `docs/DECISIONS.md` | dated decisions | rewriting current contracts |

## Registry rule

A new domain requires an explicit row here before it receives a new canonical owner. Two rows may not claim the same responsibility.

Placeholder language such as `when introduced` or `when extracted` means the responsibility is reserved but no implementation file should be created until the feature actually exists. Empty scaffolding does not count as architecture.

The current combined Apps Script file remains production code during migration. New backend work must follow the ownership rows above rather than adding more unrelated responsibility to the monolith.


## Custom Order final-pass ownership clarification — 2026-09-12

- `jill-custom-order.js` may orchestrate cross-product Custom Order personalization, but physical eligible-unit identity/count must come from `JILLPersonalization` and canonical product capability profiles. It must not own separate units-per-quantity arithmetic.
- Product-level required personalization/reference semantics come from the full canonical Shopify capability profile; the generic Custom Order choices may only become stricter from that truth, never weaker.
- `jill-forms.css` owns Custom Order large-card botanical presentation and consumes the same `--jill-botanical-field` foundation asset. It does not own a second botanical asset or decorate ordinary controls.
