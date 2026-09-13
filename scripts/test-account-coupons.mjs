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
const recoverySource = read('extensions/jill-account-coupons-v2/src/Coupons.jsx');
const recoveryConfig = read('extensions/jill-account-coupons-v2/shopify.extension.toml');
const dashboardConfig = read('extensions/jill-account-dashboard/shopify.extension.toml');
const profileConfig = read('extensions/jill-account-home/shopify.extension.toml');

includesAll(config, 'Coupons extension config', [
  'api_version = "2026-07"',
  'handle = "jill-account-coupons"',
  'uid = "dfb3e6f0-162d-b114-19a1-d854706d0d45166f43aa"',
  'target = "customer-account.page.render"',
  'module = "./src/Coupons.jsx"',
  'api_access = true',
]);

includesAll(recoveryConfig, 'Coupons recovery extension config', [
  'api_version = "2026-07"',
  'handle = "jill-account-coupons-v2"',
  'uid = "bad98099-a546-242e-ad23-378ad515feca749d22cc"',
  'target = "customer-account.page.render"',
  'module = "./src/Coupons.jsx"',
]);

includesAll(dashboardConfig, 'Dashboard extension identity', [
  'handle = "jill-account-dashboard"',
  'uid = "2f093e56-265e-4263-57fc-eb7b7a8a3f49ccd3b19a"',
]);

includesAll(profileConfig, 'Settings extension identity', [
  'handle = "jill-account-home"',
  'uid = "923e30e6-dbf9-f48a-57a6-0dbd1ab57763f55ebbde"',
]);

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

includesAll(recoverySource, 'Coupons recovery runtime', [
  '<s-page',
  'heading="Coupons"',
  'Coupons page connected ✨',
  'render(<CouponsRecovery />, document.body)',
]);

for (const [owner, candidate] of [
  ['Coupons runtime probe', source],
  ['Coupons recovery runtime', recoverySource],
]) {
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
    if (candidate.includes(forbidden)) fail(`${owner} must not contain ${forbidden}`);
  }
}

console.log('Customer account Coupons identity and recovery contracts passed.');
