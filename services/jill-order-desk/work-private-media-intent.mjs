// WORK-only private artwork authorization INTENT, source-only and fail closed.
// NOT an HTTP route, media download, proxy, presign, or migration.
// Caller must supply server-only Shopify Admin auth + WORK D1 Owner verifier
// and the existing exact-ID, signed Google v9 detail reader. No client role,
// emailed name, URL or external file ID can serve as authorization.
import {describeWorkReference} from './work-reference-provenance.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const ITEM=/^[A-Za-z0-9._:-]{1,256}$/;
function deny(){throw Error('work_private_media_access_denied');}
const freeze=o=>Object.freeze(o);
function validateSelector(selector){
  if(!selector || typeof selector!=='object' ||
    Array.isArray(selector) ||
    Object.keys(selector).some(k=>!['scope','itemId','index'].includes(k)) ||
    !['request','item'].includes(selector.scope) ||
    !Number.isSafeInteger(selector.index) ||
    selector.index<0||selector.index>19)deny();
  if(selector.scope==='request'){
    if(Object.hasOwn(selector,'itemId'))deny();
  }else if(typeof selector.itemId!=='string' ||
    !ITEM.test(selector.itemId))deny();
  return freeze({
    scope:selector.scope,
    itemId:selector.scope==='item'?selector.itemId:null,
    index:selector.index,
  });
}
export function chooseWorkOwnerReference({
  detail,submissionId,selector,
}={}){
  const selected=validateSelector(selector);
  if(!detail || typeof detail!=='object' || Array.isArray(detail) ||
    detail.version!==1 ||
    detail.operation!=='custom_order.merchant.detail.result' ||
    detail.submission_id!==submissionId || !ID.test(submissionId||'') ||
    detail.attachment_state!=='unresolved' ||
    !Array.isArray(detail.items)||!Array.isArray(detail.reference_ids) ||
    !Number.isSafeInteger(detail.revision)||detail.revision<1)deny();
  let refs;
  if(selected.scope==='request')refs=detail.reference_ids;
  else{
    const matched=detail.items.filter(x=>
      x?.item_id===selected.itemId);
    if(matched.length!==1)deny();
    refs=matched[0].reference_ids;
  }
  if(!Array.isArray(refs)||refs.length>20 ||
    selected.index>=refs.length ||
    typeof refs[selected.index]!=='string')deny();
  const result=describeWorkReference(refs[selected.index]);
  // No raw URL, public ID, base URL, storage path, signed link, or media
  // response may leave this function. File privacy has NOT been certified.
  const reason=result.kind==='legacy_cloudinary_url'?
    'legacy_public_delivery_requires_migration':
    result.kind==='opaque_id'?
      'private_asset_registry_not_connected':
      'unverified_reference';
  return freeze({
    state:'preview_disabled',
    reason,
    submission_id:submissionId,
    revision:detail.revision,
    scope:selected.scope,
    item_id:selected.itemId,
    index:selected.index,
    kind:result.kind,
    display:result.label,
  });
}
export async function inspectWorkOwnerMediaIntent({
  shop,submissionId,selector,verifiedAdminContext,
  authorizeWorkOwner,readVerifiedRequestDetail,
}={}){
  if(shop!==SHOP || typeof submissionId!=='string' ||
    !ID.test(submissionId) ||
    typeof authorizeWorkOwner!=='function' ||
    typeof readVerifiedRequestDetail!=='function' ||
    !verifiedAdminContext || typeof verifiedAdminContext!=='object')
    deny();
  const selected=validateSelector(selector);
  // No Google access or media lookup until the Shopify online staff session
  // AND WORK D1 Owner permission are independently verified by the caller's
  // injected server-side authorizer. Do not accept a plain caller role flag.
  let permission;
  try{
    permission=await authorizeWorkOwner({
      context:verifiedAdminContext,shop,
      submissionId,action:'requests.read',
    });
  }catch{deny();}
  if(permission?.allowed!==true ||
    permission?.role!=='owner' || permission?.shop!==SHOP ||
    permission?.submission_id!==submissionId ||
    permission?.source!=='shopify_online_plus_work_d1')deny();
  let detail;
  try{detail=await readVerifiedRequestDetail({submissionId});}
  catch{deny();}
  return chooseWorkOwnerReference({
    detail,submissionId,selector:selected.scope==='item'?
      {scope:'item',itemId:selected.itemId,index:selected.index}:
      {scope:'request',index:selected.index},
  });
}
