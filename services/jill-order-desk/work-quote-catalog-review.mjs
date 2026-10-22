// M2 — read-only Catalog-to-Quote review. Shopify is the catalog authority;
// signed Google is the request authority. NEVER accept browser variant IDs,
// prices, customer emails, raw private attributes, or upload URLs as authority.
// This is not quote publication, a Shopify calculation, stock assurance,
// invoice or payment. Activation requires a separate WORK-only opt-in.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';
import {readAuthorizedWorkQuoteCatalog} from './work-quote-shopify-catalog-bridge.mjs';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const MAX_ITEMS=20,MAX_VARIANTS=20,MAX_UNITS=100;
const headers={'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff'};
const response=(status,state,extra={})=>Response.json({state,...extra},{
  status,headers});
const held=reason=>Object.freeze({state:'held',reason,variant_ids:[],
  can_publish:false,can_invoice:false,can_create_order:false});
const valid=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
export function deriveVerifiedWorkQuoteVariantIds({detail,submissionId,revision}={}){
 if(!ID.test(submissionId||'')||detail?.submission_id!==submissionId||
    !Number.isSafeInteger(revision)||revision<1||revision>100||
    detail.revision!==revision||!Array.isArray(detail.items)||
    detail.items.length<1||detail.items.length>MAX_ITEMS)
    return held('signed_request_required');
 const seenItems=new Set(),variants=new Set();let units=0;
 for(const item of detail.items){
   if(!valid(item)||typeof item.item_id!=='string'||!item.item_id||
      seenItems.has(item.item_id)||!Number.isSafeInteger(item.quantity)||
      item.quantity<1||item.quantity>MAX_UNITS||
      !Array.isArray(item.variant_allocations))
     return held('unverified_item_allocations');
   seenItems.add(item.item_id);units+=item.quantity;
   if(units>MAX_UNITS)return held('unit_limit_exceeded');
   if(item.variant_allocations.length){
     let allocated=0;const seenUnits=new Set();
     for(const allocation of item.variant_allocations){
       if(!valid(allocation)||!GID.test(allocation.variant_id||'')||
          !Number.isSafeInteger(allocation.quantity)||
          allocation.quantity<1||allocation.quantity>MAX_UNITS||
          !Array.isArray(allocation.unit_ids)||
          allocation.unit_ids.length!==allocation.quantity)
         return held('unverified_variant_allocations');
       for(const unit of allocation.unit_ids){
         if(typeof unit!=='string'||unit.length<1||unit.length>128||
            seenUnits.has(unit))return held('unverified_unit_id');
         seenUnits.add(unit);
       }
       allocated+=allocation.quantity;variants.add(allocation.variant_id);
     }
     if(allocated!==item.quantity)return held('unit_quantity_mismatch');
   }else{
     if(!GID.test(item.variant_id||''))return held('exact_shopify_variant_required');
     variants.add(item.variant_id);
   }
   if(variants.size>MAX_VARIANTS)return held('variant_limit_exceeded');
 }
 return Object.freeze({state:'ready',variant_ids:Object.freeze([...variants]),
   source_revision:revision,unit_count:units,can_publish:false,
   can_invoice:false,can_create_order:false});
}
export function workQuoteCatalogReviewReady(env){
 return env?.JILL_WORK_HOST_STAGE==='canary'&&
   env?.JILL_WORK_HQ_DETAIL_ENABLED==='true'&&
   env?.JILL_WORK_QUOTE_CATALOG_REVIEW_ENABLED==='true'&&
   typeof env?.JILL_HQ_MERCHANT_READ_SECRET==='string'&&
   env.JILL_HQ_MERCHANT_READ_SECRET.length>=32&&
   typeof env?.JILL_ORDER_DESK_WORK_DB?.prepare==='function';
}
/** @param {{request?:Request,enabled?:boolean,authenticate?:any,db?:any,
 * readFreshList?:(()=>Promise<any>),readExactDetail?:any,
 * readCatalog?:(input:any)=>Promise<any>}} [options] */
export async function handleWorkQuoteCatalogReview({
 request,enabled=false,authenticate,db,readFreshList,readExactDetail,
 readCatalog=readAuthorizedWorkQuoteCatalog,
}={}){
 if(request?.method!=='GET')return response(405,'method_not_allowed');
 if(enabled!==true)return response(503,'not_enabled');
 if(typeof authenticate?.admin!=='function'||!db?.prepare||
    typeof readFreshList!=='function'||typeof readExactDetail!=='function'||
    typeof readCatalog!=='function')return response(503,'source_unavailable');
 const url=new URL(request.url),keys=[...url.searchParams.keys()];
 const id=url.searchParams.get('submission_id');
 if(keys.length!==1||keys[0]!=='submission_id'||!ID.test(id||'')||
    request.headers.get('origin')&&request.headers.get('origin')!==url.origin)
   return response(400,'invalid_request');
 // Shopify OAuth redirects/401 responses intentionally propagate to the SDK.
 const sdk=await authenticate.admin(request);
 let grant;
 try{grant=await readWorkMerchantPermission({db,session:sdk.session,
   action:'requests.read'});}
 catch{return response(503,'owner_authority_unavailable');}
 if(grant.allowed!==true||grant.role!=='owner')
   return response(grant.code==='authority_unavailable'?503:403,'access_denied');
 let detail,variantPlan;
 try{
   const list=projectWorkMerchantInbox(await readFreshList());
   const entry=list.records.find(r=>r.submission_id===id);
   if(!entry)return response(404,'request_not_found');
   detail=await readExactDetail({submissionId:id});
   if(detail?.submission_id!==id||detail.revision!==entry.revision||
      detail.items?.length!==entry.item_count)
     return response(409,'source_revision_changed');
   variantPlan=deriveVerifiedWorkQuoteVariantIds({detail,
     submissionId:id,revision:entry.revision});
 }catch{return response(503,'canonical_source_unavailable');}
 if(variantPlan.state!=='ready')return response(409,'variant_mapping_held',
   {reason:variantPlan.reason});
 // This second read independently verifies catalog.read permission, exact
 // WORK Shopify installation, exact variants and USD. No browser-sent IDs.
 let catalog;
 try{
   catalog=await readCatalog({request,authenticate:{admin:async()=>sdk},
     db,enabled:true,variantIds:variantPlan.variant_ids});
 }catch(error){
   if(error instanceof Response)throw error;
   return response(503,'catalog_unavailable');
 }
 if(catalog?.state!=='verified'||catalog.snapshot?.state!=='verified_catalog_snapshot')
   return response(catalog?.state==='access_denied'?403:503,'catalog_unavailable');
 const snap=catalog.snapshot;
 if(!Array.isArray(snap.variants)||snap.variants.length!==variantPlan.variant_ids.length||
   snap.variants.some((v,i)=>v?.variant_id!==variantPlan.variant_ids[i]))
   return response(503,'catalog_unverified');
 return response(200,'verified_catalog_snapshot',{
   submission_id:id,source_revision:detail.revision,
   currency:snap.currency,verified_at_ms:snap.verified_at_ms,
   variants:snap.variants.map(v=>({
     variant_id:v.variant_id,product_status:v.product_status,
     shopify_unit_price_cents:v.shopify_unit_price_cents,
   })),
   review_only:true,can_publish:false,can_invoice:false,can_create_order:false,
 });
}
