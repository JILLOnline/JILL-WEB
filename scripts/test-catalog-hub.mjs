import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('theme/sections/main-catalog-hub.liquid', 'utf8');
const standardCollection = fs.readFileSync('theme/sections/main-collection.liquid', 'utf8');
const template = JSON.parse(fs.readFileSync('theme/templates/collection.json', 'utf8'));
const productCard = fs.readFileSync('theme/snippets/product-card.liquid', 'utf8');
const summary = fs.readFileSync('theme/snippets/catalog-product-summary.liquid', 'utf8');
const catalogRuntime = fs.readFileSync('theme/assets/jill-catalog.js', 'utf8');
const layout = fs.readFileSync('theme/layout/theme.liquid', 'utf8');
const customOrderSection = fs.readFileSync('theme/sections/main-custom-order.liquid', 'utf8');
const customOrderRuntime = fs.readFileSync('theme/assets/jill-custom-order.js', 'utf8');

assert.match(section, /collection\.handle == 'all'/, 'Catalog Hub must own only the built-in all-products route');
assert.match(standardCollection, /unless collection\.handle == 'all'/, 'standard collection composition must yield the all-products route to Catalog Hub');
assert.equal(template.sections.catalog.type, 'main-catalog-hub');
assert.equal(template.sections.main.type, 'main-collection');
assert.deepEqual(template.order, ['catalog', 'main']);

const categoryHandles = template.sections.catalog.block_order.map(
  (blockId) => template.sections.catalog.blocks[blockId].settings.collection,
);
assert.deepEqual(categoryHandles, [
  'pinatas',
  'catalog',
  'kid-activities',
  'party-supplies',
  'apparel-gifts-dtf-sublimation',
]);
assert.equal(template.sections.catalog.settings.featured_collection, 'shop-the-party');
assert.ok(!categoryHandles.includes('shop-the-party'), 'Shop the Party is merchandising, not a catalog category');
assert.ok(!categoryHandles.includes('jill'), 'internal catch-all collection must not become customer category navigation');

assert.match(section, /data-jill-catalog-category-link/, 'collection cards must hand off to the canonical catalog filter');
assert.match(section, /data-jill-catalog-filter/, 'Catalog Hub must expose accessible category filters');
assert.match(section, /data-jill-catalog-product-grid/, 'Catalog Hub must own one complete product grid');
assert.match(section, /render 'product-card'/, 'Catalog Hub must reuse the canonical Product Card');
assert.match(section, /featured_collection\.products/, 'featured merchandising must come from the configured Shopify collection');
assert.match(section, /block\.type == 'creation'/, 'real-work gallery must be merchant configurable');
assert.match(section, /block\.type == 'testimonial'/, 'testimonials must be merchant supplied');
assert.doesNotMatch(section, /Add to cart|name="id"|\/cart\/add/i, 'Catalog Hub must not become another product configurator');

assert.match(productCard, /render 'catalog-product-summary'/, 'catalog product cards must consume the catalog summary adapter');
assert.match(productCard, /custom_order_url/, 'catalog product cards must support contextual Custom Order handoff');
assert.match(productCard, /product=/, 'contextual handoff must preserve the selected product handle');
assert.match(productCard, /card_product\.images/, 'catalog mode must support additional product imagery');

assert.match(summary, /jill_product_capabilities/, 'catalog summary must consume the canonical capability metafield');
assert.match(summary, /jill_product_page_capability_override/, 'catalog summary must respect listing-surface projection');
assert.match(summary, /options_with_values/, 'catalog summary must consume Shopify-native product variations');
assert.match(summary, /product_options/, 'catalog summary may summarize Product Options capability data');
assert.match(summary, /personalizationAllocation/, 'catalog summary may summarize personalization capability data');
assert.doesNotMatch(summary, /Snack Bags|Pinata|Piñata|Hoodie|T-Shirt|Tote/i, 'catalog summary must remain product-family agnostic');

assert.match(catalogRuntime, /data-jill-catalog-filter/, 'catalog runtime must own category filtering');
assert.match(catalogRuntime, /data-jill-catalog-category-link/, 'collection discovery cards must use the same filter owner');
assert.match(catalogRuntime, /data-jill-catalog-product/, 'catalog runtime filters canonical rendered product cards');
assert.doesNotMatch(catalogRuntime, /Snack|Pinata|Piñata|Apparel|Hoodie|Tote/i, 'catalog runtime must remain product-family agnostic');
assert.doesNotMatch(catalogRuntime, /MutationObserver|setTimeout|setInterval/, 'catalog filtering must be deterministic and event driven');
assert.match(layout, /request\.page_type == 'collection' and collection\.handle == 'all'/, 'catalog JavaScript must load only on the Catalog route');
assert.match(layout, /jill-catalog\.js/, 'Catalog route must load the canonical catalog runtime');

assert.match(customOrderSection, /data-product-handle=/, 'Custom Order items must expose stable product handles for catalog handoff');
assert.match(customOrderRuntime, /URLSearchParams/, 'Custom Order must read contextual catalog intent from the URL');
assert.match(customOrderRuntime, /applyCatalogPrefill/, 'Custom Order must have one contextual preselection adapter');

await import('../theme/assets/jill-catalog.js');
assert.equal(globalThis.JILLCatalog.normalize('  Mini SNACK Bags  '), 'mini snack bags');

await import('../theme/assets/jill-custom-order.js');
assert.equal(globalThis.JILLCustomOrder.requestedProductHandle('?product=party-favors-snack-bags-custom-theme-99329'), 'party-favors-snack-bags-custom-theme-99329');
assert.equal(globalThis.JILLCustomOrder.requestedProductHandle('?foo=bar'), '');

const select = {checked: false};
const details = {hidden: true, ariaHidden: 'true', setAttribute(name, value) { if (name === 'aria-hidden') this.ariaHidden = value; }};
const item = {
  dataset: {productHandle: 'desired-product'},
  querySelector(selector) {
    if (selector === '[data-jill-custom-order-select]') return select;
    if (selector === '[data-jill-custom-order-details]') return details;
    return null;
  },
};
const root = {
  dataset: {},
  querySelectorAll(selector) {
    return selector === '[data-jill-custom-order-item]' ? [item] : [];
  },
};
assert.equal(globalThis.JILLCustomOrder.applyCatalogPrefill(root, '?product=desired-product'), true);
assert.equal(select.checked, true);
assert.equal(details.hidden, false);
assert.equal(details.ariaHidden, 'false');
assert.equal(root.dataset.jillCustomOrderPrefilled, 'true');

console.log('JILL Catalog Hub tests passed.');
