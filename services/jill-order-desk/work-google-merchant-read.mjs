// JILL HQ WORK -> dedicated Google Custom Orders QA merchant list, server-side only.
// This never accepts a browser customer ID, guest receipt, Shopify session token,
// or a user-selected Google URL. Calling code must authenticate online Shopify
// Owner and authorize WORK D1 requests.read BEFORE invoking this reader.
import {createHmac,randomBytes} from 'node:crypto';

export const JILL_HQ_WORK_QA_GOOGLE_URL =
  'https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec';
const SHOP='jill-work.myshopify.com';
const MAX_RESPONSE_BYTES=65536;
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const TIMESTAMP=/^[0-9]{13}$/;

export function signWorkMerchantList({secret,timestamp,nonce,shop=SHOP}={}) {
  if(shop!==SHOP || typeof secret!=='string' || secret.length<32 ||
    !TIMESTAMP.test(String(timestamp||'')) || !NONCE.test(nonce||''))
    throw Error('invalid_work_merchant_signing_input');
  return createHmac('sha256',secret).update(
    ['merchant_list_v1',SHOP,String(timestamp),nonce].join('\n'),'utf8',
  ).digest('hex');
}

export async function readWorkGoogleQaMerchantList({
  secret,backendFetch=fetch,now=Date.now,makeNonce=()=>randomBytes(24).toString('base64url'),
  endpoint=JILL_HQ_WORK_QA_GOOGLE_URL,
}={}) {
  if(endpoint!==JILL_HQ_WORK_QA_GOOGLE_URL ||
    typeof backendFetch!=='function' || typeof now!=='function' ||
    typeof makeNonce!=='function')
    throw Error('invalid_work_merchant_source');
  const timestamp=String(now());
  const nonce=makeNonce();
  const signature=signWorkMerchantList({secret,timestamp,nonce});
  const body=new URLSearchParams({
    jill_order_merchant_list:'1',
    shop:SHOP,
    jill_hq_read_ts:timestamp,
    jill_hq_read_nonce:nonce,
    jill_hq_read_sig:signature,
  });
  const response=await backendFetch(endpoint,{
    method:'POST',
    headers:{
      'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
      'accept':'application/json',
    },
    body,
    redirect:'follow',
    signal:AbortSignal.timeout(15000),
  });
  if(!response?.ok)throw Error('work_merchant_source_unavailable');
  const length=Number(response.headers?.get('content-length')||'0');
  if(!Number.isFinite(length)||length>MAX_RESPONSE_BYTES)
    throw Error('work_merchant_source_oversized');
  // Limit bytes, not just JSON record count. Cancel large streaming responses.
  const reader=response.body?.getReader();
  if(!reader)throw Error('work_merchant_source_empty');
  let size=0, chunks=[];
  try {
    while(true) {
      const {value,done}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_RESPONSE_BYTES)throw Error('work_merchant_source_oversized');
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes=new Uint8Array(size);
  let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}
  let parsed;
  try{parsed=JSON.parse(new TextDecoder().decode(bytes));}
  catch {throw Error('work_merchant_source_invalid');}
  // Strict schema validation/projection happens in merchant-inbox-read.mjs.
  return parsed;
}
