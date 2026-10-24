// WORK HQ Contact: independent LOCAL fingerprint review after owner dry-run.
// No network, Wrangler calls, uploads, traffic changes or approval side effects.
// A matching local fingerprint is NOT a Cloudflare release certificate.
import {existsSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const LOCKED=join(ROOT,'services/jill-order-desk/app-home/dist/server',
 'wrangler.contact-owner-preview-disabled.json');
const PIN=Object.freeze({
 worker:'jill-order-desk-canary-work',
 d1:'3f17c186-c794-4e00-8f20-017191373a19',
 fingerprint:'c2216770580d87659c75ba82c0776a54995db149a40830ebb55f8dd00f501996',
 manifest:'890a94557193eea7cc7e62e26286f5008411f1bd30facd015e97226d0d9c7671',
 fileCount:50,
});
const SECRETS=Object.freeze([
 'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
 'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]);
const FLAGS=Object.freeze({
 JILL_WORK_HOST_STAGE:'canary',
 JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
 JILL_WORK_OAUTH_ENABLED:'true',
 JILL_WORK_CATALOG_ENABLED:'true',
 JILL_WORK_CONVERSATION_ENABLED:'false',
 JILL_WORK_HQ_DETAIL_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
 JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
});
const fail=reason=>{throw Error('contact_inactive_upload_offline_'+reason);};
const gate=(ok,why)=>{if(!ok)fail(why);};
const safeRecord=value=>value&&typeof value==='object'&&!Array.isArray(value);
export function reviewLockedLocalHqArtifact({manifest,artifact}={}){
 gate(safeRecord(manifest)&&safeRecord(artifact),'missing_evidence');
 gate(manifest.name===PIN.worker&&manifest.workers_dev===true&&
  manifest.preview_urls===false,'work_target_or_preview_changed');
 gate(safeRecord(manifest.vars)&&Object.entries(FLAGS).every(
  ([key,value])=>manifest.vars[key]===value),'existing_business_flags_changed');
 gate(Object.entries(manifest.vars).every(([key,value])=>
  !key.startsWith('JILL_WORK_CONTACT_')||value==='false'),
 'contact_flag_not_off');
 gate(Array.isArray(manifest.d1_databases)&&manifest.d1_databases.length===1&&
  manifest.d1_databases[0]?.binding==='JILL_ORDER_DESK_WORK_DB'&&
  manifest.d1_databases[0]?.database_id===PIN.d1,'work_d1_changed');
 const secrets=manifest.secrets?.required;
 gate(Array.isArray(secrets)&&secrets.length===SECRETS.length&&
  new Set(secrets).size===SECRETS.length&&
  SECRETS.every(name=>secrets.includes(name)),'required_secret_names_changed');
 gate(!manifest.services||Array.isArray(manifest.services)&&
  manifest.services.length===0,'hq_unexpected_service_binding');
 gate(artifact.fingerprint_sha256===PIN.fingerprint&&
  artifact.manifest_sha256===PIN.manifest&&
  artifact.bundled_file_count===PIN.fileCount&&
  artifact.private_worker_entry_found===true,
 'owner_pinned_local_bytes_changed');
 // Never return any input object or secret values. The caller receives
 // only a narrowly scoped, non-authorizing, bounded evidence verdict.
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  reviewed_worker:PIN.worker,
  local_artifact_matches_owner_pin:true,
  preview_disabled_in_local_manifest:true,
  existing_work_flags_and_secret_names_verified_locally:true,
  bundled_file_count:PIN.fileCount,
  local_fingerprint_sha256:PIN.fingerprint,
  local_manifest_sha256:PIN.manifest,
  remote_current_versions_rechecked:false,
  remote_preview_settings_rechecked:false,
  uploaded_secret_continuity_verified:false,
  free_tier_usage_verified:false,
  uploaded_version_verified:false,
  release_authorized:false,
  worker_uploaded:false,traffic_changed:false,
 });
}
function main(){
 gate(process.argv.length===2||process.argv.length===3&&
  process.argv[2]==='--owner-local-readonly','invalid_mode');
 if(process.argv.length===2){
  console.log(JSON.stringify({environment:'WORK',status:'HOLD',
   local_artifact_checked:false,remote_calls:0,
   worker_uploaded:false,release_authorized:false},null,2));
  return;
 }
 gate(existsSync(LOCKED),'preview_locked_local_artifact_missing');
 const manifest=JSON.parse(readFileSync(LOCKED,'utf8'));
 const artifact=fingerprintLocalContactBuild({candidatePath:LOCKED});
 console.log(JSON.stringify(reviewLockedLocalHqArtifact({
  manifest,artifact,
 }),null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}
 catch(error){
  console.error('HOLD '+(error?.message?.startsWith('contact_inactive_upload_offline_')
   ?error.message:'contact_inactive_upload_offline_unavailable'));
  process.exitCode=1;
 }
}
