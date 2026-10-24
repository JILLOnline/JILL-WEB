// WORK-only local preview from owner-authenticated READ-ONLY Cloudflare
// version metadata. Writes only ONE disposable, gitignored 0600 build manifest.
// No upload, deployment, traffic mutation, database write, secret values, or
// actual Contact flag enablement. Still HOLD until separate approval.
import {readFileSync,writeFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve,basename,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectContactPairedBaseline,readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
import {reconcileActiveHqContactManifest}
 from './plan-work-contact-binding-parity.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const BUILD=join(ROOT,'services/jill-order-desk/app-home/dist/server');
const COMPILED=join(BUILD,'wrangler.json');
const OUTPUT=join(BUILD,'wrangler.contact-owner-local-only.json');
const GATEWAY=join(ROOT,'services/custom-order-cloudflare/wrangler.contact-bridge.candidate.toml');
const stop=reason=>{throw Error('work_contact_local_candidate_'+reason);};
const check=(value,reason)=>{if(!value)stop(reason);};

// A pure/injected mode used by CI. It does NOT mutate any input. The
// inspector validates both deployed versions, before/after allocations,
// active tenant, WORK D1, login, quota/secret binding types and Contact OFF.
export async function planOwnerLocalContactCandidate({
 compiledHq,gatewayCandidate,readMetadata,
}={}){
 check(typeof readMetadata==='function','read_only_metadata_required');
 let hqVersionView=null;
 const wrapped=async(which,mode,id)=>{
  const result=await readMetadata(which,mode,id);
  if(which==='hq'&&mode==='version')hqVersionView=result;
  return result;
 };
 const report=await inspectContactPairedBaseline({
  compiledHq,gatewayCandidate,readMetadata:wrapped,
 });
 check(report.active_versions_verified===true&&
  report.status==='HOLD'&&
  report.hq?.unsupported_active_binding_names?.length===0&&
  report.hq_reconciliation?.candidate_plaintext_parity_after_reconcile===true&&
  report.gateway?.gateway_secret_name_contract_matches_active===true,
  'owner_baseline_not_certified');
 const result=reconcileActiveHqContactManifest({
  activeView:hqVersionView,compiled:compiledHq,
 });
 check(result.status==='HOLD'&&
  result.upload_or_deployment_authorized===false&&
  result.manifest.name==='jill-order-desk-canary-work'&&
  result.manifest.vars.JILL_WORK_OAUTH_ENABLED==='true'&&
  result.manifest.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false'&&
  !result.manifest.services?.length,
  'candidate_not_fail_closed');
 return {report,manifest:result.manifest};
}

export function writeOwnerLocalManifest(manifest,{
 output=OUTPUT,buildDir=BUILD,
}={}){
 check(typeof manifest==='object'&&manifest!==null&&
  !Array.isArray(manifest)&&
  manifest.name==='jill-order-desk-canary-work'&&
  manifest.vars?.JILL_WORK_OAUTH_ENABLED==='true'&&
  manifest.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false'&&
  manifest.d1_databases?.length===1&&
  manifest.d1_databases[0]?.database_id===
   '3f17c186-c794-4e00-8f20-017191373a19'&&
  Array.isArray(manifest.secrets?.required)&&
  manifest.secrets.required.includes('SHOPIFY_API_SECRET')&&
  manifest.secrets.required.includes('JILL_WORK_SESSION_KEY_B64'),
  'local_manifest_unverified');
 check(resolve(dirname(output))===resolve(buildDir)&&
  !lstatSync(buildDir).isSymbolicLink()&&
  !existsSync(output),'unsafe_or_existing_local_output');
 writeFileSync(output,JSON.stringify(manifest,null,2)+'\n',{
  encoding:'utf8',flag:'wx',mode:0o600,
 });
 return {environment:'WORK',status:'HOLD',
  artifact_written_locally:true,output_basename:basename(output),
  secret_values_in_artifact:false,
  upload_or_deployment_authorized:false};
}
async function main(){
 check(process.argv.length===3&&
  process.argv[2]==='--owner-local-only','unsupported_mode');
 check(existsSync(COMPILED)&&existsSync(GATEWAY),'canary_build_missing');
 // Output is inside the ignored WORK server build; never write to repo root.
 const compiledHq=JSON.parse(readFileSync(COMPILED,'utf8'));
 const gatewayCandidate=readFileSync(GATEWAY,'utf8');
 const {report,manifest}=await planOwnerLocalContactCandidate({
  compiledHq,gatewayCandidate,readMetadata:readWorkContactMetadata,
 });
 const saved=writeOwnerLocalManifest(manifest);
 console.log(JSON.stringify({
  environment:'WORK',status:'HOLD',
  active_versions_verified:report.active_versions_verified,
  hq_existing_flags_preserved:
   report.hq_reconciliation.existing_flag_names_preserved,
  existing_hq_secret_names_checked:
   report.hq_reconciliation.required_existing_secret_names.length,
  gateway_secret_contract_matches_active:
   report.gateway.gateway_secret_name_contract_matches_active,
  ...saved,
  build_only:true,deployed:false,traffic_changed:false,
  customer_features_enabled:false,
 },null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===
 fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  console.error('HOLD '+(e?.message?.startsWith('work_contact_local_candidate_')
   ?e.message:'work_contact_local_candidate_unavailable'));
  process.exitCode=1;
 }
}
