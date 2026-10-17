// JILL WORK PHASE 17 — read-only Cloudflare R2 account usage audit.
// No deployment, R2 object I/O, D1 writes, bucket mutations or tokens on disk.
// The exact Cloudflare account, API endpoints and GraphQL query are pinned.
// This is usage ANALYTICS, never an authoritative hard billing/spending cap.
// Run only on the clean, synchronized jill/rewards-work branch.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WRANGLER=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const ACCOUNT='1cae999d55b9df68a81ad876fb040e60';
const WORK_DB='3f17c186-c794-4e00-8f20-017191373a19';
const REST='https://api.cloudflare.com/client/v4/accounts/'+ACCOUNT+'/r2/metrics';
const GRAPHQL='https://api.cloudflare.com/client/v4/graphql';
const deny=(code)=>{throw Error(code||'work_r2_usage_unverified');};
const object=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
export const WORK_R2_USAGE_ACCOUNT_ID=ACCOUNT;
// This query intentionally omits bucketName, yielding an ACCOUNT scope.
// Adaptive analytics may be sampled, delayed, or truncated; do not use as
// the binding's hard per-transaction spending/billing authorization.
export const WORK_R2_OPERATIONS_QUERY=`query JillWorkReadOnlyR2Operations(
  $accountTag: string!, $startDate: Time!, $endDate: Time!
) {
  viewer {
    accounts(filter: {accountTag: $accountTag}) {
      r2OperationsAdaptiveGroups(
        limit: 10000,
        filter: {datetime_geq: $startDate, datetime_leq: $endDate}
      ) {
        dimensions {actionType}
        sum {requests}
      }
    }
  }
}`;
const validPair=v=>object(v)&&nonnegative(v.objects)&&
  nonnegative(v.payloadSize)&&nonnegative(v.metadataSize);
