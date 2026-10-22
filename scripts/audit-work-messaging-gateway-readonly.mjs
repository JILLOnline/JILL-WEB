// WORK-only, unsigned messaging boundary audit: no customer IDs, body, send,
// authorization with valid token, gateway writes, or feature flag changes.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {WORK_ACCOUNT_GATEWAY} from './audit-work-custom-order-account-runtime.mjs';
const steps=Object.freeze([
 ['GET','/healthz',200,null],
 ['OPTIONS','/jill-custom-order-reply',204,null],
 ['POST','/jill-custom-order-reply',401,null],
 ['POST','/jill-custom-order-reply',401,'Bearer invalid-work-audit'],
 ['GET','/jill-custom-order-reply',405,null],
]);
const fail=code=>{throw Error('work_message_gateway_'+code);};
const check=(x,code)=>{if(!x)fail(code);};
async function bodyJson(response){
 check((response.headers.get('content-type')||'').includes('application/json'),'not_json');
 const raw=await response.text();
 check(raw.length<2048&&!/(api_secret|customer_gid|customer_email|access_token)/i.test(raw),'unsafe_response');
 try{return JSON.parse(raw);}catch{fail('invalid_json');}
}
export async function auditWorkMessagingGateway({request=fetch,timeoutMs=15000}={}){
 check(typeof request==='function','invalid_request');
 check(Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=60000,'invalid_timeout');
 const results=[];
 for(const [method,path,status,authorization] of steps){
  const response=await request(WORK_ACCOUNT_GATEWAY+path,{
   method,redirect:'error',signal:AbortSignal.timeout(timeoutMs),
   headers:authorization?{Authorization:authorization}:{},
  });
  check(response?.status===status,'wrong_status');
  check((response.headers.get('cache-control')||'').includes('no-store'),'cache_unsafe');
  check((response.headers.get('x-content-type-options')||'')==='nosniff','mime_unsafe');
  if(method==='OPTIONS'){
   check(response.headers.get('access-control-allow-origin')==='*','cors_origin');
   check((response.headers.get('access-control-allow-headers')||'').toLowerCase().includes('authorization'),'cors_auth');
  }else{
   const data=await bodyJson(response);
   if(path==='/healthz')check(data?.ok===true&&data.environment==='WORK_CUSTOM_ORDERS_QA','wrong_environment');
   else check(data?.ok===false&&data?.version===1&&data?.operation==='custom_order.account.reply.result'&&
    data?.error?.code===(method==='GET'?'method_not_allowed':'unauthenticated_account'),
    'reply_not_denied');
  }
  results.push(Object.freeze({path,method,http_status:status,passed:true}));
 }
 return Object.freeze({
  status:'WORK_MESSAGING_PUBLIC_GATE_VERIFIED',checks:results,
  customer_authenticated:false,google_qa_published_verified:false,
  message_sent:false,merchant_thread_verified:false,activation_authorized:false,
 });
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==2){console.error('STOP read-only audit takes no arguments');process.exitCode=1;}
 else{
  try{console.log(JSON.stringify(await auditWorkMessagingGateway(),null,2));}
  catch(e){console.error('HOLD '+(e?.message?.startsWith('work_message_gateway_')?e.message:'work_message_gateway_unavailable'));process.exitCode=1;}
 }
}
