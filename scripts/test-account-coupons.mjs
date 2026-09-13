import fs from 'node:fs';

function fail(message) {
  throw new Error(`Account coupons test failed: ${message}`);
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

const source = read('extensions/jill-account-coupons/src/Coupons.jsx');
const config = read('extensions/jill-account-coupons/shopify.extension.toml');

includesAll(config, 'Coupons extension config', [
  'api_version = "2026-07"',
  'handle = "jill-account-coupons"',
  'target = "customer-account.page.render"',
  'module = "./src/Coupons.jsx"',
  'api_access = true',
]);

if (/^uid\s*=/m.test(config)) {
  fail('Coupons extension identity must remain owned by the linked Shopify app configuration');
}

includesAll(source, 'Coupons runtime probe', [
  '<s-page',
  'heading="Coupons"',
  'Storewide offers',
  '5% off entire order',
  'PARTY10',
  'One use per customer.',
  'No expiration date',
  'Use now',
  'For you',
  'extension:jill-account-dashboard/',
  'render(<Coupons />, document.body)',
]);

for (const forbidden of [
  'shopify://customer-account/api',
  'admin/api',
  'X-Shopify-Access-Token',
  'SHOPIFY_ADMIN',
  'MutationObserver',
  'innerHTML',
  'useEffect',
  'useState',
]) {
  if (source.includes(forbidden)) fail(`Coupons runtime probe must not contain ${forbidden}`);
}

console.log('Customer account Coupons runtime probe contract passed.');
