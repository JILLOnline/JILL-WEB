// JILL HQ WORK-only mutation boundary. NO browser access to Google or secrets.
import {createHmac,randomBytes} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL} from './work-google-merchant-read.mjs';
import {invalidateWorkMerchantSourceCache} from './work-merchant-source-cache.mjs';
import {invalidateWorkD1InboxIndex} from './work-merchant-d1-index.mjs';

import {WORK_STATUS_TRANSITIONS,WORK_INTERNAL_STAGES} from './merchant-command-contract.mjs';
export {WORK_STATUS_TRANSITIONS,WORK_INTERNAL_STAGES} from './merchant-command-contract.mjs';
const SHOP='jill-work.myshopify.com';
const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const OP=/^jill:hq:(?:status|message):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const NONCE=/^[A-Za-z0-9_-]{32}$/;
const RESPONSE_HEADERS={'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff'};
const writeResult=(status,code,extra={})=>new Response(JSON.stringify({
  ok:status===200,code,...extra,
}),{status,headers:{...RESPONSE_HEADERS,'content-type':'application/json; charset=utf-8'}});

export function validateWorkMerchantCommand(input) {
  const v=input||{};
  const keys=['kind','submission_id','operation_id','expected_revision',
    'current_status','customer_status','internal_status','public_note',
    'internal_note','handoff_reference'];
  if(typeof v!=='object'||Array.isArray(v)||
     Object.keys(v).some(key=>!keys.includes(key)))throw Error('invalid_command');
  const data={};
  for(const key of keys) {
    if(typeof v[key]!=='string')throw Error('invalid_command');
    data[key]=v[key];
  }
  const revision=Number(data.expected_revision);
  if(!['status','message'].includes(data.kind)||
     !ID.test(data.submission_id)||!OP.test(data.operation_id)||
     !data.operation_id.startsWith('jill:hq:'+data.kind+':')||
     !/^[1-9][0-9]{0,2}$/.test(data.expected_revision)||
     revision>99 ||
     !Object.hasOwn(WORK_STATUS_TRANSITIONS,data.current_status)||
     !Object.hasOwn(WORK_STATUS_TRANSITIONS,data.customer_status)||
     !WORK_INTERNAL_STAGES.includes(data.internal_status)||
     data.public_note.length>500||
     data.internal_note.length>2000||
     data.handoff_reference.length>256)
    throw Error('invalid_command');
  if(data.kind==='message') {
    if(data.customer_status!==data.current_status||
       data.public_note.trim().length===0 || data.internal_note ||
       data.handoff_reference)
      throw Error('invalid_message');
  } else {
    if(data.customer_status!==data.current_status &&
       !WORK_STATUS_TRANSITIONS[data.current_status].includes(data.customer_status))
      throw Error('invalid_transition');
    if(data.customer_status===data.current_status &&
       !data.internal_note.trim() && !data.public_note.trim() &&
       !data.handoff_reference && !data.internal_status)
      throw Error('empty_update');
    if(data.customer_status==='completed'&&!data.handoff_reference.trim())
      throw Error('missing_handoff');
  }
  return Object.freeze({...data,expected_revision:revision});
}

export function signWorkMerchantCommand({command,shop=SHOP,staffId,
  timestamp,nonce,secret}={}) {
  if(shop!==SHOP||!command||!OP.test(command.operation_id)||
     !/^[1-9][0-9]*$/.test(String(staffId||''))||
     !/^[0-9]{13}$/.test(String(timestamp))||
     !NONCE.test(nonce||'')||typeof secret!=='string'||secret.length<32)
    throw Error('invalid_write_signing');
  const fields=[
    'merchant_command_v1',SHOP,String(timestamp),nonce,command.kind,
    command.operation_id,command.submission_id,String(command.expected_revision),
    command.current_status,command.customer_status,command.internal_status,
    command.public_note,command.internal_note,command.handoff_reference,String(staffId),
  ];
  return createHmac('sha256',secret).update(fields.join('\n'),'utf8').digest('hex');
}
async function readBody(request) {
  if(request.headers.get('content-type')?.split(';')[0]?.toLowerCase()!==
     'application/x-www-form-urlencoded')throw Error('invalid_content_type');
  const declared=request.headers.get('content-length');
  if(declared && (!/^[0-9]{1,5}$/.test(declared)||Number(declared)>4096))
    throw Error('oversized');
  if(!request.body)throw Error('invalid_command');
  let size=0;const chunks=[];
  const reader=request.body.getReader();
  try {
    while(true) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>4096)throw Error('oversized');
      chunks.push(value);
    }
  } finally {await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let n=0;
  for(const part of chunks){bytes.set(part,n);n+=part.byteLength;}
  const fields=new URLSearchParams(new TextDecoder().decode(bytes));
  const data={};
  for(const [key,value] of fields) {
    if(Object.hasOwn(data,key))throw Error('duplicate_field');
    data[key]=value;
  }
  return validateWorkMerchantCommand(data);
}

