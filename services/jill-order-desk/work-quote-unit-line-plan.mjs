// JILL HQ WORK: review-only *lossless* per-unit Shopify quote mapping plan.
// No Shopify calls, no external persistence, no HTTP route, no authorizations.
// Retains every verified unit identity, variant, item attribute and P1/P2 group.
// The existing native calculator intentionally cannot accept repeated variants;
// do NOT feed these units into it until a separately certified adapter exists.
const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const ID=/^[A-Za-z0-9._:-]{1,128}$/;
const PREFIX='JILL:unit:v1:';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const clean=(x,max)=>typeof x==='string'&&x.length<=max&&
  !/[\x00-\x1f\x7f]/.test(x);
const scalar=x=>typeof x==='string'?clean(x,200):
  typeof x==='boolean'||Number.isSafeInteger(x)&&Math.abs(x)<=100000000;
const amount=x=>typeof x==='string'&&/^(?:0|[1-9]\d{0,5})\.[0-9]{2}$/.test(x)
  ?Number(x.split('.')[0])*100+Number(x.split('.')[1]):null;
const held=reason=>Object.freeze({state:'held',reason,units:Object.freeze([]),
  requires_native_unit_adapter:true,can_publish:false,can_invoice:false,
  can_create_order:false});
const attributes=values=>{
  if(!Array.isArray(values)||values.length>12)return null;
  const found=new Set(),result=[];
  for(const x of values){
    if(!isObject(x)||Object.keys(x).some(k=>!['id','label','value'].includes(k))||
      !ID.test(x.id||'')||found.has(x.id)||!clean(x.label??'',100))return null;
    found.add(x.id);
    const value=x.value;
    if(!(scalar(value)||Array.isArray(value)&&value.length<=12&&value.every(scalar)))
      return null;
    result.push(Object.freeze({id:x.id,label:x.label??'',
      value:Array.isArray(value)?Object.freeze([...value]):value}));
  }
  return Object.freeze(result);
};
const frozenUnit=(item,variantId,unitId,group,itemAttrs,priceCents)=>{
  const metadata={source_item_id:item.item_id,unit_id:unitId,
    group_id:group?.id??null,
    item_attributes:itemAttrs.map(x=>[x.id,x.label,x.value]),
    personalization:group?.attributes.map(x=>[x.id,x.label,x.value])??[]};
  const options=PREFIX+JSON.stringify(metadata);
  if(Buffer.byteLength(options,'utf8')>500)return null;
  return Object.freeze({source_item_id:item.item_id,unit_id:unitId,
    variant_id:variantId,unit_price_cents:priceCents,
    group_id:group?.id??null,options,quantity:1});
};
export function inspectWorkQuoteUnitLinePlan({detail,lines}={}){
  if(!isObject(detail)||!ID.test(detail.submission_id||'')||
    !Number.isSafeInteger(detail.revision)||detail.revision<1||detail.revision>100||
    !Array.isArray(detail.items)||detail.items.length===0||detail.items.length>20||
    !Array.isArray(lines)||lines.length!==detail.items.length)
    return held('verified_source_required');
  const all=[],seenItems=new Set();
  let grandTotal=0;
  for(const item of detail.items){
    if(!isObject(item)||!ID.test(item.item_id||'')||seenItems.has(item.item_id)||
      !Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100||
      !Array.isArray(item.variant_allocations)||
      !Array.isArray(item.personalization_groups)||
      !Array.isArray(item.reference_ids)||item.reference_ids.length>0)
      return held('unit_or_private_media_unverified');
    seenItems.add(item.item_id);
    grandTotal+=item.quantity;
    if(grandTotal>100)return held('unit_review_limit');
    const itemAttrs=attributes(item.attributes);
    if(!itemAttrs)return held('item_attributes_invalid');
    const found=lines.filter(x=>x?.id===item.item_id&&x.quantity===item.quantity);
    if(found.length!==1)return held('draft_line_identity_changed');
    const priceCents=amount(found[0].unitPrice);
    if(priceCents===null||!Number.isSafeInteger(priceCents))
      return held('verified_price_required');
    const units=new Map();
    if(item.variant_allocations.length===0){
      if(!GID.test(item.variant_id||''))return held('exact_shopify_variant_required');
      // Only ungrouped items can have synthetic display-only IDs.
      if(item.personalization_groups.length)return held('missing_original_unit_ids');
      for(let i=1;i<=item.quantity;i++)units.set('unit-'+i,item.variant_id);
    }else{
      let count=0;
      for(const variant of item.variant_allocations){
        if(!isObject(variant)||!GID.test(variant.variant_id||'')||
          !Number.isSafeInteger(variant.quantity)||variant.quantity<1||
          !Array.isArray(variant.unit_ids)||
          variant.unit_ids.length!==variant.quantity)return held('variant_allocations_invalid');
        for(const unit of variant.unit_ids){
          if(!ID.test(unit||'')||units.has(unit))return held('unit_ids_duplicate_or_invalid');
          units.set(unit,variant.variant_id);count++;
        }
      }
      if(count!==item.quantity)return held('unit_quantity_mismatch');
    }
    const groupByUnit=new Map(),groupIds=new Set();
    for(const group of item.personalization_groups){
      if(!isObject(group)||!ID.test(group.id||'')||groupIds.has(group.id)||
        !Array.isArray(group.allocations)||!group.allocations.length||
        !Array.isArray(group.attributes))return held('personalization_group_invalid');
      groupIds.add(group.id);
      const values=attributes(group.attributes);
      if(values===null)return held('personalization_attributes_invalid');
      for(const assignment of group.allocations){
        const id=assignment?.unit_id;
        if(!ID.test(id||'')||!units.has(id)||groupByUnit.has(id))
          return held('personalization_assignment_conflict');
        groupByUnit.set(id,{id:group.id,attributes:values});
      }
    }
    if(groupByUnit.size>0&&groupByUnit.size!==units.size)
      return held('personalization_units_unassigned');
    for(const [unitId,variantId] of units){
      const value=frozenUnit(item,variantId,unitId,
        groupByUnit.get(unitId)||null,itemAttrs,priceCents);
      if(!value)return held('native_personalization_limit');
      all.push(value);
    }
  }
  // Even a 100% lossless review requires trusted Shopify variant verification,
  // reconciliation of fees/taxes/shipping and a new repeated-variant API adapter.
  return Object.freeze({state:'review_only',reason:null,
    units:Object.freeze(all),unit_count:all.length,
    variant_count:new Set(all.map(x=>x.variant_id)).size,
    requires_native_unit_adapter:true,
    can_publish:false,can_invoice:false,can_create_order:false});
}
export function decodeReviewOnlyWorkUnitOptions(options){
  if(typeof options!=='string'||!options.startsWith(PREFIX)||
     Buffer.byteLength(options,'utf8')>500)throw Error('invalid_work_unit_options');
  let parsed;
  try{parsed=JSON.parse(options.slice(PREFIX.length));}
  catch{throw Error('invalid_work_unit_options');}
  if(!isObject(parsed)||!ID.test(parsed.source_item_id||'')||
    !ID.test(parsed.unit_id||'')||
    !(parsed.group_id===null||ID.test(parsed.group_id||''))||
    !Array.isArray(parsed.item_attributes)||
    !Array.isArray(parsed.personalization))throw Error('invalid_work_unit_options');
  const normalized=[['item_attributes',parsed.item_attributes],
    ['personalization',parsed.personalization]];
  for(const [,list] of normalized){
    if(list.length>12)throw Error('invalid_work_unit_options');
    for(const x of list){
      if(!Array.isArray(x)||x.length!==3||!ID.test(x[0]||'')||
        !clean(x[1],100)||!(scalar(x[2])||
          Array.isArray(x[2])&&x[2].length<=12&&x[2].every(scalar)))
        throw Error('invalid_work_unit_options');
    }
  }
  if(PREFIX+JSON.stringify(parsed)!==options)throw Error('invalid_work_unit_options');
  return Object.freeze(parsed);
}
