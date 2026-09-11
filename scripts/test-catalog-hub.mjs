import assert from 'node:assert/strict';
import fs from 'node:fs';

const section = fs.readFileSync('theme/sections/main-catalog-hub.liquid', 'utf8');
const storefrontStyles = fs.readFileSync('theme/assets/jill-storefront.css', 'utf8');
const uiStyles = fs.readFileSync('theme/assets/jill-ui.css', 'utf8');
const catalogRuntime = fs.readFileSync('theme/assets/jill-catalog.js', 'utf8');
const customOrderSection = fs.readFileSync('theme/sections/main-custom-order.liquid', 'utf8');
const customOrderRuntime = fs.readFileSync('theme/assets/jill-custom-order.js', 'utf8');

assert.match(section, /data-jill-catalog/, 'Catalog Hub must expose its canonical catalog root');
assert.match(section, /collections\['all'\]/, 'Catalog Hub must source products from Shopify catalog data');
assert.match(section, /paginate catalog_products by 250/, 'Catalog Hub must preserve a single Shopify-native product source');
assert.match(section, /data-jill-catalog-group=/, 'Catalog Hub must emit collection-owned product groups');
assert.match(section, /data-jill-catalog-group-title=/, 'Catalog Hub must expose group titles to the runtime');
assert.match(section, /data-jill-catalog-product/, 'Catalog Hub must expose canonical product cards to the runtime');
assert.match(section, /data-jill-catalog-product-id=/, 'Catalog product cards must expose stable Shopify product IDs');
assert.match(section, /data-jill-catalog-product-collections=/, 'Catalog cards must expose Shopify collection truth');
assert.match(section, /data-jill-catalog-product-title=/, 'Catalog cards must expose searchable product titles');
assert.match(section, /data-jill-catalog-search/, 'Catalog Hub must expose one canonical search input');
assert.match(section, /data-jill-catalog-search-clear/, 'Catalog Hub must expose a clear action through the catalog owner');
assert.match(section, /data-jill-catalog-empty/, 'Catalog Hub must expose one empty-state owner');
assert.match(section, /data-jill-catalog-result-count/, 'Catalog Hub must expose one result-count owner');
assert.match(section, /data-jill-catalog-search-wrap/, 'Catalog Hub must expose one search control wrapper');
assert.match(section, /data-jill-catalog-empty-query/, 'Catalog empty copy must expose the active query without duplicate state');
assert.match(section, /routes\.search_url/, 'Catalog Hub must preserve Shopify-native search navigation as the canonical URL contract');
assert.match(section, /href="{{ product\.url }}"/, 'Catalog product title must link to the canonical Shopify product page');
assert.match(section, /View product/, 'Catalog Hub must retain an explicit product-page action');
assert.match(section, /Custom order/, 'Catalog Hub must retain the canonical custom-order action');
assert.match(section, /product={{ product\.handle \| url_encode }}/, 'Custom-order action must pass stable product intent by handle');
assert.match(section, /data-display="catalog"/, 'Catalog Hub must opt into the canonical catalog-card display context');
assert.match(section, /data-kind="primary"/, 'Catalog product image must use the canonical primary-image behavior');
assert.match(section, /data-fit="contain"/, 'Catalog product image must use the canonical contain-fit behavior');
assert.match(section, /aspect-ratio:\s*1/, 'Catalog product image wrapper must own a square geometry');
assert.match(section, /loading="lazy"/, 'Catalog Hub product images must lazy-load');
assert.match(section, /{{ product\.featured_image\.alt \| default: product\.title \| escape }}/, 'Catalog Hub must use meaningful product image alt text');
assert.match(section, /widths:\s*'240, 360, 480, 640, 800'/, 'Catalog Hub must emit a responsive image srcset');
assert.match(section, /sizes:\s*'\(min-width: 990px\)/, 'Catalog Hub must emit responsive image sizing hints');
assert.doesNotMatch(section, /style=/, 'Catalog Hub must not use inline style ownership');
assert.doesNotMatch(section, /all_products\[/, 'Catalog Hub must not use Shopify all_products lookups');
assert.doesNotMatch(section, /product\.type|product\.tags|product\.handle contains/i, 'Catalog Hub must not infer product families from product type, tags, or handles');
assert.doesNotMatch(section, /Featured products|Browse products|Search products|Popular picks|Top picks/i, 'Catalog Hub must not reintroduce retired discovery chrome');
assert.doesNotMatch(section, /data-jill-catalog-featured/, 'Catalog Hub must not retain the retired featured-products region');
assert.doesNotMatch(section, /data-jill-catalog-browse/, 'Catalog Hub must not retain a duplicate browse-products region');
assert.doesNotMatch(section, /data-jill-catalog-search-submit/, 'Catalog Hub must not retain a second search-submit control');

const groupIndexes = [...section.matchAll(/data-jill-catalog-group="([^"]+)"/g)];
assert.ok(groupIndexes.length > 0, 'Catalog Hub must render collection groups');
assert.equal(new Set(groupIndexes.map((match) => match[1])).size, groupIndexes.length, 'Catalog Hub collection groups must be unique');

assert.match(catalogRuntime, /URLSearchParams/, 'Catalog Hub must read search state from the URL');
assert.match(catalogRuntime, /history\.replaceState/, 'Catalog Hub must keep the URL query synchronized without a reload');
assert.match(catalogRuntime, /data-jill-catalog-product-title/, 'Catalog runtime must search against Liquid-emitted product title truth');
assert.match(catalogRuntime, /data-jill-catalog-group-title/, 'Catalog runtime must preserve Liquid-emitted collection group truth');
assert.match(catalogRuntime, /data-jill-catalog-empty-query/, 'Catalog runtime must own dynamic empty-state query copy');
assert.match(catalogRuntime, /data-jill-catalog-search-wrap/, 'Catalog runtime must keep search-state presentation on the canonical search wrapper');
assert.match(catalogRuntime, /data-jill-catalog-search-clear/, 'Catalog runtime must own one clear-search interaction');
assert.match(catalogRuntime, /hiddenProductIds/, 'Catalog runtime must prevent cross-listed products from rendering twice');
assert.match(catalogRuntime, /visibleProductIds/, 'Catalog runtime must count unique visible products instead of duplicate collection memberships');
assert.doesNotMatch(catalogRuntime, /MutationObserver/, 'Catalog Hub must not use MutationObserver patch architecture');
assert.doesNotMatch(catalogRuntime, /setTimeout|requestAnimationFrame/, 'Catalog Hub must not use timer or animation-frame patch architecture');
assert.doesNotMatch(catalogRuntime, /innerHTML/, 'Catalog Hub runtime must not regenerate product-card markup');
assert.doesNotMatch(catalogRuntime, /fetch\(/, 'Catalog Hub must not duplicate Shopify catalog transport');
assert.doesNotMatch(catalogRuntime, /scrollIntoView/, 'Catalog search filtering must not force-scroll the customer on submit');

assert.match(storefrontStyles, /\.jill-catalog__group/, 'Catalog group visuals must stay in the storefront owner');
assert.match(storefrontStyles, /\.jill-catalog__group-title/, 'Catalog group heading visuals must stay in the storefront owner');
assert.match(storefrontStyles, /\.jill-catalog__products/, 'Catalog product-grid visuals must stay in the storefront owner');
assert.match(storefrontStyles, /\.jill-catalog__search-wrap/, 'Catalog search presentation must stay in the storefront owner');
assert.match(storefrontStyles, /\.jill-catalog__search-clear/, 'Catalog search clear affordance must stay in the storefront owner');
assert.match(storefrontStyles, /\.jill-catalog__empty/, 'Catalog empty-state visuals must stay in the storefront owner');
assert.match(storefrontStyles, /\.jill-product-card\[data-display='catalog'\]/, 'Catalog card surface must opt into a compact storefront-owned visual context');
assert.match(storefrontStyles, /\.jill-product-card\[data-display='catalog'\] \.jill-product-card__media\s*\{[^}]*width:\s*min\(100%,\s*13rem\);[^}]*justify-self:\s*center;/s, 'catalog product images must stay compact and centered inside their cards');
assert.match(storefrontStyles, /\.jill-product-card\[data-display='catalog'\] \.jill-product-card__media img\s*\{[^}]*object-fit:\s*contain;/s, 'catalog product images must preserve contain-fit behavior');
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
const orderType = {checked: false};
const collectionChoice = {
  checked: false,
  value: 'desired-collection',
  dataset: {collectionTitle: 'Desired Collection'},
};
const choice = {
  dataset: {productId: '123', productHandle: 'desired-product', collectionHandles: 'desired-collection'},
  querySelector(selector) {
    if (selector === '[data-jill-custom-order-select]') return select;
    if (selector === '[data-jill-product-projection-details]') return null;
    if (selector === '[data-jill-order-quantity] [data-jill-quantity-input]') return null;
    return null;
  },
};
const item = {
  hidden: true,
  ariaHidden: 'true',
  dataset: {jillProductId: '123', productHandle: 'desired-product'},
  setAttribute(name, value) { if (name === 'aria-hidden') this.ariaHidden = value; },
  querySelector(selector) {
    if (selector.includes('[data-jill-variant-allocation]')) return {};
    return null;
  },
};
const root = {
  dataset: {},
  querySelector(selector) {
    if (selector === '[name="order_type"][value="one"]') return orderType;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '[data-jill-product-choice]') return [choice];
    if (selector === '[data-jill-custom-order-item]') return [item];
    if (selector === '[data-jill-collection-choice]') return [collectionChoice];
    return [];
  },
};
assert.equal(globalThis.JILLCustomOrder.applyCatalogPrefill(root, '?product=desired-product'), true);
assert.equal(select.checked, true);
assert.equal(orderType.checked, true);
assert.equal(collectionChoice.checked, true);
assert.equal(item.hidden, false);
assert.equal(item.ariaHidden, 'false');
assert.equal(root.dataset.jillCustomOrderPrefilled, 'true');
select.checked = false;
item.hidden = true;
assert.equal(globalThis.JILLCustomOrder.applyCatalogPrefill(root, '?product=unknown'), false);
assert.equal(select.checked, false);
assert.equal(item.hidden, true);

console.log('JILL Catalog Hub tests passed.');