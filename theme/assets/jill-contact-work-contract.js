// WORK QA Contact Us storefront contract. The Shopify-native form remains
// default; this module contains no network call, storage or account lookup.
// Shopify app-proxy signs only a shop, never verified Customer ownership.
(() => {
  'use strict';
  const ENDPOINT='/apps/jill-custom-order/contact';
  const SHOP='jill-work.myshopify.com';
  const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
  const INPUTS=Object.freeze({
    name:'contact[name]',email:'contact[email]',
    phone:'contact[Phone]',reason:'contact[Reason]',
    message:'contact[body]',preferred_contact:'contact[Preferred contact]',
    reviewed:'contact[Reviewed details]',
  });
  const DETAILS=Object.freeze({
    order_number:'contact[Order number]',
    product_name:'contact[Product]',
    business_name:'contact[Business or organization]',
    business_link:'contact[Business link]',
    website_area:'contact[Page or area]',
    device:'contact[Device or browser]',
    reference_images:'contact[Has reference images]',
  });
  const VALID_REASONS=new Set([
    'existing','shipping','product','custom','pickup','business','website','other',
  ]);
  function single(map,key,optional=false) {
    const values=map.get(key)||[];
    if(values.length>1||(values.length===0&&!optional))
      throw Error('contact_field_ambiguous');
    return values[0]||'';
  }
  function normalizedForm(entries,uuid){
    if(typeof uuid!=='string'||!UUID.test(uuid))throw Error('contact_id_invalid');
    const map=new Map();
    for(const [key,value] of entries){
      if(typeof key!=='string'||typeof value!=='string')
        throw Error('contact_field_invalid');
      if(!map.has(key))map.set(key,[]);
      map.get(key).push(value);
    }
    const record={ticket_id:'jill:contact:'+uuid.toLowerCase()};
    for(const [key,field] of Object.entries(INPUTS))
      record[key]=single(map,field,key==='phone').trim();
    record.reviewed=record.reviewed==='Yes';
    record.details={};
    for(const [key,field] of Object.entries(DETAILS))
      record.details[key]=single(map,field,true).trim();
    if(!VALID_REASONS.has(record.reason)||
       (record.preferred_contact!=='Email'&&record.preferred_contact!=='Phone')||
       !record.reviewed||record.name.length<1||record.name.length>120||
       !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)||
       record.email.length>254||record.phone.length>40||
       record.message.length<1||record.message.length>3000||
       (record.preferred_contact==='Phone'&&record.phone.length<3)||
       (['existing','shipping'].includes(record.reason)&&
        !record.details.order_number)||
       Object.values(record.details).some(x=>x.length>200)||
       !['','Yes','No'].includes(record.details.reference_images))
      throw Error('contact_fields_invalid');
    return record;
  }
  function mayUseWorkAdapter({mode,host,endpoint}={}){
    return mode==='qa-enabled'&&host===SHOP&&endpoint===ENDPOINT;
  }
  globalThis.JILLContactWorkContract=Object.freeze({
    ENDPOINT,normalizedForm,mayUseWorkAdapter,
  });
})();
