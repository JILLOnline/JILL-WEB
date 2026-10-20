// JILL HQ Phase 28: UNAUTHENTICATED READ-ONLY live WORK canary
// reachability & session-isolation smoke check. This probes only four
// fixed GET paths. It never authenticates, submits, downloads images,
// accesses customer records, changes Cloudflare or follows redirects.
// It verifies neither a signed-in Owner session nor deployed code SHA.
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';

export const WORK_HQ_CANARY_ORIGIN=
  'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const PATHS=Object.freeze([
  '/healthz','/auth/login','/app/requests','/app/setup-owner',
]);
const HEADERS=Object.freeze({
  'accept':'application/json,text/html;q=0.2',
});
const error=code=>{throw Error('work_hq_live_boundary_'+code);};
const hasNoStore=r=>String(r.headers.get('cache-control')||'')
  .toLowerCase().includes('no-store');
function safeRedirect(location){
  if(!location||location.length>2048)return false;
  let url;
  try{url=new URL(location,WORK_HQ_CANARY_ORIGIN);}
  catch{return false;}
  const path=url.pathname;
  return (
    url.origin===WORK_HQ_CANARY_ORIGIN &&
    (path==='/auth/login'||path.startsWith('/auth/'))
  )||(
    url.origin==='https://admin.shopify.com' &&
    (path==='/store/jill-work'||path.startsWith('/store/jill-work/'))
  );
}
async function safeJson(r){
  const len=r.headers.get('content-length');
  if(len!==null&&(!/^\d+$/.test(len)||Number(len)>1024))
    error('unexpected_response_size');
  const body=await r.text();
  if(body.length>1024)error('unexpected_response_size');
  try{return JSON.parse(body);}
  catch{error('invalid_json');}
}
export async function inspectWorkHqLiveAnonymous({
  request=fetch,timeoutMs=15000,
}={}){
  if(typeof request!=='function'||!Number.isSafeInteger(timeoutMs)||
     timeoutMs<1000||timeoutMs>30000)error('invalid_config');
  const records=[];
  for(const path of PATHS){
    let response;
    try{
      response=await request(WORK_HQ_CANARY_ORIGIN+path,{
        method:'GET',redirect:'manual',headers:HEADERS,
        signal:AbortSignal.timeout(timeoutMs),
      });
    }catch{error('request_unavailable');}
    if(!(response instanceof Response)||
       !Number.isSafeInteger(response.status))error('invalid_response');
    const status=response.status;
    if(path==='/healthz'){
      if(status!==200 || !hasNoStore(response)||
         !String(response.headers.get('content-type')||'')
           .includes('application/json'))error('d1_schema_unverified');
      const body=await safeJson(response);
      if(body?.ok!==true||
         body?.environment!=='JILL_ORDER_DESK_WORK'||
         body?.database_ready!==true||
         body?.admin_ready!==false)error('d1_schema_unverified');
      records.push(Object.freeze({path,status,reason:'work_d1_healthy'}));
      continue;
    }
    if(status===503){
      if(!hasNoStore(response))error('unsafe_cache');
      const payload=await safeJson(response);
      if(payload?.ok!==false||
         payload.error!=='shopify_auth_not_configured')
        error('unexpected_service_unavailable');
      records.push(Object.freeze({path,status,reason:'oauth_locked'}));
      continue;
    }
    if(path==='/auth/login'){
      // Anonymous login is safe to offer as an HTML page; do NOT read
      // the page contents or claim Owner sign-in.
      if(status!==200)error('login_unavailable');
      records.push(Object.freeze({path,status,reason:'login_reachable'}));
      continue;
    }
    if(status===200||status===201||status===204)
      error('anonymous_merchant_or_owner_exposed');
    if([302,303,307,308].includes(status)){
      if(!safeRedirect(response.headers.get('location')))
        error('unexpected_redirect_target');
    }else if(![401,403,410].includes(status)){
      error('unknown_merchant_boundary');
    }
    records.push(Object.freeze({path,status,
      reason:'anonymous_merchant_denied'}));
  }
  const login=records.find(x=>x.path==='/auth/login');
  const requests=records.find(x=>x.path==='/app/requests');
  const owner=records.find(x=>x.path==='/app/setup-owner');
  if(login.reason==='oauth_locked' &&
     (requests.reason!=='oauth_locked'||owner.reason!=='oauth_locked'))
    error('oauth_lock_inconsistent');
  if(login.reason==='login_reachable' &&
     (requests.reason!=='anonymous_merchant_denied'||
       owner.reason!=='anonymous_merchant_denied'))
    error('oauth_isolation_inconsistent');
  return Object.freeze({
    state:login.reason==='login_reachable'?
      'oauth_login_public_and_private_routes_denied':
      'oauth_locked',
    records:Object.freeze(records),
    work_d1_healthy:true,
    signed_in_owner_verified:false,
    deployed_version_verified:false,
    google_qa_deployment_verified:false,
    hq_real_end_to_end_certified:false,
    app_public_data_exposed:false,
    remote_deploy_authorized:false,
    real_customers_accessed:false,
    mutations_performed:false,
    paid_upgrade_authorized:false,
  });
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      error('invalid_cli');
    const root=fileURLToPath(new URL('../',import.meta.url));
    const git=(...args)=>execFileSync('git',['-C',root,...args],{
      encoding:'utf8',timeout:15000,windowsHide:true,
    }).trim();
    if(git('branch','--show-current')!=='jill/rewards-work'||
       git('rev-parse','HEAD')!==
         git('rev-parse','refs/remotes/origin/jill/rewards-work')||
       git('status','--porcelain','--untracked-files=no'))
      error('source_not_synced');
    const result=await inspectWorkHqLiveAnonymous();
    for(const entry of result.records){
      console.log('PASS WORK CANARY GET '+entry.path+' HTTP '+entry.status+
        ' | '+entry.reason);
    }
    console.log('WORK anonymous state: '+result.state);
    console.log('HOLD: Real signed-in Owner, Google QA, merchant data and deployed version NOT checked.');
    console.log('READ ONLY: Four GETs, no redirects followed, no credentials, PII, deployments, D1/R2 writes or spending.');
  }catch(e){
    const message=String(e?.message||'work_hq_live_boundary_unknown');
    const safe=/^work_hq_live_boundary_[a-z0-9_]+$/.test(message)?
      message:'work_hq_live_boundary_unverified';
    console.error('STOP WORK HQ LIVE ANONYMOUS AUDIT: '+safe);
    process.exitCode=1;
  }
}
