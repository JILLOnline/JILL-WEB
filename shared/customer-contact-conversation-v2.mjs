// My JILL Contact conversation V2: customer-visible immutable projection.
// SOURCE ONLY; no existing My JILL navigation/flags or V1 thread changed.
// Endpoint requires signed Shopify Customer Account JWT and exact D1 claim.
import {WORK_CONTACT_THREAD_URL}
 from './customer-contact-thread.mjs';
export const WORK_CONTACT_CONVERSATION_V2_URL=
 new URL('/jill-contact-conversation-v2',WORK_CONTACT_THREAD_URL).href;
export const WORK_CONTACT_REPLY_URL=
 new URL('/jill-contact-reply',WORK_CONTACT_THREAD_URL).href;
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const OP=/^jill:customer:contact:reply:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const STATUSES=new Set(['received','reviewing','waiting_customer','resolved']);
const fail=()=>{throw Error('contact_conversation_v2_unverified');};
const instant=x=>typeof x==='string'&&x.length<=40&&
 /^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
export function projectOwnedContactConversationV2(data,id){
 if(!ID.test(id||'')||!data||typeof data!=='object'||
  Array.isArray(data)||data.version!==2||
  data.operation!=='jill.contact.account.conversation.result'||
  data.ok!==true||data.shop!=='jill-work.myshopify.com'||
  !data.thread||data.thread.ticket_id!==id||
  !STATUSES.has(data.thread.status)||
  !Number.isSafeInteger(data.thread.revision)||data.thread.revision<1||
  data.thread.revision>100||
  !Array.isArray(data.thread.messages)||data.thread.messages.length>50||
  typeof data.thread.reply_enabled!=='boolean'||
  data.thread.reply_enabled!==
   (data.thread.status!=='resolved'&&data.thread.messages.length<50)||
  data.thread.read_receipt_available!==false||
  data.thread.delivery_verified!==false||
  data.thread.unread_count!==null)fail();
 let lastTime=0;
 const lastByAuthor={jill:0,customer:0};
 const messages=data.thread.messages.map((item,index)=>{
  if(!item||typeof item!=='object'||Array.isArray(item)||
   item.sequence!==index+1||
   !['jill','customer'].includes(item.author)||
   item.source_sequence!==lastByAuthor[item.author]+1||
   typeof item.message!=='string'||item.message.length<1||
   item.message.length>(item.author==='jill'?1000:500)||
   !instant(item.created_at)||Date.parse(item.created_at)<lastTime)fail();
  lastByAuthor[item.author]=item.source_sequence;
  lastTime=Date.parse(item.created_at);
  return Object.freeze({sequence:item.sequence,
   source_sequence:item.source_sequence,
   author:item.author,text:item.message,
   created_at:item.created_at});
 });
 return Object.freeze({
  ticket_id:id,status:data.thread.status,revision:data.thread.revision,
  messages:Object.freeze(messages),
  reply_enabled:data.thread.reply_enabled,
  read_receipt_available:false,delivery_verified:false,
  unread_count:null,
  next_customer_reply_sequence:lastByAuthor.customer,
 });
}
async function fetchBoundedJson({url,sessionToken,request,body,signal}){
 if(typeof sessionToken?.get!=='function'||typeof request!=='function')fail();
 signal?.throwIfAborted?.();
 const token=await sessionToken.get();
 if(typeof token!=='string'||token.length<32||token.length>8192)fail();
 signal?.throwIfAborted?.();
 const response=await request(url,{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body),
  signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)])
   :AbortSignal.timeout(20000),
 });
 if(!response?.ok)fail();
 const declared=response.headers?.get('content-length');
 if(declared!==null&&declared!==undefined&&
  (!/^(0|[1-9][0-9]*)$/.test(declared)||Number(declared)>65536))fail();
 const reader=response.body?.getReader();
 if(!reader)fail();
 let length=0;const parts=[];
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;if(length>65536)fail();
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 signal?.throwIfAborted?.();
 const bytes=new Uint8Array(length);let offset=0;
 for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{fail();}
}
export async function loadOwnedContactConversationV2({
 enabled=false,sessionToken,request=fetch,ticketId,signal,
}={}){
 if(enabled!==true)return Object.freeze({state:'not_connected',messages:[]});
 if(!ID.test(ticketId||''))fail();
 const data=await fetchBoundedJson({
  url:WORK_CONTACT_CONVERSATION_V2_URL,sessionToken,request,
  body:{ticket_id:ticketId},signal,
 });
 const projection=projectOwnedContactConversationV2(data,ticketId);
 signal?.throwIfAborted?.();
 return Object.freeze({state:'ready',...projection});
}
export async function postOwnedContactReply({
 enabled=false,sessionToken,request=fetch,ticketId,
 operationId,expectedReplySequence,message,signal,
}={}){
 // Only owner-enabled WORK UI can opt into this. Does not create new IDs
 // or retry on uncertainty; the caller must keep the SAME immutable op.
 if(enabled!==true)return Object.freeze({state:'not_connected'});
 if(!ID.test(ticketId||'')||!OP.test(operationId||'')||
  !Number.isSafeInteger(expectedReplySequence)||
  expectedReplySequence<0||expectedReplySequence>49||
  typeof message!=='string'||message.length<1||message.length>500||
  message!==message.trim())fail();
 const ack=await fetchBoundedJson({
  url:WORK_CONTACT_REPLY_URL,sessionToken,request,
  body:{ticket_id:ticketId,operation_id:operationId,
   expected_reply_sequence:expectedReplySequence,message},signal,
 });
 if(!ack||ack.ok!==true||ack.version!==1||
  ack.operation!=='jill.contact.customer.reply.result'||
  !['reply_saved','already_persisted'].includes(ack.code)||
  ack.ticket_id!==ticketId||ack.operation_id!==operationId||
  ack.sequence!==expectedReplySequence+1)fail();
 return Object.freeze({
  state:'persisted_unconfirmed_readback',
  operation_id:operationId,sequence:ack.sequence,
  delivered:false,read:false,
 });
}
