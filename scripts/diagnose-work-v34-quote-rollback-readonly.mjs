// JILL WORK v34 anonymous smoke mismatch — READ-ONLY diagnostics.
// The approved 100-v34/0-v35 rollout was automatically rolled back.
// DO NOT invoke versions deploy/upload here. NEVER attach a real Shopify
// session, customer record ID, quote payload, secret, cookie or OAuth URL.
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {inspectDeploymentState,ACTIVE,ORIGIN}
  from './work-quote-v35-zero-deployment-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const BIN=join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const NAME='jill-order-desk-canary-work';
const stop=x=>{throw Error('work_v34_diagnosis_'+x);};
const ensure=(x,code)=>{if(!x)stop(code);};
function wrangler(args) {
  ensure(existsSync(BIN),'wrangler_not_found');
  const run=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,shell:false,windowsHide:true,encoding:'utf8',
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
    timeout:30000,maxBuffer:1024*1024,
  });
  ensure(!run.error&&!run.signal&&run.status===0,
    'cloudflare_metadata_unavailable');
  return String(run.stdout||'');
}
function current(){
  try{
    return currentWorkerVersion(wrangler([
      'deployments','status','--name',NAME,'--config',CONFIG]));
  }catch{stop('active_version_unknown');}
}
function allocation(){
  try{
    return inspectDeploymentState(JSON.parse(wrangler([
      'deployments','list','--name',NAME,'--config',CONFIG,
      '--json'])),'baseline');
  }catch{stop('baseline_allocation_unknown');}
}
const ALLOWED_CODES=new Set([
  'quote_drafts_not_enabled','invalid_origin','wrong_host',
  'merchant_storage_unavailable','shopify_auth_not_configured',
  'access_denied','not_found','request_not_found',
]);
export function sanitizeAnonymousResponse({status,location,contentType,body}={}){
  ensure(Number.isSafeInteger(status)&&status>=100&&status<=599,
    'http_status_unverified');
  ensure(typeof body==='string'&&body.length<=8192,
    'response_size_unverified');
  const mime=String(contentType||'').split(';',1)[0].toLowerCase().trim();
  const output={status,mime:mime==='application/json'?'json':
    mime==='text/html'?'html':mime==='text/plain'?'plain':
    mime===''?'unspecified':'other',code:'unavailable',
    redirect:'none'};
  if(location!==null&&location!==undefined) {
    let url;
    try{url=new URL(location,ORIGIN);}catch{stop('redirect_unverifiable');}
    ensure(['http:','https:'].includes(url.protocol),
      'redirect_unverifiable');
    // Never print path/query, OAuth state, tokens, session or customer IDs.
    const h=url.hostname;
    output.redirect=h==='jill-work.myshopify.com'?'shopify_work':
      h===new URL(ORIGIN).hostname&&
        url.pathname.startsWith('/auth/')?'work_auth':
      h===new URL(ORIGIN).hostname?'work_other':
      'other_host';
  }
  if(output.mime==='json'){
    let j;
    try{j=JSON.parse(body);}catch{stop('response_json_unverifiable');}
    ensure(j&&typeof j==='object'&&!Array.isArray(j),
      'response_json_unverifiable');
    const value=typeof j.error==='string'?j.error:
      typeof j.code==='string'?j.code:null;
    if(value!==null&&ALLOWED_CODES.has(value))
      output.code=value;
    else if(value!==null)
      output.code='unrecognized'; // Never echo untrusted values.
    else output.code='not_present';
    output.json_keys=Object.keys(j).length;
    output.json_ok=j.ok===false?'false':j.ok===true?'true':'not_boolean';
  }
  return Object.freeze(output);
}
async function readPublic(pathname,request){
  const res=await request(ORIGIN+pathname,{
    method:'GET',redirect:'manual',credentials:'omit',
    headers:{Accept:'application/json','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(12000),
  });
  ensure(res?.status&&typeof res.text==='function',
    'public_response_unverified');
  const body=await res.text();
  return sanitizeAnonymousResponse({
    status:res.status,location:res.headers.get('location'),
    contentType:res.headers.get('content-type'),body,
  });
}
export async function diagnoseReadOnly({request=fetch,
  before=current,deployments=allocation,after=current}={}){
  ensure(typeof request==='function','request_unavailable');
  ensure(before()===ACTIVE,'v34_not_100_percent_active');
  const prior=deployments();
  ensure(prior.state==='baseline'&&prior.active_pct===100,
    'baseline_deployment_unverified');
  const health=await readPublic('/healthz',request);
  const quote=await readPublic('/app/requests/quote-draft',request);
  ensure(after()===ACTIVE,'v34_changed_during_read');
  // Do not infer a "PASS" or accept anonymous access from this report.
  return Object.freeze({active:ACTIVE,
    deployment_id:prior.id,
    health,quote,
    quote_denial_proven:quote.status===503&&
      quote.code==='quote_drafts_not_enabled'&&
      quote.json_ok==='false',
    diagnosis_only:true,
    traffic_changed:false,
    quote_customer_workflow_tested:false,
  });
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    ensure(process.argv.length===2,'unsupported_arguments');
    const report=await diagnoseReadOnly();
    console.log('PASS READ-ONLY WORK v34 deployment: 100% active '+report.active);
    console.log('Anonymous health status: '+report.health.status+
      ' ('+report.health.mime+'), known error: '+report.health.code);
    console.log('Anonymous quote GET status: '+report.quote.status+
      ' ('+report.quote.mime+'), known error: '+report.quote.code+
      ', redirect category: '+report.quote.redirect+
      ', JSON fields: '+(report.quote.json_keys??'N/A')+'.');
    if(report.quote_denial_proven)
      console.log('DIAGNOSIS: legacy 503 quote denial observed; prior smoke mismatch requires further analysis.');
    else
      console.log('DIAGNOSIS: v34 did not present exact v35-style 503 quote-denial contract. No unsafe response accepted, investigate before new rollout.');
    console.log('HOLD: no v35 override possible after rollback. No request/customer payloads, cookies, POST, uploads, migrations, traffic changes or paid services.');
  }catch(err){
    const e=String(err?.message||'');
    console.error('STOP read-only WORK quote diagnosis: '+
      (/^work_v34_diagnosis_[a-z0-9_]+$/.test(e)?e:'work_v34_diagnosis_unverified'));
    console.error('No retry of deployment; keep v34 100% and inspect metadata.');
    process.exitCode=1;
  }
}
