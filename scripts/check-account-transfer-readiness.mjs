import fs from 'node:fs';
import assert from 'node:assert/strict';

// Source-side environment certification only. This check cannot certify a
// signed-in Shopify account, installed app, production discounts or Apps Script
// deployment state. Those require runtime evidence before release.
const read=(path)=>fs.readFileSync(path,'utf8');
const app=read('extensions/jill-account-dashboard/src/Dashboard.jsx');
const hub=read('extensions/jill-account-dashboard/src/hub/AccountHub.jsx');
const rewards=read('extensions/jill-account-dashboard/src/pages/Rewards.jsx');
const card=read('extensions/jill-account-dashboard/src/rewards/RewardsCard.jsx');
const transport=read('extensions/jill-account-dashboard/src/rewards/account-transport.mjs');
const coupons=read('extensions/jill-account-dashboard/src/pages/Coupons.jsx');
const projection=read('shared/customer-coupons.mjs');
const publicBackend=read('backend/google-apps-script/JILL_Public_Promotions.gs');
const workBackend=read('scripts/update-rewards-work-deployment.mjs');
const builder=read('scripts/build-rewards-work-backend.mjs');
const accountRelease=read('.github/workflows/deploy-customer-account.yml');
const rewardsRelease=read('.github/workflows/deploy-rewards-backend.yml');
const themeRelease=read('.github/workflows/theme-core.yml');

for (const [owner,flow] of [
  ['Production account release',accountRelease],
  ['Production Rewards backend release',rewardsRelease],
]) {
  assert.match(flow,/workflow_dispatch:/,owner+' must require manual initiation');
  assert.doesNotMatch(flow,/\n  push:\n/,owner+' must not auto-deploy on Git push');
  assert.match(flow,/expected_sha:/,owner+' must pin certified commit');
  assert.match(flow,/github\.sha/,owner+' must compare actual commit SHA');
  assert.match(flow,/environment: JILL-(?:ACCOUNT|REWARDS)-LIVE/,owner+' must use release environment');
}
assert.doesNotMatch(accountRelease,/ready=false|deployment will be skipped safely/,
  'Missing production app credentials must cause a failed release, not skipped success.');
assert.match(themeRelease,/SHOPIFY_THEME_ID: '165562941683'/);
assert.match(themeRelease,/SHOPIFY_THEME_NAME: JILL WORK/);
assert.match(themeRelease,/SHOPIFY_THEME_ROLE: unpublished/);
assert.match(themeRelease,/--nodelete/);
assert.match(themeRelease,/verify-shopify-theme-push\.mjs/);
assert.doesNotMatch(themeRelease,/^\\s+--allow-live\\b/m);

assert.match(app,/render\(<ConnectedHub \/>, document\.body\)/);
assert.match(hub,/import Rewards from '\.\.\/pages\/Rewards\.jsx'/);
assert.match(rewards,/import RewardsCard from '\.\.\/rewards\/RewardsCard\.jsx'/);
assert.match(card,/import \{loadData,requestReward,wait,metaMap\} from '\.\/account-transport\.mjs'/);
assert.match(transport,/export async function requestReward/);
assert.match(transport,/compareDigest/);
assert.match(transport,/previous reward request is still processing/);
assert.match(transport,/rewardsAccountReady/);
assert.doesNotMatch(rewards,/discountCodeBasicCreate|metafieldsSet\(/);
assert.match(coupons,/loadPublicPromotionCatalog/);
assert.match(coupons,/!upcoming &&/);
assert.match(coupons,/The code will become available when this offer launches/);
assert.match(projection,/parseUpcomingPromotions/);
assert.match(projection,/Object\.hasOwn\(offer,'code'\)/);
assert.match(publicBackend,/status:scheduled method:code/);
assert.match(publicBackend,/\[JILL UPCOMING\] /);
assert.match(publicBackend,/discount\.context\.__typename !== 'DiscountBuyerSelectionAll'/);
assert.match(publicBackend,/upcoming: upcoming/);
assert.doesNotMatch(publicBackend,/JILLWORK5-QA|CODE_DISCOUNT_BLACKFRIDAY|CODE_BXGY_DISCOUNT_SUMMERBOGO/,
 'Source must not hard-code store test discount codes');
assert.match(workBackend,/refs\/remotes\/origin\/jill\/rewards-work/);
assert.match(workBackend,/uncommitted tracked source changes/);
assert.match(workBackend,/WORK_DEPLOYMENT_ID/);
assert.match(builder,/JILL_REWARDS_RUNTIME = 'WORK'/);
assert.match(builder,/JILL_Public_Promotions\.gs/);
assert.match(builder,/Production reference leaked into WORK/);
assert.match(read('.gitignore'),/shopify\.app\.work\.toml/);

console.log('My JILL account migration source gates passed:');
console.log('  WORK account identity and isolated backend bundle');
console.log('  single authenticated Rewards/Wallet owners');
console.log('  opt-in upcoming offers with no advance codes');
console.log('  manual exact-SHA production app and backend releases');
console.log('  protected unpublished storefront Theme Core');
console.log('PENDING runtime gates: deployed WORK backend SHA, scheduled-offer snapshot,');
console.log('real WORK checkout, production scopes/metafield parity, account QA and approval.');
