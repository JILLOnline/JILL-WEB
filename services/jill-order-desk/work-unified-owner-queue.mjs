// JILL HQ WORK — one read-only owner queue for signed Custom Orders
// and owner-authorized Contact Us tickets.
//
// NO ROUTE OR RUNTIME ACTIVATION HERE. Each upstream read must independently
// authenticate Shopify Owner and WORK D1. Never use email, name, phone,
// storefront hints or Shopify Order numbers to join customer identities.
// This module returns NO customer PII, no messages, no quote contents,
// and never converts a disconnected Contact feed into "zero tickets".
//
// Important: a validated STRUCTURAL result does not itself confer authority.
// Only readUnifiedWorkOwnerQueue() orchestrates the two existing authenticated
// server-only readers. Do not call projectUnifiedWorkOwnerQueue() on browser data.
const SHOP='jill-work.myshopify.com';
const CID=/^[A-Za-z0-9._:-]{8,128}$/;
const TID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const ORDER_STATUS=new Set(['received','reviewing','awaiting_approval',
 'in_production','ready_pickup','on_hold','cancelled','completed']);
const CONTACT_STATUS=new Set(['received','reviewing',
 'waiting_customer','resolved']);
const INTERNAL=new Set(['new','needs_quote','waiting_customer',
 'materials_ordered','proof_revision','printing','assembly',
 'quality_check','ready','none']);
const REASONS=new Set(['existing','shipping','product','custom',
 'pickup','business','website','other']);
const FULFILLMENT=new Set(['','pickup','shipping']);
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const HEADERS={'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff'};
const fail=()=>{throw Error('work_unified_owner_queue_unverified');};
const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const instant=value=>{
 if(typeof value!=='string'||value.length>40||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)||
    !Number.isFinite(Date.parse(value)))fail();
 return Date.parse(value);
};
const epoch=value=>{
 if(!Number.isSafeInteger(value)||value<1600000000000||
   value>253402300799999)fail();
 return value;
};
const state=(mode,rows,extra={})=>Object.freeze({
 state:mode,source:'jill_work_unified_owner_queue_v1',shop:SHOP,
 records:Object.freeze(rows),total_visible:rows.length,
 has_unverified_pages:false,
 contact_connected:false,
 custom_orders_connected:false,
 can_send_message:false,can_publish_quote:false,
 can_invoice:false,can_create_order:false,
 unread_count:null,delivery_receipts_available:false,
 ...extra,
});
const normalizeOrders=input=>{
 if(!obj(input)||input.state!=='ready'||
    input.source!=='google_qa'||input.requestsConnected!==true||
    input.readOnly!==true||input.invoiceEnabled!==false||
    input.fulfillmentEnabled!==false||
    !Array.isArray(input.records)||input.records.length>50)fail();
 const seen=new Set();
 return input.records.map(r=>{
  if(!obj(r)||!CID.test(r.submission_id||'')||
     seen.has(r.submission_id)||
     !Number.isSafeInteger(r.revision)||r.revision<1||r.revision>100||
     !ORDER_STATUS.has(r.customer_status)||!INTERNAL.has(r.internal_status)||
     !FULFILLMENT.has(r.fulfillment)||!DATE.test(r.date_needed||'')&&
      r.date_needed!==''||
     !Number.isSafeInteger(r.item_count)||r.item_count<1||
     r.item_count>500)fail();
  seen.add(r.submission_id);
  const created=instant(r.submitted_at);
  const updated=instant(r.updated_at);
  if(updated<created)fail();
  return Object.freeze({
   kind:'custom_order',id:r.submission_id,
   revision:r.revision,status:r.customer_status,
   stage:r.internal_status,source:'google_qa',
   created_at:new Date(created).toISOString(),
   updated_at:new Date(updated).toISOString(),updated_at_ms:updated,
   item_count:r.item_count,fulfillment:r.fulfillment,
   date_needed:r.date_needed,
   href:'/app/requests/'+encodeURIComponent(r.submission_id),
   can_send_message:false,unread_count:null,
  });
 });
};
const normalizeContacts=input=>{
 if(!obj(input)||input.state!=='verified'||input.code!=='ready'||
    input.kind!=='contact'||input.shop!==SHOP||
    input.has_more!==false||
    !Array.isArray(input.records)||input.records.length>50)fail();
 const seen=new Set();
 return input.records.map(r=>{
  if(!obj(r)||r.kind!=='contact'||!TID.test(r.ticket_id||'')||
     seen.has(r.ticket_id)||!REASONS.has(r.reason)||
     !CONTACT_STATUS.has(r.status)||
     !Number.isSafeInteger(r.revision)||r.revision<1||r.revision>100||
     r.customer_reply_enabled!==false||
     r.customer_owner_verified!==false)fail();
  seen.add(r.ticket_id);
  const created=epoch(r.created_at_ms),updated=epoch(r.updated_at_ms);
  if(updated<created)fail();
  return Object.freeze({
   kind:'contact',id:r.ticket_id,revision:r.revision,
   status:r.status,reason:r.reason,source:'shopify_contact_bridge',
   created_at:new Date(created).toISOString(),
   updated_at:new Date(updated).toISOString(),updated_at_ms:updated,
   href:'/app/contacts/'+encodeURIComponent(r.ticket_id),
   can_send_message:false,unread_count:null,
  });
 });
};

