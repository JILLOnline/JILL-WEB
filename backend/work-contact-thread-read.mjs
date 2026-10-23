// JILL WORK Contact conversation read — SOURCE ONLY and OFF.
// The only authority is Shopify signed Customer Account JWT plus exact
// immutable claimed D1 Customer GID; NEVER email, phone, order # or ticket ID.
import {verifyWorkCustomerAccountSession}
 from './customer-account-work-session.mjs';

const SHOP='jill-work.myshopify.com';
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const TICKET=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PUBLIC=new Set(['received','reviewing','waiting_customer','resolved']);
const HEADERS={'content-type':'application/json; charset=utf-8',
 'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-allow-headers':'Authorization, Content-Type'};
const answer=(status,code,rest={})=>Response.json({
 version:1,operation:'jill.contact.account.thread.result',
 ok:status===200,shop:SHOP,code,...rest,
},{status,headers:HEADERS});
const validTime=ms=>Number.isSafeInteger(ms)&&ms>=1600000000000;
export function projectVerifiedContactThread({ticket,messages,expectedId,
 customerGid}={}){
 if(!TICKET.test(expectedId||'')||!GID.test(customerGid||'')||
    !ticket||ticket.ticket_id!==expectedId||
    ticket.owner_customer_gid!==customerGid||
    !PUBLIC.has(ticket.state)||
    !Number.isSafeInteger(ticket.revision)||ticket.revision<1||
    ticket.revision>100||!validTime(ticket.updated_at_ms)||
    !Array.isArray(messages)||messages.length>50)
  throw Error('contact_thread_unverified');
 let last=0;
 const publicMessages=messages.map(m=>{
  if(!m||!Number.isSafeInteger(m.sequence)||
    m.sequence!==last+1||typeof m.body_text!=='string'||
    m.body_text.length<1||m.body_text.length>1000||
    !validTime(m.created_at_ms)||m.body_text!==m.body_text.trim()||
    /[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]/.test(m.body_text))throw Error('contact_thread_unverified');
  last=m.sequence;
  // whitelist excludes staff IDs, secret hashes, D1 operation receipts,
  // email, contact body/PII, customer GID and internal staff metadata.
  return Object.freeze({
   sequence:m.sequence,author:'jill',message:m.body_text,
   created_at:new Date(m.created_at_ms).toISOString(),
  });
 });
 return Object.freeze({ticket_id:expectedId,status:ticket.state,
  revision:ticket.revision,messages:Object.freeze(publicMessages),
  reply_enabled:false,read_receipt_available:false});
}
async function inputTicket(request){
 if(!/^application\/json(?:;|$)/i.test(
   request.headers.get('content-type')||''))throw Error('invalid');
 const reader=request.body?.getReader();
 if(!reader)throw Error('invalid');
 const parts=[];let len=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   len+=value.byteLength;
   if(len>256)throw Error('invalid');
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(len);let pos=0;
 for(const part of parts){bytes.set(part,pos);pos+=part.byteLength;}
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!data||typeof data!=='object'||Array.isArray(data)||
    Object.keys(data).length!==1||!TICKET.test(data.ticket_id||''))
  throw Error('invalid');
 return data.ticket_id;
}
/** @param {{
 * request?:Request,enabled?:boolean,shopifyAppSecret?:string,
 * db?:any,rateLimit?:(x:{shop:string,customer:string})=>Promise<boolean>,
 * now?:()=>number
 * }} [options]
 */
export async function readWorkCustomerContactThread({
 request,enabled=false,shopifyAppSecret,db,rateLimit,now=Date.now,
}={}){
 if(enabled!==true)return answer(503,'not_connected');
 if(request?.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
 if(request?.method!=='POST')return answer(405,'method_not_allowed');
 if(typeof db?.prepare!=='function'||typeof rateLimit!=='function'||
   typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
   typeof now!=='function')return answer(503,'source_unavailable');
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>8300)
  return answer(401,'unauthenticated_account');
 let identity;
 try{
  identity=verifyWorkCustomerAccountSession(auth.slice(7),{
   appSecret:shopifyAppSecret,now});
  if(identity.shop!==SHOP||!GID.test(identity.customerGid||''))
   return answer(401,'unauthenticated_account');
 }catch{return answer(401,'unauthenticated_account');}
 let rate;
 try{rate=await rateLimit({shop:SHOP,customer:identity.customerGid});}
 catch{return answer(503,'rate_limit_unavailable');}
 if(rate!==true)return answer(429,'rate_limited');
 let id;
 try{id=await inputTicket(request);}
 catch{return answer(400,'invalid_request');}
 try{
  const ticket=await db.prepare(
   'SELECT ticket_id,owner_customer_gid,state,revision,updated_at_ms '+
   'FROM jill_work_contact_tickets '+
   'WHERE shop=? AND ticket_id=? AND owner_customer_gid=?'
  ).bind(SHOP,id,identity.customerGid).first();
  // No row and guest/not-yours are intentionally indistinguishable.
  if(!ticket)return answer(404,'contact_thread_unavailable');
  const query=await db.prepare(
   'SELECT sequence,body_text,created_at_ms '+
   'FROM jill_work_contact_messages WHERE shop=? AND ticket_id=? '+
   'ORDER BY sequence ASC LIMIT 51'
  ).bind(SHOP,id).all();
  if(!Array.isArray(query?.results)||query.results.length>50)
   return answer(503,'contact_thread_unverified');
  const projected=projectVerifiedContactThread({ticket,messages:query.results,
   expectedId:id,customerGid:identity.customerGid});
  return answer(200,'ready',{thread:projected});
 }catch{return answer(503,'contact_thread_unverified');}
}
