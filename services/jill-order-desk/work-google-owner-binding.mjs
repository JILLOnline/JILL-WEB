// JILL HQ WORK: FUTURE private Google QA owner-binding read, SOURCE ONLY.
// NO published Google endpoint currently supports this operation. Never
// point this at the existing immutable merchant-detail @9 endpoint.
// This module has no route/consumer and is hard OFF unless explicitly called
// by a future separately certified WORK Owner release.
import {createHmac} from 'node:crypto';
import {verifyWorkQuoteOwnerBindingReceipt}
 from './work-quote-shopify-customer-bridge.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const BACKEND=/^https:\/\/script\.google\.com\/macros\/s\/AKfycb[A-Za-z0-9_-]+\/exec$/;
const DENY_DETAIL='https://script.google.com/macros/s/AKfycby2CWe5_GeTfVwMlITER0psT5eO0UCysEsHXpiqWXTBHTICxKr5E584IA1ErxPPWIzH/exec';
const FIELDS=['version','operation','ok','shop','submission_id',
 'source_revision','owner_status','owner_customer_gid',
 'raw_payload_sha256','verified_at_ms','nonce','signature'];
const fail=code=>{throw Error('work_google_owner_binding_'+code);};
export function signWorkGoogleOwnerBindingRequest({
 secret,submissionId,sourceRevision,timestamp,nonce,
}={}){
 if(typeof secret!=='string'||secret.length<32||
   !ID.test(submissionId||'')||
   !Number.isSafeInteger(sourceRevision)||sourceRevision<1||
   sourceRevision>100||
   !/^[0-9]{13}$/.test(String(timestamp||''))||
   !NONCE.test(nonce||''))fail('invalid_request_signer');
 return createHmac('sha256',secret).update([
  'merchant_owner_binding_request_v1',SHOP,submissionId,
  String(sourceRevision),String(timestamp),nonce,
 ].join('\n'),'utf8').digest('hex');
}
async function readBoundedJson(response){
 if(!response?.ok)fail('unavailable');
 const declared=Number(response.headers?.get('content-length')||'0');
 if(!Number.isFinite(declared)||declared>2048)fail('oversized');
 const reader=response.body?.getReader();
 if(!reader)fail('missing_body');
 const chunks=[];let used=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   used+=value.byteLength;
   if(used>2048)fail('oversized');
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const out=new Uint8Array(used);let offset=0;
 for(const part of chunks){out.set(part,offset);offset+=part.byteLength;}
 try{
  const source=JSON.parse(new TextDecoder().decode(out));
  if(!source||typeof source!=='object'||Array.isArray(source)||
     Object.keys(source).length!==FIELDS.length||
     !FIELDS.every(key=>Object.hasOwn(source,key)))
   fail('unexpected_payload');
  return source;
 }catch(error){
  if(error?.message?.startsWith('work_google_owner_binding_'))throw error;
  fail('invalid_json');
 }
}
export async function readWorkGoogleQaOwnerBinding({
 enabled=false,approvedEndpoint,secret,submissionId,sourceRevision,
 nonce,now=Date.now,backendFetch=fetch,
}={}){
 if(enabled!==true)fail('not_enabled');
 if(typeof approvedEndpoint!=='string'||!BACKEND.test(approvedEndpoint)||
    approvedEndpoint===DENY_DETAIL||
    typeof backendFetch!=='function'||typeof now!=='function'||
    !NONCE.test(nonce||''))fail('unapproved_endpoint');
 const timestamp=String(now());
 const sig=signWorkGoogleOwnerBindingRequest({
  secret,submissionId,sourceRevision,timestamp,nonce,
 });
 // Signed and exact fixed key set; no email, address, customer-supplied GID
 // or raw private Custom Order payload is sent to Apps Script.
 const body=new URLSearchParams({
  jill_order_merchant_owner_binding:'1',shop:SHOP,
  submission_id:submissionId,source_revision:String(sourceRevision),
  jill_hq_read_ts:timestamp,jill_hq_read_nonce:nonce,
  jill_hq_read_sig:sig,
 });
 const response=await backendFetch(approvedEndpoint,{
  method:'POST',redirect:'follow',
  headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
   'accept':'application/json'},
  body,signal:AbortSignal.timeout(15000),
 });
 const source=await readBoundedJson(response);
 const proof=verifyWorkQuoteOwnerBindingReceipt({
  source,submissionId,sourceRevision,nonce,secret,nowMs:now(),
 });
 if(proof.state!=='owner_binding_verified')fail('invalid_signed_receipt');
 // Only the original immutable proof fields are returned internally.
 // This is NOT permission to create an invoice or use a customer address.
 return Object.freeze(Object.fromEntries(FIELDS.map(key=>[key,source[key]])));
}
