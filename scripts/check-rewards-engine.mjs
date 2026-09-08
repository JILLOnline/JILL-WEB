import fs from 'node:fs';

const dashboardPath = 'extensions/jill-account-dashboard/src/Dashboard.jsx';
const backendPath = 'backend/google-apps-script/JILL_Custom_Order_Automation_REWARDS.gs';

const dashboard = fs.readFileSync(dashboardPath, 'utf8');
const backend = fs.readFileSync(backendPath, 'utf8');

function dashboardTiers(source) {
  const section = source.match(/const REWARD_TIERS = \[([\s\S]*?)\];/);
  if (!section) throw new Error('Dashboard REWARD_TIERS was not found.');

  return [...section[1].matchAll(/\{\s*points:\s*(\d+)\s*,\s*value:\s*(\d+)\s*,\s*minimum:\s*(\d+)\s*\}/g)]
    .map((match) => ({points: Number(match[1]), value: Number(match[2]), minimum: Number(match[3])}))
    .sort((a, b) => a.points - b.points);
}

function backendTiers(source) {
  const section = source.match(/const JILL_REWARD_TIERS = \{([\s\S]*?)\};/);
  if (!section) throw new Error('Backend JILL_REWARD_TIERS was not found.');

  return [...section[1].matchAll(/(\d+)\s*:\s*\{\s*value:\s*(\d+)\s*,\s*minimum:\s*(\d+)\s*\}/g)]
    .map((match) => ({points: Number(match[1]), value: Number(match[2]), minimum: Number(match[3])}))
    .sort((a, b) => a.points - b.points);
}

const uiTiers = dashboardTiers(dashboard);
const serverTiers = backendTiers(backend);

if (!uiTiers.length || !serverTiers.length) {
  throw new Error('Rewards tier configuration cannot be empty.');
}

if (JSON.stringify(uiTiers) !== JSON.stringify(serverTiers)) {
  console.error('Dashboard tiers:', uiTiers);
  console.error('Backend tiers:', serverTiers);
  throw new Error('JILL Rewards tier parity check failed. Frontend and backend must match exactly.');
}

const forbiddenStackingCopy = 'Can combine with eligible storewide discounts';
if (dashboard.includes(forbiddenStackingCopy)) {
  throw new Error('Dashboard claims reward coupons stack, but the backend explicitly disables discount combinations.');
}

const noStackGuard = /combinesWith\s*:\s*\{[\s\S]*?orderDiscounts\s*:\s*false[\s\S]*?productDiscounts\s*:\s*false[\s\S]*?shippingDiscounts\s*:\s*false[\s\S]*?\}/;
if (!noStackGuard.test(backend)) {
  throw new Error('Rewards backend combination policy changed. Review customer-facing copy before deployment.');
}

console.log('JILL Rewards engine guard passed:', JSON.stringify(uiTiers));
