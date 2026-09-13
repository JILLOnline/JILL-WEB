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
  'target = "customer-account.page.render"',
  'module = "./src/Coupons.jsx"',
  'api_access = true',
]);

includesAll(source, 'Coupons page', [
  "shopify://customer-account/api/2026-07/graphql.json",
  'namespace:"jill_rewards",key:"coupons"',
  'metafield(namespace:"jill_account", key:"public_offers")',
  'parseRewardCoupons',
  'parsePublicOffers',
  'publicOfferIsActive',
  'FOR YOU · JILL REWARDS',
  'STOREWIDE',
  'Storewide offers',
  'No expiration date',
  'Use now',
  'Coupon history',
  'payload?.errors?.length',
  '!response.ok || !payload?.data',
  'render(<Coupons />, document.body)',
]);

for (const forbidden of [
  'admin/api',
  'X-Shopify-Access-Token',
  'SHOPIFY_ADMIN',
  'MutationObserver',
  'innerHTML',
]) {
  if (source.includes(forbidden)) fail(`Coupons page must not contain ${forbidden}`);
}

if (/payload\?\.errors\?\.length\)\s*\{?\s*throw/.test(source)) {
  fail('partial Customer Account GraphQL errors must not take down the whole coupon wallet');
}

console.log('Customer account Coupons contract passed.');
