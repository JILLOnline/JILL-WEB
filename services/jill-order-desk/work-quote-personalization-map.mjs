// Canonical, reversible simple item-wide customization for the already
// verified Shopify draftOrderCalculate line custom attribute (max 500 chars).
// Per-unit P1/P2, reference media, and request-wide instructions require a
// separate lossless representation; NEVER silently reduce them to item notes.
const PREFIX='JILL:v1:';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype;
const safeText=(x,min,max)=>typeof x==='string'&&x.length>=min&&
  x.length<=max&&!/[\x00-\x1f\x7f]/.test(x);
const scalar=x=>typeof x==='string'?safeText(x,0,200):
  typeof x==='boolean'||Number.isSafeInteger(x)&&Math.abs(x)<=100000000;
const fail=reason=>Object.freeze({state:'held',reason,options:null});
export function mapSimpleWorkItemPersonalization(item){
  if(!object(item)||!Array.isArray(item.attributes)||
     !Array.isArray(item.personalization_groups)||
     !Array.isArray(item.reference_ids)||
     !Array.isArray(item.variant_allocations))
    return fail('unverified_item_personalization');
  // Never pretend a per-unit map or attachment is a single item-wide value.
  if(item.personalization_groups.length!==0||item.reference_ids.length!==0)
    return fail('per_unit_or_reference_mapping_required');
  const attrs=item.attributes;
  if(attrs.length===0)return Object.freeze({state:'mapped',reason:null,options:''});
  if(attrs.length>12)return fail('personalization_exceeds_native_limit');
  const seen=new Set(),canonical=[];
  for(const entry of attrs){
    if(!object(entry)||Object.keys(entry).some(k=>!['id','label','value'].includes(k))||
       !safeText(entry.id,1,64)||!safeText(entry.label,0,100)||
       seen.has(entry.id))
      return fail('unverified_item_personalization');
    seen.add(entry.id);
    const v=entry.value;
    if(!scalar(v)&&!(Array.isArray(v)&&v.length<=12&&
       v.every(scalar)))
      return fail('unverified_item_personalization');
    canonical.push([entry.id,entry.label,v]);
  }
  // Encode the exact type (including booleans/arrays) and source order.
  // Do NOT change spelling, whitespace, titles, language, or P1/P2 IDs.
  const options=PREFIX+JSON.stringify(canonical);
  if(options.length>500||!safeText(options,1,500))
    return fail('personalization_exceeds_native_limit');
  return Object.freeze({state:'mapped',reason:null,options});
}
export function decodeSimpleWorkItemPersonalization(options){
  if(options==='')return [];
  if(!safeText(options,PREFIX.length+2,500)||!options.startsWith(PREFIX))
    throw Error('invalid_personalization_encoding');
  let canonical;
  try{canonical=JSON.parse(options.slice(PREFIX.length));}
  catch{throw Error('invalid_personalization_encoding');}
  // Revalidate through the SAME encoder. Avoid an alternate permissive
  // decoder that would accept changed, reordered or duplicated attributes.
  if(!Array.isArray(canonical)||canonical.length===0)
    throw Error('invalid_personalization_encoding');
  const attributes=canonical.map(x=>{
    if(!Array.isArray(x)||x.length!==3)
      throw Error('invalid_personalization_encoding');
    return {id:x[0],label:x[1],value:x[2]};
  });
  const checked=mapSimpleWorkItemPersonalization({
    attributes,personalization_groups:[],reference_ids:[],
    variant_allocations:[],
  });
  if(checked.state!=='mapped'||checked.options!==options)
    throw Error('invalid_personalization_encoding');
  return attributes;
}
