// JILL WORK — Phase 16 PRE-WRITE CHECKLIST ONLY (never uploads).
// Source-only. No Worker route, R2 call, D1 write, SQL migration, secrets,
// or account access. An untrusted payload must NEVER supply 'trusted' data.
// Live execution remains blocked even after all checks pass.
import {createHash,timingSafeEqual} from 'node:crypto';
import {inspectWorkR2AtomicBatchReceipt}
  from './work-private-r2-d1-batch-plan.mjs';
import {WORK_R2_QUOTA_POLICY as POLICY}
  from './work-private-r2-quota-plan.mjs';
import {inspectWorkPrivateArtworkBytes}
  from './work-private-media-ingest-contract.mjs';

const ACCOUNT='1cae999d55b9df68a81ad876fb040e60';
const MAX_AGE_MS=5*60*1000;
const SHA=/^[0-9a-f]{64}$/;
const deny=()=>{throw Error('work_r2_prewrite_evidence_unverified');};
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const same=(a,b)=>SHA.test(a||'')&&SHA.test(b||'')&&
  timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
const timeOk=(t,now)=>Number.isSafeInteger(t)&&t>0&&
  t<=now&&now-t<=MAX_AGE_MS;

export const WORK_R2_ACCOUNT_SOFT_LIMITS=Object.freeze({
  // Safety margins, not Cloudflare R2 plan allowances or a hard $0 cap.
  max_current_standard_bytes:512*1024*1024,
  max_month_standard_gb_month:1,
  max_month_class_a:10_000,
  max_month_class_b:20_000,
});
/**
 * Trusted account-side usage and privately configured bucket conditions
 * must be gathered independently by a future server-held provider client.
 * This validator DOES NOT make evidence genuine: a source string alone
 * can be forged. It cannot prevent other account services from consuming
 * allowance after the snapshot. No true Cloudflare spending cap exists.
 */
export function inspectWorkR2PrewriteEvidence({
  plan,batchResults,sanitizedBytes,declaredMime,
  accountUsage,bucketPrivacy,nowMs,
}={}){
  if(!Number.isSafeInteger(nowMs)||nowMs<=0||
     !object(plan)||plan.state!=='source_only_d1_batch_plan'||
     !object(plan.intent)||!Array.isArray(batchResults))deny();
  let receipt;
  try{receipt=inspectWorkR2AtomicBatchReceipt({
    plan,results:batchResults,
  });}catch{deny();}
  if(receipt.state!=='server_only_intent_reserved_not_uploaded'||
     receipt.upload_authorized!==false)deny();

  if(!(Buffer.isBuffer(sanitizedBytes)||
       (sanitizedBytes instanceof Uint8Array &&
        sanitizedBytes.buffer instanceof ArrayBuffer)))deny();
  const bytes=Buffer.from(sanitizedBytes);
  let observed;
  try{
    observed=inspectWorkPrivateArtworkBytes({bytes,declaredMime});
  }catch{deny();}
  if(bytes.length!==plan.intent.byte_length||
     observed.byte_length!==plan.intent.byte_length||
     !same(createHash('sha256').update(bytes).digest('hex'),
       plan.intent.content_sha256))deny();

  const budget=WORK_R2_ACCOUNT_SOFT_LIMITS;
  // Require a complete, trusted, current ACCOUNT-level billable-usage
  // observation, including every bucket and other service in this account.
  // 'projected' is explicitly a separately measured provider-side field;
  // treating current bytes as a complete month forecast would be unsafe.
  if(!object(accountUsage)||
     accountUsage.source!=='trusted_server_cloudflare_r2_account_usage_v1'||
     accountUsage.account_id!==ACCOUNT||
     accountUsage.shop!==POLICY.shop||
     accountUsage.plan!=='free'||
     accountUsage.storage_class!=='Standard'||
     accountUsage.complete!==true||
     accountUsage.includes_other_buckets_and_services!==true||
     accountUsage.billable_overage_possible!==false||
     accountUsage.period_utc!==plan.monthKey||
     !timeOk(accountUsage.checked_at_ms,nowMs)||
     !Number.isSafeInteger(accountUsage.standard_bytes_current)||
     accountUsage.standard_bytes_current<0||
     accountUsage.standard_bytes_current+
       plan.intent.byte_length>budget.max_current_standard_bytes||
     typeof accountUsage.projected_month_standard_gb_month!=='number'||
     !Number.isFinite(accountUsage.projected_month_standard_gb_month)||
     accountUsage.projected_month_standard_gb_month<0||
     accountUsage.projected_month_standard_gb_month>
       budget.max_month_standard_gb_month||
     !Number.isSafeInteger(accountUsage.class_a_month)||
     accountUsage.class_a_month<0||
     accountUsage.class_a_month+1>budget.max_month_class_a||
     !Number.isSafeInteger(accountUsage.class_b_month)||
     accountUsage.class_b_month<0||
     accountUsage.class_b_month+1>budget.max_month_class_b)
    deny();

  if(!object(bucketPrivacy)||
     bucketPrivacy.source!=='trusted_server_cloudflare_r2_privacy_snapshot_v1'||
     bucketPrivacy.account_id!==ACCOUNT||
     bucketPrivacy.bucket!==POLICY.bucket||
     bucketPrivacy.storage_class!=='Standard'||
     bucketPrivacy.public_dev_url_enabled!==false||
     bucketPrivacy.custom_domain_count!==0||
     !timeOk(bucketPrivacy.checked_at_ms,nowMs))
    deny();

  // Even a fully passing model-data receipt cannot authorize PUT.
  // Needs account-authoritative provider adapters, Owner auth, retention,
  // privacy, recovery, real D1/registry activation, separate approval.
  return Object.freeze({
    state:'synthetic_prewrite_checks_satisfied',
    evidence_is_provider_authenticated:false,
    upload_authorized:false,
    preview_enabled:false,
    auto_retry:false,
    auto_delete:false,
    quota_refund:false,
    remote_migration_authorized:false,
  });
}
