// Catalog cards intentionally tease; product pages own product detail and configuration context.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const section = fs.readFileSync('theme/sections/main-catalog-hub.liquid', 'utf8');
const standardCollection = fs.readFileSync('theme/sections/main-collection.liquid', 'utf8');
const template = JSON.parse(fs.readFileSync('theme/templates/collection.json', 'utf8'));
const productCard = fs.readFileSync('theme/snippets/product-card.liquid', 'utf8');
const catalogRuntime = fs.readFileSync('theme/assets/jill-catalog.js', 'utf8');
const storefrontStyles = fs.readFileSync('theme/assets/jill-storefront.css', 'utf8');
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
assert.equal(new URL(template.sections.catalog.settings.custom_order_url, 'https://example.com').searchParams.get('view'), 'custom-order', 'CLEAN handoff must use its isolated template without changing the live page assignment');
assert.ok(!categoryHandles.includes('shop-the-party'), 'Shop the Party is merchandising, not a catalog category');
assert.ok(!categoryHandles.includes('jill'), 'internal catch-all collection must not become a customer catalog group');

assert.doesNotMatch(section, /data-jill-catalog-category-link/, 'collection discovery cards belong to header navigation, not Catalog body');
assert.doesNotMatch(section, /data-jill-catalog-filter/, 'Catalog body must not duplicate header collection navigation with filter pills');
assert.match(section, /data-jill-catalog-group/, 'Catalog Hub must group products by configured Shopify collection');
assert.match(section, /JillCatalogCollection-/, 'catalog collection groups must expose stable anchors for future header navigation');
assert.match(section, /category_collection\.products/, 'each catalog collection must render its own available products');
assert.match(section, /data-jill-catalog-product-grid/, 'each collection group must own a canonical product grid');
assert.match(section, /render 'product-card'/, 'Catalog Hub must reuse the canonical Product Card');
assert.match(section, /featured_collection\.products/, 'featured merchandising must come from the configured Shopify collection');
assert.match(section, /block\.type == 'creation'/, 'real-work gallery must be merchant configurable');
assert.match(section, /block\.type == 'testimonial'/, 'testimonials must be merchant supplied');
assert.doesNotMatch(section, /Add to cart|name="id"|\/cart\/add/i, 'Catalog Hub must not become another product configurator');

assert.doesNotMatch(productCard, /render 'catalog-product-summary'/, 'Catalog cards must not expose Product Options or personalization summaries');
assert.match(productCard, /catalog\.card\.teaser_/, 'Catalog cards must use curiosity-driven teaser copy instead of product instructions');
assert.match(productCard, /jill-product-card__teaser/, 'Catalog cards must expose one intentional teaser copy surface');
assert.doesNotMatch(productCard, /truncatewords: 34/, 'Catalog cards must not reproduce shortened product descriptions');
assert.match(productCard, /custom_order_url/, 'catalog product cards must support contextual Custom Order handoff');
assert.match(productCard, /product=/, 'contextual handoff must preserve the selected product handle');
assert.match(productCard, /heading_tag/, 'canonical Product Card must accept the semantic heading level from its composition owner');
assert.doesNotMatch(productCard, /card_product\.images/, 'catalog cards must keep one strong thumbnail instead of a secondary gallery');

assert.doesNotMatch(storefrontStyles, /jill-catalog__collection-grid|jill-catalog-collection__/, 'removed Catalog discovery cards must not leave dead style owners behind');
assert.doesNotMatch(storefrontStyles, /jill-catalog__filters/, 'removed Catalog filter pills must not leave dead style owners behind');
assert.doesNotMatch(storefrontStyles, /jill-product-card__thumbnails|jill-product-card__thumbnail/, 'removed Catalog secondary thumbnails must not leave dead style owners behind');
assert.match(storefrontStyles, /data-jill-catalog-group/, 'grouped Catalog composition must have one explicit visual owner');
assert.match(storefrontStyles, /minmax\(min\(100%, 21rem\), 1fr\)/, 'Catalog cards must remain broad enough for product-led discovery');

