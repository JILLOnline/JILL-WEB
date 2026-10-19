import assert from 'node:assert/strict';
import {rewardTerms,reconcileRewardSpend,issuedCouponTerms,
  planRewardsMigration,unusedReservationRelease} from '../backend/rewards-policy.mjs';
for(const [cents,maximum] of [[100,1],[300,3],[999,9],[1000,10],[1999,19],
  [2500,25],[10000,100],[50000,500],[50900,509]]){
  const value=rewardTerms({requestedTenths:maximum,availableTenths:1000,eligibleSubtotalCents:cents});
  assert.equal(value.reward_cents,maximum*10);
  assert.equal(value.minimum_eligible_subtotal_cents,maximum*100);
  assert.throws(()=>rewardTerms({requestedTenths:maximum+1,availableTenths:1000,eligibleSubtotalCents:cents}));
}
assert.equal(rewardTerms({requestedTenths:3,availableTenths:500,eligibleSubtotalCents:300}).reward_cents,30,
  'A 50-point balance can use 0.3 points; no 50-point unlock');
for(const n of [-1,0.1,NaN,Number.MAX_SAFE_INTEGER])assert.throws(()=>rewardTerms({
  requestedTenths:n,availableTenths:1000,eligibleSubtotalCents:50000}));
const fixture={environment:'WORK',shop:'jill-work.myshopify.com',policy:'v13',
  customer_gid:'gid://shopify/Customer/111',
  pending_operations:0,eligible_spend_cents:50999,earned_points:50,
  committed_points:10,balance_points:40,coupons:[{engine_version:'13',points:10,
    value:5,minimum:25,code:'OLD_CODE',status:'active',discount_id:'gid://shopify/DiscountCodeNode/1'}]};
const migrated=planRewardsMigration(fixture);
assert.equal(migrated.earned_tenths,509);assert.equal(migrated.available_tenths,409);
assert.equal(migrated.remainder_cents,99);
assert.equal(migrated.coupons[0].value,5);assert.equal(migrated.coupons[0].minimum,25);
assert.deepEqual(issuedCouponTerms(migrated.coupons[0]),{policy:'v13',cost_tenths:100,value_cents:500,minimum_cents:2500});
assert.equal(planRewardsMigration(fixture,{existingReceipt:migrated.receipt}).already_applied,true);
assert.throws(()=>planRewardsMigration({...fixture,eligible_spend_cents:51000},{existingReceipt:migrated.receipt}));
assert.throws(()=>planRewardsMigration({...fixture,balance_points:41}));
assert.throws(()=>planRewardsMigration({...fixture,pending_operations:1}));
const prior={eligibleSpendCents:50999,previousOrderCreditCents:999,
  currentOrderCreditCents:999,committedTenths:500,enrolled:true};
assert.equal(reconcileRewardSpend(prior).signed_spend_delta_cents,0,'Repeated webhook/read earns nothing twice');
const refund=reconcileRewardSpend({...prior,currentOrderCreditCents:0});
assert.equal(refund.earned_tenths,500);
const debt=reconcileRewardSpend({...prior,committedTenths:509,currentOrderCreditCents:0});
assert.equal(debt.debt_tenths,9);assert.equal(debt.available_tenths,0);assert.equal(debt.redemption_held,true);
assert.throws(()=>reconcileRewardSpend({...prior,enrolled:false}));
const coupon={policy:'universal_v1',cost_tenths:3,value_cents:30,minimum_cents:300,
  discount_id:'gid://shopify/DiscountCodeNode/2',code:'LOCAL_CODE',
  customer_gid:'gid://shopify/Customer/111',reservation_id:'jill:reservation:local'};
const now=Date.now();
const observation={source:'shopify_admin_read',discount_id:coupon.discount_id,
  code:coupon.code,customer_gid:coupon.customer_gid,unusable:true,usage_count:0,observed_at_ms:now};
assert.equal(unusedReservationRelease({coupon,observation,nowMs:now}).release_tenths,3);
for(const change of [{usage_count:1},{unusable:false},{observed_at_ms:now-31000},
  {customer_gid:'gid://shopify/Customer/222'}])assert.throws(()=>unusedReservationRelease({
    coupon,observation:{...observation,...change},nowMs:now}));
console.log('PASS universal integer boundary table, exact v13 terms, once-only snapshot plan, fractional carry, no duplicate earn, refund debt and verified-unused release prerequisites.');
