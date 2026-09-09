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
| Shopify product capability adapter | `theme/sections/main-product.liquid` reads the initial `custom.jill_product_capabilities` JSON metafield | Shopify product metafields and normalized capability schema | capability resolution, collection-name/product-family branching, a second active capability authority |
| Product capability resolution | `theme/assets/jill-product-capabilities.js` | normalized Product Capability Profile input | Shopify storage details, collection-name/product-family branches, form state; owns the canonical default of one customization unit per merchandise quantity when no multiplier is configured |
| Product capability resolver behavioral tests | `scripts/test-product-capabilities.mjs` | resolver public API and capability contract invariants | storefront rendering or Shopify storage integration |
| Universal browser state vocabulary, field validation and stage progression | `theme/assets/jill-form-engine.js` | Product Capability field contracts, normalized form values, declarative stage dependencies | product-specific validators, DOM-derived truth, separate product/custom-order cascade engines |
| Universal form engine behavioral tests | `scripts/test-form-engine.mjs` | `jill-form-engine.js` public API | storefront implementation or business-specific behavior |
| Product behavior | `theme/assets/jill-product.js` | Shopify product DOM/contracts, capability resolver, universal form engine, Product Options state, shared primitives | duplicated validation rules, privileged business truth, Product Options state/allocation rules, personalization internals |
| Product-page Product Options rendering/controller | `theme/assets/jill-product.js` + the single allocation mount emitted by `theme/snippets/product-capability-fields.liquid` | canonical `JILLProductOptions` state, resolved capability fields, Shopify quantity input, canonical UI classes and quantity stepper | Product Options state/reconciliation rules, a second validator, product-family branching, DOM-derived business truth, a second quantity-control markup owner |
| Product discovery card | `theme/snippets/product-card.liquid` | Shopify/remote product Liquid objects, localization | Add to Cart forms, product customization validation, collection/search-specific behavior |
| Collection discovery | `theme/sections/main-collection.liquid` | Liquid `collection.products`, Product Card, canonical pagination/UI primitives | product purchase logic, API-backed product duplication, separate product-card markup |
| Storefront search discovery | `theme/sections/main-search.liquid` | Liquid `search.results`, Product Card, canonical pagination/UI primitives | product purchase logic, client-side search truth, separate product-card markup |
| Discovery pagination | `theme/snippets/pagination.liquid` | Shopify `paginate` object | collection/search business rules |
| Native cart rendering/mutation boundary | `theme/sections/main-cart.liquid` + Shopify cart routes/form contract | `cart`, `line_item`, canonical UI primitives | product/customization business logic, parallel cart database, unnecessary AJAX owner |
| Cart enhancement behavior | `theme/assets/jill-cart.js` only if a future certified interaction requirement genuinely needs JavaScript | Shopify cart routes and native cart DOM | replacing Shopify cart truth or duplicating native form behavior |
| Product customization engine | `theme/assets/jill-customization.js` when introduced | product capabilities, universal form engine | duplicated per-product-family engines |
| Product Options state, allocation, reconciliation and normalized payload | `theme/assets/jill-product-options.js` | product capabilities, Shopify merchandise quantity, resolver-owned customization-unit multiplier/default, universal form engine | collection-specific option implementations, product-title/count inference, a second units-per-quantity rule, personalization state, DOM-derived truth |
| Product Options behavioral tests | `scripts/test-product-options.mjs` | `jill-product-options.js`, capability resolver and universal form engine public APIs | storefront rendering, product-family-specific test engines |
| Personalization state/allocation and normalized payload | `theme/assets/jill-personalization.js` | product capabilities, Shopify merchandise quantity, resolver-owned customization-unit multiplier/default, universal form engine | product quantity mutation, product-title/count inference, a second units-per-quantity rule, Product Options state, DOM-derived truth |
| Personalization behavioral tests | `scripts/test-personalization.mjs` | `jill-personalization.js`, capability resolver and universal form engine public APIs | page-specific personalization engines or commerce quantity mutation |
| Reference/file upload browser adapter | one upload adapter owner when introduced | configured file constraints, backend/storage transport | independent upload systems per form |
| Custom Order catalog/composition | `theme/sections/main-custom-order.liquid` + `theme/templates/page.custom-order.json` | Shopify `collections['all']`, the canonical product capability metafield, shared product-form markup/primitives | copied product-family rules, copied Product Options/personalization engines, live-form mutation |
| Custom-order browser flow | `theme/assets/jill-custom-order.js` | the shared product runtime, capability resolver, Product Options payload, personalization engine/payload, Custom Order transport contract | a second product validator, product-family branching, a second quantity/allocation engine, backend persistence |
| Custom-order shared-engine integration guard | `scripts/test-custom-order-integration.mjs` | Custom Order section/runtime and shared customization owner hooks | Custom Order business behavior duplication |
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
| SEO/meta/structured data | canonical SEO snippets | Shopify objects/settings | page-local duplicated metadata systems |
| Localization strings | `theme/locales/*` | canonical translation keys | hard-coded duplicated merchant/customer strings |
| Theme Editor lifecycle integration | feature owner requiring lifecycle support | Shopify section events | global reinitialization observers |
| Rewards accounting/integrity | backend/rewards authority | Shopify/admin data | storefront presentation files |
| Rewards customer state derivation | existing rewards state module | backend response | reward accounting |
| Rewards Shopify discount adapter | rewards backend adapter/transport owner | privileged Shopify client | UI state ownership |
| Customer Account shared presentation | `shared/customer-account-ui.jsx` | account extension state | reward accounting/business truth |
| Customer durable profile/preferences | one explicit Shopify-metafield or backend persistence owner when introduced | authenticated customer identity | arbitrary browser-supplied customer identity |
| Migration procedure/status | `docs/MIGRATION_BLUEPRINT.md` | feature contracts/QA evidence | implementation behavior |
| Certification requirements | `docs/QA_CERTIFICATION.md` | architecture/feature contracts | production business rules |
| Durable JILL product history/context | `docs/PROJECT_CONTEXT.md` | historical evidence | normative implementation ownership |
| Architecture decision history | `docs/DECISIONS.md` | dated decisions | rewriting current contracts |

## Registry rule

A new domain requires an explicit row here before it receives a new canonical owner. Two rows may not claim the same responsibility.

Placeholder language such as `when introduced` or `when extracted` means the responsibility is reserved but no implementation file should be created until the feature actually exists. Empty scaffolding does not count as architecture.

The current combined Apps Script file remains production code during migration. New backend work must follow the ownership rows above rather than adding more unrelated responsibility to the monolith.
