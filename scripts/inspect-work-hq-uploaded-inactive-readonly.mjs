// WORK HQ: independently inspect one SPECIFIC already-uploaded inactive
// version. Read-only Cloudflare GETs + owner-local artifact checks ONLY.
// This is NOT an upload, traffic shift, release certificate or secret test.
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {reviewCombinedWorkContactEvidence}
 from './review-work-contact-combined-evidence-readonly.mjs';
import {readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
import {current100Version}
 from './inspect-work-contact-runtime-readonly.mjs';
import {
 readExactCloudflarePreviewSettings,resolveExactWorkAccount,
 tokenFromWrangler,wranglerJson,
} from './inspect-work-contact-preview-exposure-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HQ=join(ROOT,'services/jill-order-desk/app-home');
const GW=join(ROOT,'services/custom-order-cloudflare');
const LOCKED=join(HQ,'dist/server/wrangler.contact-owner-preview-disabled.json');
export const VERSION_PIN=Object.freeze({
 uploaded:'8fd0153b-3071-47df-8836-81973dab6cb4',
 active:'44ad4a81-55ad-4f49-9965-61260cc2294d',
 deployment:'f80335de-98ea-4831-b00e-87cd1a397596',
 gateway:'9322193f-5e87-4479-88c9-39229dddb5f2',
 gatewayDeployment:'4fad4b6f-3596-4797-83a3-05edb7f89097',
 d1:'3f17c186-c794-4e00-8f20-017191373a19',
});
const REQUIRED_SECRETS=Object.freeze([
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]);
const REQUIRE_VARS=Object.freeze({
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
});
const CONTACT_PREFIX='JILL_WORK_CONTACT_';
const APPROVED_TYPES=new Set([
 'd1','secret_text','plain_text','assets','version_metadata',
]);
const fail=reason=>{throw Error('work_hq_inactive_postflight_'+reason);};
const gate=(ok,reason)=>{if(!ok)fail(reason);};
function bindings(view,version){
 gate(view?.id===version&&Array.isArray(view?.resources?.bindings)&&
  view.resources.bindings.length>=10&&view.resources.bindings.length<=80,
 'view_missing_or_wrong_version');
 const output=new Map();
 for(const x of view.resources.bindings){
  gate(typeof x?.name==='string'&&/^[A-Za-z][A-Za-z0-9_]{1,127}$/.test(x.name)&&
   APPROVED_TYPES.has(x.type)&&!output.has(x.name),
  'unsupported_duplicate_or_malformed_binding');
  output.set(x.name,x);
 }
 return output;
}
const names=(map,type)=>[...map].filter(([,v])=>v.type===type)
 .map(([k])=>k).sort();
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const d1id=b=>b?.id??b?.database_id;
export function compareUploadedWorkHqVersion({activeView,uploadedView}={}){
 const active=bindings(activeView,VERSION_PIN.active);
 const uploaded=bindings(uploadedView,VERSION_PIN.uploaded);
 for(const [label,map] of [['active',active],['uploaded',uploaded]]){
  const d1=map.get('JILL_ORDER_DESK_WORK_DB');
  gate(d1?.type==='d1'&&d1id(d1)===VERSION_PIN.d1&&
   names(map,'d1').length===1,'work_d1_changed_'+label);
  const secretNames=names(map,'secret_text');
  gate(same(secretNames,[...REQUIRED_SECRETS].sort()),
   'oauth_or_merchant_secret_names_changed_'+label);
  for(const [key,value] of Object.entries(REQUIRE_VARS)){
   gate(map.get(key)?.type==='plain_text'&&map.get(key)?.text===value,
    'original_work_flag_changed_'+label);
  }
  gate(names(map,'plain_text').every(k=>
   !k.startsWith(CONTACT_PREFIX)||map.get(k).text==='false'),
   'contact_feature_on_'+label);
  gate(![...map].some(([name,item])=>item.type==='d1'&&
   name!=='JILL_ORDER_DESK_WORK_DB'),'additional_database_'+label);
 }
 const sortedPlain=map=>[...map].filter(([,v])=>v.type==='plain_text')
  .map(([k,v])=>[k,v.text]).sort(([a],[b])=>a.localeCompare(b));
 gate(same(sortedPlain(active),sortedPlain(uploaded)),
  'plaintext_added_removed_or_modified');
 // Nonsecret, non-D1 resource names must remain present. A newly
 // uploaded static assets binding is permitted only as type 'assets'.
 // No other new binding is permitted and no existing one may disappear.
 for(const [name,old] of active){
  const fresh=uploaded.get(name);
  gate(fresh?.type===old.type,'existing_binding_removed_or_retyped');
 }
 for(const [name,fresh] of uploaded){
  if(active.has(name))continue;
  gate(fresh.type==='assets'&&name==='ASSETS',
   'unexpected_new_binding');
 }
 // Secret names are not credential VALUE or OAuth-login continuity proof.
 return Object.freeze({
  uploaded_version_metadata_checked:true,
  uploaded_binding_scope_matches_active:true,
  work_d1_identity_preserved:true,
  original_plaintext_flags_preserved:true,
  required_secret_names_preserved:true,
  remote_secret_value_continuity_verified:false,
  actual_shopify_owner_login_verified:false,
  private_entrypoint_remote_execution_verified:false,
 });
}
function sameActive(actual,which){
 const ver=which==='hq'?VERSION_PIN.active:VERSION_PIN.gateway;
 const dep=which==='hq'?VERSION_PIN.deployment:
  VERSION_PIN.gatewayDeployment;
 gate(actual.active===ver&&actual.deployment===dep&&
  !actual.allocation.some(v=>v.id===VERSION_PIN.uploaded),
  'new_version_serving_or_allocation_changed_'+which);
}
export async function inspectUploadedWorkHqInactive({
 readLocal,readMetadata,readSubdomains,compiledHq,gatewayCandidate,
}={}){
 gate(typeof readMetadata==='function','missing_metadata_reader');
 // Existing combined review includes local SHA pin, both Worker binding
 // baselines, two authenticated Version URL GETs per Worker and traffic
 // snapshots. This is only an additional post-upload VERSION read.
 const combined=await reviewCombinedWorkContactEvidence({
  readLocal,readMetadata,readSubdomains,compiledHq,gatewayCandidate,
 });
 gate(combined.local_artifact_matches_owner_pin===true&&
  combined.normal_traffic_observed_unchanged===true&&
  combined.hq_version_urls_enabled===false&&
  combined.gateway_version_urls_enabled===false,
 'combined_owner_evidence_not_verified');

 const hqBefore=current100Version(await readMetadata('hq','deployments'));
 const gatewayBefore=current100Version(await readMetadata('gateway','deployments'));
 sameActive(hqBefore,'hq');
 sameActive(gatewayBefore,'gateway');
 // Direct GET of exact ID; versions LIST pagination is not proof.
 const activeView=await readMetadata('hq','version',VERSION_PIN.active);
 const uploadedView=await readMetadata('hq','version',VERSION_PIN.uploaded);
 const compared=compareUploadedWorkHqVersion({activeView,uploadedView});
 const hqAfter=current100Version(await readMetadata('hq','deployments'));
 const gatewayAfter=current100Version(await readMetadata('gateway','deployments'));
 sameActive(hqAfter,'hq');
 sameActive(gatewayAfter,'gateway');
 gate(same(hqBefore,hqAfter)&&same(gatewayBefore,gatewayAfter),
  'allocation_changed_during_uploaded_version_inspection');

 return Object.freeze({
  environment:'WORK',status:'HOLD',
  worker:'jill-order-desk-canary-work',
  inactive_uploaded_version:VERSION_PIN.uploaded,
  current_active_version:VERSION_PIN.active,
  current_active_deployment:VERSION_PIN.deployment,
  gateway_active_version:VERSION_PIN.gateway,
  gateway_active_deployment:VERSION_PIN.gatewayDeployment,
  ...compared,
  confirmed_not_in_current_traffic_allocation:true,
  version_urls_disabled_both_work_workers:true,
  local_artifact_owner_pin_verified:true,
  secret_values_read:false,customer_data_read:false,
  no_d1_writes:true,worker_uploaded_by_inspector:false,
  deployment_performed:false,traffic_changed:false,
  free_tier_actual_usage_verified:false,
  source_provenance_verified:false,
  owner_visual_login_passed:false,
  release_authorized:false,
 });
}
function readOwnerLocal(){
 gate(existsSync(LOCKED),'locked_local_artifact_missing');
 return {
  manifest:JSON.parse(readFileSync(LOCKED,'utf8')),
  artifact:fingerprintLocalContactBuild({candidatePath:LOCKED}),
 };
}
async function main(){
 gate(process.argv.length===2||process.argv.length===3&&
  process.argv[2]==='--owner-readonly','invalid_invocation');
 if(process.argv.length===2){
  console.log(JSON.stringify({
   environment:'WORK',status:'HOLD',
   uploaded_version_checked:false,provider_reads:0,
   deployment_performed:false,traffic_changed:false,
  },null,2));return;
 }
 const compiledHq=JSON.parse(readFileSync(join(HQ,'wrangler.canary.jsonc'),'utf8'));
 const gatewayCandidate=readFileSync(join(GW,
  'wrangler.contact-bridge.candidate.toml'),'utf8');
 let auth;
 const readSubdomains=async()=>{
  if(!auth){
   const whoami=wranglerJson('whoami','--json');
   const accountId=resolveExactWorkAccount(
    whoami,process.env.JILL_WORK_CLOUDFLARE_ACCOUNT_ID);
   auth={accountId,token:tokenFromWrangler()};
  }
  return readExactCloudflarePreviewSettings(auth);
 };
 const report=await inspectUploadedWorkHqInactive({
  readLocal:readOwnerLocal,readMetadata:readWorkContactMetadata,
  readSubdomains,compiledHq,gatewayCandidate,
 });
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  console.error('HOLD '+(
   e?.message?.startsWith('work_hq_inactive_postflight_')
    ?e.message:'work_hq_inactive_postflight_unavailable'));
  process.exitCode=1;
 }
}
