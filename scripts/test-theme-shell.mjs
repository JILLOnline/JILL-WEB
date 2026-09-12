import fs from 'node:fs';

function fail(message) {
  throw new Error(`Theme shell test failed: ${message}`);
}

function read(path) {
  if (!fs.existsSync(path)) fail(`${path} is missing`);
  return fs.readFileSync(path, 'utf8');
}

function includesAll(source, owner, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`${owner} is missing ${marker}`);
  }
}

function assertSingleSectionTemplate(templatePath, expectedType) {
  const template = JSON.parse(read(templatePath));
  const sections = Object.values(template.sections || {});
  if (sections.length !== 1 || sections[0].type !== expectedType) {
    fail(`${templatePath} must have one canonical ${expectedType} owner`);
  }
  return template;
}

const header = read('theme/sections/header.liquid');
includesAll(header, 'header', [
  'data-jill-header-drawer',
  "render 'ui-icon', name: 'menu'",
  "render 'ui-icon', name: 'search'",
  "render 'ui-icon', name: 'account'",
  "render 'ui-icon', name: 'cart'",
  "render 'header-socials'",
  "render 'header-localization'",
  "render 'jill-category-dock'",
  'data-jill-header-search',
  'data-jill-header-search-toggle',
  'data-jill-header-search-input',
  'action="{{ routes.search_url }}"',
  'name="q"',
  'settings.brand_logo',
  'section.settings.menu.links',
  'routes.all_products_collection_url',
  '/pages/quote?view=custom-order',
  'fallback_contact_page',
  'fallback_about_page',
  '{{ fallback_contact_page.url }}',
  '{{ fallback_about_page.url }}',
]);
if (header.includes('href="{{ routes.search_url }}"')) {
  fail('header search must expand into its input instead of navigating before a query exists');
}

for (const forbidden of ['<style', 'style=', 'MutationObserver', 'insertAdjacent', 'appendChild']) {
  if (header.includes(forbidden)) fail(`header must not contain ${forbidden}`);
}

const dock = read('theme/snippets/jill-category-dock.liquid');
includesAll(dock, 'collection dock', [
  'data-jill-category-dock',
  'jill-category-dock__track',
  'jill-category-dock__item',
  '#JillCatalogCollection-',
]);
for (const forbidden of ['<style', 'style=', '<script', 'MutationObserver', 'setTimeout']) {
  if (dock.includes(forbidden)) fail(`collection dock must not contain ${forbidden}`);
}

const dockCss = read('theme/assets/jill-category-dock.css');
includesAll(dockCss, 'collection dock CSS', [
  '.jill-category-dock',
  '.jill-category-dock__track',
  '.jill-category-dock__item',
  '.jill-category-dock__media',
  '.jill-category-dock__item:focus-visible',
  '@media (max-width: 749px)',
]);
for (const forbidden of ['!important', '.jill-category-dock__item:hover', 'transition:']) {
  if (dockCss.includes(forbidden)) fail(`collection dock CSS must not contain ${forbidden}`);
}

const headerSearchCss = read('theme/assets/jill-header-search.css');
includesAll(headerSearchCss, 'header search CSS', [
  '.jill-site-header__search',
  ".jill-site-header__search[data-open='true']",
  '.jill-site-header__search-input',
  '.jill-site-header__search-toggle',
  '@media (max-width: 749px)',
]);
for (const forbidden of ['!important', '#JillHeaderSearch-', 'style=']) {
  if (headerSearchCss.includes(forbidden)) fail(`header search CSS must not contain ${forbidden}`);
}

const headerGroup = read('theme/sections/header-group.json');
for (const handle of ['pinatas', 'catalog', 'kid-activities', 'party-supplies', 'apparel-gifts-dtf-sublimation']) {
  if (!headerGroup.includes(`"${handle}"`)) fail(`header group is missing collection dock handle ${handle}`);
}

