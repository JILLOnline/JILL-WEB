// Pure full-field search of an ALREADY Owner-verified exact request.
// Never persist, log, or export raw_payload or customer contact fields.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const normalize=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('en-US');
export function validateWorkDetailSearch(input){
  if(typeof input!=='string')throw Error('invalid_search');
  const q=input.trim().replace(/\s+/g,' ');
  if(q.length<2||q.length>80||/[\x00-\x1f\x7f]/.test(q))
    throw Error('invalid_search');
  return q;
}
function appendAttrs(out,attributes){
  if(!Array.isArray(attributes))return;
  for(const a of attributes){
    if(!a||typeof a!=='object')continue;
    out.push(a.label,a.id);
    const values=Array.isArray(a.value)?a.value:[a.value];
    for(const value of values) {
      if(['string','number','boolean'].includes(typeof value))
        out.push(String(value));
    }
  }
}
export function searchableVerifiedWorkDetail(detail){
  if(!detail||typeof detail!=='object'||!ID.test(detail.submission_id||'')||
     detail.operation!=='custom_order.merchant.detail.result'||
     !Array.isArray(detail.items))throw Error('invalid_verified_search_detail');
  const p=detail.planning||{},c=detail.customer||{};
  const out=[
    detail.submission_id,detail.submitted_at,detail.revision,
    c.name,c.email,c.phone,c.preferred_contact,
    p.date_needed,p.fulfillment,p.address?.city,p.address?.state,
    p.address?.postal_code,p.address?.country_code,
  ];
  appendAttrs(out,p.attributes);appendAttrs(out,detail.request_attributes);
  for(const item of detail.items){
    out.push(item.title,item.item_id,item.product_id,item.variant_id,
      item.quantity);
    appendAttrs(out,item.attributes);
    for(const variation of item.variant_allocations||[])
      out.push(variation.title,variation.variant_id,variation.quantity);
    for(const group of item.personalization_groups||[]){
      out.push(group.id);
      appendAttrs(out,group.attributes);
    }
    // Reference IDs are opaque; they are not file names or download URLs.
    for(const id of item.reference_ids||[])out.push(id);
  }
  for(const id of detail.reference_ids||[])out.push(id);
  return normalize(out.filter(x=>x!==undefined&&x!==null).join(' '));
}
export function matchesVerifiedWorkDetail(detail,query){
  const terms=normalize(validateWorkDetailSearch(query)).split(' ');
  const content=searchableVerifiedWorkDetail(detail);
  return terms.every(term=>content.includes(term));
}
export const DETAIL_SEARCH_PAGE_SIZE=6;
export function validateWorkDetailSearchCursor(input,total){
  if(!Number.isSafeInteger(total)||total<0||total>50 ||
     typeof input!=='string'||!/^(0|[1-9][0-9]?)$/.test(input))
    throw Error('invalid_search_cursor');
  const cursor=Number(input);
  if(cursor>total||cursor%DETAIL_SEARCH_PAGE_SIZE!==0)
    throw Error('invalid_search_cursor');
  return cursor;
}
