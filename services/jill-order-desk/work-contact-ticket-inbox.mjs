// WORK HQ Contact Us inbox projection — SOURCE ONLY, not a route.
// Exact Shopify admin Owner + WORK D1 authorization BEFORE ticket reads.
// Contact names, email, phone, message, Customer GIDs and raw JSON never
// leave the server; do not join Contact Us with Custom Orders by email.
import {readWorkMerchantPermission} from './merchant-access.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const REASON=new Set(['existing','shipping','product','custom',
 'pickup','business','website','other']);
const STATUS=new Set(['received','reviewing','waiting_customer','resolved']);
const HEADERS={'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff'};
const output=(status,code,extra={})=>Response.json({
 state:status===200?'verified':'held',code,kind:'contact',
 shop:SHOP,...extra,
},{status,headers:HEADERS});
export function projectVerifiedWorkContactInbox(rows){
 if(!Array.isArray(rows)||rows.length>51)
  throw Error('invalid_contact_inbox');
 const seen=new Set();
 return Object.freeze({
  records:Object.freeze(rows.slice(0,50).map(row=>{
   if(!row||typeof row!=='object'||Array.isArray(row)||
     !ID.test(row.ticket_id||'')||seen.has(row.ticket_id)||
     !REASON.has(row.reason)||!STATUS.has(row.state)||
     !Number.isSafeInteger(row.revision)||row.revision<1||
     row.revision>100||
     !Number.isSafeInteger(row.created_at_ms)||row.created_at_ms<=0||
     !Number.isSafeInteger(row.updated_at_ms)||
     row.updated_at_ms<row.created_at_ms)
    throw Error('invalid_contact_inbox');
   seen.add(row.ticket_id);
   return Object.freeze({
    kind:'contact',ticket_id:row.ticket_id,reason:row.reason,
    status:row.state,revision:row.revision,
    created_at_ms:row.created_at_ms,
    updated_at_ms:row.updated_at_ms,
    customer_reply_enabled:false,
    customer_owner_verified:false,
   });
  })),
  has_more:rows.length>50,
 });
}
export async function readWorkContactTicketInbox({
 request,enabled=false,authenticate,db,
 authorize=readWorkMerchantPermission,
}={}){
 // Future HQ route remains OFF by default.
 if(enabled!==true)return output(503,'not_connected');
 if(request?.method!=='GET')return output(405,'method_not_allowed');
 if(typeof authenticate?.admin!=='function'||
    typeof authorize!=='function'||typeof db?.prepare!=='function')
  return output(503,'source_unavailable');
 let session,access;
 try {
  const origin=new URL(request.url).origin;
  if(request.headers.get('origin')&&
     request.headers.get('origin')!==origin)
   return output(400,'invalid_request');
  const sdk=await authenticate.admin(request);
  session=sdk.session;
  access=await authorize({db,session,action:'requests.read'});
 }catch{return output(403,'access_denied');}
 if(access?.allowed!==true||access.role!=='owner')
  return output(403,'access_denied');
 try{
  const query=await db.prepare(
   'SELECT ticket_id,state,revision,created_at_ms,updated_at_ms,'+
   "json_extract(contact_json,'$.reason') AS reason "+
   'FROM jill_work_contact_tickets WHERE shop=? '+
   'ORDER BY updated_at_ms DESC LIMIT 51'
  ).bind(SHOP).all();
  const verified=projectVerifiedWorkContactInbox(query?.results);
  return output(200,'ready',verified);
 }catch{return output(503,'source_unavailable');}
}
