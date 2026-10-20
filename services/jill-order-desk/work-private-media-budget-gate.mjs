// JILL WORK — SOURCE ONLY: fail-closed Images Free quota contract.
// No Cloudflare API, D1, R2, HTTP route, or deployment. Not a $0 hard
// billing cap. Never install in a live Worker without independently
// certified server-held Cloudflare usage and durable atomic reservations.
import {randomUUID} from 'node:crypto';

export const WORK_IMAGES_ACCOUNT_ID='1cae999d55b9df68a81ad876fb040e60';
export const WORK_IMAGES_POLICY=Object.freeze({
  shop:'jill-work.myshopify.com',
  account_id:WORK_IMAGES_ACCOUNT_ID,
  max_account_unique_month:4500, // reserve 500 of the Images Free allowance
  max_work_reservations_month:100,
  max_snapshot_age_ms:5*60*1000,
});
const deny=()=>{throw Error('work_private_images_budget_not_authorized');};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const count=n=>Number.isSafeInteger(n)&&n>=0;
const periodOf=ms=>new Date(ms).toISOString().slice(0,7);
/**
 * Server-only future integration point for the existing sanitizer's
 * authorizeFreeTransformation callback.
 *
 * readAccountSnapshot MUST be authoritative account-wide Cloudflare data,
 * including other Workers/shops. Paid/unknown plan or incomplete scope DENY.
 * reserveAtomic MUST be an independently certified durable cross-request
 * compare-and-reserve transaction (NOT JS memory, KV, or SELECT then UPDATE).
 * Neither dependency is implemented. Caller must already be verified as
 * online Shopify WORK Owner with D1 grants and canonical signed details.
 */
export function makeWorkImagesFreeBudgetGate({
  nowMs,readAccountSnapshot,reserveAtomic,
}={}){
  if(typeof readAccountSnapshot!=='function'||
     typeof reserveAtomic!=='function'||
     !Number.isSafeInteger(nowMs)||nowMs<=0)deny();
  const policy=WORK_IMAGES_POLICY;
  const period=periodOf(nowMs);
  return async function authorizeFreeTransformation({shop,kind}={}){
    if(shop!==policy.shop||kind!=='private_artwork_sanitize_v1')deny();
    let s;
    try{s=await readAccountSnapshot({accountId:policy.account_id,period});}
    catch {deny();}
    if(!obj(s)||s.source!=='verified_cloudflare_account_usage_v1'||
      s.account_id!==policy.account_id||s.shop!==policy.shop||
      s.period!==period||s.plan!=='free'||s.complete!==true||
      s.includes_other_services!==true||
      !Number.isSafeInteger(s.checked_at_ms)||s.checked_at_ms>nowMs||
      nowMs-s.checked_at_ms>policy.max_snapshot_age_ms||
      !count(s.account_unique_transformations)||
      !count(s.work_reserved_transformations)||
      s.account_unique_transformations+1>policy.max_account_unique_month||
      s.work_reserved_transformations+1>policy.max_work_reservations_month)deny();

    // Never use customer data in the reservation nonce.
    // Any CAS conflict fails closed; no automatic retry.
    const nonce=randomUUID();
    let receipt;
    try{
      receipt=await reserveAtomic({
        accountId:policy.account_id,shop:policy.shop,period,nonce,
        expectedAccountCount:s.account_unique_transformations,
        expectedWorkReservations:s.work_reserved_transformations,
        maxAccountCount:policy.max_account_unique_month,
        maxWorkReservations:policy.max_work_reservations_month,
      });
    }catch {deny();}
    if(!obj(receipt)||receipt.source!=='work_atomic_images_reservation_v1'||
      receipt.approved!==true||receipt.account_id!==policy.account_id||
      receipt.shop!==policy.shop||receipt.period!==period||
      receipt.nonce!==nonce||
      receipt.previous_account_count!==s.account_unique_transformations||
      receipt.previous_work_reservations!==s.work_reserved_transformations||
      receipt.new_work_reservations!==s.work_reserved_transformations+1)deny();
    return Object.freeze({
      allowed:true,plan:'free',source:'trusted_work_images_free_gate_v1',
    });
  };
}
