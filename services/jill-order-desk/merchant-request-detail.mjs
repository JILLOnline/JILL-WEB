// WORK merchant FULL REQUEST projection, for a FUTURE exact-ID signed
// Google QA detail endpoint. NO browser route is registered by this module.
// Caller MUST first authenticate Shopify online Owner + WORK D1 and verify
// raw_payload belongs to this exact canonical submission ID. Raw intake
// stays immutable. Opaque references are NEVER trusted download URLs.
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const MAX_BYTES=256*1024;
const MAX_ITEMS=500;
const VALID_FULFILLMENT=new Set(['','pickup','shipping']);
const VALID_CONTACT=new Set(['email','phone','text']);
function fail(){throw Error('invalid_verified_custom_order_detail');}
function text(x,max=5000,required=false){
  if(typeof x!=='string'||x.length>max||(required&&!x.trim()))fail();
  return x;
}
function list(xs,max,convert){
  if(!Array.isArray(xs)||xs.length>max)fail();
  return Object.freeze(xs.map(convert));
}
function attrs(xs,max=200){
  return list(xs,max,a=>{
    if(!a || typeof a!=='object'||Array.isArray(a))fail();
    const raw=a.value;
    const values=Array.isArray(raw)?list(raw,100,v=>{
      if(typeof v==='string')return text(v,5000);
      if(typeof v==='number'&&Number.isFinite(v))return v;
      if(typeof v==='boolean')return v;
      fail();
    }):typeof raw==='string'?text(raw,5000):
      typeof raw==='number'&&Number.isFinite(raw)?raw:
      typeof raw==='boolean'?raw:fail();
    return Object.freeze({id:text(a.id,64,true),
      label:text(a.label??'',200),value:values});
  });
}
function ids(xs,max=20,limit=512){
  const values=list(xs,max,value=>text(value,limit,true));
  if(new Set(values).size!==values.length)fail();
  return values;
}
function natural(number,max=10000){
  if(!Number.isSafeInteger(number)||number<1||number>max)fail();
  return number;
}
function variantAllocations(xs){
  if(xs===undefined)return Object.freeze([]);
  return list(xs,100,v=>{
    if(!v||typeof v!=='object'||Array.isArray(v))fail();
    const units=ids(v.unit_ids,10000,256);
    const quantity=natural(v.quantity);
    if(units.length!==quantity)fail();
    return Object.freeze({variant_id:text(v.variant_id,128,true),
      title:text(v.title??'',500),quantity,unit_ids:units});
  });
}
function groups(xs){
  return list(xs,500,g=>{
    if(!g||typeof g!=='object'||Array.isArray(g))fail();
    return Object.freeze({
      id:text(g.id,128,true),
      allocations:list(g.allocations,500,a=>{
        if(!a||typeof a!=='object'||Array.isArray(a))fail();
        return Object.freeze({unit_id:text(a.unit_id,256,true)});
      }),
      attributes:attrs(g.attributes,100),
    });
  });
}
function items(xs){
  const observed=new Set();
  const result=list(xs,MAX_ITEMS,item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))fail();
    const itemId=text(item.item_id,256,true);
    if(observed.has(itemId))fail();
    observed.add(itemId);
    return Object.freeze({
      item_id:itemId,
      product_id:text(item.product_id,128,true),
      variant_id:text(item.variant_id??'',128),
      variant_allocations:variantAllocations(item.variant_allocations),
      title:text(item.title??'',500),
      collection_ids:ids(item.collection_ids??[],50,128),
      quantity:natural(item.quantity),
      attributes:attrs(item.attributes),
      personalization_groups:groups(item.personalization_groups),
      reference_ids:ids(item.reference_ids),
    });
  });
  if(!result.length)fail();
  return result;
}
export function projectVerifiedWorkMerchantRequestDetail({
  rawPayload,submissionId,revision,ownerAuthorized=false,
}={}){
  // This flag is a defensive guard, NOT authentication. The HTTP handler
  // must never trust an ownerAuthorized value sent by a client.
  if(ownerAuthorized!==true||!ID.test(submissionId||'')||
    !Number.isSafeInteger(revision)||revision<1||revision>100 ||
    typeof rawPayload!=='string'||
    Buffer.byteLength(rawPayload,'utf8')>MAX_BYTES)fail();
  let source;
  try {source=JSON.parse(rawPayload);}catch{fail();}
  if(!source||typeof source!=='object'||Array.isArray(source)||
    source.version!==1 || source.operation!=='custom_order.submit'||
    source.submission_id!==submissionId ||
    !source.customer||!source.planning)fail();
  const customer=Object.freeze({
    name:text(source.customer.name,200,true),
    email:text(source.customer.email,320,true),
    phone:text(source.customer.phone??'',50),
    preferred_contact:VALID_CONTACT.has(source.customer.preferred_contact)?
      source.customer.preferred_contact:'email',
  });
  const p=source.planning;
  const address=p.address??{};
  const fulfillment=text(p.fulfillment??'',64);
  if(!VALID_FULFILLMENT.has(fulfillment))fail();
  const planning=Object.freeze({
    date_needed:text(p.date_needed??'',40),
    fulfillment,
    address:Object.freeze({
      city:text(address.city??'',120),
      state:text(address.state??'',120),
      postal_code:text(address.postal_code??'',32),
      country_code:text(address.country_code??'',2),
    }),
    attributes:attrs(p.attributes??[],50),
  });
  const allItems=items(source.items);
  return Object.freeze({
    version:1,operation:'custom_order.merchant.detail.result',
    submission_id:submissionId,revision,
    submitted_at:text(source.submitted_at,40,true),
    customer,planning,items:allItems,
    request_attributes:attrs(source.request_attributes),
    reference_ids:ids(source.reference_ids),
    // NO active file URLs, inferred Shopify prices, quote totals, secret
    // customer ownership tokens, raw_payload or marketing consent here.
    attachment_state:'unresolved',
  });
}
