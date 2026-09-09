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
  'section.settings.menu.links',
  'routes.all_products_collection_url',
  'routes.search_url',
  'routes.account_url',
  'routes.cart_url',
  '/pages/quote?view=custom-order',
]);

const footer = read('theme/sections/footer.liquid');
includesAll(footer, 'footer', [
  'section.settings.menu.links',
  'instagram_url',
  'facebook_url',
  'tiktok_url',
]);

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
