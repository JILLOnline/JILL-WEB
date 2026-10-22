// M2 WORK SOURCE ONLY: repeat-variant calculation contract.
// NO route, network, D1, Shopify writes, publication or invoice.
// Private input variables must never be serialized to a browser.
import {createHash} from 'node:crypto';
import {inspectWorkQuoteUnitLinePlan} from './work-quote-unit-line-plan.mjs';
import {hydrateVerifiedWorkQuoteWorksheet} from './work-quote-restore-model.mjs';
import {normalizeWorkQuoteAddress,agreementHash} from './work-quote-agreement.mjs';
const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const VARIANT=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const CUSTOMER=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const LIMIT=20,MAX=100000000,TTL=300000;
const numeric=n=>Number.isSafeInteger(n)&&n>=0&&n<=MAX;
const hold=reason=>Object.freeze({state:'held',reason,prepared:null,calculation:null,
  can_publish:false,can_invoice:false,can_create_order:false});
const amount=n=>({amount:Math.trunc(n/100)+'.'+String(n%100).padStart(2,'0'),currencyCode:'USD'});
function money(bag){
 const result=['shopMoney','presentmentMoney'].map(key=>{
   const x=bag?.[key];
   if(x?.currencyCode!=='USD'||typeof x.amount!=='string'||
      !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(x.amount))
      throw Error('money_unverified');
   const [whole,cents='']=x.amount.split('.');
   const n=Number(whole)*100+Number(cents.padEnd(2,'0'));
   if(!numeric(n))throw Error('money_unverified');
   return n;
 });
 if(result[0]!==result[1])throw Error('currency_changed');
 return result[0];
}
function uuidFor(submissionId,revision,itemId,unitId){
 const bytes=createHash('sha256').update(JSON.stringify([
   'jill:work:unit:v1',SHOP,submissionId,revision,itemId,unitId,
 ])).digest().subarray(0,16);
 bytes[6]=(bytes[6]&15)|128;bytes[8]=(bytes[8]&63)|128;
 const h=bytes.toString('hex');
 return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');
}
export const WORK_QUOTE_PER_UNIT_CALCULATE=[
 'mutation JillWorkPerUnitQuote($input: DraftOrderInput!) {',
 ' draftOrderCalculate(input: $input) {',
 '  calculatedDraftOrder {',
 '   currencyCode presentmentCurrencyCode customer { id }',
 '   taxesIncluded acceptAutomaticDiscounts discountCodes warnings { __typename }',
 '   lineItems { uuid variant { id } quantity custom customAttributes',
 '    originalTotalSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }',
 '   }',
 '   totalShippingPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }',
 '   totalTaxSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }',
 '   totalDiscountsSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }',
 '   totalPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }',
 '  } userErrors { field message }',
 ' }',
 '}',
].join('\n');
/** @param {{submissionId?:string,detail?:any,draft?:any,catalog?:any,
 * customerGid?:string,address?:any,shippingTitle?:string,nowMs?:number}} [options] */
