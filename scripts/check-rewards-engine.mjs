import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('rewards.config.json', 'utf8'));
const dashboard = fs.readFileSync('extensions/jill-account-dashboard/src/Dashboard.jsx', 'utf8');
const ui = fs.readFileSync('shared/rewards.mjs', 'utf8');
const coupons = fs.readFileSync('extensions/jill-account-coupons/src/Coupons.jsx', 'utf8');
const backend = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
const promotionBackend = fs.readFileSync('backend/google-apps-script/JILL_Public_Promotions.gs', 'utf8');
const watchdog = fs.readFileSync('.github/workflows/rewards-watchdog.yml', 'utf8');
const backendDeploy = fs.readFileSync('.github/workflows/deploy-rewards-backend.yml', 'utf8');

try {
  // Parse the Apps Script source as JavaScript without executing Apps Script APIs.
  // This catches syntax errors before production deployment.
  new Function(backend);
} catch (error) {
  throw new Error(`Rewards Apps Script syntax check failed: ${error.message}`);
}

try {
  new Function(promotionBackend);
} catch (error) {
  throw new Error(`Public promotions Apps Script syntax check failed: ${error.message}`);
}

function mustMatch(source, regex, label) {
  const match = source.match(regex);
  if (!match) throw new Error(`${label} was not found.`);
  return match[1];
}

function uiTiers(source) {
  const section = source.match(/export const REWARD_TIERS = Object\.freeze\(\[([\s\S]*?)\]\);/);
  if (!section) throw new Error('UI REWARD_TIERS was not found.');
  return [...section[1].matchAll(/points:\s*(\d+)\s*,\s*value:\s*(\d+)\s*,\s*minimum:\s*(\d+)/g)]
    .map((m) => ({points: Number(m[1]), value: Number(m[2]), minimum: Number(m[3])}))
    .sort((a, b) => a.points - b.points);
}

function backendTiers(source) {
  const section = source.match(/const JILL_REWARD_TIERS = \{([\s\S]*?)\};/);
  if (!section) throw new Error('Backend JILL_REWARD_TIERS was not found.');
  return [...section[1].matchAll(/(\d+)\s*:\s*\{\s*value:\s*(\d+)\s*,\s*minimum:\s*(\d+)\s*\}/g)]
    .map((m) => ({points: Number(m[1]), value: Number(m[2]), minimum: Number(m[3])}))
    .sort((a, b) => a.points - b.points);
}

const expectedTiers = [...config.tiers].sort((a, b) => a.points - b.points);
if (JSON.stringify(uiTiers(ui)) !== JSON.stringify(expectedTiers)) {
  throw new Error('Dashboard reward tiers drifted from rewards.config.json.');
}
if (JSON.stringify(backendTiers(backend)) !== JSON.stringify(expectedTiers)) {
  throw new Error('Backend reward tiers drifted from rewards.config.json.');
}

const uiVersion = mustMatch(ui, /REWARD_ENGINE_VERSION = '([^']+)'/, 'UI engine version');
const backendVersion = mustMatch(backend, /JILL_REWARDS_ENGINE_VERSION = '([^']+)'/, 'Backend engine version');
const backendBuild = mustMatch(backend, /JILL_REWARDS_BUILD_SHA = '([^']+)'/, 'Backend build provenance marker');
if (backendBuild !== '__JILL_REWARDS_BUILD_SHA__') {
  throw new Error('Repository Rewards backend must retain the deployment build-SHA marker.');
}
if (uiVersion !== String(config.engineVersion) || backendVersion !== String(config.engineVersion)) {
  throw new Error(`Rewards engine version drift: config=${config.engineVersion} ui=${uiVersion} backend=${backendVersion}`);
}

const uiSpend = Number(mustMatch(ui, /REWARD_SPEND_CENTS_PER_POINT = (\d+)/, 'UI earn rate'));
const backendSpend = Number(mustMatch(backend, /JILL_REWARD_SPEND_CENTS_PER_POINT = (\d+)/, 'Backend earn rate'));
if (uiSpend !== config.earn.spendCentsPerPoint || backendSpend !== config.earn.spendCentsPerPoint) {
  throw new Error('Rewards earn-rate parity failed.');
}

const uiDays = Number(mustMatch(ui, /REWARD_COUPON_DAYS = (\d+)/, 'UI expiration days'));
const backendDays = Number(mustMatch(backend, /JILL_REWARD_COUPON_DAYS = (\d+)/, 'Backend expiration days'));
if (uiDays !== config.coupon.expirationDays || backendDays !== config.coupon.expirationDays) {
  throw new Error('Rewards expiration parity failed.');
}

