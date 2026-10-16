// JILL HQ WORK — private R2 object STAGING adapter, SOURCE ONLY.
// NO route, bucket binding, bucket creation, OAuth bypass, D1 mutation,
// registry write, Cloudinary migration, presigned URL, or preview.
// Do not wire until the Owner separately certifies the real WORK-only
// R2 bucket is non-public AND a trusted decoder/re-encoder is installed.
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import {inspectWorkOwnerMediaIntent}
  from './work-private-media-intent.mjs';
import {inspectWorkPrivateArtworkBytes}
  from './work-private-media-ingest-contract.mjs';

export const WORK_R2_BUCKET_NAME='jill-work-private-artwork';
export const WORK_R2_BINDING='JILL_WORK_PRIVATE_ARTWORK_R2';
const WORK_SHOP='jill-work.myshopify.com';
const HEX=/^[a-f0-9]{64}$/;
const UUID_V4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_ATTESTATION_AGE_MS=5*60*1000;
const den=()=>{throw Error('work_r2_private_storage_not_authorized');};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

export function assertWorkR2NotActivated(config){
  // This module may be committed without changing the deployed manifest.
  // An R2 binding can only be introduced by a separately approved release.
  if(config?.name!=='jill-order-desk-canary-work'||
    config?.d1_databases?.length!==1||
    config.d1_databases[0]?.database_id!==
      '3f17c186-c794-4e00-8f20-017191373a19'||
    config.d1_databases[0]?.database_name!=='jill-order-desk-work'||
    config.vars?.JILL_WORK_HOST_STAGE!=='canary'||
    Object.hasOwn(config.vars||{},'JILL_WORK_MEDIA_R2_ENABLED')||
    (Array.isArray(config.r2_buckets)&&config.r2_buckets.length>0)||
    Object.hasOwn(config,'r2_buckets'))
    den();
  return Object.freeze({r2_binding:'absent',media_runtime:'disabled'});
}
function eligibleBucket(proof,nowMs){
  // This is a server-authored private-access CHECKPOINT, not a
  // cryptographic/provider attestation in its own right. Never accept
  // it from a browser or assume R2 bucket privacy from an R2 binding.
  if(!proof||typeof proof!=='object'||Array.isArray(proof)||
     Object.keys(proof).length!==7||
     proof.source!=='cloudflare_owner_verified_bucket_settings'||
     proof.bucket_name!==WORK_R2_BUCKET_NAME||
     proof.binding_name!==WORK_R2_BINDING||
     proof.bucket_public_dev_url_enabled!==false||
     proof.bucket_public_custom_domain_enabled!==false||
     proof.cloud_account_matches_work!==true||
     !Number.isSafeInteger(proof.checked_at_ms)||
     proof.checked_at_ms>nowMs||
     proof.checked_at_ms<nowMs-MAX_ATTESTATION_AGE_MS)den();
}
function trustedSanitizedOutput(sanitized,original){
  if(!sanitized||typeof sanitized!=='object'||
    Array.isArray(sanitized)||
    Object.keys(sanitized).length!==4||
    sanitized.operation!=='trusted_decode_and_reencode_v1'||
    sanitized.sanitizer_verified!==true||
    typeof sanitized.mime_type!=='string')
    den();
  // Real verified image decoder/re-encoder MUST be supplied by the
  // future server-side route. A caller-provided boolean is not a
  // substitute; adapter is NEVER exposed directly to HTTP.
  const checked=inspectWorkPrivateArtworkBytes({
    bytes:sanitized.bytes,declaredMime:sanitized.mime_type,
  });
  const sanitizedBytes=Buffer.from(sanitized.bytes);
  if(timingSafeEqual(
    Buffer.from(checked.content_sha256,'hex'),
    Buffer.from(original.content_sha256,'hex')))
    den(); // Reject unchanged input masquerading as sanitized.
  return {bytes:sanitizedBytes,checked};
}
/**
 * Future server-side use ONLY: full Owner/D1 and canonical Google exact-ID
 * checks happen BEFORE decoding or any bucket operation. This is not
 * a customer upload route and NOT runtime-wired today.
 *
 * Input bytes are untrusted. decodeAndReencode is a trusted server-owned
 * integration point that must truly parse+re-encode. It is NOT supplied
 * by the browser. confirmPrivateBucket must independently inspect
 * Cloudflare bucket publicity + account/binding identity on each release.
 */
