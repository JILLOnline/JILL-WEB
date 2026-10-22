// M2 WORK: read-only display of canonical P1/P2 physical units and prices.
// The existing source mapper owns the units. This module only checks
// totals and strips all raw personalization terms and private attachments.
// Never grant Shopify calculation, quote publication or invoice authority.
const ID=/^[A-Za-z0-9._:-]{1,128}$/;
const VARIANT=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const MAX=100000000;
const int=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX;
const held=reason=>Object.freeze({state:'held',reason,units:Object.freeze([]),
  quoted_items_cents:null,read_only:true,can_publish:false,
  can_invoice:false,can_create_order:false});
export function projectWorkQuoteUnitPriceReview({plan,itemSubtotalCents}={}){
 if(plan?.state!=='review_only'||plan.requires_native_unit_adapter!==true||
    !Array.isArray(plan.units)||plan.units.length<1||plan.units.length>100||
    plan.unit_count!==plan.units.length||!int(itemSubtotalCents))
   return held('verified_units_and_priced_worksheet_required');
 const seen=new Set(),variants=new Set(),rows=[];let subtotal=0;
 for(const unit of plan.units){
   if(!unit||typeof unit!=='object'||!ID.test(unit.source_item_id||'')||
      !ID.test(unit.unit_id||'')||!VARIANT.test(unit.variant_id||'')||
      !(unit.group_id===null||ID.test(unit.group_id||''))||
      unit.quantity!==1||!int(unit.unit_price_cents)||
      typeof unit.options!=='string'||unit.options.length>500)
     return held('unit_source_invalid');
   const key=unit.source_item_id+'\0'+unit.unit_id;
   if(seen.has(key))return held('unit_identity_duplicate');
   seen.add(key);variants.add(unit.variant_id);
   subtotal+=unit.unit_price_cents;
   if(!int(subtotal))return held('unit_subtotal_over_limit');
   rows.push(Object.freeze({source_item_id:unit.source_item_id,
     unit_id:unit.unit_id,group_id:unit.group_id,variant_id:unit.variant_id,
     quoted_unit_cents:unit.unit_price_cents}));
 }
 if(plan.variant_count!==variants.size||subtotal!==itemSubtotalCents)
   return held('worksheet_unit_subtotal_mismatch');
 return Object.freeze({state:'review_only',reason:null,units:Object.freeze(rows),
   count:rows.length,variant_count:variants.size,quoted_items_cents:subtotal,
   read_only:true,can_publish:false,can_invoice:false,can_create_order:false});
}
