// JILL HQ WORK: authenticated Owner-only saved quote + Shopify Catalog preflight.
// SOURCE ONLY: route must remain OFF until a distinct reviewed WORK release.
// No writes, customer quote publish, draftOrderCalculate/Create, invoice or email.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {projectWorkMerchantInbox} from './merchant-inbox-read.mjs';
import {projectVerifiedWorkQuoteDraft} from './work-quote-draft-read.mjs';
import {deriveVerifiedWorkQuoteVariantIds} from './work-quote-catalog-review.mjs';
import {readAuthorizedWorkQuoteCatalog}
 from './work-quote-shopify-catalog-bridge.mjs';
import {inspectWorkQuoteCatalogPreflight}
 from './work-quote-catalog-preflight.mjs';
import {workQuoteDraftFeatureReady}
 from './work-quote-release-readiness.mjs';
import {workQuoteCatalogReviewReady}
 from './work-quote-catalog-review.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const HEADERS={'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff'};
const REASONS=new Set([
 'not_enabled','source_unavailable','invalid_request','access_denied',
 'owner_authority_unavailable','request_not_found','source_revision_changed',
 'canonical_source_unavailable','no_saved_draft','unverified_saved_draft',
 'variant_mapping_held','catalog_unavailable','catalog_unverified',
 'personalization_requires_review','catalog_price_review_required',
 'trusted_customer_context_unavailable',
]);
const respond=(status,state,reason=state,more={})=>Response.json({
 state,reason:REASONS.has(reason)?reason:'manual_owner_review',
 next_action:reason==='catalog_price_review_required'?'compare_shopify_price':
  reason==='no_saved_draft'?'save_quote_draft':
  reason==='source_revision_changed'?'reload_original_request':
  reason==='trusted_customer_context_unavailable'?'verify_shopify_customer':
  'manual_owner_review',
 can_publish:false,can_invoice:false,can_create_order:false,
 can_charge_customer:false,can_send_email:false,
 source_only:true,native_shopify_calculation_performed:false,...more,
},{status,headers:HEADERS});
export function workQuoteOwnerPreflightReady(env){
 return env?.JILL_WORK_HQ_QUOTE_CATALOG_PREFLIGHT_ENABLED==='true'&&
  workQuoteDraftFeatureReady(env)&&workQuoteCatalogReviewReady(env);
}
// Read-only source check; never infer ownership from a submitted email or GID.
export async function handleWorkQuoteOwnerPreflight({
 request,enabled=false,authenticate,db,readFreshList,readExactDetail,
 readCatalog=readAuthorizedWorkQuoteCatalog,
 resolveTrustedCustomerContext,now=Date.now,
}={}){
 if(request?.method!=='GET')return respond(405,'method_not_allowed');
 // Critical: disabled before Shopify session, D1 and Google/API calls.
 if(enabled!==true)return respond(503,'not_enabled');
 if(typeof authenticate?.admin!=='function'||
    typeof db?.prepare!=='function'||typeof readFreshList!=='function'||
    typeof readExactDetail!=='function'||typeof readCatalog!=='function')
   return respond(503,'source_unavailable');
 const url=new URL(request.url),entries=[...url.searchParams.entries()];
 const id=entries.length===1&&entries[0][0]==='submission_id'?
  entries[0][1]:null;
 if(!ID.test(id||'')||(request.headers.get('origin')&&
   request.headers.get('origin')!==url.origin))
   return respond(400,'invalid_request');
 // Let SDK redirect/401 propagate; never convert auth errors to source data.
 const sdk=await authenticate.admin(request);
 let grant;
 try{grant=await readWorkMerchantPermission({
   db,session:sdk.session,action:'requests.read',
 });}catch{return respond(503,'owner_authority_unavailable');}
 if(grant?.allowed!==true||grant.role!=='owner')
  return respond(grant?.code==='authority_unavailable'?503:403,
   'access_denied');
 let detail,draft;
 try{
  const list=projectWorkMerchantInbox(await readFreshList());
  const entry=list.records.find(x=>x.submission_id===id);
  if(!entry)return respond(404,'request_not_found');
  detail=await readExactDetail({submissionId:id});
  if(detail?.submission_id!==id||
     detail.revision!==entry.revision||
     detail.items?.length!==entry.item_count)
    return respond(409,'source_revision_changed');
  const row=await db.prepare(
   'SELECT shop,submission_id,draft_revision,source_revision,'+
   'source_sha256,quote_sha256,quote_json,total_cents,currency,'+
   'state,updated_at_ms FROM jill_work_quote_drafts '+
   'WHERE shop=? AND submission_id=?'
  ).bind(SHOP,id).first();
  if(row===null)return respond(200,'held','no_saved_draft');
  try{draft=projectVerifiedWorkQuoteDraft({row,detail,submissionId:id});}
  catch{return respond(409,'held','unverified_saved_draft');}
 }catch{return respond(503,'canonical_source_unavailable');}
 const variants=deriveVerifiedWorkQuoteVariantIds({
  detail,submissionId:id,revision:detail.revision,
 });
 if(variants.state!=='ready')
  return respond(409,'held','variant_mapping_held');
 // A separate catalog.read WORK Owner permission and exact Shopify shop/app
 // + currency check happens in this reader. No user-selected GIDs permitted.
 let read;
 try{
  read=await readCatalog({
   request,authenticate:{admin:async()=>sdk},
   db,enabled:true,variantIds:variants.variant_ids,now,
  });
 }catch(e){
  if(e instanceof Response)throw e;
  return respond(503,'catalog_unavailable');
 }
 if(read?.state!=='verified')return respond(
  read?.state==='access_denied'?403:503,'catalog_unavailable');
 const snapshot=read.snapshot;
 if(snapshot?.state!=='verified_catalog_snapshot'||
   snapshot.shop!==SHOP||snapshot.currency!=='USD'||
   !Array.isArray(snapshot.variants)||
   snapshot.variants.length!==variants.variant_ids.length||
   snapshot.variants.some((v,i)=>
    v?.variant_id!==variants.variant_ids[i]||
    !GID.test(v.variant_id)||v.product_status!=='ACTIVE'||
    !Number.isSafeInteger(v.shopify_unit_price_cents)||
    v.shopify_unit_price_cents<0))
  return respond(409,'catalog_unverified');
 // For a price comparison, original items must be one exact variant each.
 // Multi-variant P1/P2 requires a separate lossless per-unit mapping.
 const items=detail.items;
 // Even a single allocated variant cannot represent distinct P1/P2 unit
 // instructions, artwork references or request-wide personalization. Make
 // this blocker explicit before asking the merchant for customer identity.
 if(items.some(v=>!Array.isArray(v.personalization_groups)||
   v.personalization_groups.length>0||
   !Array.isArray(v.reference_ids)||v.reference_ids.length>0)||
   !Array.isArray(detail.request_attributes)||
   detail.request_attributes.length>0||
   !Array.isArray(detail.reference_ids)||detail.reference_ids.length>0||
   !Array.isArray(detail.planning?.attributes)||
   detail.planning.attributes.length>0)
  return respond(200,'held','personalization_requires_review');
 if(items.some((v,i)=>!GID.test(v?.variant_id||'')||
   !Array.isArray(v.variant_allocations)||
   v.variant_allocations.length>1||
   v.variant_allocations.length===1&&(
    v.variant_allocations[0].variant_id!==v.variant_id||
    v.variant_allocations[0].quantity!==v.quantity))||
   new Set(items.map(v=>v.variant_id)).size!==items.length)
  return respond(200,'held','personalization_requires_review');
 const prices=new Map(snapshot.variants.map(v=>
  [v.variant_id,v.shopify_unit_price_cents]));
 const mismatched=items.some((v,i)=>{
  const money=draft.lines[i]?.unitPrice;
  if(typeof money!=='string'||!/^(0|[1-9]\d{0,6})\.\d{2}$/.test(money))
   return true;
  const [whole,frac]=money.split('.');
  return Number(whole)*100+Number(frac)!==prices.get(v.variant_id);
 });
 if(mismatched)return respond(200,'held','catalog_price_review_required');
 // A WORK-only route has NO trusted Shopify customer/address resolver yet.
 // Never promote a price match to invoice-ready based on user input.
 if(typeof resolveTrustedCustomerContext!=='function')
  return respond(200,'held','trusted_customer_context_unavailable');
 let context;
 try{context=await resolveTrustedCustomerContext({
  request,session:sdk.session,submissionId:id,detail,
 });}catch{return respond(503,'source_unavailable');}
 const review=inspectWorkQuoteCatalogPreflight({
  enabled:true,submissionId:id,detail,draft,
  customerGid:context?.customerGid,address:context?.address,
  shippingTitle:context?.shippingTitle,catalogSnapshot:snapshot,
  nowMs:now(),
 });
 // Even a ready state is a review-only eligibility to ask Shopify for
 // a FRESH native calculation in a DIFFERENT gated request.
 return Response.json({...review,
  can_publish:false,can_invoice:false,can_create_order:false,
  can_charge_customer:false,can_send_email:false,
 },{status:200,headers:HEADERS});
}
