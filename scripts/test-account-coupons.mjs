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
const dashboardConfig = read('extensions/jill-account-dashboard/shopify.extension.toml');
const profileConfig = read('extensions/jill-account-home/shopify.extension.toml');
const promotionBackend = read('backend/google-apps-script/JILL_Public_Promotions.gs');

includesAll(config, 'Coupons extension config', [
  'api_version = "2026-07"',
  'handle = "jill-account-coupons"',
  'uid = "dfb3e6f0-162d-b114-19a1-d854706d0d45166f43aa"',
  'target = "customer-account.page.render"',
  'module = "./src/Coupons.jsx"',
  'api_access = true',
]);

includesAll(source, 'Coupons runtime', [
  'shopify://storefront/api/2026-07/graphql.json',
  'shopify://customer-account/api/2026-07/graphql.json',
  'namespace: "jill_promotions"',
  'key: "active_public_codes"',
  'namespace: "jill_rewards"',
  'key: "coupons"',
  'PROMOTION_SNAPSHOT_MAX_AGE_MS',
  'rewardWallet',
  'rewardCouponStatus',
  'discountCartUrl',
  'storefrontOrigin',
  'const STORE = storefrontOrigin(shopify.shop);',
  'href={discountCartUrl(STORE, offer.code)}',
  'href={discountCartUrl(STORE, coupon.code)}',
  'REWARDS_REFRESH_MS',
  'refreshRewards(false)',
  'clearInterval(rewardsRefreshTimer)',
  'setRewardsStale(true)',
  'Your last confirmed coupons are still shown while we refresh automatically.',
  'Storewide offers',
  'Current Shopify promotions available to everyone.',
  'Personal JILL Rewards coupons generated from your Dashboard.',
  'No storewide promotions right now.',
  'extension:jill-account-dashboard/',
  'render(<Coupons />, document.body)',
]);

for (const forbidden of [
  'function discountUrl(',
  "const STORE = 'https://jillonlinestore.com'",

  '/discount/${encodeURIComponent',
  'PARTY10',
  'PARTY5',
  'SUBSCRIBE10',
  'admin/api',
  'X-Shopify-Access-Token',
  'SHOPIFY_ADMIN',
  'MutationObserver',
  'innerHTML',
  'const REWARDS_REFRESH_MS =',
]) {
  if (source.includes(forbidden)) {
    fail(`Coupons runtime must not contain ${forbidden}`);
  }
}

includesAll(promotionBackend, 'Public promotion synchronizer', [
  "HANDLER: 'syncJillPublicPromotions'",
  "NAMESPACE: 'jill_promotions'",
  "KEY: 'active_public_codes'",
  'function setupJillPublicPromotions()',
  'function syncJillPublicPromotions()',
  '.everyMinutes(1)',
  'after: $after',
  'pageInfo {',
  'hasNextPage',
  'endCursor',
  'DiscountBuyerSelectionAll',
  'codes(first: 2)',
  'if (codes.length !== 1) return;',
  'query: "status:active method:code"',
  'shopifyGraphQL_',
  'metafieldsSet',
  'function ensureJillPublicPromotionsHealthy_(force)',
  'PAGE_SIZE: 50',
  'MAX_PAGES: 100',
  'MAX_SNAPSHOT_AGE_MS: 10 * 60 * 1000',
  'health = jillPublicPromotionsHealth_();',
]);

for (const forbidden of [
  'PARTY10',
  'PARTY5',
  'SUBSCRIBE10',
  'context:all',
  'SHOPIFY_ACCESS_TOKEN',
  'X-Shopify-Access-Token',
  'UrlFetchApp.fetch(',
]) {
  if (promotionBackend.includes(forbidden)) {
    fail(`Public promotion synchronizer must not contain ${forbidden}`);
  }
}


includesAll(dashboardConfig, 'Dashboard extension identity', [
  'handle = "jill-account-dashboard"',
  'uid = "2f093e56-265e-4263-57fc-eb7b7a8a3f49ccd3b19a"',
]);

includesAll(profileConfig, 'Settings extension identity', [
  'handle = "jill-account-home"',
  'uid = "923e30e6-dbf9-f48a-57a6-0dbd1ab57763f55ebbde"',
]);

console.log('Customer account Coupons Shopify source-of-truth contract passed.');
