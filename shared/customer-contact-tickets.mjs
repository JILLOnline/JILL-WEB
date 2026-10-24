// My JILL — FUTURE signed Contact Us ticket account read.
// Source-only; not imported by any extension screen and there is NO deployed
// /jill-contact-account handler. Never treat Shopify contact[email] as ownership.
import {WORK_CUSTOM_ORDER_ACCOUNT_URL} from './customer-custom-orders.mjs';

export const WORK_CONTACT_ACCOUNT_URL=
 new URL('/jill-contact-account',WORK_CUSTOM_ORDER_ACCOUNT_URL).href;
const SHOP='jill-work.myshopify.com';
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const REASON=new Set(['existing','shipping','product','custom',
 'pickup','business','website','other']);
const STATUS=new Set(['received','reviewing','waiting_customer','resolved']);
const date=x=>typeof x==='string'&&x.length<=40&&
 /^\d{4}-\d{2}-\d{2}T/.test(x)&&Number.isFinite(Date.parse(x));
const fail=()=>{throw Error('contact_account_unverified');};
export function projectVerifiedContactTicketList(source){
 // Must be called only after a future WORK Worker validates signed Shopify
 // customer JWT, exact immutable Contact ownership, source hash and revision.
 if(!source||typeof source!=='object'||Array.isArray(source)||
    source.version!==1||source.operation!=='jill.contact.account.list.result'||
    source.ok!==true||source.shop!==SHOP||
    !Array.isArray(source.tickets)||source.tickets.length>20)fail();
 const seen=new Set();
 return Object.freeze(source.tickets.map(record=>{
  if(!record||typeof record!=='object'||Array.isArray(record)||
    !ID.test(record.ticket_id||'')||seen.has(record.ticket_id)||
    !Number.isSafeInteger(record.revision)||record.revision<1||
    record.revision>100||!REASON.has(record.reason)||
    !STATUS.has(record.status)||!date(record.created_at)||
    !date(record.updated_at)||Date.parse(record.updated_at)<Date.parse(record.created_at)||
    record.thread_version!==1||record.reply_enabled!==false)fail();
  seen.add(record.ticket_id);
  // Whitelist. No email, phone, owner/customer GID, body, private notes,
  // unread/read/delivery status or unverifiable Shopify order association.
  return Object.freeze({ticket_id:record.ticket_id,
   revision:record.revision,reason:record.reason,status:record.status,
   created_at:record.created_at,updated_at:record.updated_at,
   thread_version:1,reply_enabled:false});
 }));
}
export async function loadWorkCustomerContactTickets({
 enabled=false,sessionToken,request=fetch,signal,
}={}){
 // Until the separately certified customer-account route exists, refuse
 // BEFORE reading a session token or making any request.
 if(enabled!==true)return Object.freeze({state:'not_connected',tickets:[]});
 if(typeof sessionToken?.get!=='function'||typeof request!=='function')fail();
 if(signal!==undefined&&!(typeof signal.aborted==='boolean'&&
   typeof signal.addEventListener==='function'))fail();
 signal?.throwIfAborted?.();
 const jwt=await sessionToken.get();
 if(typeof jwt!=='string'||jwt.length<32||jwt.length>8192)fail();
 signal?.throwIfAborted?.();
 const response=await request(WORK_CONTACT_ACCOUNT_URL,{
  method:'POST',body:'',
  headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)])
    :AbortSignal.timeout(20000),
 });
 if(!response?.ok)fail();
 const declared=response.headers?.get('content-length');
 if(declared!==null&&declared!==undefined&&
   (!/^(0|[1-9][0-9]*)$/.test(declared)||Number(declared)>65536))fail();
 const reader=response.body?.getReader();
 if(!reader)fail();
 const parts=[];let used=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   used+=value.byteLength;
   if(used>65536)fail();
   parts.push(value);
  }
 }finally{reader.releaseLock();}
 signal?.throwIfAborted?.();
 const raw=new Uint8Array(used);let offset=0;
 for(const part of parts){raw.set(part,offset);offset+=part.byteLength;}
 let data;
 try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));}
 catch{fail();}
 const tickets=projectVerifiedContactTicketList(data);
 signal?.throwIfAborted?.();
 return Object.freeze({state:'ready',tickets});
}