const themeLayout = read('theme/layout/theme.liquid');
includesAll(themeLayout, 'theme layout', [
  "'jill-category-dock.css' | asset_url | stylesheet_tag",
  "'jill-header-search.css' | asset_url | stylesheet_tag",
  "template.suffix == 'custom-order'",
  "template.suffix == 'our-story'",
  "template.suffix == 'contact'",
  "'jill-forms.css' | asset_url | stylesheet_tag",
  "'jill-custom-order.js' | asset_url",
  "'jill-contact.js' | asset_url",
]);

const contentPage = read('theme/sections/main-page.liquid');
includesAll(contentPage, 'content page', [
  'data-jill-content-page',
  'data-content-width',
  'data-botanical',
  'jill-content-page__hero',
  'jill-content-page__title',
  'jill-content-page__body',
  '{{ page.title }}',
  '{{ page.content }}',
  '"name": "Content page"',
  '"id": "content_width"',
  '"id": "show_botanical"',
]);
for (const forbidden of ['<style', 'style=', '<script', 'MutationObserver']) {
  if (contentPage.includes(forbidden)) fail(`content page must not contain ${forbidden}`);
}

if (fs.existsSync('theme/assets/jill-content-page.css')) {
  fail('content page styles must stay in the canonical jill-storefront.css owner');
}
const contentPageCss = read('theme/assets/jill-storefront.css');
includesAll(contentPageCss, 'content page CSS', [
  '.jill-content-page',
  '.jill-content-page__hero',
  '.jill-content-page__body',
  'var(--jill-botanical-field)',
  "[data-content-width='narrow']",
  "[data-content-width='standard']",
  "[data-content-width='wide']",
  '@media (max-width: 749px)',
]);
if (/\.jill-content-page\s*\{[^}]*width:\s*100%/s.test(contentPageCss)) {
  fail('content page shell must preserve the canonical jill-page-width constraint');
}

const headerJs = read('theme/assets/jill-header.js');
includesAll(headerJs, 'header runtime', [
  "'[data-jill-header-localization]'",
  "'[data-jill-header-search]'",
  'setSearchOpen',
  "document.addEventListener('change', onChange)",
  "document.addEventListener('click', onClick)",
  "document.addEventListener('keydown', onKeydown)",
  "event.key !== 'Escape'",
  'requestSubmit()',
]);
for (const forbidden of ['MutationObserver', 'setTimeout', '.style', 'appendChild', 'insertAdjacent']) {
  if (headerJs.includes(forbidden)) fail(`header runtime must not contain ${forbidden}`);
}

const mainSearch = read('theme/sections/main-search.liquid');
if (mainSearch.includes('jill-search__form') || mainSearch.includes("name: 'q'") || mainSearch.includes("type: 'submit'")) {
  fail('search results page must not duplicate the header search input or submit button');
}
includesAll(mainSearch, 'search results page', [
  "'search.title' | t",
  "'search.result_count' | t",
  'search.results',
  "render 'product-card'",
]);

const storefrontCss = read('theme/assets/jill-storefront.css');
includesAll(storefrontCss, 'storefront CSS', [
  '.jill-site-header__layout',
  '.jill-site-header__drawer-panel',
  '.jill-site-header__utilities',
  '.jill-site-header__socials',
  '.jill-site-header__localization',
  '.jill-site-header--sticky',
]);

const formsCss = read('theme/assets/jill-forms.css');
includesAll(formsCss, 'guided form CSS', [
  '.jill-custom-order',
  '.jill-contact',
  '.jill-custom-order__product-list',
  '.jill-custom-order-item',
  '.jill-custom-order__personalization',
  '.jill-media',
  '.jill-contact__step-index',
  '.jill-contact__choice-group',
  '@media (max-width: 749px)',
]);

const contactSection = read('theme/sections/main-contact.liquid');
includesAll(contactSection, 'contact form', [
  "form 'contact'",
  'data-jill-contact',
  'data-contact-reason',
  'data-contact-message',
  'data-contact-phone',
  'contact[Reviewed details]',
  '/pages/quote?view=custom-order',
]);
for (const forbidden of ['<style', 'style=', '<script', 'MutationObserver']) {
  if (contactSection.includes(forbidden)) fail(`contact form must not contain ${forbidden}`);
}