export function summarizeWorkR2AccountUsage({
  storageResponse,operationsResponse,nowMs,
}={}){
  if(!Number.isSafeInteger(nowMs)||nowMs<=0)deny('work_r2_usage_clock_invalid');
  const month=new Date(nowMs).toISOString().slice(0,7);
  const root=storageResponse?.result;
  if(storageResponse?.success!==true||!object(root)||
     !object(root.standard))deny('work_r2_storage_metrics_incomplete');
  let standardBytes=0,standardObjects=0,otherClassBytes=0,otherClassObjects=0;
  for(const [klass,required] of [['standard',true],['infrequentAccess',false]]){
    const cls=root[klass];
    if(!object(cls)){
      if(required)deny('work_r2_storage_metrics_incomplete');
      continue;
    }
    for(const state of ['published','uploaded']){
      const row=cls[state];
      if(row===undefined||row===null)continue;
      if(!validPair(row))deny('work_r2_storage_metrics_incomplete');
      const size=row.payloadSize+row.metadataSize;
      if(!Number.isSafeInteger(size))deny('work_r2_storage_metrics_invalid');
      if(klass==='standard'){
        standardBytes+=size;standardObjects+=row.objects;
      }else{otherClassBytes+=size;otherClassObjects+=row.objects;}
    }
  }
  if(![standardBytes,standardObjects,otherClassBytes,otherClassObjects]
    .every(nonnegative))deny('work_r2_storage_metrics_invalid');

  if(!object(operationsResponse)||
     (Array.isArray(operationsResponse.errors)&&operationsResponse.errors.length)||
     !object(operationsResponse.data?.viewer)||
     !Array.isArray(operationsResponse.data.viewer.accounts)||
     operationsResponse.data.viewer.accounts.length!==1)
    deny('work_r2_operations_analytics_unavailable');
  const account=operationsResponse.data.viewer.accounts[0];
  const groups=account?.r2OperationsAdaptiveGroups;
  if(!Array.isArray(groups)||groups.length>=10000)
    deny('work_r2_operations_analytics_incomplete');
  let observedRequests=0;
  const actions=new Map();
  for(const g of groups){
    const label=g?.dimensions?.actionType;
    const n=g?.sum?.requests;
    if(typeof label!=='string'||label.length<1||label.length>100||
       !/^[a-zA-Z0-9_.:-]+$/.test(label)||!nonnegative(n))
      deny('work_r2_operations_analytics_invalid');
    observedRequests+=n;
    actions.set(label,(actions.get(label)||0)+n);
  }
  if(!nonnegative(observedRequests))
    deny('work_r2_operations_analytics_invalid');
  return Object.freeze({
    state:'read_only_analytics_observed',
    month_utc:month,
    standard_storage_bytes_observed:standardBytes,
    standard_objects_observed:standardObjects,
    other_storage_class_bytes_observed:otherClassBytes,
    other_storage_class_objects_observed:otherClassObjects,
    requests_observed:observedRequests,
    action_counts:Object.freeze([...actions.entries()]
      .sort((a,b)=>a[0].localeCompare(b[0]))
      .map(([action,requests])=>Object.freeze({action,requests}))),
    account_scope_requested:true,
    complete_billing_evidence:false,
    safe_spend_guaranteed:false,
    can_authorize_r2_upload:false,
    account_metrics_may_be_delayed_or_sampled:true,
  });
}
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:10000}).trim();}
  catch{deny('work_r2_usage_git_unverified');}
}
function checkSource(){
  if(git('branch','--show-current')!=='jill/rewards-work'||
     git('rev-parse','HEAD')!==git('rev-parse',
       'refs/remotes/origin/jill/rewards-work')||
     git('status','--porcelain','--untracked-files=no'))
    deny('work_r2_usage_git_unverified');
  for(const filename of ['wrangler.jsonc','wrangler.canary.jsonc']){
    const conf=JSON.parse(fs.readFileSync(path.join(APP,filename),'utf8'));
    if(conf.d1_databases?.length!==1||
       conf.d1_databases[0].database_id!==WORK_DB||
       Object.hasOwn(conf,'r2_buckets'))deny('work_r2_usage_work_scope_drift');
  }
  const active=fs.readdirSync(path.join(ROOT,
    'services/jill-order-desk/migrations')).sort();
  if(JSON.stringify(active)!==JSON.stringify([
    '0001_staff_authority.sql',
    '0002_shopify_sessions.sql',
    '0003_work_verified_inbox_index.sql',
  ]))deny('work_r2_usage_migrations_changed');
}
// Only receive a credential from the existing trusted LOCAL Wrangler CLI.
// It stays in this process memory; stdout/stderr of auth never forwarded,
// including on failure. Do not log token, HTTP auth headers or API bodies.
function localWranglerBearer(){
  if(!fs.existsSync(WRANGLER))deny('work_r2_usage_wrangler_missing');
  const p=spawnSync(process.execPath,[WRANGLER,'auth','token','--json'],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    timeout:30000,maxBuffer:64*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  if(p.error||p.status!==0)deny('work_r2_usage_wrangler_auth_unavailable');
  let auth;
  try{auth=JSON.parse(p.stdout);}catch{
    deny('work_r2_usage_wrangler_auth_unreadable');
  }
  if(!['oauth','api_token'].includes(auth?.type)||
     typeof auth.token!=='string'||auth.token.length<15||
     /\s/.test(auth.token))deny('work_r2_usage_bearer_unavailable');
  return auth.token;
}
async function readApi(endpoint,init){
  if(![REST,GRAPHQL].includes(endpoint))deny('work_r2_usage_endpoint_forbidden');
  let response;
  try{
    response=await fetch(endpoint,{...init,redirect:'error',
      signal:AbortSignal.timeout(25000)});
  }catch{deny('work_r2_usage_cloudflare_unreachable');}
  if(!response.ok)deny(endpoint===GRAPHQL?
    'work_r2_usage_graphql_http_denied':'work_r2_usage_storage_http_denied');
  const len=Number(response.headers.get('content-length'));
  if(Number.isFinite(len)&&len>1024*1024)
    deny('work_r2_usage_response_too_large');
  let parsed;
  try{
    const raw=await response.text();
    if(raw.length>1024*1024)deny('work_r2_usage_response_too_large');
    parsed=JSON.parse(raw);
  }catch{deny('work_r2_usage_api_invalid_json');}
  return parsed;
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='arguments';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      deny('work_r2_usage_read_only_mode_required');
    phase='source_and_environment';
    checkSource();
    phase='local_wrangler_auth';
    const token=localWranglerBearer();
    const headers={Authorization:'Bearer '+token};
    phase='account_storage_metrics';
    const storageResponse=await readApi(REST,{method:'GET',headers});
    phase='account_operations_analytics';
    const nowMs=Date.now();
    const start=new Date(nowMs);
    start.setUTCDate(1);start.setUTCHours(0,0,0,0);
    const operationsResponse=await readApi(GRAPHQL,{
      method:'POST',headers:{...headers,'Content-Type':'application/json'},
      body:JSON.stringify({
        query:WORK_R2_OPERATIONS_QUERY,
        variables:{
          accountTag:ACCOUNT,
          startDate:start.toISOString(),
          endDate:new Date(nowMs).toISOString(),
        },
      }),
    });
    phase='metrics_validation';
    const snapshot=summarizeWorkR2AccountUsage({
      storageResponse,operationsResponse,nowMs,
    });
    console.log('PASS Cloudflare R2 read-only account analytics fetched (NOT billing certification).');
    console.log('Observed UTC month: '+snapshot.month_utc);
    console.log('Observed Standard storage bytes: '+snapshot.standard_storage_bytes_observed);
    console.log('Observed Standard objects: '+snapshot.standard_objects_observed);
    console.log('Observed other-class bytes: '+snapshot.other_storage_class_bytes_observed);
    console.log('Observed R2 requests in current UTC month: '+snapshot.requests_observed);
    console.log('Observed operation types: '+snapshot.action_counts.length);
    for(const row of snapshot.action_counts.slice(0,15)){
      console.log('  '+row.action+': '+row.requests);
    }
    if(snapshot.action_counts.length>15)
      console.log('  Additional operation types: '+(snapshot.action_counts.length-15));
    console.log('HOLD: Analytics may be delayed/sampled and are not an authoritative account billing cap.');
    console.log('READ ONLY: No secrets printed, deployments, D1/R2 object writes, uploads or previews.');
  }catch(error){
    // Only stable, hardcoded diagnostic identifiers may be emitted.
    const code=String(error?.message||'work_r2_usage_unverified');
    const safeCode=/^work_r2_[a-z0-9_]+$/.test(code)?
      code:'work_r2_usage_unverified';
    console.error('STOP WORK R2 ACCOUNT ANALYTICS: '+safeCode);
    console.error('READ ONLY PHASE: '+phase);
    process.exitCode=1;
  }
}
