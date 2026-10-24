// WORK HQ visual activation readback. It never deploys or authorizes.
// After separately owner-approved WORK-only traffic promotion, verify the
// EXACT repaired version at 100%, original gateway, restored binding,
// preview exposure OFF, and original local 50-file source pin.
// No customer data, secret values, Cloudflare writes, Shopify or D1 queries.
import {readFileSync,existsSync,lstatSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {fingerprintLocalContactBuild}
 from './attest-work-contact-local-artifact-readonly.mjs';
import {reviewRepairedWorkHqArtifact}
 from './review-work-hq-repaired-artifact-offline.mjs';
import {compareUploadedWorkHqVersion,VERSION_PIN}
 from './inspect-work-hq-uploaded-inactive-readonly.mjs';
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
const ORIGINAL=join(HQ,'dist/server/wrangler.contact-owner-preview-disabled.json');
const REPAIRED=join(HQ,'dist/server/wrangler.contact-owner-version-metadata-restored.json');
export const VISUAL_CANDIDATE='d1f4e07f-8c9b-4b40-97a4-0c13d2c5149a';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const err=why=>{throw Error('work_hq_activated_readback_'+why);};
const check=(yes,why)=>{if(!yes)err(why);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function localArtifact(path){
 check(existsSync(path)&&lstatSync(path).isFile()&&
  !lstatSync(path).isSymbolicLink(),'local_candidate_missing');
 return {manifest:JSON.parse(readFileSync(path,'utf8')),
  artifact:fingerprintLocalContactBuild({candidatePath:path})};
}
async function localPin(readOriginal,readRepaired){
 const original=await readOriginal();
 const corrected=await readRepaired();
 const review=reviewRepairedWorkHqArtifact({
  original:original.manifest,repaired:corrected.manifest,
  originalEvidence:original.artifact,
  repairedEvidence:corrected.artifact,
 });
 check(review.only_change==='add version_metadata.binding CF_VERSION_METADATA',
  'repaired_source_unverified');
 return review;
}
function exactActive(deployment,version){
 const parsed=current100Version(deployment);
 check(parsed.active===version&&parsed.allocation.length>=1&&
  parsed.allocation.every(x=>
   x.id===version&&x.pct===100||x.pct===0),
  'unexpected_active_worker_allocation');
 return parsed;
}
function previewOff(settings){
 check(settings?.hq?.enabled===true&&
  settings.hq.previews_enabled===false&&
  settings.gateway?.enabled===true&&
  settings.gateway.previews_enabled===false,
  'work_preview_settings_changed');
}
export async function inspectActivatedWorkHq({
 readOriginal,readRepaired,readMetadata,readSubdomains,
 candidate=VISUAL_CANDIDATE,
}={}){
 check(candidate===VISUAL_CANDIDATE&&UUID.test(candidate)&&
  typeof readOriginal==='function'&&
  typeof readRepaired==='function'&&
  typeof readMetadata==='function'&&
  typeof readSubdomains==='function',
  'invalid_or_untrusted_reader');
 const sourceFirst=await localPin(readOriginal,readRepaired);
 const hqFirst=exactActive(await readMetadata('hq','deployments'),candidate);
 const gatewayFirst=exactActive(
  await readMetadata('gateway','deployments'),VERSION_PIN.gateway);
 const previewFirst=await readSubdomains();
 previewOff(previewFirst);
 const original=await readMetadata('hq','version',VERSION_PIN.active);
 const promoted=await readMetadata('hq','version',candidate);
 const compared=compareUploadedWorkHqVersion({
  activeView:original,uploadedView:promoted,uploadedVersion:candidate,
 });
 check(compared.uploaded_binding_scope_matches_active===true&&
  promoted?.resources?.bindings?.some(x=>
   x.name==='CF_VERSION_METADATA'&&x.type==='version_metadata'),
  'promoted_binding_not_equal_to_active');
 const sourceFinal=await localPin(readOriginal,readRepaired);
 check(sourceFirst.corrected_artifact_sha256===
  sourceFinal.corrected_artifact_sha256,
  'local_artifact_changed_during_readback');
 const previewFinal=await readSubdomains();
 previewOff(previewFinal);
 check(equal(previewFirst,previewFinal),
  'work_preview_settings_changed_during_readback');
 const hqFinal=exactActive(await readMetadata('hq','deployments'),candidate);
 const gatewayFinal=exactActive(
  await readMetadata('gateway','deployments'),VERSION_PIN.gateway);
 check(equal(hqFirst,hqFinal)&&equal(gatewayFirst,gatewayFinal),
  'deployment_changed_during_readback');
 return Object.freeze({
  environment:'WORK',
  status:'HOLD_OWNER_VISUAL_ACCEPTANCE',
  new_hq_version_at_100_percent:true,
  version:candidate,
  new_hq_deployment_id:hqFinal.deployment,
  gateway_version_preserved:VERSION_PIN.gateway,
  gateway_unchanged:true,
  previous_hq_rollback_version:VERSION_PIN.active,
  all_14_hq_bindings_restored:true,
  ...compared,
  version_urls_off_for_both_work_workers:true,
  local_50_file_fingerprint_verified:true,
  contact_flags_still_off:true,
  no_customer_data_read:true,
  secret_values_read:false,
  real_oauth_login_verified:false,
  shopify_session_functionality_verified:false,
  user_accepted_work_ui:false,
  release_to_live_authorized:false,
  worker_uploaded_by_inspector:false,
  deployment_performed_by_inspector:false,
  traffic_changed_by_inspector:false,
 });
}
async function main(){
 check(process.argv.length===2||
  (process.argv.length===3&&process.argv[2]==='--owner-readonly'),
  'invalid_invocation');
 if(process.argv.length===2){
  console.log(JSON.stringify({
   environment:'WORK',status:'HOLD',
   authenticated_reads:0,traffic_changed:false,
   release_authorized:false,
  },null,2));return;
 }
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
 const result=await inspectActivatedWorkHq({
  readOriginal:()=>localArtifact(ORIGINAL),
  readRepaired:()=>localArtifact(REPAIRED),
  readMetadata:readWorkContactMetadata,readSubdomains,
 });
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(e){
  console.error('HOLD '+(
   e?.message?.startsWith('work_hq_activated_readback_')
   ?e.message:'work_hq_activated_readback_unavailable'));
  process.exitCode=1;
 }
}