function policyBoolean(source, regex, label) {
  const value = mustMatch(source, regex, label);
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${label} must be a boolean literal.`);
  }
  return value === 'true';
}

const uiUsageLimit = Number(mustMatch(ui, /REWARD_COUPON_USAGE_LIMIT = (\d+)/, 'UI usage limit'));
const backendUsageLimit = Number(mustMatch(backend, /JILL_REWARD_USAGE_LIMIT = (\d+)/, 'Backend usage limit'));
const uiOnce = policyBoolean(ui, /REWARD_COUPON_APPLIES_ONCE_PER_CUSTOMER = (true|false)/, 'UI once-per-customer policy');
const backendOnce = policyBoolean(backend, /JILL_REWARD_APPLIES_ONCE_PER_CUSTOMER = (true|false)/, 'Backend once-per-customer policy');
const uiOrderStacking = policyBoolean(ui, /REWARD_COUPON_ORDER_STACKING = (true|false)/, 'UI order stacking policy');
const uiProductStacking = policyBoolean(ui, /REWARD_COUPON_PRODUCT_STACKING = (true|false)/, 'UI product stacking policy');
const uiShippingStacking = policyBoolean(ui, /REWARD_COUPON_SHIPPING_STACKING = (true|false)/, 'UI shipping stacking policy');
const backendOrderStacking = policyBoolean(backend, /JILL_REWARD_ORDER_STACKING = (true|false)/, 'Backend order stacking policy');
const backendProductStacking = policyBoolean(backend, /JILL_REWARD_PRODUCT_STACKING = (true|false)/, 'Backend product stacking policy');
const backendShippingStacking = policyBoolean(backend, /JILL_REWARD_SHIPPING_STACKING = (true|false)/, 'Backend shipping stacking policy');

if (
  uiUsageLimit !== config.coupon.usageLimit ||
  backendUsageLimit !== config.coupon.usageLimit ||
  uiOnce !== config.coupon.appliesOncePerCustomer ||
  backendOnce !== config.coupon.appliesOncePerCustomer ||
  uiOrderStacking !== config.coupon.stacking.order ||
  backendOrderStacking !== config.coupon.stacking.order ||
  uiProductStacking !== config.coupon.stacking.product ||
  backendProductStacking !== config.coupon.stacking.product ||
  uiShippingStacking !== config.coupon.stacking.shipping ||
  backendShippingStacking !== config.coupon.stacking.shipping
) {
  throw new Error('Rewards coupon policy parity failed.');
}

if (fs.existsSync('extensions/jill-account-dashboard/src/rewards.mjs')) {
  throw new Error('Dashboard-local Rewards module must not coexist with shared/rewards.mjs.');
}
if (!dashboard.includes("from '../../../shared/rewards.mjs'")) {
  throw new Error('Dashboard is not using the canonical shared Rewards module.');
}
if (!coupons.includes("from '../../../shared/rewards.mjs'")) {
  throw new Error('Coupons is not using the canonical shared Rewards module.');
}

const refreshMs = Number(mustMatch(ui, /REWARDS_REFRESH_MS = (\d+)/, 'Rewards refresh cadence'));
if (refreshMs !== 25000) {
  throw new Error('Rewards refresh cadence changed without contract review.');
}
if (dashboard.includes('const REWARDS_REFRESH_MS =') || coupons.includes('const REWARDS_REFRESH_MS =')) {
  throw new Error('Rewards refresh cadence must have one owner in shared/rewards.mjs.');
}
if (dashboard.includes('const REWARD_TIERS = [')) {
  throw new Error('Dashboard reintroduced a duplicate reward tier table.');
}
if (dashboard.includes(': !isAvailable\n                      ? ` · ${pointsRemaining}')) {
  throw new Error('Locked tiers are incorrectly displaying pts-left copy.');
}
if (dashboard.includes('Expires 30 days') || dashboard.includes('every $10')) {
  throw new Error('Dashboard reintroduced hard-coded Rewards policy copy.');
}

for (const marker of [
  'usageLimit: JILL_REWARD_USAGE_LIMIT',
  'appliesOncePerCustomer: JILL_REWARD_APPLIES_ONCE_PER_CUSTOMER',
  'orderDiscounts: JILL_REWARD_ORDER_STACKING',
  'productDiscounts: JILL_REWARD_PRODUCT_STACKING',
  'shippingDiscounts: JILL_REWARD_SHIPPING_STACKING',
]) {
  if (!backend.includes(marker)) throw new Error(`Reward coupon creation is not using canonical policy: ${marker}`);
}
for (const marker of [
  "JILL_REWARDS_SWEEP_CURSOR_PROPERTY = 'JILL_REWARDS_SWEEP_CURSOR'",
  'JILL_REWARDS_SWEEP_PAGE_SIZE = 100',
  'JILL_REWARDS_SWEEP_MAX_PAGES_PER_RUN = 5',
  'props.setProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY, nextCursor)',
  'props.deleteProperty(JILL_REWARDS_SWEEP_CURSOR_PROPERTY)',
  'cursor_recovered: cursorRecovered',
  'cycle_complete: cycleComplete',
]) {
  if (!backend.includes(marker)) {
    throw new Error(`Rewards resumable sweep guard missing: ${marker}`);
  }
}
if (/while \(hasNextPage && scanned < 1000\)/.test(backend)) {
  throw new Error('Rewards sweep reintroduced the permanent 1,000-customer ceiling.');
}

