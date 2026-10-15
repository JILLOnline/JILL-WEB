// Private WORK-only exact request payload reader. DO NOT invoke from
// a browser loader without verified Shopify online Owner + WORK D1 access.
// The deployed QA v7 currently lacks this operation: keep feature DISABLED
// until Google QA project has a separately certified detail-enabled /exec.
import {createHmac,randomBytes} from 'node:crypto';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from './work-google-merchant-read.mjs';
import {projectVerifiedWorkMerchantRequestDetail}
  from './merchant-request-detail.mjs';

const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const TS=/^[0-9]{13}$/;
const MAX_RESPONSE_BYTES=350*1024;
const MAX_RAW_BYTES=256*1024;
function fail(){throw Error('invalid_work_merchant_detail_source');}

export function signWorkMerchantDetail({
  secret,shop=SHOP,submissionId,timestamp,nonce,
}={}){
  if(shop!==SHOP||!ID.test(submissionId||'')||
    !TS.test(String(timestamp||''))||!NONCE.test(nonce||'')||
    typeof secret!=='string'||secret.length<32)fail();
  return createHmac('sha256',secret).update(
    ['merchant_detail_v1',SHOP,submissionId,String(timestamp),nonce]
      .join('\n'),'utf8').digest('hex');
}

/** @param {{
  secret?:string,
  submissionId?:string,
  backendFetch?:typeof fetch,
  now?:()=>number,
  makeNonce?:()=>string,
  endpoint?:string
}} [options] */
export async function readWorkGoogleQaMerchantDetail({
  secret,submissionId,backendFetch=fetch,now=Date.now,
  makeNonce=()=>randomBytes(24).toString('base64url'),
  endpoint=JILL_HQ_WORK_QA_GOOGLE_URL,
}={}){
  if(!ID.test(submissionId||'')||
    endpoint!==JILL_HQ_WORK_QA_GOOGLE_URL ||
    typeof backendFetch!=='function'||typeof now!=='function'||
    typeof makeNonce!=='function')fail();
  const timestamp=String(now()),nonce=makeNonce();
  const sig=signWorkMerchantDetail({secret,submissionId,timestamp,nonce});
  const body=new URLSearchParams({
    jill_order_merchant_detail:'1',shop:SHOP,submission_id:submissionId,
    jill_hq_read_ts:timestamp,jill_hq_read_nonce:nonce,
    jill_hq_read_sig:sig,
  });
  const response=await backendFetch(endpoint,{
    method:'POST',
    redirect:'follow',
    headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
      accept:'application/json'},
    body,signal:AbortSignal.timeout(15000),
  });
  if(!response?.ok)throw Error('work_merchant_detail_source_unavailable');
  const declared=Number(response.headers?.get('content-length')||'0');
  if(!Number.isFinite(declared)||declared>MAX_RESPONSE_BYTES)fail();
  const reader=response.body?.getReader();
  if(!reader)fail();
  let len=0;
  const chunks=[];
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      len+=value.byteLength;
      if(len>MAX_RESPONSE_BYTES)fail();
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(len);
  let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let source;
  try{source=JSON.parse(new TextDecoder().decode(bytes));}
  catch{fail();}
  if(!source||source.version!==1||
    source.operation!=='custom_order.merchant.detail.source.result' ||
    source.ok!==true||source.shop!==SHOP||
    source.submission_id!==submissionId||
    !Number.isSafeInteger(source.revision)||
    source.revision<1||source.revision>100||
    typeof source.raw_payload!=='string'||
    Buffer.byteLength(source.raw_payload,'utf8')>MAX_RAW_BYTES)
    fail();
  // Only this immutable projection is allowed to reach an Owner UI.
  // Raw_payload cannot be returned by any exported helper.
  return projectVerifiedWorkMerchantRequestDetail({
    rawPayload:source.raw_payload,
    submissionId,revision:source.revision,
    ownerAuthorized:true,
  });
}
