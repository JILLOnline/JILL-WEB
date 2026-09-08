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
| Product capability definitions/resolution | product-capabilities owner when introduced | Shopify product/collection configuration | duplicated product-family engines |
| Global form validation / required-state semantics | validation engine owner when introduced | field/capability contracts | product-specific validation copies |
| Cascading/progressive disclosure | progression engine owner when introduced | validation state/dependency config | separate product/custom-order cascade engines |
| Product behavior | `theme/assets/jill-product.js` when introduced | Shopify product DOM/contracts, shared primitives | customization engine internals |
| Cart behavior | `theme/assets/jill-cart.js` when introduced | Shopify cart routes | product/customization logic |
| Product customization engine | `theme/assets/jill-customization.js` when introduced | product capabilities, validation/progression | duplicated per-product-family engines |
| Product Options | one Product Options state/renderer owner when introduced | product capabilities, quantity owner, validation | collection-specific option implementations |
| Personalization state/allocation | one personalization module within the customization domain when introduced | selected quantities, capabilities, validation | product quantity mutation or DOM-derived business truth |
| Reference/file upload adapter | one upload adapter owner when introduced | configured file constraints, backend/platform transport | independent upload systems per form |
| Custom-order flow | `theme/assets/jill-custom-order.js` when introduced | shared validation/customization/upload contracts | a second customization/validation engine |
| Custom-order persistence / privileged sync | backend custom-order authority | validated request payload | storefront rendering/design |
| SEO/meta/structured data | canonical SEO snippets | Shopify objects/settings | page-local duplicated metadata systems |
| Localization strings | `theme/locales/*` | canonical translation keys | hard-coded duplicated merchant/customer strings |
| Theme Editor lifecycle integration | feature owner requiring lifecycle support | Shopify section events | global reinitialization observers |
| Rewards accounting/integrity | backend/rewards authority | Shopify/admin data | storefront presentation files |
| Rewards customer state derivation | existing rewards state module | backend response | reward accounting |
| Customer Account shared presentation | `shared/customer-account-ui.jsx` | account extension state | reward accounting/business truth |
| Migration procedure/status | `docs/MIGRATION_BLUEPRINT.md` | feature contracts/QA evidence | implementation behavior |
| Certification requirements | `docs/QA_CERTIFICATION.md` | architecture/feature contracts | production business rules |
| Durable JILL product history/context | `docs/PROJECT_CONTEXT.md` | historical evidence | normative implementation ownership |
| Architecture decision history | `docs/DECISIONS.md` | dated decisions | rewriting current contracts |

## Registry rule

A new domain requires an explicit row here before it receives a new canonical owner. Two rows may not claim the same responsibility.

Placeholder language such as `when introduced` means the responsibility is reserved but no implementation file should be created until the feature actually exists. Empty scaffolding does not count as architecture.