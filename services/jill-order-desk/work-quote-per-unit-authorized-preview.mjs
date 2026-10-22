// M2 WORK per-unit pricing execution boundary — SOURCE ONLY.
// No HTTP route, feature flag enabled, customer mutation, Draft Order creation,
// invoice, email, R2 or automatic retry. Even a successful calculation is
// OFFLINE REVIEW ONLY and cannot feed the legacy publication contract.
// Caller-provided readBundle MUST be a trusted Owner-scoped, signed-source
// server reader, not browser JSON.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {readAuthorizedWorkQuoteCatalog}
 from './work-quote-shopify-catalog-bridge.mjs';
import {deriveVerifiedWorkQuoteVariantIds}
 from './work-quote-catalog-review.mjs';
import {WORK_QUOTE_SHOP_QUERY}
 from './work-quote-calculation.mjs';
import {JILL_WORK_MERCHANT_SHOP as SHOP,
 JILL_WORK_MERCHANT_CLIENT_ID as APP}
 from '../../backend/jill-merchant-auth.mjs';
import {prepareWorkQuotePerUnitCalculation,projectWorkQuotePerUnitCalculation,
 WORK_QUOTE_PER_UNIT_CALCULATE}
 from './work-quote-per-unit-calculation-preview.mjs';
const held=state=>Object.freeze({state,calculation:null,
 can_publish:false,can_invoice:false,can_create_order:false});
const valid=(x)=>x!==null&&typeof x==='object'&&!Array.isArray(x);
async function graphql(admin,query,variables){
 if(typeof admin?.graphql!=='function')throw Error('no_shopify_sdk');
 const response=await admin.graphql(query,{
   variables,tries:1,signal:AbortSignal.timeout(10000),
 });
 if(!response?.ok)throw Error('shopify_unavailable');
 const body=await response.json();
 if(!valid(body)||body.errors?.length)throw Error('shopify_errors');
 return body;
}
/** @param {{request?:Request,authenticate?:any,db?:any,enabled?:boolean,
 * loadVerifiedBundle?:any,readCatalog?:any,now?:()=>number}} [options] */
export async function calculateAuthorizedWorkPerUnitQuote({
 request,authenticate,db,enabled=false,loadVerifiedBundle,
 readCatalog=readAuthorizedWorkQuoteCatalog,now=Date.now,
}={}){
 if(enabled!==true)return held('not_enabled');
 if(typeof authenticate?.admin!=='function'||typeof db?.prepare!=='function'||
    typeof loadVerifiedBundle!=='function'||typeof readCatalog!=='function'||
    typeof now!=='function')return held('source_unavailable');
 // Shopify's OAuth/embedded login redirects must not turn into a fake denial.
 const sdk=await authenticate.admin(request);
 let grant;
 try{grant=await readWorkMerchantPermission({
   db,session:sdk.session,action:'quote.calculate',
 });}catch{return held('authority_unavailable');}
 if(grant.allowed!==true||grant.role!=='owner')
   return held(grant.code==='authority_unavailable'?
     'authority_unavailable':'access_denied');
 try{
   const verifiedShop=await graphql(sdk.admin,WORK_QUOTE_SHOP_QUERY,{});
   if(verifiedShop.data?.shop?.myshopifyDomain!==SHOP||
      verifiedShop.data.shop.currencyCode!=='USD'||
      verifiedShop.data.currentAppInstallation?.app?.apiKey!==APP)
     return held('wrong_shop_or_app');
   // This bundle must come from authenticated Owner+D1, exact signed @9
   // detail and independently verified D1 saved quote projection.
   const bundle=await loadVerifiedBundle({staffId:grant.staffId});
   if(!valid(bundle)||!valid(bundle.detail)||!valid(bundle.draft)||
      typeof bundle.submissionId!=='string')
     return held('canonical_quote_bundle_unavailable');
   const variants=deriveVerifiedWorkQuoteVariantIds({
     detail:bundle.detail,submissionId:bundle.submissionId,
     revision:bundle.detail.revision,
   });
   if(variants.state!=='ready')
     return held('variant_source_unverified');
   const catalog=await readCatalog({
     request,authenticate:{admin:async()=>sdk},db,enabled:true,
     variantIds:variants.variant_ids,
   });
   if(catalog?.state!=='verified')
     return held('catalog_not_verified');
   const prepared=prepareWorkQuotePerUnitCalculation({
     submissionId:bundle.submissionId,detail:bundle.detail,
     draft:bundle.draft,catalog:catalog.snapshot,
     customerGid:bundle.customerGid,address:bundle.address,
     shippingTitle:bundle.shippingTitle,nowMs:now(),
   });
   if(prepared.state!=='ready_for_offline_shopify_projection')
     return held('quote_unit_input_held');
   // A calculate mutation creates NO order and may not change the store.
   const result=await graphql(sdk.admin,WORK_QUOTE_PER_UNIT_CALCULATE,
      prepared.variables);
   const observation=projectWorkQuotePerUnitCalculation({
     prepared,result,nowMs:now(),
   });
   if(observation.state!=='offline_calculation_reconciled')
     return held('calculation_readback_unverified');
   return Object.freeze({...observation,source:'owner_sdk_calculation_review_only',
     can_publish:false,can_invoice:false,can_create_order:false});
 }catch(error){
   if(error instanceof Response)throw error;
   return held('calculation_unavailable');
 }
}
