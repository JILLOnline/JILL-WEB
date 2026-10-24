// OWNER-APPROVED **WORK ONLY** Version URL disable operation.
// This is the narrow Cloudflare API subdomain-settings POST authorized
// on October 23, 2026. Never uploads/deploys Workers, touches traffic,
// changes D1, Shopify, secrets, flags, workers.dev or LIVE/KEEP.
// The caller must supply the EXACT CLI approval string.
// Post body has only {enabled:true,previews_enabled:false} for TWO fixed
// WORK names. On partial failure it STOPS; never re-enables public URLs.
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectContactPairedBaseline,readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
import {
 SCRIPTS,wranglerJson,tokenFromWrangler,resolveExactWorkAccount,
 evaluateWorkPreviewSettings,readExactCloudflarePreviewSettings,
} from './inspect-work-contact-preview-exposure-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HQ=join(ROOT,'services/jill-order-desk/app-home');
const GW=join(ROOT,'services/custom-order-cloudflare');
const ACTION='--owner-approved-disable-work-version-urls-only';
const ORDER=Object.freeze(['hq','gateway']);
const STOP=reason=>{throw Error('work_version_urls_disable_'+reason);};
const gate=(ok,reason)=>{if(!ok)STOP(reason);};
const validAccount=id=>typeof id==='string'&&/^[0-9a-f]{32}$/.test(id);
const validToken=token=>typeof token==='string'&&
 token.length>=20&&token.length<=8192;