const contactJs = read('theme/assets/jill-contact.js');
includesAll(contactJs, 'contact runtime', [
  'setRegion',
  'syncPhoneRequirement',
  'syncEmailValidity',
  'syncReason',
  "document.addEventListener('shopify:section:load'",
]);
for (const forbidden of ['MutationObserver', 'setTimeout', '.style', 'insertAdjacent', 'innerHTML']) {
  if (contactJs.includes(forbidden)) fail(`contact runtime must not contain ${forbidden}`);
}

const settingsSchema = read('theme/config/settings_schema.json');
includesAll(settingsSchema, 'global brand settings', [
  '"brand_logo"',
  '"brand_logo_width"',
  '"social_instagram_url"',
  '"social_facebook_url"',
  '"social_tiktok_url"',
  '"social_youtube_url"',
]);

const footer = read('theme/sections/footer.liquid');
includesAll(footer, 'footer', [
  'section.settings.menu.links',
  'settings.social_instagram_url',
  'settings.social_facebook_url',
  'settings.social_tiktok_url',
]);
if (footer.includes('section.settings.instagram_url') || footer.includes('section.settings.facebook_url') || footer.includes('section.settings.tiktok_url')) {
  fail('footer must consume the global social URL owner');
}

const accountDashboardConfig = read('extensions/jill-account-dashboard/shopify.extension.toml');
const accountCouponsConfig = read('extensions/jill-account-coupons/shopify.extension.toml');
const accountProfileConfig = read('extensions/jill-account-home/shopify.extension.toml');
const accountDashboard = read('extensions/jill-account-dashboard/src/Dashboard.jsx');
const accountCoupons = read('extensions/jill-account-coupons/src/Coupons.jsx');
includesAll(accountDashboardConfig, 'account dashboard target', ['customer-account.page.render']);
includesAll(accountCouponsConfig, 'account coupons target', ['customer-account.page.render']);
includesAll(accountProfileConfig, 'account profile target', ['customer-account.profile.block.render']);
includesAll(accountDashboard, 'account dashboard page shell', ['<s-page', 'Back to JILL']);
includesAll(accountCoupons, 'account coupon page shell', ['<s-page', 'My Coupons']);
for (const source of [accountDashboard, accountCoupons]) {
  if (source.includes('theme.liquid') || source.includes('jill-site-header') || source.includes('jill-site-footer')) {
    fail('customer-account full pages must stay inside Shopify account header/footer instead of importing storefront Liquid shell');
  }
}

const index = JSON.parse(read('theme/templates/index.json'));
const homeTypes = Object.values(index.sections || {}).map((section) => section.type);
if (homeTypes.length < 3 || homeTypes.some((type) => type !== 'rich-text')) {
  fail('home must ship with the initial three-section navigable composition');
}
const homeHeroSettings = index.sections.hero?.settings || {};
if (homeHeroSettings.button_label || homeHeroSettings.button_link) {
  fail('home hero must not duplicate catalog navigation with a browse button');
}

for (const [templatePath, expectedType] of [
  ['theme/templates/page.json', 'main-page'],
  ['theme/templates/page.about-us.json', 'main-page'],
  ['theme/templates/page.contact.json', 'main-contact'],
  ['theme/templates/page.custom-order.json', 'main-custom-order'],
  ['theme/templates/page.our-story.json', 'main-custom-order'],
  ['theme/templates/404.json', 'main-404'],
]) {
  assertSingleSectionTemplate(templatePath, expectedType);
}

const welcome = assertSingleSectionTemplate('theme/templates/page.welcome.json', 'rich-text');
const welcomeSettings = Object.values(welcome.sections)[0].settings || {};
if (!String(welcomeSettings.heading || '').includes('Welcome to JILL')) {
  fail('welcome page must ship with JILL welcome content');
}
if (!String(welcomeSettings.body || '').includes('every party deserves a little extra sparkle')) {
  fail('welcome page must ship with substantive welcome copy');
}
if (welcomeSettings.button_label || welcomeSettings.button_link) {
  fail('welcome page must not duplicate catalog navigation with a browse button');
}

console.log('Theme shell contract passed.');
