import assert from 'node:assert/strict';
import {rewardsAccountReady} from '../extensions/jill-account-dashboard/src/rewards/account-transport.mjs';

const ledger={
  points_balance:'30',
  redeem_request_points:'0',
  redeem_request_nonce:'consumed:previous',
  coupons:'[]',
};
const account=(patch={},id='gid://shopify/Customer/101')=>({
  id,
  metafields:Object.entries({...ledger,...patch}).map(([key,value])=>({
    namespace:'jill_rewards',key,value,
  })),
});
assert.equal(rewardsAccountReady(account()),true);
assert.equal(rewardsAccountReady(account({points_balance:'0'})),true);
assert.equal(rewardsAccountReady(account({redeem_request_points:'10'})),true);
assert.equal(rewardsAccountReady(account({},'gid://shopify/Customer/202')),true);
assert.equal(rewardsAccountReady(account({},'gid://shopify/Customer/other')),false);
assert.equal(rewardsAccountReady(account({},'')),false);
assert.equal(rewardsAccountReady(null),false);
for (const invalid of [
  {points_balance:'-1'},
  {points_balance:'not-number'},
  {points_balance:'9007199254740992'},
  {redeem_request_points:'-1'},
  {redeem_request_points:'10.5'},
  {coupons:'not-json'},
  {coupons:'{}'},
  {coupons:'[null]'},
  {coupons:'[{"code":"INCOMPLETE","points":10}]'},
]) {
  assert.equal(rewardsAccountReady(account(invalid)),false,
    'Unsafe ledger must disable redemption: '+JSON.stringify(invalid));
}
const noField={id:'gid://shopify/Customer/1',metafields:[]};
assert.equal(rewardsAccountReady(noField),false);
console.log('My JILL Rewards authenticated ledger and wallet readiness checks passed.');
