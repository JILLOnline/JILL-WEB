import {createHmac,randomUUID} from 'node:crypto';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL} from './work-google-merchant-read.mjs';
import {readBackendResult} from '../../backend/custom-order-gateway.mjs';
import {onlyPublicCustomOrderProjection} from '../../backend/custom-order-account-read.mjs';

export async function readWorkRequestThread({submissionId,secret,
  backendFetch=fetch,now=Date.now}={}){
  if(!/^[A-Za-z0-9._:-]{8,128}$/.test(submissionId||'')||
    typeof secret!=='string'||secret.length<32)throw Error('thread_unavailable');
  const ts=String(now()),nonce=randomUUID();
  const sig=createHmac('sha256',secret).update([
    'merchant_thread_v1','jill-work.myshopify.com',submissionId,ts,nonce,
  ].join('\n'),'utf8').digest('hex');
  const body=new URLSearchParams({jill_order_merchant_thread:'1',
    shop:'jill-work.myshopify.com',submission_id:submissionId,
    jill_hq_read_ts:ts,jill_hq_read_nonce:nonce,jill_hq_read_sig:sig});
  const result=await readBackendResult(backendFetch,JILL_HQ_WORK_QA_GOOGLE_URL,body,131072);
  if(result?.version!==1||result.operation!=='custom_order.merchant.thread.result'||
    result.ok!==true||result.thread?.submission_id!==submissionId||
    result.thread.timeline_version!==2)throw Error('thread_unavailable');
  return onlyPublicCustomOrderProjection([result.thread])[0];
}
/** @param {{request?:Request,authenticate?:any,db?:any,enabled?:boolean,secret?:string,backendFetch?:typeof fetch}} [options] */
export async function handleWorkRequestThread({request,authenticate,db,
  enabled=false,secret,backendFetch=fetch}={}){
  const response=(status,data)=>Response.json(data,{status,
    headers:{'cache-control':'private, no-store, max-age=0','x-content-type-options':'nosniff'}});
  if(request?.method!=='GET')return response(405,{ok:false,code:'method_not_allowed'});
  const {session}=await authenticate.admin(request);
  const access=await readWorkMerchantPermission({db,session,action:'requests.read'});
  if(!access.allowed||access.role!=='owner')return response(403,{ok:false,code:'access_denied'});
  if(!enabled)return response(503,{ok:false,code:'thread_not_connected'});
  const url=new URL(request.url);
  if(url.searchParams.size!==1||!url.searchParams.has('submission_id'))
    return response(400,{ok:false,code:'invalid_request'});
  try{return response(200,{ok:true,thread:await readWorkRequestThread({
    submissionId:url.searchParams.get('submission_id'),secret,backendFetch})});}
  catch{return response(503,{ok:false,code:'thread_unavailable'});}
}
