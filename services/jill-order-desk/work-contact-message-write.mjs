// JILL WORK Contact message persistence — SOURCE ONLY, hard OFF.
// Merchant public replies become available to My JILL only after exact
// ticket claim by a Shopify Customer Account. NO email send, read receipt,
// payment, or generic Shopify Order association happens here.
import {createHash} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';

const SHOP='jill-work.myshopify.com';
const TICKET=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:work:contact:msg:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const STAFF=/^[1-9][0-9]{0,19}$/;
const HEADERS={'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff'};
const reply=(status,code,extra={})=>Response.json({
 ok:status===200,code,kind:'contact',...extra,
},{status,headers:HEADERS});
const digest=body=>createHash('sha256').update(
 'jill_work_contact_message_v1\n'+body,'utf8').digest('hex');
async function command(request){
 if(!/^application\/json(?:;|$)/i.test(
   request.headers.get('content-type')||''))throw Error('invalid');
 const declared=request.headers.get('content-length');
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||
    Number(declared)>2500))throw Error('invalid');
 const stream=request.body?.getReader();
 if(!stream)throw Error('invalid');
 let size=0;const chunks=[];
 try{
  while(true){
   const {value,done}=await stream.read();
   if(done)break;
   size+=value.byteLength;
   if(size>2500)throw Error('invalid');
   chunks.push(value);
  }
 }finally{stream.releaseLock();}
 const bytes=new Uint8Array(size);let pos=0;
 for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.byteLength;}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).length!==3||
    !TICKET.test(data.ticket_id||'')||!OP.test(data.operation_id||'')||
    typeof data.message!=='string'||data.message.length<1||
    data.message.length>1000||data.message!==data.message.trim()||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(data.message))
  throw Error('invalid');
 return data;
}
/** @param {{
 * request?:Request,enabled?:boolean,expectedTicketId?:string,db?:any,
 * authenticate?:{admin:(request:Request)=>Promise<any>},
 * authorize?:typeof readWorkMerchantPermission,now?:()=>number
 * }} [options]
 */
export async function persistWorkContactMerchantMessage({
 request,enabled=false,expectedTicketId,db,authenticate,
 authorize=readWorkMerchantPermission,now=Date.now,
}={}){
 if(enabled!==true)return reply(503,'not_connected');
 if(request?.method!=='POST')return reply(405,'method_not_allowed');
 if(typeof db?.prepare!=='function'||typeof authenticate?.admin!=='function'||
    typeof authorize!=='function'||typeof now!=='function')
  return reply(503,'source_unavailable');
 try{
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin)
   return reply(400,'invalid_request');
 }catch{return reply(400,'invalid_request');}
 let access;
 try{
  const {session}=await authenticate.admin(request);
  access=await authorize({db,session,action:'requests.write'});
 }catch{return reply(403,'access_denied');}
 if(access?.allowed!==true||access.role!=='owner'||
    !STAFF.test(access.staffId||''))return reply(403,'access_denied');
 let data;
 try{data=await command(request);}
 catch{return reply(400,'invalid_request');}
 if(expectedTicketId!==undefined&&data.ticket_id!==expectedTicketId)
  return reply(400,'invalid_ticket');
 const at=now();
 if(!Number.isSafeInteger(at)||at<1600000000000)
  return reply(503,'source_unavailable');
 const hash=digest(data.message);
 try{
  // A guest must claim using a separate signed Customer Account JWT
  // and the private form claim code before HQ posts to My JILL.
  const ticket=await db.prepare(
   'SELECT owner_customer_gid FROM jill_work_contact_tickets '+
   'WHERE shop=? AND ticket_id=?'
  ).bind(SHOP,data.ticket_id).first();
  if(!GID.test(ticket?.owner_customer_gid||''))
   return reply(409,'customer_account_unverified');
  // SINGLE SQL INSERT (including sequence allocation) prevents a partial
  // status/message write. Global operation uniqueness blocks reuse of a
  // receipt across any ticket even if a caller guesses another ticket ID.
  const saved=await db.prepare(
   'INSERT OR IGNORE INTO jill_work_contact_messages '+
   '(shop,ticket_id,sequence,operation_id,actor_staff_id,body_text,'+
   'body_sha256,created_at_ms) '+
   'SELECT ?,?,COALESCE((SELECT MAX(sequence)+1 '+
   'FROM jill_work_contact_messages WHERE shop=? AND ticket_id=?),1),'+
   '?,?,?,?,? FROM jill_work_contact_tickets t '+
   'WHERE t.shop=? AND t.ticket_id=? AND t.owner_customer_gid=? '+
   'AND (SELECT COUNT(*) FROM jill_work_contact_messages m '+
   'WHERE m.shop=? AND m.ticket_id=?)<50'
  ).bind(SHOP,data.ticket_id,SHOP,data.ticket_id,
   data.operation_id,access.staffId,data.message,hash,at,
   SHOP,data.ticket_id,ticket.owner_customer_gid,SHOP,data.ticket_id).run();
  if(saved?.success!==true||![0,1].includes(saved?.meta?.changes))
   return reply(503,'source_unavailable');
  const existing=await db.prepare(
   'SELECT sequence,operation_id,actor_staff_id,body_sha256 '+
   'FROM jill_work_contact_messages '+
   'WHERE shop=? AND operation_id=?'
  ).bind(SHOP,data.operation_id).first();
  if(existing?.operation_id!==data.operation_id||
     existing?.actor_staff_id!==access.staffId||
     existing?.body_sha256!==hash)
   return reply(409,'message_not_confirmed');
  // An existing operation for some other ticket is NOT a success.
  const exact=await db.prepare(
   'SELECT sequence FROM jill_work_contact_messages '+
   'WHERE shop=? AND ticket_id=? AND operation_id=?'
  ).bind(SHOP,data.ticket_id,data.operation_id).first();
  if(exact?.sequence!==existing.sequence||
     !Number.isSafeInteger(exact?.sequence))
   return reply(409,'message_not_confirmed');
  return reply(200,saved.meta.changes===1?'persisted_for_customer_account':
    'already_persisted',{ticket_id:data.ticket_id,sequence:exact.sequence});
 }catch{return reply(503,'source_unavailable');}
}
