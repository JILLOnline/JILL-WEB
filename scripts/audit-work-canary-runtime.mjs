import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Uncredentialed, GET-only canary certification. Never tests OAuth,
// sends Authorization, or touches owner/Shopify sessions.
export const WORK_CANARY_HOST =
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const checks=Object.freeze([
  {path:'/healthz',status:200,label:'Canary D1 schema health'},
  {path:'/',status:503,label:'Canary home locked before secrets'},
  {path:'/app',status:503,label:'Canary Shopify Admin locked before secrets'},
  {path:'/auth/login',status:503,label:'Canary Shopify login locked before secrets'},
  {path:'/app/setup-owner',status:503,label:'Canary Owner commissioning locked'},
]);
function assert(condition,message){if(!condition)throw new Error(message);}

export async function auditWorkCanary({request=fetch,timeoutMs=15000}={}) {
  assert(typeof request==='function','Invalid read-only request adapter');
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs>0 && timeoutMs<=60000,
    'Invalid timeout');
  const results=[];
  for(const item of checks) {
    const response=await request(WORK_CANARY_HOST+item.path,{
      method:'GET',redirect:'error',signal:AbortSignal.timeout(timeoutMs),
    });
    assert(response.status===item.status,
      item.label+': expected '+item.status+', received '+response.status);
    assert((response.headers.get('content-type')||'').includes('application/json'),
      item.label+': expected JSON');
    assert((response.headers.get('cache-control')||'').includes('no-store'),
      item.label+': no-store missing');
    const raw=await response.text();
    assert(raw.length<=1024,item.label+': unexpected response size');
    assert(!/(access_token|api_secret|owner_staff_id|database_id|session_key)/i.test(raw),
      item.label+': possible privileged data exposure');
    let body;
    try{body=JSON.parse(raw);}catch{throw new Error(item.label+': invalid JSON');}
    if(item.path==='/healthz'){
      assert(body?.ok===true &&
        body.environment==='JILL_ORDER_DESK_WORK' &&
        body.database_ready===true && body.admin_ready===false,
        item.label+': D1 not ready or Admin enabled unexpectedly');
    }else{
      assert(body?.ok===false &&
        body.error==='shopify_auth_not_configured',
        item.label+': access gate changed unexpectedly');
    }
    results.push(Object.freeze({label:item.label,status:response.status,ok:true}));
  }
  return results;
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  try{
    for(const check of await auditWorkCanary())
      console.log('PASS '+check.status+' '+check.label);
    console.log('WORK canary D1 reachable and no unauthenticated Shopify/Owner routes enabled. This does NOT certify Shopify OAuth.');
  }catch(error){
    console.error('WORK canary runtime audit failed: '+error.message);
    process.exitCode=1;
  }
}