const previewState=state=>{
 gate(state&&typeof state==='object'&&
  Object.keys(state).length===2&&ORDER.every(k=>
   Object.hasOwn(state,k)&&
   state[k]?.enabled===true&&
   typeof state[k]?.previews_enabled==='boolean'),
 'settings_missing_or_workers_dev_not_enabled');
 return state;
};
async function stableWorkBaseline({compiledHq,gatewayCandidate,readMetadata}){
 const report=await inspectContactPairedBaseline({
  compiledHq,gatewayCandidate,readMetadata,
 });
 gate(report?.active_versions_verified===true&&
  report.hq_reconciliation?.candidate_plaintext_parity_after_reconcile===true&&
  report.gateway?.gateway_secret_name_contract_matches_active===true,
  'active_work_binding_parity_missing');
 return report;
}
function pinnedUnchanged(before,after){
 gate(before.hq_active_version===after.hq_active_version&&
  before.gateway_active_version===after.gateway_active_version&&
  before.hq_active_deployment===after.hq_active_deployment&&
  before.gateway_active_deployment===after.gateway_active_deployment,
  'active_versions_or_deployments_changed');
}
export async function postDisableWorkVersionUrl({
 which,accountId,token,fetchImpl=fetch,
}={}){
 gate(ORDER.includes(which)&&
  SCRIPTS[which]===({
   hq:'jill-order-desk-canary-work',
   gateway:'jill-work-custom-orders-qa',
  })[which]&&validAccount(accountId)&&validToken(token)&&
  typeof fetchImpl==='function','not_exact_approved_work_target');
 const url='https://api.cloudflare.com/client/v4/accounts/'+accountId+
  '/workers/scripts/'+SCRIPTS[which]+'/subdomain';
 let response;
 try{
  response=await fetchImpl(url,{
   method:'POST',redirect:'error',
   headers:{
    Authorization:'Bearer '+token,
    Accept:'application/json',
    'Content-Type':'application/json',
   },
   body:JSON.stringify({enabled:true,previews_enabled:false}),
   signal:AbortSignal.timeout(20000),
  });
 }catch{STOP('cloudflare_setting_update_unconfirmed');}
 gate(response?.ok===true&&[200,201].includes(response.status),
  'cloudflare_setting_update_unconfirmed');
 let payload;
 try{
  const raw=await response.text();
  gate(raw.length>0&&raw.length<32768,'unexpected_response_size');
  payload=JSON.parse(raw);
 }catch{STOP('cloudflare_update_response_invalid');}
 gate(payload?.success===true&&
  payload.result?.enabled===true&&
  payload.result?.previews_enabled===false,
  'cloudflare_update_not_confirmed');
 return {worker:SCRIPTS[which],
  workers_dev_enabled:true,version_urls_enabled:false};
}
export async function applyApprovedWorkPreviewDisable({
 compiledHq,gatewayCandidate,readMetadata,readSubdomains,
 writeDisable,
}={}){
 gate(typeof readMetadata==='function'&&
  typeof readSubdomains==='function'&&typeof writeDisable==='function',
  'missing_owner_authenticated_operations');
 // BEFORE ANY WRITE, inspect BOTH pinned live Worker versions, OAuth,
 // exact HQ private D1, all original flags, limiter and secret NAMES.
 const before=await stableWorkBaseline({
  compiledHq,gatewayCandidate,readMetadata,
 });
 const initial=previewState(await readSubdomains());
 evaluateWorkPreviewSettings({baseline:before,subdomains:initial});
 // No surprise workers.dev changes; only the two preview booleans
 // are approved to change from true to false.
 let expected={
  hq:{enabled:true,previews_enabled:initial.hq.previews_enabled},
  gateway:{enabled:true,previews_enabled:initial.gateway.previews_enabled},
 };
 const changed=[];
 for(const which of ORDER){
  // Recheck normal traffic and all bindings BEFORE each possible POST.
  const freshBaseline=await stableWorkBaseline({
   compiledHq,gatewayCandidate,readMetadata,
  });
  pinnedUnchanged(before,freshBaseline);
  const live=previewState(await readSubdomains());
  for(const key of ORDER){
   gate(live[key].previews_enabled===expected[key].previews_enabled,
    'preview_changed_outside_this_operation');
  }
  if(expected[which].previews_enabled===false)continue; // safe idempotence
  // This is the ONLY mutating API request anywhere in this workflow.
  const updated=await writeDisable(which);
  gate(updated?.worker===SCRIPTS[which]&&
   updated?.workers_dev_enabled===true&&
   updated?.version_urls_enabled===false,
   'setting_write_result_not_confirmed');
  expected={...expected,[which]:{enabled:true,previews_enabled:false}};
  // Confirm actual persisted settings, not just the POST response.
  const persisted=previewState(await readSubdomains());
  for(const key of ORDER){
   gate(persisted[key].previews_enabled===expected[key].previews_enabled,
    'setting_readback_or_other_worker_changed');
  }
  changed.push(which);
 }
 const after=await stableWorkBaseline({
  compiledHq,gatewayCandidate,readMetadata,
 });
 pinnedUnchanged(before,after);
 const final=previewState(await readSubdomains());
 gate(ORDER.every(which=>final[which].previews_enabled===false),
  'final_version_url_settings_not_disabled');
 const evaluated=evaluateWorkPreviewSettings({
  baseline:after,subdomains:final,
 });
 gate(evaluated.preview_url_exposure_gate_cleared===true,
  'public_preview_still_enabled');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  approved_change:'Version URLs disabled on WORK HQ and gateway only',
  applied_to:changed.map(x=>SCRIPTS[x]),
  hq_version:after.hq_active_version,
  gateway_version:after.gateway_active_version,
  hq_workers_dev_enabled:true,gateway_workers_dev_enabled:true,
  hq_version_urls_enabled:false,gateway_version_urls_enabled:false,
  active_worker_versions_unchanged:true,
  normal_traffic_unchanged:true,
  preview_url_exposure_gate_cleared:true,
  contact_flags_enabled:false,
  worker_uploaded:false,worker_deployed:false,
  database_modified:false,shopify_modified:false,
  other_environments_modified:false,
  secret_values_read:false,release_authorized:false,
 });
}
async function main(){
 gate(process.argv.length===3&&process.argv[2]===ACTION,
  'exact_owner_approval_flag_required');
 const compiledHq=JSON.parse(readFileSync(join(HQ,
  'wrangler.canary.jsonc'),'utf8'));
 const gatewayCandidate=readFileSync(join(GW,
  'wrangler.contact-bridge.candidate.toml'),'utf8');
 // One authenticated account, or a specifically selected WORK account
 // which MUST be among the authenticated Cloudflare account memberships.
 const whoami=wranglerJson('whoami','--json');
 const accountId=resolveExactWorkAccount(
  whoami,process.env.JILL_WORK_CLOUDFLARE_ACCOUNT_ID);
 const token=tokenFromWrangler(); // NEVER print or persist
 const readSubdomains=()=>readExactCloudflarePreviewSettings({
  accountId,token,
 });
 const report=await applyApprovedWorkPreviewDisable({
  compiledHq,gatewayCandidate,
  readMetadata:readWorkContactMetadata,
  readSubdomains,
  writeDisable:which=>postDisableWorkVersionUrl({
   which,accountId,token,
  }),
 });
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  // No authentication/network raw output: it may include secrets.
  // If one POST succeeded before a failure, do NOT re-enable it as a
  // 'rollback'. Run the standalone read-only inspector to reconcile.
  console.error('STOP '+(e?.message?.startsWith('work_version_urls_disable_')
   ?e.message:'work_version_urls_disable_unverified')+
   ' — run the existing read-only WORK preview inspector to confirm both settings; do not upload or deploy.');
  process.exitCode=1;
 }
}
