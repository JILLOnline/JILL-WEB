// WORK v35 preview/host-pin smoke — PUBLIC ANONYMOUS GET ONLY.
// No cookies, no auth header, no owner or customer IDs, no POST.
// Never uses Cloudflare account credentials, changes traffic or writes D1.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const V35='dbc6341f-de7f-41de-8e97-6bf971201eeb';
export const V34='4973b74d-d479-41da-897c-e36129303279';
export const CANONICAL=
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
export const VERSION_URL=
  'https://dbc6341f-jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const fail=code=>{throw Error('quote_v35_preview_'+code);};
const assert=(v,c)=>{if(!v)fail(c);};
async function getJson({url,request,expectedCode,expectedStatus}){
  const result=await request(url,{
    method:'GET',credentials:'omit',redirect:'manual',
    headers:{accept:'application/json'},
    signal:AbortSignal.timeout(20000),
  });
  assert(result?.status===expectedStatus,'unexpected_http_status');
  assert((result.headers?.get('content-type')||'')
    .includes('application/json'),'json_content_type_missing');
  assert((result.headers?.get('cache-control')||'')
    .includes('no-store'),'no_store_missing');
  const txt=await result.text();
  assert(txt.length<=1024,'unexpected_body_size');
  let json;
  try{json=JSON.parse(txt);}catch{fail('invalid_json');}
  assert(json?.ok===false&&json.error===expectedCode&&
    Object.keys(json).length===2,'unexpected_anonymous_response');
  return true;
}
export async function inspectQuoteV35Preview({request=fetch}={}){
  assert(typeof request==='function','request_invalid');
  const origin=new URL(VERSION_URL);
  const live=new URL(CANONICAL);
  assert(origin.protocol==='https:'&&
    origin.hostname===V35.slice(0,8)+'-'+live.hostname,
    'preview_domain_unverified');
  assert(live.hostname==='jill-order-desk-canary-work.jill-work-custom-orders.workers.dev',
    'work_hostname_unverified');
  // Cloudflare Version URLs have a distinct hostname. The v35 source
  // rejects a noncanonical Host with HTTP 421 BEFORE OAuth/D1 calls.
  // This check does not prove that quote features can operate on v35.
  await getJson({url:VERSION_URL+'/healthz',request,
    expectedStatus:421,expectedCode:'wrong_host'});
  // Active 100% v34 blocks quote draft access before Owner/customer data.
  await getJson({url:CANONICAL+'/app/requests/quote-draft',
    request,expectedStatus:503,expectedCode:'quote_drafts_not_enabled'});
  return Object.freeze({
    preview_hostname_enforced:true,
    active_v34_quote_route_locked:true,
    v35_authenticated_flow_tested:false,
    candidate_byte_parity_proven:false,
    deployment_permission_granted:false,
    traffic_changed:false,
  });
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    if(process.argv.length!==2)fail('unexpected_mode');
    const result=await inspectQuoteV35Preview();
    assert(result.preview_hostname_enforced&&
      result.active_v34_quote_route_locked,'readback_incomplete');
    console.log('PASS v35 Version URL refuses noncanonical hostname (421) before auth or D1.');
    console.log('PASS WORK canonical v34 quote endpoint still locked (503).');
    console.log('HOLD: Version URL cannot test quote Save/Reload due to exact WORK hostname pin. A 0% deployment + version override needs separate authorization.');
    console.log('READ ONLY: anonymous GET only; no customer data, upload, version deploy, D1 write, R2, LIVE/KEEP or billing change.');
  }catch{
    console.error('STOP v35 preview GET not verified. Version URLs may be disabled; do not enable URLs, change worker host or alter traffic without approval.');
    process.exitCode=1;
  }
}
