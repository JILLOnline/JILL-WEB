// JILL HQ WORK: isolated, server-only R2 QUARANTINE adapter (source-only).
// NOT wired to Worker/Shopify HTTP; NOT private previews or a deployed upload.
// Never read Cloudinary URLs or treat untrusted asset IDs as storage keys.
// Requires independent online Shopify Owner + WORK D1 authorization and a
// signed exact-request projection BEFORE any R2 metadata/write operation.
// New uploads MUST be decoded/re-encoded by a separately approved sanitizer.
// The future WORK R2 binding and account privacy audit are NOT provisioned.
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {inspectWorkOwnerMediaIntent} from './work-private-media-intent.mjs';
import {draftWorkMediaRegistryBinding} from './work-private-media-registry.mjs';
import {inspectWorkPrivateArtworkBytes} from './work-private-media-ingest-contract.mjs';

const SHOP='jill-work.myshopify.com';
export const WORK_R2_PRIVATE_BUCKET='jill-work-private-artwork';
export const WORK_R2_PRIVATE_BINDING='JILL_WORK_PRIVATE_ARTWORK_R2';
const MAX_AUDIT_AGE_MS=5*60*1000;
const HEX=/^[a-f0-9]{64}$/;
const safeObject=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const deny=()=>{throw Error('work_r2_private_quarantine_not_authorized');};
const sameHex=(a,b)=>HEX.test(a||'')&&HEX.test(b||'')&&
  timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));
function approvedBucketAudit(audit,now){
  // The actual Cloudflare R2 account-side privacy probe MUST be supplied
  // by trusted server code; a browser-supplied receipt has no authority.
  if(!safeObject(audit)||
    audit.source!=='cloudflare_r2_account_privacy_audit_v1'||
    audit.bucket!==WORK_R2_PRIVATE_BUCKET||
    audit.binding!==WORK_R2_PRIVATE_BINDING||
    audit.public_dev_url_enabled!==false||
    audit.custom_domain_count!==0||
    audit.bucket_exists!==true||
    !Number.isSafeInteger(audit.checked_at_ms)||
    audit.checked_at_ms>now||
    now-audit.checked_at_ms>MAX_AUDIT_AGE_MS)deny();
  return true;
}
function bytes(input){
  if(Buffer.isBuffer(input))return Buffer.from(input);
  if(input instanceof Uint8Array&&input.buffer instanceof ArrayBuffer)
    return Buffer.from(input.buffer,input.byteOffset,input.byteLength);
  deny();
}
function checkR2Receipt(o,key,length,mac,sha){
  // Head must confirm the exact generated key and metadata. Missing or
  // inconsistent response after put is AMBIGUOUS, never auto-retry/delete.
  if(!safeObject(o)||o.key!==key||o.size!==length ||
    o.httpMetadata?.contentType!=='application/octet-stream'||
    o.customMetadata?.work_stage!=='quarantine_v1'||
    o.customMetadata?.reference_mac!==mac||
    !sameHex(o.customMetadata?.sha256,sha))
    deny();
  return true;
}
/**
 * Source-only R2 write adapter. It has NO registered HTTP route, bucket
 * binding, secrets or D1 persistence. Caller must pass trusted server-only
 * auth, detail reader, decoder/sanitizer and Cloudflare privacy auditor.
 * On success it reports only unlinked QUARANTINE state, never an object key,
 * URL, file bytes, provider ID, access grant or claim of private delivery.
 */
