// JILL WORK Contact: LOCAL artifact + fresh owner-authenticated metadata
// evidence, READ ONLY. No Cloudflare writes, uploads, deploys or approvals.
// Runs with the explicit --owner-readonly switch only; otherwise OFFLINE HOLD.
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {reviewLockedLocalHqArtifact}
 from './review-work-contact-inactive-upload-offline.mjs';
import {inspectContactPairedBaseline,readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
import {current100Version} from './inspect-work-contact-runtime-readonly.mjs';
import {
 evaluateWorkPreviewSettings,readExactCloudflarePreviewSettings,
 resolveExactWorkAccount,tokenFromWrangler,wranglerJson,
} from './inspect-work-contact-preview-exposure-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const LOCKED=join(ROOT,'services/jill-order-desk/app-home/dist/server',
 'wrangler.contact-owner-preview-disabled.json');
const HQ_SOURCE=join(ROOT,'services/jill-order-desk/app-home/wrangler.canary.jsonc');
const GATEWAY_SOURCE=join(ROOT,'services/custom-order-cloudflare',
 'wrangler.contact-bridge.candidate.toml');
const WORKERS=Object.freeze({
 hq:'jill-order-desk-canary-work',
 gateway:'jill-work-custom-orders-qa',
});
const stop=why=>{throw Error('work_contact_combined_review_'+why);};
const gate=(ok,why)=>{if(!ok)stop(why);};

