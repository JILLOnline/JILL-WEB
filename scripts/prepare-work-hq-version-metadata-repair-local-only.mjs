// WORK HQ version-metadata repair: local manifest ONLY.
// The first inactive upload omitted CF_VERSION_METADATA; NEVER relax
// the full-bundles/source lock, Worker safety flags, or release gate.
// No Cloudflare API/CLI, traffic, Shopify, D1, files outside dist/server,
// automatic upload, approval, or paid resource provisioning.
import {existsSync,lstatSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {reviewLockedLocalHqArtifact}
 from './review-work-contact-inactive-upload-offline.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SERVER=join(ROOT,'services/jill-order-desk/app-home/dist/server');
export const ORIGINAL=join(SERVER,
 'wrangler.contact-owner-preview-disabled.json');
export const REPAIRED=join(SERVER,
 'wrangler.contact-owner-version-metadata-restored.json');
const BINDING='CF_VERSION_METADATA';
const REQUIRED_BASENAME=basename(REPAIRED);
const stop=why=>{throw Error('work_hq_metadata_repair_'+why);};
const gate=(ok,why)=>{if(!ok)stop(why);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);

export function prepareWorkHqVersionMetadataRepair({
 manifest,artifact,
}={}){
 const pinned=reviewLockedLocalHqArtifact({manifest,artifact});
 gate(pinned.local_artifact_matches_owner_pin===true&&
  pinned.status==='HOLD','owner_pin_unverified');
 gate(record(manifest)&&!Object.hasOwn(manifest,'version_metadata')&&
  !Object.hasOwn(manifest,'CF_VERSION_METADATA')&&
  !Object.hasOwn(manifest.vars??{},BINDING),'unexpected_existing_metadata');
 const snapshot=structuredClone(manifest);
 const restored=structuredClone(manifest);
 restored.version_metadata={binding:BINDING};
 const without=structuredClone(restored);
 delete without.version_metadata;
 gate(isDeepStrictEqual(without,snapshot)&&
  Object.keys(restored).length===Object.keys(snapshot).length+1&&
  restored.version_metadata.binding===BINDING,
  'more_than_one_manifest_setting_changed');
 gate(restored.workers_dev===true&&restored.preview_urls===false&&
  restored.vars?.JILL_WORK_OAUTH_ENABLED==='true'&&
  restored.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
  'authentication_or_routing_changed');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  original_fingerprint_sha256:pinned.local_fingerprint_sha256,
  original_manifest_sha256:pinned.local_manifest_sha256,
  changed_keys:Object.freeze(['version_metadata']),
  required_binding_name:BINDING,
  exact_manifest_only_diff:true,
  bundled_file_count:pinned.bundled_file_count,
  remote_bindings_verified:false,
  source_provenance_verified:false,
  upload_authorized:false,traffic_change_authorized:false,
  new_worker_version_uploaded:false,manifest:restored,
 });
}
export function writeWorkHqVersionMetadataRepair({
 original,repaired,output=REPAIRED,directory=SERVER,
}={}){
 gate(record(original)&&record(repaired)&&
  !Object.hasOwn(original,'version_metadata')&&
  record(repaired.version_metadata)&&
  isDeepStrictEqual(repaired.version_metadata,{binding:BINDING}),
  'invalid_repair_manifest');
 const back=structuredClone(repaired);
 delete back.version_metadata;
 gate(isDeepStrictEqual(original,back),'unexpected_manifest_changes');
 gate(resolve(dirname(output))===resolve(directory)&&
  basename(output)===REQUIRED_BASENAME&&
  existsSync(directory)&&lstatSync(directory).isDirectory()&&
  !lstatSync(directory).isSymbolicLink()&&!existsSync(output),
  'output_not_new_or_not_in_original_build');
 const bytes=Buffer.from(JSON.stringify(repaired,null,2)+'\n');
 gate(bytes.byteLength>100&&bytes.byteLength<65536,
  'unsafe_manifest_length');
 // Atomic exclusive creation. Existing candidates are never overwritten.
 writeFileSync(output,bytes,{flag:'wx',mode:0o600});
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  candidate_path:output,manifest_sha256:sha(bytes),
  local_file_created:true,cloudflare_operations:0,
  version_uploaded:false,traffic_changed:false,
  release_authorized:false,
 });
}
function main(){
 gate(process.argv.length===3&&
  process.argv[2]==='--owner-local-only','explicit_local_only_mode_required');
 gate(existsSync(ORIGINAL)&&lstatSync(ORIGINAL).isFile()&&
  !lstatSync(ORIGINAL).isSymbolicLink(),
  'owner_locked_original_missing');
 gate(!existsSync(REPAIRED),'repaired_manifest_already_exists');
 const manifest=JSON.parse(readFileSync(ORIGINAL,'utf8'));
 const artifact=fingerprintLocalContactBuild({candidatePath:ORIGINAL});
 const planned=prepareWorkHqVersionMetadataRepair({manifest,artifact});
 const saved=writeWorkHqVersionMetadataRepair({
  original:manifest,repaired:planned.manifest,
 });
 const newFp=fingerprintLocalContactBuild({candidatePath:REPAIRED});
 gate(newFp.manifest_sha256===saved.manifest_sha256&&
  newFp.bundled_file_count===planned.bundled_file_count&&
  newFp.private_worker_entry_found===true,
  'repaired_artifact_fingerprint_unverified');
 // No new approval is implied by local compilation or a fresh hash.
 console.log(JSON.stringify({
  environment:'WORK',status:'HOLD',
  repaired_manifest_path:saved.candidate_path,
  exact_change:'add version_metadata.binding CF_VERSION_METADATA',
  original_manifest_sha256:planned.original_manifest_sha256,
  new_manifest_sha256:newFp.manifest_sha256,
  new_local_fingerprint_sha256:newFp.fingerprint_sha256,
  bundled_file_count:newFp.bundled_file_count,
  oauth_preserved:true,contact_features_remain_off:true,
  preview_urls_enabled:false,workers_dev_enabled:true,
  source_artifacts_rebuilt:false,
  worker_uploaded:false,traffic_changed:false,
  fresh_upload_approval_required:true,release_authorized:false,
 },null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{main();}
 catch(error){
  console.error('HOLD '+(
   error?.message?.startsWith('work_hq_metadata_repair_')
    ?error.message:'work_hq_metadata_repair_unavailable'));
  process.exitCode=1;
 }
}
