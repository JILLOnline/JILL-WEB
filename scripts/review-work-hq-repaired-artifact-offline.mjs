// Read-only owner attestation of the SECOND (version-metadata-restored)
// WORK HQ candidate. No cloud API calls, uploads, traffic changes or secret reads.
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {reviewLockedLocalHqArtifact}
 from './review-work-contact-inactive-upload-offline.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const DIR=join(ROOT,'services/jill-order-desk/app-home/dist/server');
const ORIGINAL=join(DIR,'wrangler.contact-owner-preview-disabled.json');
const REPAIRED=join(DIR,'wrangler.contact-owner-version-metadata-restored.json');
export const FIX_PIN=Object.freeze({
 manifest:'ccec9a3f0d84ba5b3e07e9170450146c12238995b13b990b51747d2f3ff929cc',
 fingerprint:'3625479c615109b980153d40e009f147523e8fe95b53d7403c92afe9abebe9db',
 bundledFiles:50,
});
const stop=x=>{throw Error('work_hq_repaired_artifact_review_'+x);};
const gate=(ok,why)=>{if(!ok)stop(why);};

export function reviewRepairedWorkHqArtifact({
 original,repaired,originalEvidence,repairedEvidence,
}={}){
 const baseline=reviewLockedLocalHqArtifact({
  manifest:original,artifact:originalEvidence,
 });
 gate(baseline.local_artifact_matches_owner_pin===true,
  'original_manifest_or_bundle_changed');
 gate(repaired&&typeof repaired==='object'&&!Array.isArray(repaired)&&
  repaired.version_metadata?.binding==='CF_VERSION_METADATA'&&
  Object.keys(repaired.version_metadata).length===1,
  'version_metadata_binding_missing_or_changed');
 const reduced=structuredClone(repaired);
 delete reduced.version_metadata;
 gate(isDeepStrictEqual(reduced,original),
  'repaired_candidate_has_other_manifest_changes');
 gate(repairedEvidence?.manifest_sha256===FIX_PIN.manifest&&
  repairedEvidence?.fingerprint_sha256===FIX_PIN.fingerprint&&
  repairedEvidence?.bundled_file_count===FIX_PIN.bundledFiles&&
  repairedEvidence?.private_worker_entry_found===true,
  'repaired_manifest_or_bundle_not_owner_pinned');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  worker:'jill-order-desk-canary-work',
  original_manifest_unchanged:true,
  only_change:'add version_metadata.binding CF_VERSION_METADATA',
  corrected_manifest_sha256:FIX_PIN.manifest,
  corrected_artifact_sha256:FIX_PIN.fingerprint,
  bundled_file_count:FIX_PIN.bundledFiles,
  original_work_oauth_and_business_flags_preserved:true,
  preview_urls_disabled_in_manifest:true,
  WORK_D1_and_required_secret_names_preserved:true,
  contact_feature_activated:false,
  cloudflare_reads:0,cloudflare_writes:0,
  version_uploaded_by_reviewer:false,
  traffic_changed:false,release_authorized:false,
 });
}

function readNonlink(path){
 gate(existsSync(path)&&lstatSync(path).isFile()&&
  !lstatSync(path).isSymbolicLink(),'candidate_missing_or_symlink');
 return JSON.parse(readFileSync(path,'utf8'));
}

function main(){
 gate(process.argv.length===2||process.argv.length===3&&
  process.argv[2]==='--owner-local-readonly','unsupported_mode');
 if(process.argv.length===2){
  console.log(JSON.stringify({environment:'WORK',status:'HOLD',
   local_artifact_checked:false,cloudflare_calls:0,
   upload_authorized:false},null,2));return;
 }
 const original=readNonlink(ORIGINAL);
 const repaired=readNonlink(REPAIRED);
 const originalEvidence=fingerprintLocalContactBuild({
  candidatePath:ORIGINAL,
 });
 const repairedEvidence=fingerprintLocalContactBuild({
  candidatePath:REPAIRED,
 });
 const result=reviewRepairedWorkHqArtifact({
  original,repaired,originalEvidence,repairedEvidence,
 });
 console.log(JSON.stringify(result,null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}
 catch(e){
  console.error('HOLD '+(e?.message?.startsWith(
   'work_hq_repaired_artifact_review_')?e.message:
   'work_hq_repaired_artifact_review_unavailable'));
  process.exitCode=1;
 }
}
