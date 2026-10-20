// JILL WORK merchant-only quote review of original per-unit P1/P2 detail.
// This NEVER maps a legacy variant identifier into a Shopify GID or writes
// prices/charges. It keeps the exact unit/group relationship visible for HQ.
const text=(value,max=256)=>typeof value==='string'&&
  value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hold=reason=>Object.freeze({state:'held',reason,groups:[],
  variants:[],units:[],unassigned_unit_ids:[],
  commerce_ready:false,customer_approved:false});
export function inspectWorkQuoteUnitReview(item){
  if(!object(item)||!text(item.item_id,256)||
    !Number.isSafeInteger(item.quantity)||item.quantity<1||
    item.quantity>10000||!Array.isArray(item.personalization_groups)||
    !Array.isArray(item.variant_allocations)||
    !Array.isArray(item.reference_ids))
    return hold('verified_item_required');
  if(item.personalization_groups.length>500||
    item.variant_allocations.length>100||
    item.reference_ids.length>20)
    return hold('unit_review_limit');
  const units=new Set();
  const variants=[];
  for(const allocation of item.variant_allocations){
    if(!object(allocation)||!text(allocation.variant_id,128)||
      !Number.isSafeInteger(allocation.quantity)||allocation.quantity<1||
      !Array.isArray(allocation.unit_ids)||
      allocation.quantity!==allocation.unit_ids.length||
      variants.some(v=>v.variant_id===allocation.variant_id))
      return hold('unverified_variant_allocations');
    for(const unit of allocation.unit_ids){
      if(!text(unit)||units.has(unit))
        return hold('duplicate_or_invalid_unit');
      units.add(unit);
    }
    variants.push(Object.freeze({
      variant_id:allocation.variant_id,
      title:typeof allocation.title==='string'?allocation.title.slice(0,500):'',
      quantity:allocation.quantity,unit_ids:Object.freeze([...allocation.unit_ids]),
    }));
  }
  if(item.personalization_groups.length>0&&units.size===0)
    return hold('missing_unit_allocations');
  if(item.variant_allocations.length>0&&units.size!==item.quantity)
    return hold('unit_quantity_mismatch');
  const used=new Set(),groupIds=new Set(),groups=[];
  for(const group of item.personalization_groups){
    if(!object(group)||!text(group.id,128)||groupIds.has(group.id)||
      !Array.isArray(group.allocations)||!Array.isArray(group.attributes)||
      group.allocations.length<1||group.allocations.length>item.quantity||
      group.attributes.length>100)
      return hold('unverified_personalization_group');
    groupIds.add(group.id);
    const assigned=[];
    for(const a of group.allocations){
      if(!object(a)||!text(a.unit_id)||!units.has(a.unit_id)||
        used.has(a.unit_id))
        return hold('invalid_or_duplicate_personalized_unit');
      used.add(a.unit_id);
      assigned.push(a.unit_id);
    }
    const attributes=[];
    const keys=new Set();
    for(const a of group.attributes){
      if(!object(a)||!text(a.id,64)||keys.has(a.id)||
        typeof (a.label??'')!=='string'||
        (a.label??'').length>200)
        return hold('unverified_personalization_attribute');
      keys.add(a.id);
      const v=a.value;
      const scalar=x=>typeof x==='string'&&x.length<=5000||
        typeof x==='boolean'||
        typeof x==='number'&&Number.isFinite(x);
      if(!(scalar(v)||Array.isArray(v)&&v.length<=100&&v.every(scalar)))
        return hold('unverified_personalization_attribute');
      attributes.push(Object.freeze({
        id:a.id,label:a.label||a.id,value:Array.isArray(v)?Object.freeze([...v]):v,
      }));
    }
    groups.push(Object.freeze({
      id:group.id,unit_ids:Object.freeze(assigned),
      attributes:Object.freeze(attributes),
    }));
  }
  const unassigned=[...units].filter(id=>!used.has(id));
  // A request with no per-unit groups is fine for item-wide estimate, but
  // still does NOT become a Shopify-mappable validated quote via this plan.
  const state=groups.length>0&&unassigned.length>0
    ?'review_unassigned_units':'ready_for_merchant_review';
  return Object.freeze({
    state,reason:null,
    item_id:item.item_id,quantity:item.quantity,
    groups:Object.freeze(groups),variants:Object.freeze(variants),
    units:Object.freeze([...units]),
    unassigned_unit_ids:Object.freeze(unassigned),
    reference_count:item.reference_ids.length,
    // Only original count/opaque IDs are reviewed; media ownership and
    // native variants must be independently proved before publication.
    commerce_ready:false,customer_approved:false,
  });
}