export async function reviewCombinedWorkContactEvidence({
 readLocal,readMetadata,readSubdomains,compiledHq,gatewayCandidate,
}={}){
 gate(typeof readLocal==='function'&&typeof readMetadata==='function'&&
  typeof readSubdomains==='function'&&compiledHq&&
  typeof compiledHq==='object'&&typeof gatewayCandidate==='string',
 'missing_read_only_inputs');

 // Local byte gate FIRST. Do not even attempt remote authentication on
 // absent, replaced, or inconsistent local build files.
 const first=await readLocal();
 const local=reviewLockedLocalHqArtifact(first);
 gate((gatewayCandidate.match(/^preview_urls = false$/gm)??[]).length===1&&
  (gatewayCandidate.match(/^workers_dev = true$/gm)??[]).length===1,
 'gateway_preview_manifest_not_locked');

 const baseline=await inspectContactPairedBaseline({
  readMetadata,compiledHq,gatewayCandidate,
 });
 gate(baseline.active_versions_verified===true&&
  baseline.hq_reconciliation?.candidate_plaintext_parity_after_reconcile===true&&
  baseline.gateway?.gateway_secret_name_contract_matches_active===true&&
  baseline.hq_reconciliation?.existing_flag_names_preserved?.length===5&&
  baseline.hq_reconciliation?.required_existing_secret_names?.length===4,
 'active_work_binding_parity_unverified');

 // TWO independent reads of each exact WORK script's subdomain settings.
 // A single successful GET or a source-only flag does not clear this gate.
 const settings1=await readSubdomains();
 const preview1=evaluateWorkPreviewSettings({baseline,subdomains:settings1});
 gate(preview1.preview_url_exposure_gate_cleared===true&&
  preview1.hq.workers_dev_enabled===true&&
  preview1.gateway.workers_dev_enabled===true&&
  preview1.hq.version_urls_enabled===false&&
  preview1.gateway.version_urls_enabled===false,
 'public_or_ambiguous_version_urls');

 // Re-read 100%-traffic deployments AFTER the first preview GETs.
 for(const which of Object.keys(WORKERS)){
  const current=current100Version(await readMetadata(which,'deployments'));
  gate(current.active===baseline[which+'_active_version']&&
   current.deployment===baseline[which+'_active_deployment'],
  'deployment_changed_'+which);
 }
 const settings2=await readSubdomains();
 const preview2=evaluateWorkPreviewSettings({baseline,subdomains:settings2});
 gate(preview2.preview_url_exposure_gate_cleared===true&&
  Object.keys(WORKERS).every(which=>
   preview2[which].workers_dev_enabled===true&&
   preview2[which].version_urls_enabled===false&&
   settings1[which]?.enabled===settings2[which]?.enabled&&
   settings1[which]?.previews_enabled===settings2[which]?.previews_enabled),
 'preview_settings_changed_during_review');

 // The same LOCAL candidate must still exist after all network reads.
 const second=await readLocal();
 const localAfter=reviewLockedLocalHqArtifact(second);
 gate(localAfter.local_fingerprint_sha256===local.local_fingerprint_sha256&&
  localAfter.local_manifest_sha256===local.local_manifest_sha256,
 'local_candidate_changed_during_review');
 // Last, re-read deployments. This is only a bounded observation and
 // not a guarantee that the state cannot subsequently change.
 for(const which of Object.keys(WORKERS)){
  const current=current100Version(await readMetadata(which,'deployments'));
  gate(current.active===baseline[which+'_active_version']&&
   current.deployment===baseline[which+'_active_deployment'],
  'deployment_changed_final_'+which);
 }

 return Object.freeze({
  environment:'WORK',status:'HOLD',
  local_artifact_matches_owner_pin:true,
  local_fingerprint_sha256:local.local_fingerprint_sha256,
  local_manifest_sha256:local.local_manifest_sha256,
  local_bundled_files:local.bundled_file_count,
  hq_worker:WORKERS.hq,
  hq_active_version:baseline.hq_active_version,
  hq_active_deployment:baseline.hq_active_deployment,
  gateway_worker:WORKERS.gateway,
  gateway_active_version:baseline.gateway_active_version,
  gateway_active_deployment:baseline.gateway_active_deployment,
  active_binding_names_and_plaintext_parity_verified:true,
  remote_preview_settings_gets_per_worker:2,
  hq_version_urls_enabled:false,gateway_version_urls_enabled:false,
  both_workers_dev_enabled:true,
  normal_traffic_observed_unchanged:true,
  customer_data_read:false,secret_values_read:false,
  source_provenance_verified:false,
  remote_secret_value_continuity_verified:false,
  free_tier_budget_verified:false,
  contact_feature_activated:false,
  readiness_certificate_issued:false,
  inactive_upload_authorized:false,
  worker_uploaded:false,worker_deployed:false,
  normal_traffic_changed:false,
 });
}
function readOwnerLocalArtifact(){
 gate(existsSync(LOCKED),'locked_artifact_missing');
 return {
  manifest:JSON.parse(readFileSync(LOCKED,'utf8')),
  artifact:fingerprintLocalContactBuild({candidatePath:LOCKED}),
 };
}
async function main(){
 gate(process.argv.length===2||process.argv.length===3&&
  process.argv[2]==='--owner-readonly','invalid_mode');
 if(process.argv.length===2){
  console.log(JSON.stringify({environment:'WORK',status:'HOLD',
   local_artifact_verified:false,cloudflare_reads:0,
   upload_authorized:false,worker_uploaded:false},null,2));
  return;
 }
 const compiledHq=JSON.parse(readFileSync(HQ_SOURCE,'utf8'));
 const gatewayCandidate=readFileSync(GATEWAY_SOURCE,'utf8');
 // Lazy authentication keeps even token retrieval behind the local gate.
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
 const result=await reviewCombinedWorkContactEvidence({
  readLocal:readOwnerLocalArtifact,
  readMetadata:readWorkContactMetadata,
  readSubdomains,compiledHq,gatewayCandidate,
 });
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(error){
  // Never echo raw provider output, auth tokens, or arbitrary remote JSON.
  console.error('HOLD '+(
   error?.message?.startsWith('work_contact_combined_review_')
    ?error.message:'work_contact_combined_review_unavailable'));
  process.exitCode=1;
 }
}
