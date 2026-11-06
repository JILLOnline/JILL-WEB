// My JILL — signed, bounded customer-owned Contact conversation reader.
// This is SOURCE ONLY and hard OFF unless separately WORK-certified.
import {WORK_CONTACT_ACCOUNT_URL} from './customer-contact-tickets.mjs';
export const WORK_CONTACT_THREAD_URL=
 new URL('/jill-contact-thread',WORK_CONTACT_ACCOUNT_URL).href;
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const STATUS=new Set(['received','reviewing','waiting_customer','resolved']);
const time=v=>typeof v==='string'&&v.length<=40&&
 !Number.isNaN(Date.parse(v))&&/^\d{4}-\d{2}-\d{2}T/.test(v);
const fail=()=>{throw Error('contact_thread_unverified');};
export function projectOwnedContactThread(data,id){
 if(!ID.test(id||'')||!data||typeof data!=='object'||
   Array.isArray(data)||data.version!==1||
   data.operation!=='jill.contact.account.thread.result'||
   data.ok!==true||data.shop!=='jill-work.myshopify.com'||
   !data.thread||data.thread.ticket_id!==id||
   !STATUS.has(data.thread.status)||
   !Number.isSafeInteger(data.thread.revision)||
   data.thread.revision<1||data.thread.revision>100||
   data.thread.reply_enabled!==false||
   data.thread.read_receipt_available!==false||
   !Array.isArray(data.thread.messages)||data.thread.messages.length>50)
  fail();
 let expected=1;
 const messages=data.thread.messages.map(m=>{
  if(!m||typeof m!=='object'||Array.isArray(m)||
     m.author!=='jill'||m.sequence!==expected++||
     typeof m.message!=='string'||m.message.length<1||
     m.message.length>1000||!time(m.created_at))fail();
  return Object.freeze({
   sequence:m.sequence,author:'jill',text:m.message,created_at:m.created_at,
  });
 });
 return Object.freeze({ticket_id:id,status:data.thread.status,
  revision:data.thread.revision,messages:Object.freeze(messages),
  reply_enabled:false,read_receipt_available:false});
}
export async function loadOwnedContactThread({
 enabled=false,sessionToken,request=fetch,ticketId,signal,
}={}){
 if(enabled!==true)return Object.freeze({state:'not_connected',messages:[]});
 if(!ID.test(ticketId||'')||
    typeof sessionToken?.get!=='function'||typeof request!=='function')fail();
 signal?.throwIfAborted?.();
 const jwt=await sessionToken.get();
 if(typeof jwt!=='string'||jwt.length<32||jwt.length>8192)fail();
 signal?.throwIfAborted?.();
 const response=await request(WORK_CONTACT_THREAD_URL,{
  method:'POST',headers:{
   Authorization:'Bearer '+jwt,'Content-Type':'application/json',
  },body:JSON.stringify({ticket_id:ticketId}),
  signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)])
    :AbortSignal.timeout(20000),
 });
 if(!response?.ok)fail();
 const declared=response.headers?.get('content-length');
 if(declared!==null&&declared!==undefined&&
   (!/^(0|[1-9][0-9]*)$/.test(declared)||Number(declared)>65536))fail();
 const reader=response.body?.getReader();
 if(!reader)fail();
 const parts=[];let count=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   count+=value.byteLength;
   if(count>65536)fail();
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 signal?.throwIfAborted?.();
 const bytes=new Uint8Array(count);let at=0;
 for(const part of parts){bytes.set(part,at);at+=part.byteLength;}
 let data;
 try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{fail();}
 const thread=projectOwnedContactThread(data,ticketId);
 signal?.throwIfAborted?.();
 return Object.freeze({state:'ready',...thread});
}
