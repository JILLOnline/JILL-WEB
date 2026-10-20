import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

// Exact WORK URL from Wrangler deployment output. Read-only and uncredentialed.
export const WORK_MERCHANT_HOST =
  'https://jill-order-desk-work.jill-work-custom-orders.workers.dev';

const checks=Object.freeze([
  {label:'Merchant D1 schema health',method:'GET',path:'/healthz',status:200},
  {label:'Anonymous merchant home denied',method:'GET',path:'/',status:503},
  {label:'Anonymous admin page denied',method:'GET',path:'/admin',status:503},
  {label:'Anonymous merchant API denied',method:'GET',path:'/api/merchant',status:503},
]);

function assert(ok,message) {if(!ok)throw new Error(message);}

export async function auditWorkMerchantRuntime({request=fetch,timeoutMs=15000}={}) {
  assert(typeof request==='function','Invalid request adapter');
  assert(Number.isSafeInteger(timeoutMs) && timeoutMs>0 && timeoutMs<=60000,
    'Invalid audit timeout');
  const results=[];
  for(const check of checks) {
    const res=await request(WORK_MERCHANT_HOST+check.path,{
      method:check.method,redirect:'error',
      signal:AbortSignal.timeout(timeoutMs),
    });
    assert(res.status===check.status,
      check.label+': expected HTTP '+check.status+', got '+res.status);
    assert((res.headers.get('content-type')||'').includes('application/json'),
      check.label+': expected application/json');
    assert((res.headers.get('cache-control')||'').includes('no-store'),
      check.label+': no-store missing');
    const raw=await res.text();
    assert(raw.length<1024,check.label+': oversized response');
    let payload;
    try {payload=JSON.parse(raw);}catch{
      throw new Error(check.label+': invalid JSON');
    }
    assert(payload && typeof payload==='object' && !Array.isArray(payload),
      check.label+': invalid JSON envelope');
    assert(!/(access_token|owner_staff_id|shopify_api_secret|database_id)/i.test(raw),
      check.label+': restricted data in public response');
    if(check.path==='/healthz') {
      assert(payload.ok===true &&
        payload.environment==='JILL_ORDER_DESK_WORK' &&
        payload.database_ready===true && payload.admin_ready===false,
      check.label+': schema not ready or Admin incorrectly enabled');
    } else {
      assert(payload.ok===false &&
        payload.error==='merchant_host_not_configured' &&
        payload.admin_ready===undefined,
      check.label+': merchant boundary not fail-closed');
    }
    results.push(Object.freeze({
      label:check.label,status:res.status,passed:true,
    }));
  }
  return results;
}

if(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  try {
    for(const result of await auditWorkMerchantRuntime()) {
      console.log('PASS '+result.status+' '+result.label);
    }
    console.log('WORK D1 is reachable; merchant access stays disabled. Shopify Owner and hosted App Home are NOT certified.');
  } catch(error) {
    console.error('WORK merchant remote audit failed: '+error.message);
    process.exitCode=1;
  }
}
