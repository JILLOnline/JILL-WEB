// JILL WORK Contact conversation V2: signed Customer Account read,
// two immutable D1 ledgers merged into a public two-author timeline.
// SOURCE ONLY: NEW exact route + feature flags, no modification to V1 read.
import {verifyWorkCustomerAccountSession}
 from './customer-account-work-session.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const GID=/^gid:\/\/shopify\/Customer\/[1-9][0-9]*$/;
const STATES=new Set(['received','reviewing','waiting_customer','resolved']);
const HEADERS={
 'cache-control':'private, no-store, max-age=0',
 'x-content-type-options':'nosniff',
 'access-control-allow-origin':'*',
 'access-control-allow-methods':'POST, OPTIONS',
 'access-control-allow-headers':'Authorization, Content-Type',
};
const reply=(status,code,rest={})=>Response.json({
 version:2,operation:'jill.contact.account.conversation.result',
 ok:status===200,shop:SHOP,code,...rest,
},{status,headers:HEADERS});
const fail=()=>{throw Error('contact_conversation_v2_unverified');};
const epoch=ms=>Number.isSafeInteger(ms)&&ms>=1600000000000&&
 ms<=253402300799999;
const clean=text=>typeof text==='string'&&text.length>0&&
 text.length<=1000&&text===text.trim()&&
 !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text);

export function projectVerifiedContactConversationV2({
 ticket,merchantMessages,customerReplies,ticketId,customerGid,
}={}){
 if(!ID.test(ticketId||'')||!GID.test(customerGid||'')||
  ticket?.ticket_id!==ticketId||
  ticket?.owner_customer_gid!==customerGid||
  !STATES.has(ticket?.state)||
  !Number.isSafeInteger(ticket?.revision)||ticket.revision<1||
  ticket.revision>100||!epoch(ticket.updated_at_ms)||
  !Array.isArray(merchantMessages)||merchantMessages.length>50||
  !Array.isArray(customerReplies)||customerReplies.length>50||
  merchantMessages.length+customerReplies.length>50)fail();
 const merged=[];
 for(const [items,author,key,maxLen] of [
  [merchantMessages,'jill','sequence',1000],
  [customerReplies,'customer','reply_sequence',500],
 ]){
  let previous=0,previousTime=0;
  for(const item of items){
   if(!item||!Number.isSafeInteger(item[key])||
    item[key]!==previous+1||
    !clean(item.body_text)||item.body_text.length>maxLen||
    !epoch(item.created_at_ms)||item.created_at_ms<previousTime)fail();
   if(author==='customer'&&item.actor_customer_gid!==customerGid)fail();
   previous=item[key];
   previousTime=item.created_at_ms;
   merged.push({author,source_sequence:previous,
    message:item.body_text,created_at_ms:item.created_at_ms});
  }
 }
 merged.sort((a,b)=>a.created_at_ms-b.created_at_ms||
  (a.author==='jill'?0:1)-(b.author==='jill'?0:1)||
  a.source_sequence-b.source_sequence);
 const messages=merged.map((m,i)=>Object.freeze({
  sequence:i+1,source_sequence:m.source_sequence,
  author:m.author,message:m.message,
  created_at:new Date(m.created_at_ms).toISOString(),
 }));
 return Object.freeze({
  ticket_id:ticketId,status:ticket.state,revision:ticket.revision,
  messages:Object.freeze(messages),
  reply_enabled:ticket.state!=='resolved'&&messages.length<50,
  read_receipt_available:false,delivery_verified:false,
  unread_count:null,
 });
}
async function requestedTicket(request){
 if(!/^application\/json(?:;|$)/i.test(
  request.headers.get('content-type')||''))fail();
 const len=request.headers.get('content-length');
 if(len!==null&&(!/^(0|[1-9][0-9]*)$/.test(len)||Number(len)>256))fail();
 const reader=request.body?.getReader();
 if(!reader)fail();
 const chunks=[];let used=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   used+=value.byteLength;if(used>256)fail();
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(used);let p=0;
 for(const chunk of chunks){bytes.set(chunk,p);p+=chunk.byteLength;}
 const parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||
   Object.keys(parsed).length!==1||!ID.test(parsed.ticket_id||''))fail();
 return parsed.ticket_id;
}
/** @param {{
 request?:Request,enabled?:boolean,shopifyAppSecret?:string,db?:any,
 rateLimit?:(x:{shop:string,customer:string})=>Promise<boolean>,
 now?:()=>number
 }} [options] */
export async function readWorkContactConversationV2({
 request,enabled=false,shopifyAppSecret,db,rateLimit,now=Date.now,
}={}){
 if(enabled!==true)return reply(503,'not_connected');
 if(request?.method==='OPTIONS')return new Response(null,{status:204,headers:HEADERS});
 if(request?.method!=='POST')return reply(405,'method_not_allowed');
 if(typeof db?.prepare!=='function'||typeof rateLimit!=='function'||
   typeof shopifyAppSecret!=='string'||shopifyAppSecret.length<32||
   typeof now!=='function')return reply(503,'source_unavailable');
 const auth=request.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth.length>8300)
  return reply(401,'unauthenticated_account');
 let gid;
 try{
  const signed=verifyWorkCustomerAccountSession(auth.slice(7),{
   appSecret:shopifyAppSecret,now,
  });
  if(signed.shop!==SHOP||!GID.test(signed.customerGid||''))
   return reply(401,'unauthenticated_account');
  gid=signed.customerGid;
 }catch{return reply(401,'unauthenticated_account');}
 try{
  if(await rateLimit({shop:SHOP,customer:gid})!==true)
   return reply(429,'rate_limited');
 }catch{return reply(503,'rate_limit_unavailable');}
 let id;
 try{id=await requestedTicket(request);}
 catch{return reply(400,'invalid_request');}
 try{
  const ticket=await db.prepare(
   'SELECT ticket_id,owner_customer_gid,state,revision,updated_at_ms '+
   'FROM jill_work_contact_tickets WHERE shop=? AND ticket_id=? '+
   'AND owner_customer_gid=?'
  ).bind(SHOP,id,gid).first();
  if(!ticket)return reply(404,'contact_thread_unavailable');
  const merchant=await db.prepare(
   'SELECT sequence,body_text,created_at_ms FROM jill_work_contact_messages '+
   'WHERE shop=? AND ticket_id=? ORDER BY sequence ASC LIMIT 51'
  ).bind(SHOP,id).all();
  const customer=await db.prepare(
   'SELECT reply_sequence,actor_customer_gid,body_text,created_at_ms '+
   'FROM jill_work_contact_customer_replies '+
   'WHERE shop=? AND ticket_id=? ORDER BY reply_sequence ASC LIMIT 51'
  ).bind(SHOP,id).all();
  const projection=projectVerifiedContactConversationV2({
   ticket,merchantMessages:merchant?.results,
   customerReplies:customer?.results,
   ticketId:id,customerGid:gid,
  });
  return reply(200,'ready',{thread:projection});
 }catch{return reply(503,'contact_conversation_unverified');}
}