export async function stageWorkOwnerArtworkToPrivateR2({
  shop,submissionId,selector,verifiedAdminContext,
  authorizeWorkOwner,readVerifiedRequestDetail,
  inputBytes,declaredMime,decodeAndReencode,
  bucket,confirmPrivateBucket,
  nowMs=Date.now(),
}={}){
  if(shop!==WORK_SHOP||
    !Number.isSafeInteger(nowMs)||nowMs<1||
    !bucket||typeof bucket!=='object'||
    typeof bucket.put!=='function'||
    typeof bucket.head!=='function'||
    typeof bucket.get!=='function'||
    typeof decodeAndReencode!=='function'||
    typeof confirmPrivateBucket!=='function')
    den();
  try{
    const intent=await inspectWorkOwnerMediaIntent({
      shop,submissionId,selector,verifiedAdminContext,
      authorizeWorkOwner,readVerifiedRequestDetail,
    });
    // Public legacy Cloudinary URLs, external URLs, unknown refs,
    // guessed cross-item selectors all stay blocked.
    if(intent.state!=='preview_disabled'||
      intent.kind!=='opaque_id')den();
    const original=inspectWorkPrivateArtworkBytes({
      bytes:inputBytes,declaredMime,
    });
    const privateProof=await confirmPrivateBucket({
      expectedBucket:WORK_R2_BUCKET_NAME,
      expectedBinding:WORK_R2_BINDING,
    });
    eligibleBucket(privateProof,nowMs);
    const sanitized=await decodeAndReencode({
      inputBytes:Buffer.from(inputBytes),
      declaredMime,maximumBytes:8*1024*1024,
    });
    const {bytes,checked}=trustedSanitizedOutput(sanitized,original);
    const uuid=randomUUID();
    if(!UUID_V4.test(uuid))den();
    const key='work-artwork/v1/'+uuid;
    // R2 onlyIf If-None-Match:* refuses overwrites even if a key
    // unexpectedly collides. No user filename, URL or request ID in key.
    const put=await bucket.put(key,bytes,{
      onlyIf:new Headers({'If-None-Match':'*'}),
      httpMetadata:{
        contentType:checked.mime_type,
        contentDisposition:'attachment',
        cacheControl:'private, no-store, max-age=0',
      },
      customMetadata:{
        lifecycle:'work_private_unregistered',
        content_sha256:checked.content_sha256,
      },
    });
    if(!put||put.key!==key||put.size!==bytes.byteLength)den();
    // Metadata-only head plus body read-back validates provider persistence.
    const head=await bucket.head(key);
    if(head?.key!==key||head.size!==bytes.byteLength||
      head.httpMetadata?.contentType!==checked.mime_type||
      head.customMetadata?.content_sha256!==checked.content_sha256||
      head.customMetadata?.lifecycle!=='work_private_unregistered')den();
    const read=await bucket.get(key);
    if(!read||read.key!==key||
      read.size!==bytes.byteLength||
      typeof read.arrayBuffer!=='function')den();
    const reread=Buffer.from(await read.arrayBuffer());
    if(reread.byteLength!==bytes.byteLength||
      !HEX.test(checked.content_sha256)||
      !timingSafeEqual(Buffer.from(digest(reread),'hex'),
        Buffer.from(checked.content_sha256,'hex')))den();
    // INTERNAL server-only receipt. The object_key MUST NEVER go to a
    // browser, customer, or logs. No preview grant or registry activation.
    return Object.freeze({
      state:'r2_object_staged_unregistered',
      object_key:key,
      content_sha256:checked.content_sha256,
      mime_type:checked.mime_type,
      byte_length:bytes.byteLength,
      registry_state:'not_written',
      delivery_state:'disabled',
      provider_public_access:'not_independently_attested_by_this_receipt',
    });
  }catch{
    // Fail closed with no raw file, key, PII, URL or provider error output.
    // A partial write may leave an unregistered orphan; reconcile manually.
    den();
  }
}
