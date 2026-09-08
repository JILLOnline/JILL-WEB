# JILL Theme Core Domain Ownership

This registry answers one question: **where does this behavior belong?**

| Domain | Canonical owner | May consume | Must never own |
| --- | --- | --- | --- |
| Global design tokens / reset / typography / motion vocabulary | `theme/assets/jill-foundation.css.liquid` | Theme settings | component/page exceptions |
| Buttons, fields, pills, cards, notices, shared states | `theme/assets/jill-ui.css` + matching `theme/snippets/ui-*` | Foundation tokens | page/business rules |
| Header/footer/page/product/collection/cart composition | `theme/assets/jill-storefront.css` + matching section | UI primitives | duplicated primitives |
| Merchant global visual controls | `theme/config/settings_schema.json` | Design tokens | per-section one-off styling |
| Page composition | `theme/templates/*.json` | Sections | CSS, JS, business logic |
| Merchant-editable content units | `theme/blocks/*.liquid` | Internal snippets | duplicate primitive markup |
| Internal reusable markup | `theme/snippets/*.liquid` | Shopify objects/settings | independent merchant configuration |
| Product capability profile shape | `contracts/product-capability-profile.schema.json` | feature contract semantics | runtime state or merchant storage |
| Shopify product capability adapter | one adapter owner when introduced | Shopify-native product metafields/metaobjects, capability schema | a second active capability authority |
| Product capability resolution | one resolver owner when introduced | normalized Product Capability Profile | collection-name/product-family branches |
| Universal browser state vocabulary, field validation and stage progression | `theme/assets/jill-form-engine.js` | Product Capability field contracts, normalized form values, declarative stage dependencies | product-specific validators, DOM-derived truth, separate product/custom-order cascade engines |
| Universal form engine behavioral tests | `scripts/test-form-engine.mjs` | `jill-form-engine.js` public API | storefront implementation or business-specific behavior |
| Product behavior | `theme/assets/jill-product.js` when introduced | Shopify product DOM/contracts, shared primitives | customization engine internals |
| Cart behavior | `theme/assets/jill-cart.js` when introduced | Shopify cart routes | product/customization logic |
| Product customization engine | `theme/assets/jill-customization.js` when introduced | product capabilities, universal form engine | duplicated per-product-family engines |
| Product Options | one Product Options state/renderer owner when introduced | product capabilities, quantity owner, universal form engine | collection-specific option implementations |
| Personalization state/allocation | one personalization module within the customization domain when introduced | selected quantities, capabilities, universal form engine | product quantity mutation or DOM-derived business truth |
| Reference/file upload browser adapter | one upload adapter owner when introduced | configured file constraints, backend/storage transport | independent upload systems per form |
| Custom-order browser flow | `theme/assets/jill-custom-order.js` when introduced | universal form engine/customization/upload contracts | a second customization/validation engine |
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
