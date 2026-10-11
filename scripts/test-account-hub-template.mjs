import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HUB_ROUTES, canonicalRoute, routeFromEntry, extensionRoute}
  from '../extensions/jill-account-dashboard/src/hub/routes.mjs';

const read = (p) => fs.readFileSync(p,'utf8');
const root = 'extensions/jill-account-dashboard/src/';
const pages = ['Overview','Rewards','Coupons','CustomOrders','Celebrations',
  'SavedPreferences','Settings'];
assert.deepEqual(HUB_ROUTES.map((r)=>r.id),[
  'overview','rewards','coupons','custom-orders','celebrations','saved','settings',
]);
assert.equal(new Set(HUB_ROUTES.map((r)=>r.id)).size,7);
assert.equal(new Set(HUB_ROUTES.map((r)=>r.path)).size,7);
assert.equal(extensionRoute('overview'),'extension://');
assert.equal(extensionRoute('coupons'),'extension://coupons');
assert.equal(extensionRoute('unknown'),'extension://');
assert.equal(routeFromEntry({url:'https://account.example.test/account/pages/123/rewards'}),'rewards');
assert.equal(routeFromEntry({url:'invalid-url'}),'overview');
assert.equal(routeFromEntry({url:'extension://rewards'}),'rewards');
assert.equal(routeFromEntry({url:'extension://coupons'}),'coupons');
assert.equal(routeFromEntry({url:'extension://settings'}),'settings');
assert.equal(canonicalRoute('__proto__'),'overview');
const hub=read(root+'hub/AccountHub.jsx');
const connected=read(root+'hub/ConnectedHub.jsx');
assert.match(hub,/HUB_ROUTES\.map/);
assert.match(hub,/navigation\.navigate\(extensionRoute\(id\)\)/);
assert.match(hub,/currententrychange/);
assert.match(hub,/<s-page heading="My JILL"/);
assert.match(connected,/loadAccountHubSummary\(\)/);
for (const name of pages) {
  const source=read(root+'pages/'+name+'.jsx');
  assert.ok(source.includes('export default function ' + name),'Missing screen owner: '+name);
  assert.ok(hub.includes('import ' + name + " from '../pages/" + name + ".jsx'"),'Missing module import');
  assert.match(source,/<s-(stack|section)/);
  assert.doesNotMatch(source, /metafieldsSet|discountCodeBasicCreate|write_customers|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(source, /jillonlinestore\.com|jqtdgr-1y\.myshopify\.com/);
}
const rewards=read(root+'pages/Rewards.jsx');
assert.match(rewards,/REWARD_TIERS/);
assert.match(rewards,/REWARD_COUPON_POLICY/);
assert.match(rewards,/import RewardsCard from '\.\.\/rewards\/RewardsCard\.jsx'/);
assert.match(rewards,/hasVerifiedLedger/);
assert.match(rewards,/onNavigate\('coupons'\)/);
assert.doesNotMatch(rewards,/const REQUEST_REWARD_MUTATION|discountCodeBasicCreate/);
const coupons=read(root+'pages/Coupons.jsx');
assert.match(coupons,/loadPersonalCoupons/);
assert.match(coupons,/loadPublicPromotions/);
assert.match(coupons,/We couldn\\'t verify your personal coupons/);
assert.doesNotMatch(coupons,/Use Now.*onClick|discountCartUrl\(/);
assert.match(read(root+'pages/Celebrations.jsx'),/Reminders will be optional and off/);
assert.match(read(root+'pages/CustomOrders.jsx'),/history is not connected yet/);
const preparer=read('scripts/prepare-account-hub-canary.mjs');
assert.match(preparer,/mode === 'read' \|\| mode === 'template'/);
assert.match(preparer,/\'rewards\.mjs\',\'customer-account-api\.mjs\',\'customer-coupons\.mjs\'/);
for (const file of ['Overview.jsx','Rewards.jsx','Coupons.jsx','CustomOrders.jsx',
  'Celebrations.jsx','SavedPreferences.jsx','Settings.jsx']) {
  assert.ok(preparer.includes("'"+file+"'"),'Canary does not copy '+file);
}
const expected='node scripts/prepare-account-hub-canary.mjs --template && '+
  'shopify app dev --path .work-account-canary --config work --store jill-work.myshopify.com';
const scripts=JSON.parse(read('package.json')).scripts;
assert.equal(scripts['rewards:work:hub:template'],expected);
console.log('Seven-screen read-only My JILL template, Shopify navigation and isolated WORK preview contract verified.');