export async function stageWorkOwnerR2Quarantine({
  shop,submissionId,selector,verifiedAdminContext,
  authorizeWorkOwner,readVerifiedRequestDetail,
  registryKey,bytes:input,declaredMime,
  sanitizeArtwork,verifyPrivateWorkBucket,r2Bucket,
  nowMs=Date.now(),
}={}){
  if(shop!==SHOP||!safeObject(verifiedAdminContext)||
    typeof authorizeWorkOwner!=='function'||
    typeof readVerifiedRequestDetail!=='function'||
    typeof sanitizeArtwork!=='function'||
    typeof verifyPrivateWorkBucket!=='function'||
    !safeObject(r2Bucket)||
    typeof r2Bucket.put!=='function'||
    typeof r2Bucket.head!=='function'||
    !Number.isSafeInteger(nowMs)||nowMs<=0)
    deny();

  // Do not even query R2 or sanitizer until fresh Owner+D1 authorization
  // and the exact verified canonical Google QA detail are established.
  let detail;
  const intent=await inspectWorkOwnerMediaIntent({
    shop,submissionId,selector,verifiedAdminContext,authorizeWorkOwner,
    readVerifiedRequestDetail:async ({submissionId:id})=>{
      detail=await readVerifiedRequestDetail({submissionId:id});
      return detail;
    },
  });
  // An existing public Cloudinary image/upload URL must NEVER be ingested
  // as if it were a new privately owned file; legacy migration is separate.
  if(intent.kind!=='opaque_id')deny();
  const binding=draftWorkMediaRegistryBinding({
    detail,submissionId,selector,registryKey,
  });
  if(binding.shop!==SHOP||
    binding.status!=='pending_verification'||
    binding.provider!==null||!HEX.test(binding.reference_mac))deny();
  const source=inspectWorkPrivateArtworkBytes({
    bytes:input,declaredMime,
  });

  // The future decoder/re-encoder must be a trusted server-only component,
  // not a claim in a request body. It must enforce complete decode,
  // malware and resource rules separately from signature sniffing here.
  let sanitized;
  try {
    sanitized=await sanitizeArtwork({
      bytes:bytes(input),declaredMime:source.mime_type,
      maxOutputBytes:8*1024*1024,
    });
  } catch {deny();}
  if(!safeObject(sanitized)||sanitized.sanitized!==true||
    sanitized.mime_type!==source.mime_type)deny();
  const cleanedBytes=bytes(sanitized.bytes);
  const cleaned=inspectWorkPrivateArtworkBytes({
    bytes:cleanedBytes,declaredMime:sanitized.mime_type,
  });

  let audit;
  try {
    audit=await verifyPrivateWorkBucket({
      bucket:WORK_R2_PRIVATE_BUCKET,
      binding:WORK_R2_PRIVATE_BINDING,
    });
  } catch {deny();}
  approvedBucketAudit(audit,nowMs);

  // No source ref, email, customer, original name, raw URL, or ID in keys.
  const objectKey='work/quarantine/v1/'+randomUUID();
  const options={
    onlyIf:{etagDoesNotMatch:'*'},
    sha256:cleaned.content_sha256,
    httpMetadata:{
      contentType:'application/octet-stream',
      cacheControl:'private, no-store',
      contentDisposition:'attachment',
    },
    customMetadata:{
      work_stage:'quarantine_v1',
      reference_mac:binding.reference_mac,
      sha256:cleaned.content_sha256,
    },
  };
  let put,head;
  try{
    put=await r2Bucket.put(objectKey,cleanedBytes,options);
    if(!put)deny();
    checkR2Receipt(put,objectKey,cleaned.byte_length,
      binding.reference_mac,cleaned.content_sha256);
    head=await r2Bucket.head(objectKey);
    checkR2Receipt(head,objectKey,cleaned.byte_length,
      binding.reference_mac,cleaned.content_sha256);
  }catch{
    // A write may have happened. Never retry automatically or delete an
    // object when provider status is ambiguous. Separate operator audit.
    throw Error('work_r2_quarantine_write_unverified');
  }

  return Object.freeze({
    state:'quarantined_unlinked',
    private_delivery:'disabled',
    registry_persisted:false,
    content_verified_by_r2_head:true,
    bucket_public_access_audited:true,
    owner_access_recheck_required:true,
  });
}