/**
 * This is a pure projection of already verified SERVER results.
 * It is NOT an authentication mechanism or a public parser.
 * The exact server orchestration below is the intended caller.
 */
export function projectUnifiedWorkOwnerQueue({
 requestModel,contactModel,contactEnabled=false,
}={}){
 const orders=normalizeOrders(requestModel);
 if(contactEnabled!==true)return state('partial',orders,{
  custom_orders_connected:true,contact_connected:false,
  contact_state:'not_connected',
 });
 const contacts=normalizeContacts(contactModel);
 const ids=new Set(orders.map(row=>row.id));
 for(const ticket of contacts){
  if(ids.has(ticket.id))fail();
  ids.add(ticket.id);
 }
 // Equal timestamps prefer the already established Custom Order queue;
 // within a kind the stable canonical ID breaks any remaining ties.
 const rank={custom_order:0,contact:1};
 const rows=[...orders,...contacts].sort((a,b)=>
  b.updated_at_ms-a.updated_at_ms||
  rank[a.kind]-rank[b.kind]||a.id.localeCompare(b.id));
 return state('ready',rows,{
  custom_orders_connected:true,contact_connected:true,
  contact_state:'ready',
 });
}

/** Both server readers independently enforce authenticated online Owner and
 * WORK D1 permissions. Contact is NEVER read while hard OFF.
 * Any failed/partial/unauthorized source HOLDs the combined result, rather
 * than presenting an apparently complete but misleading empty inbox.
 */
export async function readUnifiedWorkOwnerQueue({
 enabled=false,contactEnabled=false,request,readRequests,readContacts,
}={}){
 if(enabled!==true)return state('not_connected',[],{
  contact_state:'not_connected',
 });
 if(request?.method!=='GET')return state('held',[],{
  reason:'method_not_allowed',contact_state:'not_connected',
 });
 if(typeof readRequests!=='function'||
  (contactEnabled===true&&typeof readContacts!=='function'))
  return state('held',[],{
   reason:'sources_unavailable',contact_state:'unverified',
  });
 let orders;
 try{
  orders=await readRequests(request);
  if(orders?.status!==200||orders?.model?.state!=='ready')
   return state('held',[],{
    reason:'custom_orders_unavailable',contact_state:'unverified',
   });
 }catch{return state('held',[],{
  reason:'custom_orders_unavailable',contact_state:'unverified',
 });}
 if(contactEnabled!==true){
  try{return projectUnifiedWorkOwnerQueue({
   requestModel:orders.model,
  });}catch{return state('held',[],{
   reason:'custom_orders_unverified',contact_state:'not_connected',
  });}
 }
 let contact;
 try{
  const response=await readContacts(request);
  if(!(response instanceof Response)||response.status!==200)
   return state('held',[],{
    reason:'contact_source_unavailable',contact_state:'unverified',
   });
  // A provider error must not allocate unlimited bytes in the Worker.
  const declared=response.headers.get('content-length');
  if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||
    Number(declared)>24000))fail();
  const reader=response.body?.getReader();
  if(!reader)fail();
  const chunks=[];let total=0;
  try{
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    total+=value.byteLength;
    if(total>24000)fail();
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(total);
  let pos=0;
  for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
  contact=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{return state('held',[],{
  reason:'contact_source_unavailable',contact_state:'unverified',
 });}
 try{return projectUnifiedWorkOwnerQueue({
  requestModel:orders.model,contactModel:contact,contactEnabled:true,
 });}catch{return state('held',[],{
  reason:'unified_source_unverified',contact_state:'unverified',
 });}
}
