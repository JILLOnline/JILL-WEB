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

const header = read('theme/sections/header.liquid');
includesAll(header, 'header', [
  'data-jill-header-drawer',
  "render 'ui-icon', name: 'menu'",
  "render 'ui-icon', name: 'search'",
  "render 'ui-icon', name: 'account'",
  "render 'ui-icon', name: 'cart'",
  "render 'header-socials'",
  "render 'header-localization'",
  'settings.brand_logo',
  'section.settings.menu.links',
  'routes.all_products_collection_url',
  '/pages/quote?view=custom-order',
]);

for (const forbidden of ['<style', 'style=', 'MutationObserver', 'insertAdjacent', 'appendChild']) {
  if (header.includes(forbidden)) fail(`header must not contain ${forbidden}`);
}

const headerJs = read('theme/assets/jill-header.js');
includesAll(headerJs, 'header runtime', [
  "'[data-jill-header-localization]'",
  "document.addEventListener('change', onChange)",
  'requestSubmit()',
]);
for (const forbidden of ['MutationObserver', 'setTimeout', '.style', 'appendChild', 'insertAdjacent']) {
  if (headerJs.includes(forbidden)) fail(`header runtime must not contain ${forbidden}`);
}

const storefrontCss = read('theme/assets/jill-storefront.css');
includesAll(storefrontCss, 'storefront CSS', [
  '.jill-site-header__layout',
  '.jill-site-header__drawer-panel',
  '.jill-site-header__utilities',
  '.jill-site-header__socials',
  '.jill-site-header__localization',
  '.jill-site-header--sticky',
]);

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

const index = JSON.parse(read('theme/templates/index.json'));
const homeTypes = Object.values(index.sections || {}).map((section) => section.type);
if (homeTypes.length < 3 || homeTypes.some((type) => type !== 'rich-text')) {
  fail('home must ship with the initial three-section navigable composition');
}

for (const [templatePath, expectedType] of [
  ['theme/templates/page.json', 'main-page'],
  ['theme/templates/404.json', 'main-404'],
]) {
  const template = JSON.parse(read(templatePath));
  const sections = Object.values(template.sections || {});
  if (sections.length !== 1 || sections[0].type !== expectedType) {
    fail(`${templatePath} must have one canonical ${expectedType} owner`);
  }
}

console.log('Theme shell contract passed.');
