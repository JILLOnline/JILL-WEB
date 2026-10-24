// WORK-only read-only preview security verification. Reads exact Cloudflare
// script subdomain settings via GET after re-checking pinned active versions.
// Sensitive Wrangler token stays in RAM; never printed or written to disk.
// Zero uploads/deployments/subdomain writes, no dashboard mutations.
import {spawnSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectContactPairedBaseline,readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HQ=join(ROOT,'services/jill-order-desk/app-home');
const GW=join(ROOT,'services/custom-order-cloudflare');
const WRANGLER=join(HQ,'node_modules/wrangler/bin/wrangler.js');
const SCRIPTS=Object.freeze({
 hq:'jill-order-desk-canary-work',
 gateway:'jill-work-custom-orders-qa',
});
const stop=reason=>{throw Error('work_preview_guard_'+reason);};
const check=(ok,reason)=>{if(!ok)stop(reason);};

export function evaluateWorkPreviewSettings({
 baseline,subdomains,
}={}){
 check(baseline?.environment==='WORK'&&baseline?.status==='HOLD'&&
  baseline?.active_versions_verified===true&&
  baseline?.hq_active_version==='44ad4a81-55ad-4f49-9965-61260cc2294d'&&
  baseline?.gateway_active_version==='9322193f-5e87-4479-88c9-39229dddb5f2'&&
  baseline?.hq_reconciliation?.candidate_plaintext_parity_after_reconcile===true&&
  baseline?.gateway?.gateway_secret_name_contract_matches_active===true,
  'active_baseline_not_pinned');
 check(subdomains&&typeof subdomains==='object'&&
  Object.keys(subdomains).length===2&&
  Object.keys(SCRIPTS).every(k=>Object.hasOwn(subdomains,k)),
  'missing_exact_preview_settings');
 const observed={};
 for(const which of Object.keys(SCRIPTS)){
  const item=subdomains[which];
  check(item&&typeof item==='object'&&!Array.isArray(item)&&
   typeof item.enabled==='boolean'&&
   typeof item.previews_enabled==='boolean',
   'preview_setting_unknown_'+which);
  observed[which]={
   worker:SCRIPTS[which],
   workers_dev_enabled:item.enabled,
   version_urls_enabled:item.previews_enabled,
   preview_url_exposure:item.previews_enabled?'POTENTIALLY_PUBLIC':'DISABLED',
  };
 }
 const publicPreview=Object.values(observed).some(x=>x.version_urls_enabled);
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  active_worker_versions_verified:true,
  ...observed,
  any_version_urls_enabled:publicPreview,
  safe_for_unprotected_inactive_upload:!publicPreview,
  // A 'safe' flag here only concerns PUBLIC VERSION URL exposure. It
  // does NOT establish secrets, source provenance, costs, or approval.
  upload_authorized:false,traffic_changed:false,
  version_uploaded:false,subdomain_settings_changed:false,
  secret_values_read:false,customer_data_read:false,
 });
}
function wranglerJson(...args){
 check(existsSync(WRANGLER),'missing_wrangler');
 const result=spawnSync(process.execPath,[WRANGLER,...args],{
  cwd:HQ,encoding:'utf8',windowsHide:true,shell:false,
  timeout:45000,maxBuffer:524288,
  stdio:['ignore','pipe','pipe'],
  env:{...process.env,WRANGLER_SEND_METRICS:'false'},
 });
 // Deliberately NEVER attach raw stdout/stderr to an error. 'auth token'
 // contains secret material. No telemetry or export files.
 check(!result.error&&!result.signal&&result.status===0,
  'authenticated_wrangler_query_failed');
 try{return JSON.parse(result.stdout);}
 catch{stop('wrangler_response_not_json');}
}
export function resolveExactWorkAccount(whoami,environmentAccountId){
 const ids=whoami?.accounts?.map(x=>x?.id);
 check(Array.isArray(ids)&&ids.length>0&&ids.length<=25&&
  ids.every(x=>typeof x==='string'&&/^[0-9a-f]{32}$/.test(x))&&
  new Set(ids).size===ids.length,'cloudflare_accounts_not_verified');
 if(environmentAccountId){
  check(/^[0-9a-f]{32}$/.test(environmentAccountId)&&
   ids.includes(environmentAccountId),
   'selected_account_not_in_authenticated_memberships');
  return environmentAccountId;
 }
 check(ids.length===1,'multiple_accounts_select_explicit_id');
 return ids[0];
}
function tokenFromWrangler(){
 const auth=wranglerJson('auth','token','--json');
 check(['oauth','api_token'].includes(auth?.type)&&
  typeof auth.token==='string'&&auth.token.length>=20&&
  auth.token.length<=8192,'unsupported_authentication');
 return auth.token;
}
export async function readExactCloudflarePreviewSettings({
 accountId,token,fetchImpl=fetch,
}={}){
 check(typeof accountId==='string'&&/^[0-9a-f]{32}$/.test(accountId)&&
  typeof token==='string'&&token.length>=20&&token.length<=8192&&
  typeof fetchImpl==='function','missing_explicit_account_or_token');
 const results={};
 for(const which of Object.keys(SCRIPTS)){
  const scriptName=SCRIPTS[which];
  const url='https://api.cloudflare.com/client/v4/accounts/'+accountId+
   '/workers/scripts/'+scriptName+'/subdomain';
  let response;
  try{
   response=await fetchImpl(url,{
    method:'GET',
    headers:{Authorization:'Bearer '+token,Accept:'application/json'},
    redirect:'error',
    signal:AbortSignal.timeout(20000),
   });
  }catch{stop('read_only_cloudflare_get_unavailable');}
  check(response?.ok===true&&response.status===200,
   'cloudflare_subdomain_read_denied');
  let payload;
  try{
   const raw=await response.text();
   check(raw.length>0&&raw.length<32768,'cloudflare_json_too_large');
   payload=JSON.parse(raw);
  }catch{stop('cloudflare_subdomain_json_invalid');}
  check(payload?.success===true&&
   typeof payload.result?.enabled==='boolean'&&
   typeof payload.result?.previews_enabled==='boolean'&&
   !Object.keys(payload.result).some(k=>k==='token'||k==='secret'),
   'cloudflare_subdomain_result_unverified');
  // Return ONLY the two documented booleans, discard all other response
  // fields even if the account API someday adds identifying metadata.
  results[which]={
   enabled:payload.result.enabled,
   previews_enabled:payload.result.previews_enabled,
  };
 }
 return results;
}
export async function inspectWorkPreviewProtection({
 compiledHq,gatewayCandidate,readMetadata,readSubdomains,
}={}){
 check(typeof readMetadata==='function'&&typeof readSubdomains==='function',
  'read_only_sources_missing');
 const baseline=await inspectContactPairedBaseline({
  compiledHq,gatewayCandidate,readMetadata,
 });
 const subdomains=await readSubdomains();
 const evaluated=evaluateWorkPreviewSettings({baseline,subdomains});
 // Final deployments read, too: the subdomain GETs might be slow.
 // A changed traffic allocation during our inspection is never trusted.
 for(const which of Object.keys(SCRIPTS)){
  const before=baseline[which+'_active_version'];
  const data=await readMetadata(which,'deployments');
  // current100Version is intentionally the same strict 100%-allocation
  // helper used for all previous WORK-only acceptance reads.
  const {current100Version}=await import('./inspect-work-contact-runtime-readonly.mjs');
  const after=current100Version(data);
  check(after.active===before&&
   after.deployment===baseline[which+'_active_deployment'],
   'active_version_or_deployment_changed');
 }
 return evaluated;
}
async function main(){
 check(process.argv.length===2||
  (process.argv.length===3&&process.argv[2]==='--owner-readonly'),
  'invalid_mode');
 if(process.argv.length===2){
  console.log(JSON.stringify({environment:'WORK',status:'HOLD',
   preview_settings:'unknown',remote_reads:0,
   release_authorized:false},null,2));
  return;
 }
 const compiledHq=JSON.parse(readFileSync(
  join(HQ,'wrangler.canary.jsonc'),'utf8'));
 const gatewayCandidate=readFileSync(join(GW,
  'wrangler.contact-bridge.candidate.toml'),'utf8');
 const whoami=wranglerJson('whoami','--json');
 const accountId=resolveExactWorkAccount(
  whoami,process.env.JILL_WORK_CLOUDFLARE_ACCOUNT_ID);
 const token=tokenFromWrangler();
 const report=await inspectWorkPreviewProtection({
  compiledHq,gatewayCandidate,
  readMetadata:readWorkContactMetadata,
  readSubdomains:()=>readExactCloudflarePreviewSettings({accountId,token}),
 });
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  console.error('HOLD '+(e?.message?.startsWith('work_preview_guard_')
   ?e.message:'work_preview_guard_unavailable'));
  process.exitCode=1;
 }
}