export async function submitWorkMerchantCommand({command,staffId,secret,
  backendFetch=fetch,now=Date.now,nonceFn=()=>randomBytes(24).toString('base64url'),
}={}) {
  const timestamp=String(now()),nonce=nonceFn();
  const signature=signWorkMerchantCommand({
    command,staffId,timestamp,nonce,secret,
  });
  const payload=new URLSearchParams({
    jill_order_merchant_command:'1',shop:SHOP,
    ...Object.fromEntries(Object.entries(command).map(([k,v])=>[k,String(v)])),
    jill_hq_write_ts:timestamp,jill_hq_write_nonce:nonce,
    jill_hq_write_staff:String(staffId),jill_hq_write_sig:signature,
  });
  const response=await backendFetch(JILL_HQ_WORK_QA_GOOGLE_URL,{
    method:'POST',redirect:'follow',
    headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8',
      accept:'application/json'},
    body:payload,signal:AbortSignal.timeout(15000),
  });
  if(!response?.ok)throw Error('source_unavailable');
  const text=await response.text();
  if(text.length>4096)throw Error('invalid_ack');
  let data;
  try{data=JSON.parse(text);}catch{throw Error('invalid_ack');}
  if(data?.version!==1||data.operation!=='custom_order.merchant.command.result')
    throw Error('invalid_ack');
  if(data.ok!==true) {
    if(data.error?.code==='stale_revision')return {ok:false,code:'stale_revision'};
    if(data.error?.code==='invalid_transition')return {ok:false,code:'invalid_transition'};
    return {ok:false,code:'source_rejected'};
  }
  if(data.submission_id!==command.submission_id ||
     data.operation_id!==command.operation_id ||
     data.customer_status!==command.customer_status ||
     !Number.isSafeInteger(data.revision)||
     data.revision<command.expected_revision+1||
     data.revision>100||
     typeof data.duplicate!=='boolean' ||
     !['not_requested','queued'].includes(data.email_status))
    throw Error('invalid_ack');
  return {ok:true,code:'saved',revision:data.revision,
    duplicate:data.duplicate,email_status:data.email_status};
}

/** @param {{request?: Request,authenticate?: any,db?: any,enabled?: boolean,secret?: string,backendFetch?: typeof fetch,now?: ()=>number,fastIndexEnabled?:boolean}} [options] */
export async function handleWorkMerchantCommand({request,authenticate,db,
  enabled=false,secret,backendFetch=fetch,now=Date.now,
  fastIndexEnabled=false,
}={}) {
  if(request?.method!=='POST')return writeResult(405,'method_not_allowed');
  if(typeof authenticate?.admin!=='function')return writeResult(503,'unavailable');
  // Shopify session verification happens before D1, body parsing or source read.
  const {session}=await authenticate.admin(request);
  const access=await readWorkMerchantPermission({
    db,session,action:'requests.write',
  });
  if(!access.allowed||access.role!=='owner')
    return writeResult(access.code==='authority_unavailable'?503:403,
      'access_denied');
  if(enabled!==true||typeof secret!=='string'||secret.length<32)
    return writeResult(503,'writes_not_connected');
  if(request.headers.get('origin')!==new URL(request.url).origin)
    return writeResult(403,'invalid_origin');
  let command;
  try{command=await readBody(request);}
  catch{return writeResult(400,'invalid_command');}
  try {
    const result=await submitWorkMerchantCommand({
      command,staffId:access.staffId,secret,backendFetch,now,
    });
    if(!result.ok)return writeResult(result.code==='stale_revision'?409:422,result.code);
    invalidateWorkMerchantSourceCache();
    if(fastIndexEnabled===true) {
      try {await invalidateWorkD1InboxIndex(db);}
      catch {
        // Google may already have committed. Do NOT return a false
        // success while an older shared snapshot could still be served.
        // The same operation_id remains safe for idempotent reconciliation.
        return writeResult(503,'commit_unconfirmed');
      }
    }
    return writeResult(200,'saved',{submission_id:command.submission_id,
      operation_id:command.operation_id,revision:result.revision,
      duplicate:result.duplicate,email_status:result.email_status});
  } catch {
    // Unknown outcome: retry with the SAME operation_id to reconcile.
    return writeResult(503,'commit_unconfirmed');
  }
}
