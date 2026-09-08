import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('rewards.config.json', 'utf8'));
const dashboard = fs.readFileSync('extensions/jill-account-dashboard/src/Dashboard.jsx', 'utf8');
const ui = fs.readFileSync('extensions/jill-account-dashboard/src/rewards.mjs', 'utf8');
const backend = fs.readFileSync('backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs', 'utf8');
const watchdog = fs.readFileSync('.github/workflows/rewards-watchdog.yml', 'utf8');

try {
  // Parse the Apps Script source as JavaScript without executing Apps Script APIs.
  // This catches syntax errors before production deployment.
  new Function(backend);
} catch (error) {
  throw new Error(`Rewards Apps Script syntax check failed: ${error.message}`);
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

if (!dashboard.includes("from './rewards.mjs'")) {
  throw new Error('Dashboard is not using the canonical reward state module.');
}
if (dashboard.includes('const REWARD_TIERS = [')) {
  throw new Error('Dashboard reintroduced a duplicate reward tier table.');
}
if (dashboard.includes(': !isAvailable\n                      ? ` · ${pointsRemaining}')) {
  throw new Error('Locked tiers are incorrectly displaying pts-left copy.');
}

const noStackGuard = /combinesWith\s*:\s*\{[\s\S]*?orderDiscounts\s*:\s*false[\s\S]*?productDiscounts\s*:\s*false[\s\S]*?shippingDiscounts\s*:\s*false[\s\S]*?\}/;
if (!noStackGuard.test(backend)) throw new Error('Reward coupon stacking policy changed.');
if (!/usageLimit\s*:\s*1/.test(backend) || !/appliesOncePerCustomer\s*:\s*true/.test(backend)) {
  throw new Error('Reward coupon single-use policy changed.');
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
