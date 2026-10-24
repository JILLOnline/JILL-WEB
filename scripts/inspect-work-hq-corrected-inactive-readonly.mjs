// JILL WORK HQ second inactive-upload version postflight.
// Independent authenticated READ ONLY; a PASS in metadata still reports HOLD.
// No Cloudflare versions upload, deploy, D1, Shopify or secret reads.
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {reviewRepairedWorkHqArtifact}
 from './review-work-hq-repaired-artifact-offline.mjs';
import {reviewCombinedWorkContactEvidence}
 from './review-work-contact-combined-evidence-readonly.mjs';
import {compareUploadedWorkHqVersion,VERSION_PIN}
 from './inspect-work-hq-uploaded-inactive-readonly.mjs';
import {current100Version}
 from './inspect-work-contact-runtime-readonly.mjs';
import {readWorkContactMetadata}
 from './inspect-work-contact-paired-baseline-readonly.mjs';
import {
 readExactCloudflarePreviewSettings,resolveExactWorkAccount,
 tokenFromWrangler,wranglerJson,
} from './inspect-work-contact-preview-exposure-readonly.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HQ=join(ROOT,'services/jill-order-desk/app-home');
const GW=join(ROOT,'services/custom-order-cloudflare');
const ORIGINAL=join(HQ,
 'dist/server/wrangler.contact-owner-preview-disabled.json');
const FIXED=join(HQ,
 'dist/server/wrangler.contact-owner-version-metadata-restored.json');
const stop=why=>{throw Error('work_hq_corrected_postflight_'+why);};
const gate=(ok,why)=>{if(!ok)stop(why);};
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const readLocalArtifact=(candidatePath)=>{
 gate(existsSync(candidatePath)&&lstatSync(candidatePath).isFile()&&
  !lstatSync(candidatePath).isSymbolicLink(),'local_candidate_missing');
 return {manifest:JSON.parse(readFileSync(candidatePath,'utf8')),
  artifact:fingerprintLocalContactBuild({candidatePath})};
};
const snapshot=(data,which,newVersion)=>{
 const pinnedVersion=which==='hq'?VERSION_PIN.active:VERSION_PIN.gateway;
 const pinnedDeploy=which==='hq'?VERSION_PIN.deployment:
  VERSION_PIN.gatewayDeployment;
 const now=current100Version(data);
 gate(now.active===pinnedVersion&&now.deployment===pinnedDeploy&&
  !now.allocation.some(x=>x.id===newVersion),
  'deployed_version_or_traffic_changed_'+which);
 return now;
};

export async function inspectRepairedVersionInactive({
 newVersion,readOriginal,readRepaired,
 readMetadata,readSubdomains,compiledHq,gatewayCandidate,
}={}){
 gate(typeof newVersion==='string'&&UUID.test(newVersion)&&
  ![VERSION_PIN.active,VERSION_PIN.gateway,
    VERSION_PIN.uploaded].includes(newVersion),
  'new_uploaded_version_id_invalid_or_previously_rejected');
 gate(typeof readOriginal==='function'&&
  typeof readRepaired==='function'&&
  typeof readMetadata==='function'&&
  typeof readSubdomains==='function',
  'required_read_only_sources_missing');

 const first=await readRepaired();
 const original=await readOriginal();
 const artifact=reviewRepairedWorkHqArtifact({
  original:original.manifest,repaired:first.manifest,
  originalEvidence:original.artifact,
  repairedEvidence:first.artifact,
 });
 gate(artifact.only_change==='add version_metadata.binding CF_VERSION_METADATA',
  'corrected_artifact_not_attested');
 const baseline=await reviewCombinedWorkContactEvidence({
  readLocal:readOriginal,readMetadata,readSubdomains,
  compiledHq,gatewayCandidate,
 });
 gate(baseline.local_artifact_matches_owner_pin===true&&
  baseline.hq_version_urls_enabled===false&&
  baseline.gateway_version_urls_enabled===false&&
  baseline.normal_traffic_observed_unchanged===true,
  'active_work_protection_unverified');
 const beforeHq=snapshot(await readMetadata('hq','deployments'),
  'hq',newVersion);
 const beforeGateway=snapshot(await readMetadata('gateway','deployments'),
  'gateway',newVersion);
 const activeView=await readMetadata('hq','version',VERSION_PIN.active);
 const uploadedView=await readMetadata('hq','version',newVersion);
 const compare=compareUploadedWorkHqVersion({
  activeView,uploadedView,uploadedVersion:newVersion,
 });
 gate(compare.uploaded_binding_scope_matches_active===true,
  'uploaded_version_binding_mismatch');
 const versionBinding=uploadedView?.resources?.bindings?.filter(x=>
  x.name==='CF_VERSION_METADATA')??[];
 gate(versionBinding.length===1&&
  versionBinding[0].type==='version_metadata',
  'version_metadata_not_restored');
 const finalLocal=await readRepaired();
 const after=reviewRepairedWorkHqArtifact({
  original:original.manifest,repaired:finalLocal.manifest,
  originalEvidence:original.artifact,
  repairedEvidence:finalLocal.artifact,
 });
 gate(after.corrected_artifact_sha256===
  artifact.corrected_artifact_sha256,
  'repaired_candidate_changed_during_inspection');
 const afterHq=snapshot(await readMetadata('hq','deployments'),
  'hq',newVersion);
 const afterGateway=snapshot(await readMetadata('gateway','deployments'),
  'gateway',newVersion);
 gate(equal(beforeHq,afterHq)&&equal(beforeGateway,afterGateway),
  'traffic_changed_during_postflight');
 return Object.freeze({
  environment:'WORK',status:'HOLD',
  owner_uploaded_version:newVersion,
  active_hq_version:VERSION_PIN.active,
  active_gateway_version:VERSION_PIN.gateway,
  ...compare,
  expected_fourteenth_binding_present:true,
  uploaded_version_confirmed_outside_traffic_allocation:true,
  both_work_version_urls_disabled:true,
  restored_artifact_digest_verified:true,
  local_artifact_unchanged_during_inspection:true,
  active_deployment_unchanged:true,
  secret_values_read:false,customer_data_read:false,
  source_provenance_verified:false,
  true_secret_value_continuity_verified:false,
  actual_owner_login_verified:false,
  free_tier_account_usage_verified:false,
  version_uploaded_by_inspector:false,traffic_changed:false,
  deployment_performed:false,
  authorization_to_promote:false,
 });
}
async function main(){
 gate(process.argv.length===2||
  process.argv.length===4&&
  process.argv[2]==='--owner-readonly'&&UUID.test(process.argv[3]),
 'invalid_invocation');
 if(process.argv.length===2){
  console.log(JSON.stringify({
   environment:'WORK',status:'HOLD',cloudflare_reads:0,
   corrected_version_checked:false,authorized_to_promote:false,
  },null,2));return;
 }
 const compiledHq=JSON.parse(readFileSync(
  join(HQ,'wrangler.canary.jsonc'),'utf8'));
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
 const report=await inspectRepairedVersionInactive({
  newVersion:process.argv[3],
  readOriginal:()=>readLocalArtifact(ORIGINAL),
  readRepaired:()=>readLocalArtifact(FIXED),
  readMetadata:readWorkContactMetadata,
  readSubdomains,compiledHq,gatewayCandidate,
 });
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(err){
  console.error('HOLD '+(
   err?.message?.startsWith('work_hq_corrected_postflight_')
   ?err.message:'work_hq_corrected_postflight_unavailable'));
  process.exitCode=1;
 }
}
