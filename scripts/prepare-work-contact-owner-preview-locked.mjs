// WORK release review only: derive new LOCAL preview-disabled HQ candidate
// from the owner-attested unchanged 50-file build. Zero Cloudflare writes,
// Worker uploads, settings changes, traffic changes, D1 or Shopify mutations.
// The old build & original manifest are never overwritten or committed.
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {attestWorkContactLocalManifest,fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
import {
 inspectWorkPreviewProtection,readExactCloudflarePreviewSettings,
 resolveExactWorkAccount,tokenFromWrangler,wranglerJson,
} from './inspect-work-contact-preview-exposure-readonly.mjs';
import {proposeHqPreviewDisabledManifest}
 from './plan-work-contact-preview-lockdown.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const GW=join(ROOT,'services/custom-order-cloudflare');
const SERVER=join(APP,'dist/server');
const ORIGINAL=join(SERVER,'wrangler.contact-owner-local-only.json');
const LOCKED=join(SERVER,'wrangler.contact-owner-preview-disabled.json');
const COMPILED=join(SERVER,'wrangler.json');
const GATEWAY=join(GW,'wrangler.contact-bridge.candidate.toml');
const EXPECTED={
 fingerprint:'ed1379e8723a10fe3a73cb662249c7e327b534187b25c929286ca7a3ebdd490f',
 manifest:'c0ae54ac0b29aedf12b9090b6575d04e913ce80329005333bc1439a7bed4fe07',
 files:50,
};
const stop=reason=>{throw Error('work_contact_preview_locked_local_'+reason);};
const gate=(ok,reason)=>{if(!ok)stop(reason);};
const sha=content=>createHash('sha256').update(content).digest('hex');
export async function preparePreviewLockedCandidate({
 compiled,original,gatewayCandidate,readMetadata,readSubdomains,
}={}){
 gate(typeof readMetadata==='function'&&typeof readSubdomains==='function',
  'read_only_sources_missing');
 // This cross-checks the ORIGINAL candidate against fresh active HQ and
 // Gateway binding metadata. It rejects any drift from the pinned versions.
 const originalProof=await attestWorkContactLocalManifest({
  compiled,candidate:original,gatewayCandidate,readMetadata,
 });
 gate(originalProof.local_manifest_matches_active_reconciled_candidate&&
  !originalProof.upload_authorized,
  'original_active_parity_missing');
 const preview=await inspectWorkPreviewProtection({
  compiledHq:compiled,gatewayCandidate,readMetadata,readSubdomains,
 });
 gate(preview.preview_url_exposure_gate_cleared===true&&
  preview.any_version_urls_enabled===false&&
  preview.hq.workers_dev_enabled===true&&
  preview.gateway.workers_dev_enabled===true&&
  preview.hq.version_urls_enabled===false&&
  preview.gateway.version_urls_enabled===false,
  'public_preview_not_disabled');
 // Re-read BOTH settings after the metadata check, just before
 // producing any file. A concurrent preview re-enable must fail closed.
 const finalPreview=await readSubdomains();
 gate(finalPreview?.hq?.enabled===true&&
  finalPreview?.hq?.previews_enabled===false&&
  finalPreview?.gateway?.enabled===true&&
  finalPreview?.gateway?.previews_enabled===false,
  'preview_settings_changed_during_attestation');
 const proposed=proposeHqPreviewDisabledManifest(original);
 gate(proposed.status==='HOLD'&&
  proposed.changed_keys.length===1&&
  proposed.changed_keys[0]==='preview_urls'&&
  proposed.manifest.preview_urls===false&&
  proposed.manifest.workers_dev===true&&
  proposed.release_authorized===false,
  'candidate_scope_not_verified');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  manifest:proposed.manifest,
  only_changed_key:'preview_urls',
  original_hq_version:originalProof.active_hq_version,
  original_gateway_version:originalProof.active_gateway_version,
  preview_urls_disabled_on_active_workers:true,
  contact_enabled:false,
  upload_or_deployment_authorized:false,
 });
}
export function writePreviewLockedLocal({manifest,original,buildDir=SERVER,
 output=LOCKED}={}){
 gate(manifest&&typeof manifest==='object'&&
  original&&typeof original==='object'&&
  manifest.preview_urls===false&&
  manifest.workers_dev===true,
  'invalid_preview_candidate');
 const before=JSON.stringify(original);
 const comparison=structuredClone(manifest);
 if(Object.hasOwn(original,'preview_urls'))
  comparison.preview_urls=original.preview_urls;
 else delete comparison.preview_urls;
 gate(JSON.stringify(comparison)===before,
  'unexpected_changes_beyond_preview_urls');
 gate(resolve(dirname(output))===resolve(buildDir)&&
  existsSync(buildDir)&&!lstatSync(buildDir).isSymbolicLink()&&
  !existsSync(output),'existing_or_unsafe_output_path');
 // IMPORTANT: output is a LOCAL gitignored build artifact, NOT a
 // Cloudflare settings modification or worker version upload.
 writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{
  encoding:'utf8',flag:'wx',mode:0o600,
 });
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  local_manifest_written:true,
  local_manifest_sha256:sha(readFileSync(output)),
  preview_urls:false,workers_dev:true,
  worker_uploaded:false,worker_deployed:false,
  cloudflare_settings_changed:false,
  release_authorized:false,
 });
}
async function main(){
 gate(process.argv.length===3&&process.argv[2]==='--owner-local-only',
  'explicit_owner_local_only_required');
 for(const file of [COMPILED,ORIGINAL,GATEWAY]){
  gate(existsSync(file)&&lstatSync(file).isFile()&&
   !lstatSync(file).isSymbolicLink(),'existing_attested_build_missing');
 }
 gate(!existsSync(LOCKED),'locked_manifest_already_exists');
 const fp=fingerprintLocalContactBuild();
 gate(fp.fingerprint_sha256===EXPECTED.fingerprint&&
  fp.manifest_sha256===EXPECTED.manifest&&
  fp.bundled_file_count===EXPECTED.files,
  'original_local_fingerprint_drift');
 const compiled=JSON.parse(readFileSync(COMPILED,'utf8'));
 const original=JSON.parse(readFileSync(ORIGINAL,'utf8'));
 const gatewayCandidate=readFileSync(GATEWAY,'utf8');
 const whoami=wranglerJson('whoami','--json');
 const accountId=resolveExactWorkAccount(
  whoami,process.env.JILL_WORK_CLOUDFLARE_ACCOUNT_ID);
 const token=tokenFromWrangler();
 const candidate=await preparePreviewLockedCandidate({
  compiled,original,gatewayCandidate,
  readMetadata:readWorkContactMetadata,
  readSubdomains:()=>readExactCloudflarePreviewSettings({accountId,token}),
 });
 const saved=writePreviewLockedLocal({
  manifest:candidate.manifest,original,
 });
 const newProof=fingerprintLocalContactBuild({candidatePath:LOCKED});
 gate(newProof.manifest_sha256===saved.local_manifest_sha256&&
  newProof.bundled_file_count===EXPECTED.files,
  'new_local_fingerprint_invalid');
 console.log(JSON.stringify({
  environment:'WORK',status:'HOLD',
  original_fingerprint_verified:true,
  active_work_preview_urls_disabled:true,
  only_manifest_change:'preview_urls: false',
  active_hq_version:candidate.original_hq_version,
  active_gateway_version:candidate.original_gateway_version,
  new_local_fingerprint_sha256:newProof.fingerprint_sha256,
  new_local_manifest_sha256:newProof.manifest_sha256,
  file_count:newProof.bundled_file_count,
  local_file_only:true,worker_uploaded:false,
  worker_deployed:false,traffic_changed:false,
  settings_changed:false,secret_values_read:false,
  release_authorized:false,
 },null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(error){
  console.error('HOLD '+(error?.message?.startsWith('work_contact_preview_locked_local_')
   ?error.message:'work_contact_preview_locked_local_unavailable'));
  process.exitCode=1;
 }
}
