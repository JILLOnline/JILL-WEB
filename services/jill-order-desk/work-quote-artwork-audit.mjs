// M2 quote artwork audit — source-verified COUNTS ONLY.
// No file IDs, provider URLs, raw attributes or customer details escape.
// A registry record or legacy Cloudinary URL never proves private access.
// Real Owner-specific media delivery must be separately authorized.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const ITEM=/^[A-Za-z0-9._:-]{1,256}$/;
const REF_LIMIT=100;
const hold=reason=>Object.freeze({state:'held',reason,
  references:0,request_references:0,items:Object.freeze([]),
  preview_enabled:false,private_storage_verified:false,
  can_publish:false,can_invoice:false,can_create_order:false});
/** @param {{detail?:any,submissionId?:string,sourceRevision?:number}} [options] */
export function auditWorkQuoteArtworkReferences({
  detail,submissionId,sourceRevision,
}={}){
 if(!ID.test(submissionId||'')||detail?.submission_id!==submissionId||
    detail.revision!==sourceRevision||!Number.isSafeInteger(sourceRevision)||
    sourceRevision<1||sourceRevision>100||
    detail.attachment_state!=='unresolved'||
    !Array.isArray(detail.reference_ids)||detail.reference_ids.length>20||
    !Array.isArray(detail.items)||detail.items.length<1||
    detail.items.length>20)
   return hold('verified_request_and_media_state_required');
 const valid=ref=>typeof ref==='string'&&ref.length>0&&
   ref.length<=512&&!/[\x00-\x1f\x7f]/.test(ref);
 if(!detail.reference_ids.every(valid))return hold('invalid_reference');
 let total=detail.reference_ids.length;
 const items=[];
 for(let i=0;i<detail.items.length;i++){
   const item=detail.items[i];
   if(!ITEM.test(item?.item_id||'')||
      !Array.isArray(item.reference_ids)||item.reference_ids.length>20||
      !item.reference_ids.every(valid))return hold('unverified_item_reference');
   total+=item.reference_ids.length;
   if(total>REF_LIMIT)return hold('reference_review_limit');
   items.push(Object.freeze({item_number:i+1,
     reference_count:item.reference_ids.length}));
 }
 return Object.freeze({state:total===0?'no_submitted_references':
   'owner_private_media_verification_required',
   reason:total===0?null:'all_submitted_references_unverified',
   references:total,request_references:detail.reference_ids.length,
   items:Object.freeze(items),preview_enabled:false,
   private_storage_verified:false,customer_media_authorized:false,
   can_publish:false,can_invoice:false,can_create_order:false});
}
