// JILL WORK — SOURCE ONLY: durable R2 intent/reconciliation candidates.
// No Worker route, R2 access, D1 access, mutations, deliveries or secrets.
// The caller MUST verify actual Shopify online Owner + WORK D1 permission,
// signed exact Google request, account-wide R2 budget and quota reservation
// in an approved ATOMIC server-held transaction BEFORE any provider PUT.
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {draftWorkMediaRegistryBinding} from './work-private-media-registry.mjs';
import {chooseWorkOwnerReference} from './work-private-media-intent.mjs';
import {WORK_R2_QUOTA_POLICY} from './work-private-r2-quota-plan.mjs';

const SHOP='jill-work.myshopify.com';
const KEY_PREFIX='work/quarantine/v1/';
const HEX=/^[0-9a-f]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const deny=()=>{throw Error('work_r2_object_intent_not_authorized');};
const safeObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const sameHash=(a,b)=>HEX.test(a||'')&&HEX.test(b||'')&&
  timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));

export function draftWorkR2ObjectIntent({
  detail,submissionId,selector,registryKey,contentSha256,
  byteLength,nowMs,
}={}){
  if(!Number.isSafeInteger(nowMs)||nowMs<=0||
     !Number.isSafeInteger(byteLength)||byteLength<20||
     byteLength>WORK_R2_QUOTA_POLICY.max_object_bytes||
     !HEX.test(contentSha256||''))deny();
  const intent=chooseWorkOwnerReference({detail,submissionId,selector});
  if(intent.kind!=='opaque_id'||intent.submission_id!==submissionId)deny();
  const bound=draftWorkMediaRegistryBinding({
    detail,submissionId,selector,registryKey,
  });
  if(bound.shop!==SHOP||bound.provider!==null||
     bound.status!=='pending_verification'||!HEX.test(bound.reference_mac))deny();
  const uuid=randomUUID();
  const key=KEY_PREFIX+uuid;
  return Object.freeze({
    shop:SHOP,submission_id:submissionId,
    scope:bound.scope,item_key:bound.item_id??'',
    reference_index:bound.reference_index,
    reference_mac:bound.reference_mac,
    reservation_id:uuid,object_key:key,
    content_sha256:contentSha256,byte_length:byteLength,
    state:'reserved',created_at_ms:nowMs,updated_at_ms:nowMs,
  });
}
/**
 * Advisory ONLY. A trusted server-side provider HEAD and fresh account
 * privacy audit are needed, but callback labels are NOT cryptographic proof.
 * A missing/ambiguous HEAD MUST NOT trigger retries, delete or refund.
 * Caller must not promote an object from this alone.
 */
export function inspectWorkR2ObjectReconciliation({
  intent,providerHead,privacyAudit,nowMs,
}={}){
  const verdict=(state)=>Object.freeze({
    state,private_delivery:'disabled',preview_enabled:false,
    auto_retry:false,auto_delete:false,quota_refund:false,
    provider_attested_for_delivery:false,
  });
  if(!safeObject(intent)||intent.shop!==SHOP||
     intent.state!=='reserved'||!UUID.test(intent.reservation_id||'')||
     intent.object_key!==KEY_PREFIX+intent.reservation_id||
     !HEX.test(intent.reference_mac||'')||
     !HEX.test(intent.content_sha256||'')||
     !Number.isSafeInteger(intent.byte_length)||
     intent.byte_length<20||
     intent.byte_length>WORK_R2_QUOTA_POLICY.max_object_bytes||
     !Number.isSafeInteger(nowMs)||nowMs<=0)deny();
  if(!safeObject(privacyAudit)||
     privacyAudit.source!=='trusted_server_cloudflare_r2_privacy_snapshot_v1'||
     privacyAudit.bucket!==WORK_R2_QUOTA_POLICY.bucket||
     privacyAudit.public_dev_url_enabled!==false||
     privacyAudit.custom_domain_count!==0||
     privacyAudit.storage_class!=='Standard'||
     !Number.isSafeInteger(privacyAudit.checked_at_ms)||
     privacyAudit.checked_at_ms>nowMs||
     nowMs-privacyAudit.checked_at_ms>5*60*1000)
    return verdict('manual_review_required');
  if(!safeObject(providerHead)||
     providerHead.source!=='trusted_server_r2_head_v1'||
     providerHead.key!==intent.object_key||
     providerHead.size!==intent.byte_length||
     providerHead.httpMetadata?.contentType!=='application/octet-stream'||
     providerHead.httpMetadata?.cacheControl!=='private, no-store'||
     providerHead.httpMetadata?.contentDisposition!=='attachment'||
     providerHead.customMetadata?.work_stage!=='quarantine_v1'||
     !sameHash(providerHead.customMetadata?.sha256,intent.content_sha256)||
     !sameHash(providerHead.customMetadata?.reference_mac,intent.reference_mac))
    return verdict('manual_review_required');
  // Matching provider metadata suggests the intended quarantined bytes
  // exist but neither authorizes private delivery nor registry linkage.
  return verdict('quarantined_unlinked_candidate');
}