export function prepareWorkQuotePerUnitCalculation({
 submissionId,detail,draft,catalog,customerGid,address,shippingTitle,
 nowMs=Date.now(),
}={}){
 try{
  if(!ID.test(submissionId||'')||detail?.submission_id!==submissionId||
     !Number.isSafeInteger(detail.revision)||detail.revision<1||
     detail.revision>100||draft?.source_revision!==detail.revision||
     !CUSTOMER.test(customerGid||'')||!Number.isSafeInteger(nowMs)||
     nowMs<1_600_000_000_000)return hold('canonical_source_unverified');
  const restored=hydrateVerifiedWorkQuoteWorksheet({draft,detail,submissionId});
  if(!restored)return hold('verified_draft_required');
  if(!['shipping','pickup'].includes(detail.planning?.fulfillment)||
     !Array.isArray(detail.reference_ids)||detail.reference_ids.length||
     !Array.isArray(detail.request_attributes)||detail.request_attributes.length||
     !Array.isArray(detail.planning.attributes)||detail.planning.attributes.length)
    return hold('unmapped_request_instructions');
  if(['materials','labor','other','discount','tax'].some(
      key=>restored.fees[key]!=='0.00'))
    return hold('unmapped_fees_or_manual_tax');
  const shippingCents=Number(restored.fees.shipping.replace('.',''));
  if(!numeric(shippingCents)||
     detail.planning.fulfillment==='pickup'&&shippingCents!==0)
    return hold('shipping_amount_unverified');
  if(typeof shippingTitle!=='string'||!shippingTitle.trim()||
     shippingTitle.length>255||/[\x00-\x1f\x7f]/.test(shippingTitle))
    return hold('shipping_service_unverified');
  const shipAddress=normalizeWorkQuoteAddress(address);
  const plan=inspectWorkQuoteUnitLinePlan({detail,lines:draft.lines});
  if(plan.state!=='review_only'||plan.requires_native_unit_adapter!==true||
     plan.unit_count<1||plan.unit_count>LIMIT)
    return hold('lossless_per_unit_plan_required');
  if(catalog?.state!=='verified_catalog_snapshot'||catalog.shop!==SHOP||
     catalog.currency!=='USD'||!Array.isArray(catalog.variants)||
     !Number.isSafeInteger(catalog.verified_at_ms)||
     catalog.verified_at_ms>nowMs||nowMs-catalog.verified_at_ms>TTL)
    return hold('fresh_shopify_catalog_required');
  const catalogPrices=new Map();
  for(const v of catalog.variants){
    if(!VARIANT.test(v?.variant_id||'')||
       catalogPrices.has(v.variant_id)||v.product_status!=='ACTIVE'||
       !numeric(v.shopify_unit_price_cents))
      return hold('catalog_variants_invalid');
    catalogPrices.set(v.variant_id,v.shopify_unit_price_cents);
  }
  if(catalogPrices.size!==plan.variant_count)
    return hold('catalog_variant_count_changed');
  let subtotal=0;const uuids=new Set(),units=[];
  for(const u of plan.units){
    if(!catalogPrices.has(u.variant_id)||
       catalogPrices.get(u.variant_id)!==u.unit_price_cents)
      return hold('catalog_price_review_required');
    const uuid=uuidFor(submissionId,detail.revision,u.source_item_id,u.unit_id);
    if(uuids.has(uuid))return hold('duplicate_unit_identity');
    uuids.add(uuid);subtotal+=u.unit_price_cents;
    if(!numeric(subtotal)||typeof u.options!=='string'||
       Buffer.byteLength(u.options,'utf8')>500)
      return hold('unit_price_or_options_invalid');
    units.push(Object.freeze({uuid,variant_id:u.variant_id,
      source_item_id:u.source_item_id,unit_id:u.unit_id,
      group_id:u.group_id,unit_price_cents:u.unit_price_cents,
      options:u.options})); // PRIVATE: ONLY server-side Shopify variables
  }
  if(subtotal+shippingCents!==restored.estimatedTotalCents)
    return hold('worksheet_subtotal_changed');
  const input={
    purchasingEntity:{customerId:customerGid},presentmentCurrencyCode:'USD',
    useCustomerDefaultAddress:false,acceptAutomaticDiscounts:false,
    allowDiscountCodesInCheckout:false,discountCodes:[],
    lineItems:units.map(u=>({uuid:u.uuid,variantId:u.variant_id,
      quantity:1,priceOverride:amount(u.unit_price_cents),
      customAttributes:[{key:'JILL personalization',value:u.options}]})),
    shippingLine:{title:shippingTitle,priceWithCurrency:amount(shippingCents)},
    shippingAddress:shipAddress,
  };
  const fingerprint=agreementHash({shop:SHOP,submissionId,
    sourceRevision:detail.revision,input});
  return Object.freeze({state:'ready_for_offline_shopify_projection',
    shop:SHOP,submission_id:submissionId,source_revision:detail.revision,
    draft_revision:draft.draft_revision,customer_gid:customerGid,
    prepared_at_ms:nowMs,input_sha256:fingerprint,
    units:Object.freeze(units),variables:Object.freeze({input}),
    quoted_items_cents:subtotal,shipping_cents:shippingCents,
    can_publish:false,can_invoice:false,can_create_order:false});
 }catch{return hold('calculation_input_unverified');}
}
/** @param {{prepared?:any,result?:any,nowMs?:number}} [options] */
export function projectWorkQuotePerUnitCalculation({prepared,result,nowMs=Date.now()}={}){
 const fail=reason=>({state:'held',reason,calculation:null,
   can_publish:false,can_invoice:false,can_create_order:false});
 try{
  if(prepared?.state!=='ready_for_offline_shopify_projection'||
     prepared.shop!==SHOP||!Array.isArray(prepared.units)||
     prepared.units.length<1||prepared.units.length>LIMIT||
     !Number.isSafeInteger(nowMs)||nowMs<prepared.prepared_at_ms||
     nowMs-prepared.prepared_at_ms>30000||
     agreementHash({shop:SHOP,submissionId:prepared.submission_id,
       sourceRevision:prepared.source_revision,
       input:prepared.variables.input})!==prepared.input_sha256)
    return fail('prepared_input_or_age_unverified');
  const payload=result?.data?.draftOrderCalculate;
  if(!result||result.errors?.length||!Array.isArray(payload?.userErrors)||
     payload.userErrors.length)return fail('shopify_calculation_rejected');
  const c=payload.calculatedDraftOrder;
  if(c?.currencyCode!=='USD'||c.presentmentCurrencyCode!=='USD'||
     c.customer?.id!==prepared.customer_gid||
     c.taxesIncluded!==false||c.acceptAutomaticDiscounts!==false||
     !Array.isArray(c.discountCodes)||c.discountCodes.length||
     !Array.isArray(c.warnings)||c.warnings.length||
     !Array.isArray(c.lineItems)||c.lineItems.length!==prepared.units.length)
    return fail('calculated_state_unverified');
  const byUuid=new Map();
  for(const line of c.lineItems){
    if(typeof line?.uuid!=='string'||byUuid.has(line.uuid))
      return fail('shopify_uuid_missing_or_duplicate');
    byUuid.set(line.uuid,line);
  }
  let subtotal=0;const rows=[];
  for(const expected of prepared.units){
    const got=byUuid.get(expected.uuid);
    if(got?.quantity!==1||got.custom!==false||
       got.variant?.id!==expected.variant_id||
       agreementHash(got.customAttributes)!==
         agreementHash([{key:'JILL personalization',value:expected.options}]))
      return fail('unit_or_personalization_changed');
    const price=money(got.originalTotalSet);
    if(price!==expected.unit_price_cents)return fail('unit_price_changed');
    subtotal+=price;
    if(!numeric(subtotal))return fail('subtotal_over_limit');
    rows.push(Object.freeze({unit_id:expected.unit_id,
      source_item_id:expected.source_item_id,group_id:expected.group_id,
      variant_id:expected.variant_id,uuid:expected.uuid,
      quoted_unit_cents:price}));
  }
  const shipping=money(c.totalShippingPriceSet),tax=money(c.totalTaxSet),
    discount=money(c.totalDiscountsSet),total=money(c.totalPriceSet);
  if(subtotal!==prepared.quoted_items_cents||
     shipping!==prepared.shipping_cents||discount!==0||
     subtotal+shipping+tax!==total||!numeric(total))
    return fail('calculated_totals_changed');
  return Object.freeze({state:'offline_calculation_reconciled',
    calculation:Object.freeze({currency:'USD',line_count:rows.length,
      rows:Object.freeze(rows),items_cents:subtotal,shipping_cents:shipping,
      tax_cents:tax,total_cents:total}),
    can_publish:false,can_invoice:false,can_create_order:false});
 }catch{return fail('shopify_response_unverified');}
}
