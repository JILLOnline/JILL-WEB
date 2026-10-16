// WORK-only media registry fingerprint/record validator. SOURCE ONLY.
// This module never grants file access, fetches files, migrates assets,
// creates tables, or trusts a self-reported provider-private state.
// Call it ONLY after real Shopify online Owner + WORK D1 authorization,
// using the separately verified exact Google @9 request projection.
// A registry record does not prove Cloudinary/R2 privacy or ownership.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {chooseWorkOwnerReference} from './work-private-media-intent.mjs';

const SHOP='jill-work.myshopify.com';
const MAC=/^[a-f0-9]{64}$/;
const SAFE_RECORD=new Set([
  'version','shop','submission_id','scope','item_id','reference_index',
  'reference_mac','status','provider',
]);
function deny(){throw Error('work_media_registry_not_authorized');}
function keyOk(key){
  return typeof key==='string'&&
    Buffer.byteLength(key,'utf8')>=32&&
    Buffer.byteLength(key,'utf8')<=512;
}
function select({detail,submissionId,selector}){
  const intent=chooseWorkOwnerReference({detail,submissionId,selector});
  if(intent.kind!=='opaque_id' &&
    intent.kind!=='legacy_cloudinary_url')deny();
  const scope=intent.scope;
  const itemId=intent.item_id;
  const refs=scope==='request' ? detail.reference_ids :
    detail.items.filter(x=>x.item_id===itemId)[0]?.reference_ids;
  if(!Array.isArray(refs)||refs.length>20 ||
    intent.index>=refs.length ||
    typeof refs[intent.index]!=='string'||
    refs[intent.index].length>512)deny();
  return {intent,sourceReference:refs[intent.index]};
}
function hmac(key,data){
  return createHmac('sha256',key)
    .update(JSON.stringify(data),'utf8').digest('hex');
}
/**
 * Candidate for a FUTURE WORK D1 registry write, not an executable write.
 * The source must be the immutable Google @9 projection after Owner/D1.
 * A unique, dedicated server-side registry MAC secret must be provisioned
 * and audited separately; NEVER send it to a browser.
 * Revision is intentionally not included in the MAC: updating status can
 * increment revision without modifying original submitted references.
 */
export function draftWorkMediaRegistryBinding({
  detail,submissionId,selector,registryKey,
}={}){
  if(!keyOk(registryKey))deny();
  const {intent,sourceReference}=select({detail,submissionId,selector});
  const record={
    version:1,shop:SHOP,submission_id:submissionId,
    scope:intent.scope,item_id:intent.item_id,
    reference_index:intent.index,
    reference_mac:hmac(registryKey,[
      'jill_work_media_registry_source_v1',SHOP,
      submissionId,intent.scope,intent.item_id,intent.index,sourceReference,
    ]),
    status:'pending_verification',
    provider:null,
  };
  return Object.freeze(record);
}
/**
 * Read-only, no file/URL material returned. Even a row claimed 'verified'
 * by a faulty caller must be rejected until a separate provider-attested
 * storage service and short-lived Owner-specific delivery grant exist.
 */
export function inspectWorkMediaRegistryBinding({
  detail,submissionId,selector,registryKey,record,
}={}){
  const expected=draftWorkMediaRegistryBinding({
    detail,submissionId,selector,registryKey,
  });
  if(!record||typeof record!=='object'||Array.isArray(record)||
    Object.keys(record).some(k=>!SAFE_RECORD.has(k))||
    Object.keys(record).length!==SAFE_RECORD.size||
    record.version!==1 ||
    record.status!=='pending_verification'||
    record.provider!==null ||
    record.shop!==expected.shop ||
    record.submission_id!==expected.submission_id ||
    record.scope!==expected.scope ||
    record.item_id!==expected.item_id ||
    record.reference_index!==expected.reference_index ||
    !MAC.test(record.reference_mac||''))deny();
  if(!timingSafeEqual(
    Buffer.from(expected.reference_mac,'hex'),
    Buffer.from(record.reference_mac,'hex')))deny();
  return Object.freeze({
    state:'preview_disabled',
    reason:'provider_storage_not_verified',
    scope:expected.scope,
    item_id:expected.item_id,
    index:expected.reference_index,
  });
}
