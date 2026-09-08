# JILL Theme Core Domain Ownership

This registry answers one question: **where does this behavior belong?**

| Domain | Canonical owner | May consume | Must never own |
| --- | --- | --- | --- |
| Global design tokens / reset / typography | `theme/assets/jill-foundation.css.liquid` | Theme settings | component/page exceptions |
| Buttons, fields, pills, cards, notices, shared states | `theme/assets/jill-ui.css` + matching `theme/snippets/ui-*` | Foundation tokens | page/business rules |
| Header/footer/page/product/collection/cart composition | `theme/assets/jill-storefront.css` + matching section | UI primitives | duplicated primitives |
| Merchant global visual controls | `theme/config/settings_schema.json` | Design tokens | per-section one-off styling |
| Page composition | `theme/templates/*.json` | Sections | CSS, JS, business logic |
| Merchant-editable content units | `theme/blocks/*.liquid` | Internal snippets | duplicate primitive markup |
| Internal reusable markup | `theme/snippets/*.liquid` | Shopify objects/settings | independent merchant configuration |
| Product behavior | `theme/assets/jill-product.js` when introduced | DOM contracts, shared primitives | customization engine internals |
| Cart behavior | `theme/assets/jill-cart.js` when introduced | Shopify cart routes | product/customization logic |
| Product customization engine | `theme/assets/jill-customization.js` when introduced | product capabilities/config | duplicated per-product-family engines |
| Custom-order flow | `theme/assets/jill-custom-order.js` when introduced | shared validation/customization contracts | a second customization engine |
| Rewards accounting/integrity | backend/rewards authority | Shopify/admin data | storefront presentation files |
| Rewards customer state derivation | existing rewards state module | backend response | reward accounting |
| Customer Account shared presentation | `shared/customer-account-ui.jsx` | account extension state | reward accounting/business truth |

## Registry rule

A new domain requires an explicit row here before it receives a new canonical owner. Two rows may not claim the same responsibility.
