// WORK-only PRIVATE MEDIA REGISTRY D1 ADAPTER (SOURCE ONLY).
// No route, deployment, table creation, provider upload, preview or signing.
// Real Shopify authenticate.admin() MUST provide the online session;
// this adapter enforces existing WORK D1 account-owner policy again.
// The signed exact Google QA @9 source is independently read AFTER Owner.
// No caller-supplied URL / reference ID / record is ever accepted.
// 0004 remains an INERT migration proposal: these functions are NOT WIRED.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {readWorkGoogleQaMerchantDetail}
  from './work-google-merchant-detail.mjs';
import {draftWorkMediaRegistryBinding,
  inspectWorkMediaRegistryBinding}
  from './work-private-media-registry.mjs';
import {chooseWorkOwnerReference}
  from './work-private-media-intent.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:[A-Za-z0-9._:-]{3,123}$/;
const TABLE='jill_work_private_media_registry';
export const WORK_MEDIA_REGISTRY_SELECT_SQL=
  'SELECT shop,submission_id,scope,item_key,reference_index,'+
  'reference_mac,status,created_at_ms,updated_at_ms '+
  'FROM '+TABLE+' WHERE shop=? AND submission_id=? AND scope=? '+
  'AND item_key=? AND reference_index=?';
export const WORK_MEDIA_REGISTRY_INSERT_SQL=
  'INSERT INTO '+TABLE+' (shop,submission_id,scope,item_key,'+
  'reference_index,reference_mac,status,created_at_ms,updated_at_ms) '+
  'VALUES (?,?,?,?,?,?,?,?,?) '+
  'ON CONFLICT(shop,submission_id,scope,item_key,reference_index) DO NOTHING';
const deny=()=>{throw Error('work_media_registry_access_denied');};
const disabled=(reason,intent)=>Object.freeze({
  state:'preview_disabled',reason,
  scope:intent.scope,item_id:intent.item_id,index:intent.index,
});
async function authorize({
  db,session,shop,submissionId,selector,registryKey,
  detailSecret,backendFetch,
}){
  if(shop!==SHOP||typeof submissionId!=='string'||
    !ID.test(submissionId)||!db||typeof db.prepare!=='function'||
    typeof detailSecret!=='string'||detailSecret.length<32||
    typeof registryKey!=='string'||
    Buffer.byteLength(registryKey,'utf8')<32||
    Buffer.byteLength(registryKey,'utf8')>512)deny();
  // team.read is reserved for the real Shopify online account owner,
  // unlike requests.read, which may allow other assigned merchant staff.
  // Session must originate from trusted Shopify SDK admin authentication.
  let grant;
  try{grant=await readWorkMerchantPermission({
    db,session,action:'team.read',
  });}catch{deny();}
  if(grant?.allowed!==true||grant.role!=='owner')deny();
  let detail;
  try{detail=await readWorkGoogleQaMerchantDetail({
    secret:detailSecret,submissionId,...(backendFetch?{backendFetch}:{}),
  });}catch{deny();}
  // Selector must be exact canonical request/item reference; reject
  // raw URLs, unrecognized source values or client-supplied identifiers.
  let intent,binding;
  try{
    intent=chooseWorkOwnerReference({detail,submissionId,selector});
    binding=draftWorkMediaRegistryBinding({
      detail,submissionId,selector,registryKey,
    });
  }catch{deny();}
  if(intent.kind!=='opaque_id'&&
    intent.kind!=='legacy_cloudinary_url')deny();
  return {detail,intent,binding};
}
async function readRow(db,binding){
  let row;
  try{
    row=await db.prepare(WORK_MEDIA_REGISTRY_SELECT_SQL).bind(
      SHOP,binding.submission_id,binding.scope,
      binding.item_id??'',binding.reference_index,
    ).first();
  }catch{deny();}
  return row;
}
function verifyRow({detail,submissionId,selector,registryKey,
  binding,row}){
  if(!row)return disabled('registry_binding_missing',binding);
  if(typeof row!=='object'||Array.isArray(row)||
    Object.keys(row).length!==9 ||
    row.shop!==SHOP||row.submission_id!==submissionId||
    row.scope!==binding.scope||
    row.item_key!==(binding.item_id??'')||
    row.reference_index!==binding.reference_index||
    !Number.isSafeInteger(row.created_at_ms)||
    row.created_at_ms<=0||
    !Number.isSafeInteger(row.updated_at_ms)||
    row.updated_at_ms<row.created_at_ms||
    !['pending_verification','quarantined','revoked'].includes(row.status))
    deny();
  // Recalculate/compare original source HMAC against current canonical
  // Google request, even for a revoked/quarantined row. No raw refs out.
  try{
    inspectWorkMediaRegistryBinding({
      detail,submissionId,selector,registryKey,
      record:{
        version:1,shop:row.shop,submission_id:row.submission_id,
        scope:row.scope,item_id:row.item_key||null,
        reference_index:row.reference_index,
        reference_mac:row.reference_mac,
        status:'pending_verification',provider:null,
      },
    });
  }catch{deny();}
  return disabled(row.status==='pending_verification'?
    'provider_storage_not_verified':'registry_entry_unavailable',binding);
}
/**
 * Authoritative Owner-gated, READ ONLY D1 lookup. Future HTTP callers must
 * first obtain the Shopify SDK authenticated ONLINE session; no public route
 * or browser transport is provided. A missing registry fails closed.
 */
export async function inspectAuthorizedWorkMediaRegistry({
  db,session,shop,submissionId,selector,registryKey,
  detailSecret,backendFetch,
}={}){
  const {detail,binding}=await authorize({
    db,session,shop,submissionId,selector,
    registryKey,detailSecret,backendFetch,
  });
  const row=await readRow(db,binding);
  return verifyRow({
    detail,submissionId,selector,registryKey,binding,row,
  });
}
/**
 * Owner-gated, pending-only insert for a FUTURE explicitly-enabled backend.
 * No route or caller enables this today. A WORK-only dedicated MAC secret
 * and independently approved/applied 0004 table are prerequisites.
 * Never returns a URL or provider asset; every row is preview_disabled.
 */
export async function registerPendingAuthorizedWorkMedia({
  db,session,shop,submissionId,selector,registryKey,
  detailSecret,backendFetch,registrationEnabled=false,
  now=Date.now,
}={}){
  if(registrationEnabled!==true||typeof now!=='function')deny();
  const {detail,binding}=await authorize({
    db,session,shop,submissionId,selector,
    registryKey,detailSecret,backendFetch,
  });
  const at=now();
  if(!Number.isSafeInteger(at)||at<=0)deny();
  try{
    await db.prepare(WORK_MEDIA_REGISTRY_INSERT_SQL).bind(
      SHOP,submissionId,binding.scope,binding.item_id??'',
      binding.reference_index,binding.reference_mac,
      'pending_verification',at,at,
    ).run();
  }catch{deny();}
  // A conflict with a different original reference must be DENIED;
  // never rewrite the MAC, resurrect revocations, or insert a "verified"
  // provider status. Even successful insertion yields NO file access.
  const row=await readRow(db,binding);
  return verifyRow({
    detail,submissionId,selector,registryKey,binding,row,
  });
}
