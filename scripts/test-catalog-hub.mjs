// Catalog cards stay concise; product pages own detail and configuration context.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('theme/sections/main-catalog-hub.liquid', 'utf8');
const standardCollection = fs.readFileSync('theme/sections/main-collection.liquid', 'utf8');
const template = JSON.parse(fs.readFileSync('theme/templates/collection.json', 'utf8'));
const productCard = fs.readFileSync('theme/snippets/product-card.liquid', 'utf8');
const storefrontStyles = fs.readFileSync('theme/assets/jill-storefront.css', 'utf8');
const uiStyles = fs.readFileSync('theme/assets/jill-ui.css', 'utf8');
const disclosureStyles = fs.readFileSync('theme/assets/jill-catalog-disclosure.css', 'utf8');
const disclosureRuntime = fs.readFileSync('theme/assets/jill-catalog-disclosure.js', 'utf8');
const locale = JSON.parse(fs.readFileSync('theme/locales/en.default.json', 'utf8'));
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
assert.match(section, /data-jill-catalog-accordion/, 'Catalog collections must share one accordion owner');
assert.match(section, /<button[^>]*data-jill-catalog-trigger/s, 'collection controls must be stable pill buttons');
assert.match(section, /data-jill-catalog-panel/, 'collection content must render in a dedicated panel row below the pill dock');
assert.match(section, /data-jill-catalog-panel[\s\S]*?hidden/, 'collection panels must start hidden until their pill is activated');
assert.doesNotMatch(section, /jill-catalog-disclosure__count/, 'collection pills must not render product-count text');
assert.match(section, /data-jill-catalog-group/, 'Catalog Hub must group products by configured Shopify collection');
assert.match(section, /JillCatalogCollection-/, 'catalog collection groups must expose stable anchors for header navigation');
assert.match(section, /category_collection\.products/, 'each catalog collection must render its own available products');
assert.match(section, /jill-catalog__product-grid/, 'each collection group must use the canonical product grid');
assert.match(section, /render 'product-card'/, 'Catalog Hub must reuse the canonical Product Card');
assert.match(section, /featured_collection\.products/, 'featured merchandising must come from the configured Shopify collection');
assert.match(section, /jill-catalog-disclosure--featured/, 'featured merchandising must remain independently collapsible');
assert.doesNotMatch(section, /featured_eyebrow|FEATURED RIGHT NOW/i, 'featured Catalog shelf must not render or configure an eyebrow label');
assert.match(section, /block\.type == 'creation'/, 'real-work gallery must be merchant configurable');
assert.match(section, /block\.type == 'testimonial'/, 'testimonials must be merchant supplied');
assert.doesNotMatch(section, /Add to cart|name="id"|\/cart\/add/i, 'Catalog Hub must not become another product configurator');

assert.doesNotMatch(section, /JillCatalogSearch|show_search|browse_label|Browse products|type:\s*'search'/i, 'Catalog must not own duplicate browse or search controls');
assert.doesNotMatch(layout, /jill-catalog\.js/, 'obsolete Catalog search runtime must not return');
assert.equal(fs.existsSync('theme/assets/jill-catalog.js'), false, 'obsolete Catalog search runtime must remain removed');
assert.match(layout, /is_catalog_hub/, 'catalog-only disclosure assets must be route scoped');
assert.match(layout, /jill-catalog-disclosure\.css/, 'catalog disclosure styles must load from one dedicated owner');
assert.match(layout, /jill-catalog-disclosure\.js/, 'catalog disclosure behavior must load from one dedicated owner');
assert.match(disclosureRuntime, /hashchange/, 'collection dock anchors must open their targeted catalog collection');
assert.match(disclosureRuntime, /setActiveTrigger/, 'catalog collections must have one accordion state owner');
assert.match(disclosureRuntime, /querySelectorAll\(triggerSelector\)/, 'accordion activation must reconcile every sibling trigger');
assert.match(disclosureRuntime, /panel\.hidden = !active/, 'accordion activation must show only the active panel');

assert.doesNotMatch(productCard, /render 'catalog-product-summary'/, 'Catalog cards must not expose Product Options or personalization summaries');
assert.doesNotMatch(productCard, /catalog_teaser|catalog\.card\.teaser_|jill-product-card__teaser/, 'product cards must not render teaser sentences');
assert.equal('teaser_1' in locale.catalog.card, false, 'removed teaser copy must not remain in locales');
assert.equal('teaser_2' in locale.catalog.card, false, 'removed teaser copy must not remain in locales');
assert.equal('teaser_3' in locale.catalog.card, false, 'removed teaser copy must not remain in locales');
assert.equal('teaser_4' in locale.catalog.card, false, 'removed teaser copy must not remain in locales');
assert.doesNotMatch(productCard, /truncatewords: 34/, 'Catalog cards must not reproduce shortened product descriptions');
assert.match(productCard, /custom_order_url/, 'catalog product cards must support contextual Custom Order handoff');
assert.match(productCard, /product=/, 'contextual handoff must preserve the selected product handle');
assert.match(productCard, /heading_tag/, 'canonical Product Card must accept the semantic heading level from its composition owner');
assert.match(productCard, /data-jill-product-card-media/, 'canonical Product Card must expose one media-surface hook');
assert.doesNotMatch(productCard, /card_product\.images/, 'catalog cards must keep one strong thumbnail instead of a secondary gallery');
assert.doesNotMatch(productCard, /data-search|data-jill-catalog-product|assign catalog_search/, 'removed Catalog search must leave no product-card search metadata behind');

