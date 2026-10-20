// WORK quote-draft -> native Shopify CALCULATION handoff (source-only).
// No route, network, D1 reads/writes, invoice, checkout, or order creation.
// Inputs MUST already be verified by existing Owner + canonical source readers;
// a successful result never grants authorization or publication.
import {hydrateVerifiedWorkQuoteWorksheet}
  from './work-quote-restore-model.mjs';
import {prepareWorkQuoteCalculation}
  from './work-quote-calculation.mjs';
import {mapSimpleWorkItemPersonalization}
  from './work-quote-personalization-map.mjs';

const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const VARIANT=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const CUSTOMER=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const MONEY=/^(?:0|[1-9][0-9]{0,6})\.[0-9]{2}$/;
const empty=x=>Array.isArray(x)&&x.length===0;
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hold=reason=>Object.freeze({
  state:'held',reason,calculation_intent:null,
  can_publish:false,can_invoice:false,can_create_order:false,
});
function toCents(x){
  if(typeof x!=='string'||!MONEY.test(x))return null;
  const [a,b]=x.split('.');
  const n=Number(a)*100+Number(b);
  return Number.isSafeInteger(n)&&n>=0&&n<=100000000?n:null;
}
/** A deliberately narrow bridge: exact single-variant items with
 * losslessly mapped *item-wide* attributes and zero extra custom fees can
 * proceed to an authoritative Shopify calculation. P1/P2, attachments and
 * request-wide instructions still require a separately reviewed mapping.
 *
 * No component/browser may call this directly with untrusted data. There is
 * intentionally no HTTP consumer until the source/permission gates are wired.
 */
export function inspectWorkQuoteCommerceHandoff({
  submissionId,detail,draft,customerGid,address,shippingTitle,
}={}){
  if(!ID.test(submissionId||'')||!obj(detail)||
     detail.submission_id!==submissionId||
     !obj(draft)||draft.submission_id!==submissionId||
     !Number.isSafeInteger(detail.revision)||detail.revision<1)
    return hold('canonical_source_unverified');
  if(!Array.isArray(detail.items)||detail.items.length>20)
    return hold('native_line_limit');
  const restored=hydrateVerifiedWorkQuoteWorksheet({
    draft,detail,submissionId,
  });
  if(!restored)return hold('verified_draft_unavailable_or_stale');
  if(!CUSTOMER.test(customerGid||''))
    return hold('shopify_customer_unverified');
  if(!['pickup','shipping'].includes(detail.planning?.fulfillment))
    return hold('fulfillment_unverified');
  // Original notes and reference media are business terms. No "best effort"
  // mapping into Shopify is allowed if the mapping would lose those terms.
  if(!empty(detail.request_attributes)||!empty(detail.reference_ids)||
     !empty(detail.planning.attributes))
    return hold('unmapped_order_instructions');
  const optionsByItem=[];
  for(const item of detail.items){
    if(!obj(item)||!VARIANT.test(item.variant_id||''))
      return hold('variant_or_personalization_requires_review');
    const mapped=mapSimpleWorkItemPersonalization(item);
    if(mapped.state!=='mapped')return hold(mapped.reason);
    optionsByItem.push(mapped.options);
    const allocations=item.variant_allocations;
    if(!Array.isArray(allocations)||
      !(allocations.length===0||
        (allocations.length===1&&
         allocations[0]?.variant_id===item.variant_id&&
         allocations[0]?.quantity===item.quantity)))
      return hold('variant_allocations_require_review');
  }
  if(new Set(detail.items.map(item=>item.variant_id)).size!==detail.items.length)
    return hold('duplicate_shopify_variant_needs_consolidation');
  const fee=Object.fromEntries(Object.entries(restored.fees).map(
    ([key,value])=>[key,toCents(value)]));
  if(Object.values(fee).some(x=>x===null))
    return hold('quote_money_unverified');
  if(fee.materials!==0||fee.labor!==0||fee.other!==0)
    return hold('custom_fee_lines_not_mapped');
  // Estimated manual tax is NOT Shopify tax; a real calculation must be done.
  // Likewise flat manual discounts are not Rewards authorizations.
  if(fee.tax!==0)return hold('manual_tax_must_be_recalculated');
  if(fee.discount!==0)return hold('discount_authorization_required');
  if(detail.planning.fulfillment==='pickup'&&fee.shipping!==0)
    return hold('pickup_shipping_inconsistent');
  if(typeof shippingTitle!=='string'||!shippingTitle.trim()||
     shippingTitle.length>255)
    return hold('shipping_service_not_approved');
  // The source's city/zip-only address does NOT prove a usable Shopify
  // address. This is an explicit trusted server-side, fully verified input.
  if(!obj(address))return hold('full_address_required');
  const lines=detail.items.map((item,i)=>({
    variant_id:item.variant_id,quantity:item.quantity,
    unit_price_cents:toCents(draft.lines[i].unitPrice),
    options:optionsByItem[i],
  }));
  if(lines.some(x=>x.unit_price_cents===null))
    return hold('quote_money_unverified');
  const intent={
    customer_gid:customerGid,lines,
    fulfillment:detail.planning.fulfillment,
    address,shipping:{title:shippingTitle,amount_cents:fee.shipping},
    reward:null,
  };
  try{
    // Reuse the existing native agreement/Shopify validator, not a parallel
    // decimal calculator. This prepares variables but performs NO API call.
    const prepared=prepareWorkQuoteCalculation(intent);
    const quotedSubtotal=lines.reduce((n,l)=>
      n+l.unit_price_cents*l.quantity,0);
    if(quotedSubtotal+fee.shipping!==restored.estimatedTotalCents)
      return hold('manual_and_native_totals_disagree');
    return Object.freeze({
      state:'ready_for_shopify_calculation',reason:null,
      calculation_intent:prepared.intent,
      needs_native_tax_and_total_verification:true,
      can_publish:false,can_invoice:false,can_create_order:false,
    });
  }catch{return hold('native_quote_input_unverified');}
}
