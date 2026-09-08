# JILL Theme Core Architecture

## Repository boundary

`JILL-WEB` is the product repository. The sellable storefront theme lives in `theme/`. JILL-specific backends and account extensions stay outside the sellable theme.

```text
JILL-WEB/
├── .github/                 CI and deployment only
├── backend/                 privileged/server-side business authority
├── contracts/               machine-readable cross-layer product contracts
├── docs/                    constitutions, contracts, decisions, QA
├── extensions/              Shopify app/customer-account extensions
├── scripts/                 guards, tests, build/release tooling
├── shared/                  cross-extension code with an explicit owner
└── theme/                   sellable Shopify Theme Core
```

### `contracts/` — normalized machine contracts

`contracts/` owns data shapes that must be shared conceptually across storefront features, migration tooling and future adapters without hard-coding a product family into an engine.

Current owner:

- `product-capability-profile.schema.json` — versioned normalized contract describing configurable product fields, field dependencies and shared behavior features such as personalization allocation, date planning and reference upload.

A contract defines shape and semantics; it does not become a second runtime state owner. Shopify-specific storage/adapters normalize merchant data into the contract, and runtime feature engines consume the normalized result.

No product family such as piñata, apparel, favor or gift receives its own schema. Those are profile configurations of the same contract.

## Shopify theme boundary

Shopify supports the standard theme directories below. Theme Core does not invent unsupported nested architecture.

```text
theme/
├── assets/
├── blocks/
├── config/
├── layout/
├── locales/
├── sections/
├── snippets/
└── templates/
```

### `assets/` — presentation and browser behavior

Assets are flat, so filenames carry ownership.

CSS is intentionally limited to three canonical owners:

- `jill-foundation.css.liquid` — cascade order, merchant-generated design tokens, reset, typography, global document/layout primitives, accessibility baseline.
- `jill-ui.css` — reusable visual primitives only: buttons, fields, pills, cards, notices, dialogs, quantities, loaders and shared states.
- `jill-storefront.css` — storefront compositions only: header, footer, navigation, product/collection/cart/page structures and section composition.

No fourth stylesheet is created without an architecture decision. A feature that needs a new visual treatment extends the appropriate existing owner.

JavaScript follows feature ownership and is loaded only where needed. Target names are descriptive owners such as:

- `jill-product.js`
- `jill-cart.js`
- `jill-customization.js`
- `jill-custom-order.js`
- `jill-dialog.js` only if dialog behavior becomes independently reusable

Shared behavior moves upward to one shared owner rather than being copied between feature files.

Media assets use semantic names (`jill-icon-cart.svg`, not `icon-final-2.svg`).

### `snippets/` — internal reusable primitives

Snippets are implementation details. Merchants do not arrange them directly.

Canonical families:

- `ui-*` — one markup owner for each UI primitive (`ui-button.liquid`, `ui-field.liquid`, `ui-pill.liquid`, `ui-icon.liquid`).
- `product-*` — reusable product internals (`product-card.liquid`, `product-price.liquid`, etc.).
- platform/shared utilities — `meta-tags.liquid`, `structured-data.liquid`, `pagination.liquid`, localization helpers.

If two sections need the same markup concept, the markup moves to a snippet rather than being copied.

### `blocks/` — merchant-editable units

Blocks expose content/configuration and render canonical snippets. A block must not reimplement the primitive it represents.

Target block families:

- content: `heading.liquid`, `text.liquid`, `image.liquid`, `button.liquid`, `spacer.liquid`
- product: `product-title.liquid`, `product-price.liquid`, `product-variant-picker.liquid`, `product-quantity.liquid`, `product-buy-buttons.liquid`, `product-description.liquid`, `product-customization.liquid`

### `sections/` — composition owners

Sections compose blocks and platform data. They do not define a private button system, field system, modal system, or business engine.

Canonical core targets:

- shell: `announcement-bar.liquid`, `header.liquid`, `footer.liquid`
- commerce: `main-product.liquid`, `main-collection.liquid`, `main-cart.liquid`, `main-search.liquid`
- content: `main-page.liquid`, `main-blog.liquid`, `main-article.liquid`, `main-404.liquid`
- flexible: `rich-text.liquid`, `image-banner.liquid`, `featured-collection.liquid`, `featured-product.liquid`, `multicolumn.liquid`, `custom-liquid.liquid`
- customizable-commerce: `custom-order.liquid` and other genuinely distinct business compositions only
- groups: `header-group.json`, `footer-group.json`

Names like `final`, `fix`, `cleanup`, `polish`, `override`, and numbered authority fragments are forbidden.

### `templates/` — page composition only

JSON templates reference sections; they do not own CSS or business logic.

Core targets:

`index.json`, `product.json`, `collection.json`, `cart.json`, `search.json`, `page.json`, `list-collections.json`, `blog.json`, `article.json`, `404.json`, `password.json`, plus `gift_card.liquid` where Shopify requires the Liquid exception. `templates/metaobject/` is added only when a real metaobject template is required.

### `config/` — global merchant controls

- `settings_schema.json` defines global design-system and theme behavior settings.
- `settings_data.json` is Shopify-managed merchant state/defaults.

Visual settings are global tokens. Sections may choose a semantic variant or color scheme, but cannot invent local radii, local button systems, or arbitrary component styling.

### `locales/` — merchant/customer language

`en.default.json` and its schema are canonical source strings. Additional locales mirror the same key structure. JILL-specific bilingual content is not hard-coded into component markup.

### `layout/` — document shell

`theme.liquid` owns the HTML document, global asset loading, header/footer section groups, main landmark and Shopify platform hooks. It does not contain visual CSS or executable inline JavaScript.

## Product capability data path

The normalized direction is:

`Shopify merchant data → one Shopify capability adapter → Product Capability Profile v1 → shared validation/progression/customization engines → UI primitives`

The adapter may use Shopify-native custom data such as product metafields/metaobject references, but only one active authority may produce the normalized profile for a merchant implementation. Collection-name inference and product-family conditionals are not capability authorities.

Theme Core remains fully functional for standard Shopify products when no custom capability profile is present.

## CSS cascade

The fixed cascade is:

`foundation → ui → storefront`

There are no override/utility escape-hatch layers. Responsive design prefers fluid primitives (`clamp`, grid/flex, logical properties, intrinsic sizing) over repeated override rules.

## Ownership test before every change

Before code is added, answer:

1. What domain is changing?
2. What file owns it now?
3. Can the current owner express the new requirement through configuration or a semantic variant?
4. Would this create another owner?
5. What becomes obsolete after the change?
6. What automated guard/test protects the invariant?

If #2 has no clear answer, ownership is defined before implementation.
