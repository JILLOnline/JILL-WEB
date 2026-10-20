// JILL WORK PHASE 14 — SOURCE-ONLY D1 atomic quota+intent batch plan.
// NO deployed Worker, D1 calls, R2 operations, account grants or writes.
// The only supported future execution shape is ONE D1Database.batch()
// with both prepared statements, in order. No individual .run calls.
// Cloudflare D1 docs say a failed batch statement rolls back the batch.
// https://developers.cloudflare.com/d1/worker-api/d1-database/#batch
//
// The provided detail must ALREADY come from verified Shopify online Owner
// + WORK D1 authority and signed, exact Google submission detail. Passing a
// client-supplied detail is NOT authorization. No account-wide R2 billing
// attestation exists, so real use is disabled regardless of this plan.
import {timingSafeEqual} from 'node:crypto';
import {planWorkR2QuotaReservation} from './work-private-r2-quota-plan.mjs';
import {draftWorkR2ObjectIntent} from './work-private-r2-object-intent.mjs';

const SHOP='jill-work.myshopify.com';
const deny=()=>{throw Error('work_r2_atomic_batch_not_authorized');};
const sha=/^[0-9a-f]{64}$/;
const safe=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function same(a,b){
  return typeof a==='string' && typeof b==='string' &&
    sha.test(a)&&sha.test(b)&&
    timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
}
const COLUMNS=[
  'shop','submission_id','scope','item_key','reference_index',
  'reference_mac','reservation_id','object_key','content_sha256',
  'byte_length','state','created_at_ms','updated_at_ms',
];
/**
 * A plan, not an execution. The exact two prepared statements MUST run in
 * a single D1 batch transaction without intervening queries.
 *
 * SQLite changes() records the affected row count of the immediately
 * preceding quota UPDATE. If the quota UPDATE affects zero rows, the
 * CASE yields NULL for the NOT NULL shop column and triggers a SQL error;
 * Cloudflare documents rollback of the whole batch on statement failure.
 * If the insert fails due to duplicate slot/FK/key/MAC, quota rolls back.
 */
export function planWorkR2AtomicIntentBatch({
  shop,detail,submissionId,selector,registryKey,
  contentSha256,byteLength,nowMs,
}={}){
  if(shop!==SHOP||!Number.isSafeInteger(nowMs)||nowMs<=0)deny();
  let intent,quota;
  try{
    intent=draftWorkR2ObjectIntent({
      detail,submissionId,selector,registryKey,
      contentSha256,byteLength,nowMs,
    });
    quota=planWorkR2QuotaReservation({shop,byteLength,nowMs});
  }catch{deny();}
  if(intent.shop!==shop||intent.byte_length!==byteLength||
    !same(intent.content_sha256,contentSha256))deny();

  const placeholders=COLUMNS.map((_,i)=>
    i===0?'CASE WHEN changes()=1 THEN ? ELSE NULL END':'?');
  const insertSql='INSERT INTO jill_work_r2_object_intents ('+
    COLUMNS.join(',')+') VALUES ('+placeholders.join(',')+') '+
    'RETURNING shop,submission_id,scope,item_key,reference_index,'+
    'reference_mac,reservation_id,object_key,content_sha256,byte_length,state';
  const insertParams=COLUMNS.map(column=>intent[column]);
  return Object.freeze({
    state:'source_only_d1_batch_plan',
    statements:Object.freeze([
      Object.freeze({sql:quota.sql,params:quota.params}),
      Object.freeze({sql:insertSql,params:Object.freeze(insertParams)}),
    ]),
    intent, // PRIVATE SERVER ONLY. NEVER return this to HTTP or log it.
    monthKey:new Date(nowMs).toISOString().slice(0,7),
    execution_allowed:false,
    remote_migration_authorized:false,
    private_delivery:'disabled',
  });
}
/**
 * Intended server-side receipt validation only. Never treat a returned
 * receipt as an authorization to issue an R2 PUT or to preview artwork.
 * Network/commit ambiguity requires manual audit and NO automatic retry.
 */
export function inspectWorkR2AtomicBatchReceipt({plan,results}={}){
  if(!safe(plan)||plan.state!=='source_only_d1_batch_plan'||
     !safe(plan.intent)||!Array.isArray(results)||
     results.length!==2||
     results.some(r=>r?.success!==true||
       !Array.isArray(r.results)||r.results.length!==1))
    deny();
  const quota=results[0].results[0],row=results[1].results[0];
  const intent=plan.intent;
  if(!safe(quota)||quota.shop!==SHOP||
     quota.month_key!==plan.monthKey||
     !Number.isSafeInteger(quota.lifetime_reserved_bytes)||
     quota.lifetime_reserved_bytes<intent.byte_length||
     quota.lifetime_reserved_bytes>256*1024*1024||
     !Number.isSafeInteger(quota.month_uploads)||
     quota.month_uploads<1||quota.month_uploads>40||
     quota.month_class_a!==quota.month_uploads||
     quota.month_class_b!==quota.month_uploads||
     !Number.isSafeInteger(quota.lifetime_reservations)||
     quota.lifetime_reservations<1||
     !safe(row)||
     COLUMNS.slice(0,11).some(column=>row[column]!==intent[column]))
    deny();
  return Object.freeze({
    state:'server_only_intent_reserved_not_uploaded',
    upload_authorized:false,private_delivery:'disabled',
    retry_on_uncertain_commit:false,quota_refund:false,
    remote_migration_authorized:false,
  });
}
