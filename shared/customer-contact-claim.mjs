// My JILL — future verified claim of a guest Contact Us inquiry.
// No email/phone lookup. The customer must provide both a private 256-bit
// possession code and a fresh Shopify Customer Account session JWT.
// This module is hard OFF until the independently certified WORK Worker
// and D1 source claim route are deployed and allowed in this extension.
import {WORK_CONTACT_ACCOUNT_URL} from './customer-contact-tickets.mjs';
export const WORK_CONTACT_CLAIM_URL=
 new URL('/jill-contact-claim',WORK_CONTACT_ACCOUNT_URL).href;
const ID=/^jill:contact:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const CLAIM=/^[A-Za-z0-9_-]{43}$/;
const fail=code=>{throw Error(code);};
export async function claimWorkCustomerContactTicket({
 enabled=false,sessionToken,request=fetch,ticketId,claimCode,signal,
}={}){
 // OFF before acquiring ANY Shopify session JWT or request data.
 if(enabled!==true)fail('contact_claim_not_connected');
 if(typeof sessionToken?.get!=='function'||typeof request!=='function'||
    !ID.test(ticketId||'')||!CLAIM.test(claimCode||''))
   fail('contact_claim_invalid');
 signal?.throwIfAborted?.();
 const jwt=await sessionToken.get();
 if(typeof jwt!=='string'||jwt.length<32||jwt.length>8192)
  fail('contact_claim_unauthenticated');
 signal?.throwIfAborted?.();
 const response=await request(WORK_CONTACT_CLAIM_URL,{
  method:'POST',
  headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
  body:JSON.stringify({ticket_id:ticketId,claim_token:claimCode}),
  signal:signal?AbortSignal.any([signal,AbortSignal.timeout(20000)])
   :AbortSignal.timeout(20000),
 });
 if(response?.status===409)fail('contact_claim_unverified');
 if(!response?.ok)fail('contact_claim_unconfirmed');
 const declared=response.headers?.get('content-length');
 if(declared!==null&&declared!==undefined&&
    (!/^(0|[1-9][0-9]*)$/.test(declared)||Number(declared)>2048))
  fail('contact_claim_unconfirmed');
 const reader=response.body?.getReader();
 if(!reader)fail('contact_claim_unconfirmed');
 const buffers=[];let len=0;
 try{
  while(true){
   const {value,done}=await reader.read();
   if(done)break;
   len+=value.byteLength;
   if(len>2048)fail('contact_claim_unconfirmed');
   buffers.push(value);
  }
 }finally{reader.releaseLock();}
 signal?.throwIfAborted?.();
 const bytes=new Uint8Array(len);let index=0;
 for(const chunk of buffers){bytes.set(chunk,index);index+=chunk.byteLength;}
 let receipt;
 try{receipt=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{fail('contact_claim_unconfirmed');}
 if(!receipt||typeof receipt!=='object'||Array.isArray(receipt)||
   receipt.version!==1||
   receipt.operation!=='jill.contact.account.claim.result'||
   receipt.ok!==true||
   !['claimed','already_claimed'].includes(receipt.code)||
   receipt.ticket_id!==ticketId)
  fail('contact_claim_unconfirmed');
 // Do not return the secret, email, phone, claimed GID or raw ticket body.
 return Object.freeze({state:'claimed',ticket_id:ticketId});
}