assert.match(catalogRuntime, /data-jill-catalog-group/, 'catalog runtime must search within canonical collection groups');
assert.match(catalogRuntime, /data-jill-catalog-product/, 'catalog runtime must filter canonical rendered product cards');
assert.doesNotMatch(catalogRuntime, /data-jill-catalog-filter|data-jill-catalog-category-link/, 'catalog runtime must not duplicate future header collection navigation');
assert.doesNotMatch(catalogRuntime, /Snack|Pinata|Piñata|Apparel|Hoodie|Tote/i, 'catalog runtime must remain product-family agnostic');
assert.doesNotMatch(catalogRuntime, /MutationObserver|setTimeout|setInterval/, 'catalog search must be deterministic and event driven');
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
select.checked = false;
details.hidden = true;
assert.equal(globalThis.JILLCustomOrder.applyCatalogPrefill(root, '?product=unknown'), false);
assert.equal(select.checked, false);
assert.equal(details.hidden, true);

const makeControl = (dataset = {}) => ({
  dataset, handlers: {}, attributes: {},
  addEventListener(name, handler) { (this.handlers[name] ||= []).push(handler); },
  setAttribute(name, value) { this.attributes[name] = value; },
  fire(name, event = {}) { this.handlers[name]?.forEach((handler) => handler(event)); },
});
const alpha = {dataset: {search: 'Alpha party piece'}, hidden: false};
const beta = {dataset: {search: 'Beta celebration piece'}, hidden: false};
const firstGroupCount = {};
const secondGroupCount = {};
const firstGroup = {
  hidden: false,
  querySelectorAll(selector) { return selector === '[data-jill-catalog-product]' ? [alpha] : []; },
  querySelector(selector) { return selector === '[data-jill-catalog-group-count]' ? firstGroupCount : null; },
};
const secondGroup = {
  hidden: false,
  querySelectorAll(selector) { return selector === '[data-jill-catalog-product]' ? [beta] : []; },
  querySelector(selector) { return selector === '[data-jill-catalog-group-count]' ? secondGroupCount : null; },
};
const search = makeControl();
const count = {};
const empty = {};
const catalogRoot = {
  dataset: {resultSingular: 'product', resultPlural: 'products'},
  querySelectorAll(selector) {
    return selector === '[data-jill-catalog-group]' ? [firstGroup, secondGroup] : [];
  },
  querySelector(selector) {
    return {
      '[id^="JillCatalogSearch-"]': search,
      '[data-jill-catalog-results-count]': count,
      '[data-jill-catalog-empty]': empty,
    }[selector];
  },
};
const document = makeControl();
document.querySelectorAll = () => [catalogRoot];
vm.runInNewContext(catalogRuntime, {document});
assert.equal(count.textContent, '2 products');
assert.equal(firstGroupCount.textContent, '1 product');
assert.equal(secondGroupCount.textContent, '1 product');
search.value = 'Beta';
search.fire('input');
assert.equal(alpha.hidden, true);
assert.equal(beta.hidden, false);
assert.equal(firstGroup.hidden, true);
assert.equal(secondGroup.hidden, false);
assert.equal(count.textContent, '1 product');
assert.equal(empty.hidden, true);
search.value = 'no match';
search.fire('input');
assert.equal(firstGroup.hidden, true);
assert.equal(secondGroup.hidden, true);
assert.equal(count.textContent, '0 products');
assert.equal(empty.hidden, false);
search.value = '';
search.fire('input');
assert.equal(alpha.hidden, false);
assert.equal(beta.hidden, false);
assert.equal(firstGroup.hidden, false);
assert.equal(secondGroup.hidden, false);
document.fire('shopify:section:load', {target: document});
assert.equal(search.handlers.input.length, 1, 'section reinitialization must not duplicate listeners');

console.log('JILL Catalog Hub tests passed.');