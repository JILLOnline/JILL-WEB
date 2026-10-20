// WORK HQ — exact Shopify ProductVariant read and safe quote reconciliation.
// INTERNAL ONLY: no HTTP route, no product edits, no invoice or draft creation.
// Authenticator MUST be the verified Shopify Admin SDK for the current WORK
// installation. Merchant D1 authorization and online staff scopes are required.
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {JILL_WORK_MERCHANT_CLIENT_ID as APP,
  JILL_WORK_MERCHANT_SHOP as SHOP} from '../../backend/jill-merchant-auth.mjs';

const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const PRODUCT=/^gid:\/\/shopify\/Product\/[1-9][0-9]*$/;
const MONEY=/^(?:0|[1-9][0-9]{0,6})\.[0-9]{2}$/;
const MAX=20;
const verify=x=>{if(!x)throw Error('quote_catalog_unverified');};
const cents=value=>{
  verify(typeof value==='string'&&MONEY.test(value));
  const [whole,frac]=value.split('.');
  const sum=Number(whole)*100+Number(frac);
  verify(Number.isSafeInteger(sum)&&sum>=0&&sum<=100000000);
  return sum;
};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const held=reason=>Object.freeze({state:'held',reason,
  calculation_intent:null,can_publish:false,can_invoice:false,
  can_create_order:false});
const validIds=ids=>Array.isArray(ids)&&ids.length>=1&&
  ids.length<=MAX&&ids.every(x=>typeof x==='string'&&GID.test(x))&&
  new Set(ids).size===ids.length;
export const WORK_QUOTE_VARIANT_LOOKUP=`query JillWorkQuoteVariants($ids: [ID!]!) {
  shop { myshopifyDomain currencyCode }
  currentAppInstallation { app { apiKey } }
  nodes(ids: $ids) {
    __typename
    ... on ProductVariant {
      id title price sku
      product { id title status }
    }
  }
}`;

// Accept only the EXACT requested variants, order, source shop, app and USD.
// Wrong, null, duplicate, inactive, non-variant or stale shape => NO snapshot.
export function projectVerifiedWorkQuoteCatalog({variantIds,result,nowMs=Date.now()}={}){
  verify(validIds(variantIds)&&Number.isSafeInteger(nowMs)&&nowMs>0);
  verify(object(result)&&(!result.errors||Array.isArray(result.errors)&&
    result.errors.length===0));
  const data=result.data;
  verify(data?.shop?.myshopifyDomain===SHOP&&
    data.shop.currencyCode==='USD'&&
    data.currentAppInstallation?.app?.apiKey===APP&&
    Array.isArray(data.nodes)&&data.nodes.length===variantIds.length);
  const variants=data.nodes.map((node,index)=>{
    verify(node?.__typename==='ProductVariant'&&
      node.id===variantIds[index]&&GID.test(node.id)&&
      typeof node.title==='string'&&node.title.length>0&&
      node.title.length<=255&&
      (node.sku===null||typeof node.sku==='string'&&node.sku.length<=255));
    const product=node.product;
    verify(PRODUCT.test(product?.id||'')&&
      typeof product.title==='string'&&product.title.length>0&&
      product.title.length<=255&&
      ['ACTIVE','DRAFT','ARCHIVED','UNLISTED'].includes(product.status));
    return Object.freeze({
      variant_id:node.id,product_id:product.id,
      product_status:product.status,title:node.title,
      product_title:product.title,sku:node.sku||'',
      shopify_unit_price_cents:cents(node.price),
    });
  });
  return Object.freeze({
    state:'verified_catalog_snapshot',
    shop:SHOP,currency:'USD',verified_at_ms:nowMs,
    variants:Object.freeze(variants),
    can_publish:false,can_invoice:false,can_create_order:false,
  });
}

// No automatic fee/price override: merchants must manually reconcile a
// catalog price change in the existing saved quote draft, then recalculate.
// Even a "ready" result means only READY FOR NATIVE SHOPIFY CALCULATION.
export function reconcileWorkQuoteWithCatalog({
  handoff,snapshot,nowMs=Date.now(),maxAgeMs=300000,
}={}){
  if(handoff?.state!=='ready_for_shopify_calculation'||
    !object(handoff.calculation_intent)||
    !validIds(handoff.calculation_intent.lines?.map(x=>x.variant_id)))
    return held('quote_draft_not_verified');
  if(snapshot?.state!=='verified_catalog_snapshot'||
    snapshot.shop!==SHOP||snapshot.currency!=='USD'||
    !Array.isArray(snapshot.variants)||
    !Number.isSafeInteger(snapshot.verified_at_ms)||
    !Number.isSafeInteger(nowMs)||!Number.isSafeInteger(maxAgeMs)||
    maxAgeMs<0||maxAgeMs>300000||
    snapshot.verified_at_ms>nowMs||
    nowMs-snapshot.verified_at_ms>maxAgeMs)
    return held('catalog_snapshot_missing_or_stale');
  const lines=handoff.calculation_intent.lines;
  if(snapshot.variants.length!==lines.length)
    return held('variant_count_changed');
  for(let i=0;i<lines.length;i++){
    const expected=lines[i],actual=snapshot.variants[i];
    if(!object(actual)||actual.variant_id!==expected.variant_id||
      !GID.test(actual.variant_id)||!PRODUCT.test(actual.product_id||''))
      return held('shopify_variant_changed');
    if(actual.product_status!=='ACTIVE')
      return held('shopify_product_not_active');
    if(!Number.isSafeInteger(actual.shopify_unit_price_cents)||
      actual.shopify_unit_price_cents<0||
      actual.shopify_unit_price_cents>100000000)
      return held('catalog_price_unverified');
    if(actual.shopify_unit_price_cents!==expected.unit_price_cents)
      return held('catalog_price_review_required');
  }
  return Object.freeze({
    state:'ready_for_native_shopify_calculation',
    reason:null,
    calculation_intent:handoff.calculation_intent,
    catalog_verified_at_ms:snapshot.verified_at_ms,
    native_tax_and_total_check_required:true,
    can_publish:false,can_invoice:false,can_create_order:false,
  });
}

// No route is connected. When enabled in a FUTURE approved Owner path,
// this reader must be called with independently verified variant IDs taken
// from the canonical source (never request query params or browser payload).
export async function readAuthorizedWorkQuoteCatalog({
  request,authenticate,db,enabled=false,variantIds,now=Date.now,
}={}){
  const fail=code=>Object.freeze({state:code,snapshot:null});
  if(!enabled)return fail('not_enabled');
  if(!validIds(variantIds))return fail('invalid_variant_ids');
  // Preserve SDK redirects/401 errors; do not convert auth faults to success.
  const {session,admin}=await authenticate.admin(request);
  const permission=await readWorkMerchantPermission({
    db,session,action:'catalog.read',
  });
  if(!permission.allowed||permission.role!=='owner')return fail('access_denied');
  try{
    const response=await admin.graphql(WORK_QUOTE_VARIANT_LOOKUP,{
      variables:{ids:[...variantIds]},tries:1,
      signal:AbortSignal.timeout(10000),
    });
    verify(response.ok);
    const result=await response.json();
    const snapshot=projectVerifiedWorkQuoteCatalog({
      variantIds,result,nowMs:now(),
    });
    return Object.freeze({state:'verified',snapshot});
  }catch{return fail('catalog_unavailable');}
}