if (!backend.includes('priceAfterAllDiscountsBeforeTaxesSet')) {
  throw new Error('Eligible spend must use Shopify post-discount pre-tax line totals.');
}
if (!backend.includes("revoked_reason = 'refund_solvency'")) {
  throw new Error('Refund solvency revocation guard is missing.');
}
if (!backend.includes("reason: 'premature_expiration'")) {
  throw new Error('Admin-shortened reward expiration guard is missing.');
}
if (!backend.includes('Invalid JILL Rewards coupon wallet JSON')) {
  throw new Error('Malformed coupon wallets must fail closed.');
}
for (const guard of ['asyncUsageCount', 'DiscountCustomers', 'DiscountAmount', 'DiscountMinimumSubtotal', 'AllDiscountItems']) {
  if (!backend.includes(guard)) throw new Error(`Coupon integrity guard missing: ${guard}`);
}
if (!watchdog.includes(`EXPECTED_ENGINE_VERSION: '${config.engineVersion}'`)) {
  throw new Error('Watchdog engine version does not match rewards.config.json.');
}
if (!watchdog.includes('EXPECTED_BUILD_SHA') || !watchdog.includes('deploy-rewards-backend.yml')) {
  throw new Error('Watchdog must verify the exact successful Rewards backend deployment SHA.');
}
for (const marker of [
  "EXPECTED_ENGINE_VERSION: '" + config.engineVersion + "'",
  'CLASPRC_JSON',
  'CLASP_JSON',
  'clasp pull',
  'clasp push --force',
  'create-deployment',
  'APPS_SCRIPT_DEPLOYMENT_ID',
  'EXPECTED_BUILD_SHA',
]) {
  if (!backendDeploy.includes(marker)) throw new Error(`Rewards backend deployment guard missing: ${marker}`);
}

const promotionBackendMaxAgeMinutes = Number(mustMatch(
  promotionBackend,
  /MAX_SNAPSHOT_AGE_MS:\s*(\d+)\s*\*\s*60\s*\*\s*1000/,
  'Public promotions backend freshness window',
));
const couponPromotionMaxAgeMinutes = Number(mustMatch(
  coupons,
  /PROMOTION_SNAPSHOT_MAX_AGE_MS = (\d+) \* 60 \* 1000/,
  'Coupons promotion freshness window',
));
if (promotionBackendMaxAgeMinutes !== couponPromotionMaxAgeMinutes) {
  throw new Error('Public promotion freshness policy drifted between backend and Coupons.');
}

for (const marker of [
  'ensureJillPublicPromotionsHealthy_(false)',
  'promotions: promotions',
  'ok: promotions.ok === true',
]) {
  if (!backend.includes(marker)) {
    throw new Error(`Rewards watchdog is not enforcing public promotions health: ${marker}`);
  }
}

for (const marker of [
  'PAGE_SIZE: 50',
  'MAX_PAGES: 100',
  'after: $after',
  'hasNextPage',
  'endCursor',
  'DiscountBuyerSelectionAll',
  'if (codes.length !== 1) return;',
  'health = jillPublicPromotionsHealth_();',
]) {
  if (!promotionBackend.includes(marker)) {
    throw new Error(`Public promotions source-of-truth guard missing: ${marker}`);
  }
}

if (!dashboard.includes('rewardRequestIsComplete(nextMeta, requestNonce)')) {
  throw new Error('Redemption completion must match the request nonce and cleared points.');
}
if (!/<s-button\b[^>]*variant="primary"[^>]*onClick=\{\(\) => handleRedeem\(tier\)\}[^>]*>[\s\S]*?Generate coupon\s*<\/s-button>/.test(dashboard)) {
  throw new Error('Reward confirmation must use the Shopify primary button action.');
}

console.log('JILL Rewards v13 guard passed:', JSON.stringify({
  engineVersion: config.engineVersion,
  spendCentsPerPoint: config.earn.spendCentsPerPoint,
  expirationDays: config.coupon.expirationDays,
  tiers: expectedTiers,
}));
