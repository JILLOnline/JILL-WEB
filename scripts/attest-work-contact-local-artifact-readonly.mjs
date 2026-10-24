// LOCAL WORK Contact release evidence only. No version upload, traffic,
// secrets read, form submission, D1 write or Shopify interaction.
// Recomputes the owner-pinned WORK HQ/gateway metadata parity, verifies the
// exact local manifest produced by our reconciler, hashes build bytes, HOLD.
import {createHash} from 'node:crypto';
import {existsSync,lstatSync,readFileSync,readdirSync} from 'node:fs';
import {join,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {planOwnerLocalContactCandidate}
 from './prepare-work-contact-owner-local-candidate.mjs';
import {readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const BUILD=join(APP,'dist/server');
const CLIENT=join(APP,'dist/client');
const SOURCE=join(BUILD,'wrangler.json');
const CANDIDATE=join(BUILD,'wrangler.contact-owner-local-only.json');
const GATEWAY=join(ROOT,'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml');
const stop=reason=>{throw Error('work_contact_artifact_attestation_'+reason);};
const gate=(ok,reason)=>{if(!ok)stop(reason);};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function attestWorkContactLocalManifest({compiled,candidate,
 gatewayCandidate,readMetadata}={}){
 gate(typeof compiled==='object'&&compiled!==null&&
  typeof candidate==='object'&&candidate!==null&&
  typeof gatewayCandidate==='string'&&
  typeof readMetadata==='function','invalid_attestation_inputs');
 const {report,manifest}=await planOwnerLocalContactCandidate({
  compiledHq:compiled,gatewayCandidate,readMetadata,
 });
 gate(isDeepStrictEqual(candidate,manifest),'candidate_not_equal_to_active');
 gate(report.hq_reconciliation?.candidate_plaintext_parity_after_reconcile===true&&
  report.gateway?.gateway_secret_name_contract_matches_active===true&&
  report.active_versions_verified===true,'active_parity_not_verified');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  local_manifest_matches_active_reconciled_candidate:true,
  active_hq_version:report.hq_active_version,
  active_gateway_version:report.gateway_active_version,
  existing_hq_flag_count:
   report.hq_reconciliation.existing_flag_names_preserved.length,
  required_hq_secret_name_count:
   report.hq_reconciliation.required_existing_secret_names.length,
  gateway_secret_names_match_active:true,
  secret_values_read:false,
  upload_authorized:false,traffic_changed:false,
 });
}

function filesUnder(directory,limit){
 gate(existsSync(directory)&&lstatSync(directory).isDirectory()&&
  !lstatSync(directory).isSymbolicLink(),'build_directory_missing');
 const result=[];
 const walk=dir=>{
  for(const name of readdirSync(dir).sort()){
   const file=join(dir,name);
   const meta=lstatSync(file);
   gate(!meta.isSymbolicLink(),'symlink_in_build');
   if(meta.isDirectory()){walk(file);continue;}
   gate(meta.isFile()&&meta.size<12*1024*1024,'invalid_build_file');
   result.push(file);
   gate(result.length<=limit,'too_many_build_files');
  }
 };
 walk(directory);
 return result;
}
export function fingerprintLocalContactBuild({server=BUILD,
 client=CLIENT,candidatePath=CANDIDATE}={}){
 const entry=join(server,'index.js');
 const assets=join(server,'assets');
 gate([entry,candidatePath].every(existsSync),'local_build_missing');
 gate(!lstatSync(candidatePath).isSymbolicLink(),'candidate_symlink');
 gate(lstatSync(candidatePath).size>100&&
  lstatSync(candidatePath).size<65536,'invalid_manifest_size');
 const worker=filesUnder(assets,75).filter(file=>
  /^worker-entry-.*\.js$/.test(file.split(sep).at(-1)));
 gate(worker.length===1,'private_worker_entry_ambiguous');
 const serverFiles=[entry,...filesUnder(assets,75)];
 const clientFiles=filesUnder(client,150);
 gate(clientFiles.length>=1&&serverFiles.length>=3,
  'incomplete_build');
 // Include only the exact compiled files, client assets and the candidate.
 // Do not fingerprint .env, .dev.vars, sourcemaps outside the build, or
 // unrelated temporary files. The digest proves local bytes, NOT cloud state.
 const files=[...serverFiles,...clientFiles,candidatePath];
 const digest=createHash('sha256');
 for(const file of files){
  const label=relative(resolve(server,'../..'),file)
   .split(sep).join('/');
  gate(!label.startsWith('../'),'artifact_outside_build');
  digest.update(label+'\u0000');
  digest.update(readFileSync(file));
  digest.update('\u0000');
 }
 return Object.freeze({
  fingerprint_sha256:digest.digest('hex'),
  manifest_sha256:sha(readFileSync(candidatePath)),
  bundled_file_count:files.length,
  private_worker_entry_found:true,
  status:'HOLD',deployment_performed:false,
 });
}
async function main(){
 gate(process.argv.length===3&&process.argv[2]==='--owner-readonly',
  'explicit_owner_readonly_required');
 for(const file of [SOURCE,CANDIDATE,GATEWAY]){
  gate(existsSync(file)&&lstatSync(file).isFile()&&
   !lstatSync(file).isSymbolicLink(),'candidate_file_missing');
 }
 const compiled=JSON.parse(readFileSync(SOURCE,'utf8'));
 const candidate=JSON.parse(readFileSync(CANDIDATE,'utf8'));
 const gatewayCandidate=readFileSync(GATEWAY,'utf8');
 const attestation=await attestWorkContactLocalManifest({
  compiled,candidate,gatewayCandidate,
  readMetadata:readWorkContactMetadata,
 });
 const fingerprint=fingerprintLocalContactBuild();
 console.log(JSON.stringify({
  ...attestation,...fingerprint,
  evidence_scope:'local bytes plus current pinned read-only bindings',
  published_source_provenance_verified:false,
  uploaded_worker_secret_continuity_verified:false,
  release_authorized:false,
 },null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  console.error('HOLD '+(e?.message?.startsWith('work_contact_artifact_attestation_')
   ?e.message:'work_contact_artifact_attestation_unavailable'));
  process.exitCode=1;
 }
}
