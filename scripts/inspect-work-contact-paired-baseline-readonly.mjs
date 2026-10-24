// Owner-authenticated, READ-ONLY WORK deployment baseline vs paired
// Contact candidate. Names/boolean readiness only; never secrets,
// private tickets, Shopify sessions, uploads, deploys, migrations or writes.
// Without --owner-readonly this is an offline source check only.
import {spawnSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {current100Version,verifyWorkActiveBindings}
 from './inspect-work-contact-runtime-readonly.mjs';
import {compareHqWorkContactCandidate,compareGatewayWorkContactCandidate,
 reconcileActiveHqContactManifest}
 from './plan-work-contact-binding-parity.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const HQ=join(ROOT,'services/jill-order-desk/app-home');
const GW=join(ROOT,'services/custom-order-cloudflare');
const WRANGLER=join(HQ,'node_modules/wrangler/bin/wrangler.js');
const EXPECTED=Object.freeze({
 hq:'44ad4a81-55ad-4f49-9965-61260cc2294d',
 gateway:'9322193f-5e87-4479-88c9-39229dddb5f2',
});
const T=Object.freeze({
 hq:{name:'jill-order-desk-canary-work',
  cwd:HQ,config:'./wrangler.canary.jsonc'},
 gateway:{name:'jill-work-custom-orders-qa',
  cwd:GW,config:'./wrangler.toml'},
});
const STOP=reason=>{throw Error('contact_paired_baseline_'+reason);};
const check=(ok,reason)=>{if(!ok)STOP(reason);};
export const readWorkContactMetadata=(which,mode,id)=>{
 check(Object.hasOwn(T,which),'unapproved_worker');
 check(mode==='deployments'||mode==='version','unapproved_operation');
 check(existsSync(WRANGLER),'missing_local_wrangler');
 const t=T[which];
 const args=mode==='deployments'
  ?['deployments','list','--name',t.name,'--config',t.config,'--json']
  :['versions','view',id,'--name',t.name,'--config',t.config,'--json'];
 const result=spawnSync(process.execPath,[WRANGLER,...args],{
  cwd:t.cwd,encoding:'utf8',windowsHide:true,shell:false,
  timeout:45000,maxBuffer:5*1024*1024,
  stdio:['ignore','pipe','pipe'],
  env:{...process.env,WRANGLER_SEND_METRICS:'false'},
 });
 check(!result.error&&!result.signal&&result.status===0,
  'cloudflare_read_unavailable');
 try{return JSON.parse(result.stdout);}
 catch{STOP('invalid_cloudflare_json');}
};
export async function inspectContactPairedBaseline({readMetadata,
 compiledHq,gatewayCandidate,expected=EXPECTED}={}){
 check(typeof readMetadata==='function','missing_metadata_reader');
 const report={environment:'WORK',status:'HOLD',
  deployment_performed:false,uploaded_candidate:false,
  traffic_changed:false,secret_values_read:false,
  active_versions_verified:false,release_authorized:false};
 for(const which of ['hq','gateway']){
  const before=current100Version(await readMetadata(which,'deployments'));
  check(before.active===expected[which],
   which+'_version_changed_since_owner_attestation');
  const view=await readMetadata(which,'version',before.active);
  const after=current100Version(await readMetadata(which,'deployments'));
  check(JSON.stringify(before)===JSON.stringify(after),
   which+'_allocation_changed');
  verifyWorkActiveBindings(which,before,view);
  report[which]=which==='hq'
   ?compareHqWorkContactCandidate({activeView:view,compiled:compiledHq})
   :compareGatewayWorkContactCandidate({
     activeView:view,candidateManifestText:gatewayCandidate,
    });
  // In-memory only. Never print plaintext values or write a candidate.
  // The original baseline parity report stays visible for transparency.
  if(which==='hq'){
   const reconciled=reconcileActiveHqContactManifest({
    activeView:view,compiled:compiledHq,
   });
   report.hq_reconciliation={
    existing_flag_names_preserved:reconciled.restored_existing_flag_names,
    required_existing_secret_names:reconciled.required_existing_secret_names,
    candidate_plaintext_parity_after_reconcile:true,
    manifest_written:false,secret_values_read:false,
    upload_or_deployment_authorized:false,
   };
  }
  report[which+'_active_version']=before.active;
 }
 report.active_versions_verified=true;
 return report;
}
async function main(){
 check(process.argv.length===2||
  (process.argv.length===3&&process.argv[2]==='--owner-readonly'),
  'invalid_mode');
 const compiledHq=JSON.parse(readFileSync(
  join(HQ,'wrangler.canary.jsonc'),'utf8'));
 const gatewayCandidate=readFileSync(join(GW,
  'wrangler.contact-bridge.candidate.toml'),'utf8');
 if(process.argv.length===2){
  // No Wrangler calls in offline mode. No readiness claim.
  console.log(JSON.stringify({environment:'WORK',status:'HOLD',
   source_candidate:'available',active_versions_verified:false,
   active_binding_parity:'unverified',metadata_reads:0,
   deploy_performed:false},null,2));
  return;
 }
 const report=await inspectContactPairedBaseline({
  compiledHq,gatewayCandidate,
  readMetadata:async(which,mode,id)=>readWorkContactMetadata(which,mode,id),
 });
 console.log(JSON.stringify(report,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await main();}
 catch(error){
  console.error('HOLD '+(error?.message?.startsWith('contact_paired_baseline_')
   ?error.message:'contact_paired_baseline_unavailable'));
  process.exitCode=1;
 }
}
