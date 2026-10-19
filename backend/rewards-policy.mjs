// Backend-only universal policy/migration planner for the EXISTING Rewards
// authority. No storage, browser export, discount creation or second wallet.
// v13 remains active until a snapshot/CAS migration and native checkout proof.
import {createHash} from 'node:crypto';
export const UNIVERSAL_REWARDS_POLICY='universal_v1';
const LEGACY=Object.freeze({10:{value:5,minimum:25},20:{value:12,minimum:50},
  35:{value:25,minimum:100},50:{value:40,minimum:150}});
const fail=code=>{throw Error('rewards_policy_'+code);};
function amount(n){if(!Number.isSafeInteger(n)||n<0||n>1_000_000_000)fail('invalid_integer');return n;}
export function rewardTerms({requestedTenths,availableTenths,eligibleSubtotalCents}){
  amount(requestedTenths);amount(availableTenths);amount(eligibleSubtotalCents);
  const maximumTenths=Math.min(availableTenths,Math.floor(eligibleSubtotalCents/100));
  if(requestedTenths<1||requestedTenths>maximumTenths)fail('ineligible_redemption');
  return Object.freeze({policy:UNIVERSAL_REWARDS_POLICY,requested_tenths:requestedTenths,
    reward_cents:requestedTenths*10,minimum_eligible_subtotal_cents:requestedTenths*100,
    maximum_tenths:maximumTenths});
}
export function reconcileRewardSpend({eligibleSpendCents,previousOrderCreditCents,
  currentOrderCreditCents,committedTenths,reservedTenths=0,enrolled,paidInitial=false}){
  for(const n of [eligibleSpendCents,previousOrderCreditCents,currentOrderCreditCents,
    committedTenths,reservedTenths])amount(n);
  if(enrolled!==true&&paidInitial!==true)fail('historical_order_not_enrolled');
  if(previousOrderCreditCents>eligibleSpendCents)fail('credit_snapshot_inconsistent');
  const delta=currentOrderCreditCents-previousOrderCreditCents;
  const spend=amount(eligibleSpendCents+delta);
  const earned=Math.floor(spend/100),used=committedTenths+reservedTenths;
  return Object.freeze({eligible_spend_cents:spend,order_credit_cents:currentOrderCreditCents,
    signed_spend_delta_cents:delta,earned_tenths:earned,remainder_cents:spend%100,
    available_tenths:Math.max(0,earned-used),debt_tenths:Math.max(0,used-earned),
    redemption_held:used>earned});
}
export function issuedCouponTerms(coupon){
  if(coupon?.policy===UNIVERSAL_REWARDS_POLICY){
    const n=amount(coupon.cost_tenths);
    if(n<1||coupon.value_cents!==n*10||coupon.minimum_cents!==n*100)
      fail('coupon_integrity');
    return {policy:UNIVERSAL_REWARDS_POLICY,cost_tenths:n,
      value_cents:coupon.value_cents,minimum_cents:coupon.minimum_cents};
  }
  const terms=LEGACY[coupon?.points];
  if(String(coupon?.engine_version)!=='13'||!terms||
    coupon.value!==terms.value||coupon.minimum!==terms.minimum)fail('legacy_coupon_integrity');
  return {policy:'v13',cost_tenths:coupon.points*10,
    value_cents:coupon.value*100,minimum_cents:coupon.minimum*100};
}
export function planRewardsMigration(snapshot,{existingReceipt=null}={}){
  // Normalize this input in the canonical owner from a fresh complete WORK
  // snapshot, retaining metafield compareDigests and Shopify observations.
  if(snapshot?.environment!=='WORK'||snapshot.shop!=='jill-work.myshopify.com'||
    !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(snapshot.customer_gid)||
    snapshot.policy!=='v13'||snapshot.pending_operations!==0||
    !Array.isArray(snapshot.coupons)||snapshot.coupons.length>250)
    fail('snapshot_unverified');
  const spend=amount(snapshot.eligible_spend_cents),earned=amount(snapshot.earned_points),
    committed=amount(snapshot.committed_points),balance=amount(snapshot.balance_points);
  if(earned!==Math.floor(spend/1000)||balance!==Math.max(0,earned-committed))
    fail('legacy_ledger_requires_reconciliation');
  const snapshotHash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  if(existingReceipt){
    if(existingReceipt.migration_id!=='jill_rewards_universal_v1'||
      existingReceipt.snapshot_sha256!==snapshotHash)fail('migration_receipt_conflict');
    return {already_applied:true,receipt:existingReceipt};
  }
  const codes=new Set();
  const coupons=snapshot.coupons.map(c=>{
    if(typeof c.code!=='string'||!c.code||codes.has(c.code))fail('coupon_snapshot_conflict');
    codes.add(c.code);
    // Preserve the entire original issued coupon, including its real Shopify
    // ID, expiry, status and nonce. Universal terms must not reinterpret it.
    return {...c,issuance_terms:issuedCouponTerms(c)};
  });
  const committedByWallet=coupons.reduce((sum,c)=>{
    if(!['active','used','expired','revoked'].includes(c.status))fail('coupon_status_unverified');
    return sum+(c.status==='revoked'?0:c.points);
  },0);
  if(committedByWallet!==committed)fail('legacy_coupon_commitments_inconsistent');
  const earnedTenths=Math.floor(spend/100),committedTenths=committed*10;
  return {already_applied:false,
    receipt:{migration_id:'jill_rewards_universal_v1',snapshot_sha256:snapshotHash,
      historical_fractional_carry_tenths:earnedTenths-earned*10},
    policy:UNIVERSAL_REWARDS_POLICY,earned_tenths:earnedTenths,
    committed_tenths:committedTenths,reserved_tenths:0,
    available_tenths:Math.max(0,earnedTenths-committedTenths),
    debt_tenths:Math.max(0,committedTenths-earnedTenths),remainder_cents:spend%100,
    eligible_spend_cents:spend,coupons};
}
export function unusedReservationRelease({coupon,observation,nowMs=Date.now()}){
  if(coupon?.policy!==UNIVERSAL_REWARDS_POLICY)fail('legacy_release_requires_review');
  issuedCouponTerms(coupon);
  if(!Number.isSafeInteger(nowMs)||
    !/^gid:\/\/shopify\/DiscountCodeNode\/[1-9][0-9]*$/.test(coupon.discount_id)||
    !/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/.test(coupon.customer_gid)||
    typeof coupon.code!=='string'||!coupon.code||
    typeof coupon.reservation_id!=='string'||!coupon.reservation_id)
    fail('reservation_identity_unverified');
  if(!observation||observation.source!=='shopify_admin_read'||
    observation.discount_id!==coupon.discount_id||observation.code!==coupon.code||
    observation.customer_gid!==coupon.customer_gid||observation.unusable!==true||
    observation.usage_count!==0||!Number.isSafeInteger(observation.observed_at_ms)||
    nowMs-observation.observed_at_ms<0||nowMs-observation.observed_at_ms>30000)
    fail('unused_status_unverified');
  return {release_tenths:coupon.cost_tenths,reservation_id:coupon.reservation_id,
    // The canonical owner must CAS the reservation from reserved to released
    // once and keep this receipt; repeating this plan alone grants no balance.
    requires_reservation_cas:true};
}