assert.doesNotMatch(storefrontStyles, /jill-catalog__collection-grid|jill-catalog-collection__/, 'removed Catalog discovery cards must not leave dead style owners behind');
assert.doesNotMatch(storefrontStyles, /jill-catalog__filters/, 'removed Catalog filter pills must not leave dead style owners behind');
assert.doesNotMatch(storefrontStyles, /jill-product-card__thumbnails|jill-product-card__thumbnail/, 'removed Catalog secondary thumbnails must not leave dead style owners behind');
assert.doesNotMatch(storefrontStyles, /jill-catalog__hero(?:-title|-text|-actions)?/, 'removed Catalog hero must not leave dead style owners behind');
assert.match(storefrontStyles, /\.jill-product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 18rem\), 18rem\)\);[^}]*justify-content:\s*center;/s, 'all product grids must use the same centered reference width');
assert.match(storefrontStyles, /\.jill-catalog__featured-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 18rem\), 18rem\)\);[^}]*justify-content:\s*center;/s, 'featured products must use the canonical reference width');
assert.match(storefrontStyles, /\.jill-catalog__product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit, minmax\(min\(100%, 18rem\), 18rem\)\);[^}]*justify-content:\s*center;/s, 'catalog collection groups must use the canonical reference width');
assert.match(storefrontStyles, /\.jill-product-card\[data-display='catalog'\]\s*\{[^}]*max-width:\s*18rem;[^}]*padding:\s*calc\(var\(--jill-space-unit\) \* 2\);/s, 'catalog cards must hug the thumbnail frame at one canonical width');
assert.match(storefrontStyles, /\.jill-product-card\[data-display='catalog'\] \.jill-product-card__media\s*\{[^}]*aspect-ratio:\s*1;/s, 'catalog thumbnails must share one square reference frame');
assert.match(storefrontStyles, /\.jill-product-card\[data-display='catalog'\] \.jill-product-card__image\s*\{[^}]*object-fit:\s*contain;[^}]*object-position:\s*center;/s, 'Catalog thumbnails must show the full product instead of cropping it');
assert.match(disclosureStyles, /\[data-jill-product-card-media\]\s*\{[^}]*background:\s*var\(--jill-color-background\);/s, 'unused thumbnail canvas must be white');
assert.match(disclosureStyles, /\.jill-catalog-disclosure__pill\s*\{[^}]*border-radius:\s*999px;/s, 'collapsed collections must render as pills');
assert.match(disclosureStyles, /\.jill-catalog-disclosure-list\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s, 'collection pills must stay on one stable horizontal rail');
assert.match(disclosureStyles, /\.jill-catalog-accordion__panel\s*\{[^}]*width:\s*100%;/s, 'active collection content must open in a full-width row under the pill rail');
assert.match(disclosureStyles, /\.jill-catalog-disclosure__content:not\(\[hidden\]\)\s*\{[^}]*display:\s*grid;/s, 'shared content layout must apply only to visible collection panels');
assert.doesNotMatch(disclosureStyles, /\.jill-catalog-disclosure__content\s*\{[^}]*display:\s*grid;/s, 'base content styling must never override the hidden panel state');
assert.match(disclosureStyles, /\.jill-catalog-disclosure\[open\]\s*\{/, 'featured merchandising must retain its expanded content surface');
assert.match(storefrontStyles, /\.jill-product-card__actions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s, 'catalog product actions must use one compact two-button layout');
assert.doesNotMatch(storefrontStyles, /\.jill-catalog__featured-grid \.jill-product-card/, 'featured merchandising must not fork canonical product-card sizing');
assert.doesNotMatch(uiStyles, /jill-product-card\[data-display='catalog'\]/, 'Catalog product-card visuals belong to the storefront owner, not the generic UI layer');

assert.match(customOrderSection, /data-product-handle=/, 'Custom Order items must expose stable product handles for catalog handoff');
assert.match(customOrderRuntime, /URLSearchParams/, 'Custom Order must read contextual catalog intent from the URL');
assert.match(customOrderRuntime, /applyCatalogPrefill/, 'Custom Order must have one contextual preselection adapter');

await import('../theme/assets/jill-custom-order.js');
assert.equal(globalThis.JILLCustomOrder.requestedProductHandle('?product=party-favors-snack-bags-custom-theme-99329'), 'party-favors-snack-bags-custom-theme-99329');
assert.equal(globalThis.JILLCustomOrder.requestedProductHandle('?foo=bar'), '');

const select = {checked: false};
const choice = {
  dataset: {productId: '123', productHandle: 'desired-product'},
  querySelector(selector) {
    if (selector === '[data-jill-custom-order-select]') return select;
    return null;
  },
};
const item = {
  hidden: true,
  ariaHidden: 'true',
  dataset: {jillProductId: '123', productHandle: 'desired-product'},
  setAttribute(name, value) { if (name === 'aria-hidden') this.ariaHidden = value; },
};
const root = {
  dataset: {},
  querySelectorAll(selector) {
    if (selector === '[data-jill-product-choice]') return [choice];
    if (selector === '[data-jill-custom-order-item]') return [item];
    return [];
  },
};
assert.equal(globalThis.JILLCustomOrder.applyCatalogPrefill(root, '?product=desired-product'), true);
assert.equal(select.checked, true);
assert.equal(item.hidden, false);
assert.equal(item.ariaHidden, 'false');
assert.equal(root.dataset.jillCustomOrderPrefilled, 'true');
select.checked = false;
item.hidden = true;
assert.equal(globalThis.JILLCustomOrder.applyCatalogPrefill(root, '?product=unknown'), false);
assert.equal(select.checked, false);
assert.equal(item.hidden, true);

console.log('JILL Catalog Hub tests passed.');
