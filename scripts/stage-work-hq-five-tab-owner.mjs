// WORK FIVE-TAB: fresh Owner-authenticated, ONE-USE INACTIVE upload ONLY.
// Never invokes versions deploy, Shopify write, D1 migration, R2, LIVE/KEEP,
// quote publication, customer conversation, invoice, payment or paid upgrade.
// A reserved local private receipt is spent even if Wrangler times out.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {certifyM1M2SourceEdition} from './certify-work-hq-m1-m2-source-edition.mjs';
import {planWorkFiveTabLocalDryRun} from './plan-work-hq-five-tab-inactive-dry-run.mjs';
import {inspectM1M2WorkRuntime} from './inspect-work-hq-m1-m2-owner.mjs';
import {readConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
import {receiptPath} from './probe-work-gateway-connection-owner.mjs';
import {read,view,allocation,cloud,bundleDigest} from './stage-work-hq-connected-read-owner.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BRANCH='jill/m1-work-queue-preview-20261021';
export const BASELINE=Object.freeze({
 deployment:'0f2704bb-f8e6-4f61-a55f-947065ef8546',
 active:'cd233caa-0128-4b22-bf68-002caf2ecf65',
 quote:'dbc6341f-de7f-41de-8e97-6bf971201eeb',
});
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const WORKER='jill-order-desk-canary-work';
const MESSAGE='JILL HQ WORK FIVE-TAB source-locked INACTIVE ';
const fail=code=>{throw Error('five_tab_stage_'+code);};
const gate=(yes,code)=>{if(!yes)fail(code);};
const equal=(a,b)=>isDeepStrictEqual(a,b);
export function assertBaseline(state){
 gate(state?.deployment===BASELINE.deployment&&
  state.versions?.length===2&&
  state.versions.some(v=>v.id===BASELINE.active&&v.percentage===100)&&
  state.versions.some(v=>v.id===BASELINE.quote&&v.percentage===0),
 'allocation_changed');
 return true;
}
export function selectStageCandidate(result,marker){
 const list=Array.isArray(result)?result:
   Array.isArray(result?.versions)?result.versions:
   Array.isArray(result?.result?.versions)?result.result.versions:
   Array.isArray(result?.result)?result.result:null;
 gate(Array.isArray(list),'versions_list_unavailable');
 const matches=list.filter(v=>v?.annotations?.['workers/message']===marker);
 gate(matches.length<=1,'ambiguous_candidate_identity');
 if(matches.length===0)return null; // Pagination never proves absence.
 gate(UUID.test(matches[0]?.id||''),'invalid_candidate_identity');
 return matches[0].id;
}
export function assertCandidate({active,quote,candidate,marker,planned,baseline}){
 assertBaseline(baseline);
 gate(UUID.test(candidate?.id||'')&&
  ![BASELINE.active,BASELINE.quote].includes(candidate.id)&&
  candidate?.annotations?.['workers/message']===marker,
 'candidate_identity_unverified');
 gate(active?.id===BASELINE.active&&quote?.id===BASELINE.quote,
 'old_version_identity_changed');
 const a=active.resources?.bindings,c=candidate.resources?.bindings;
 gate(Array.isArray(a)&&Array.isArray(c)&&a.length===c.length&&
   new Set(a.map(x=>x.name)).size===a.length&&
   new Set(c.map(x=>x.name)).size===c.length,
  'candidate_binding_count_changed');
 const old=new Map(a.map(v=>[v.name,v]));
 const next=new Map(c.map(v=>[v.name,v]));
 for(const [name,binding] of old)
  gate(equal(binding,next.get(name)),'candidate_binding_changed');
 gate(planned?.state==='LOCAL_DRY_RUN_MANIFEST_PREPARED'&&
  planned.manifest.name===WORKER&&planned.upload_authorized===false&&
  planned.deploy_authorized===false,'stage_policy_missing');
 for(const [name,value] of Object.entries(planned.manifest.vars))
  gate(next.get(name)?.type==='plain_text'&&
   next.get(name)?.text===value,'candidate_stage_flag_changed');
 const prior=active.resources,release=candidate.resources;
 gate(typeof prior?.script?.etag==='string'&&
   typeof release?.script?.etag==='string'&&
   prior.script.etag!==release.script.etag&&
   equal(prior.script.handlers,release.script.handlers),
  'candidate_code_or_handlers_unverified');
 const runtime=x=>{
  gate(x&&typeof x==='object','runtime_metadata_unavailable');
  const copy={...x};delete copy.assets;return copy;
 };
 gate(equal(runtime(prior.script_runtime),
            runtime(release.script_runtime)),'candidate_runtime_changed');
 const aAsset=prior.script_runtime.assets;
 const cAsset=release.script_runtime.assets;
 gate(Boolean(aAsset)===Boolean(cAsset),'candidate_assets_changed');
 if(aAsset)for(const [key,defaultValue] of [
  ['html_handling','auto-trailing-slash'],
  ['not_found_handling','none'],['run_worker_first',undefined]])
  gate(equal(aAsset[key]??defaultValue,cAsset[key]??defaultValue),
    'candidate_asset_route_changed');
 return Object.freeze({candidate_id:candidate.id,
  code_changed:true,bindings_preserved:true,runtime_preserved:true,
  resources_added:false,traffic_allocation_unchanged:true});
}
function git(...args){
 return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']
 }).trim();
}
function sourceGuard(){
 gate(process.platform==='win32','owner_windows_required');
 const root=fs.realpathSync(ROOT).toLowerCase();
 const temp=fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep;
 gate(root.startsWith(temp)&&
   path.basename(root).startsWith('jill_m1_m2_qa_'),
  'isolated_temp_checkout_required');
 gate(git('branch','--show-current')===BRANCH&&
  git('status','--porcelain','--untracked-files=no')===''&&
  git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/'+BRANCH),
  'clean_pinned_git_checkout_required');
 gate(certifyM1M2SourceEdition().ok===true,'source_certificate_unverified');
 gate(fs.existsSync(path.join(APP,'node_modules/wrangler/bin/wrangler.js')),
  'local_wrangler_unavailable');
 return git('rev-parse','HEAD');
}
function receiptLocation(source){
 gate(/^[0-9a-f]{40}$/.test(source),'source_sha_unverified');
 return path.join(path.dirname(receiptPath()),
  'work-hq-five-tab-inactive-upload-once-'+source+'.json');
}
function readReceipt(file){
 if(!fs.existsSync(file))return null;
 gate(!fs.lstatSync(file).isSymbolicLink(),'receipt_symlink_denied');
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 gate(data.operation==='HQ_FIVE_TAB_WORK_INACTIVE_UPLOAD'&&
  data.retry_allowed===false&&
  data.baseline?.deployment===BASELINE.deployment&&
  /^[0-9a-f]{40}$/.test(data.source||'')&&
  UUID.test(data.nonce||'')&&
  /^[a-f0-9]{64}$/.test(data.package_sha256||''),
 'receipt_unverified');
 return data;
}
function reserveOnce(file,data){
 const fd=fs.openSync(file,'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify({...data,retry_allowed:false})+'\n');
  fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function runNode(args,cwd=ROOT){
 const result=spawnSync(process.execPath,args,{
  cwd,stdio:'inherit',shell:false,windowsHide:true,timeout:180000,
  env:{...process.env,WRANGLER_SEND_METRICS:'false',
   CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'}});
 gate(!result.error&&!result.signal&&result.status===0,'local_test_failed');
}
function runNpm(name,canary=false){
 const result=spawnSync(process.env.ComSpec||'cmd.exe',
  ['/d','/s','/c','npm.cmd run '+name],{
  cwd:APP,stdio:'inherit',shell:false,windowsHide:true,timeout:180000,
  env:{...process.env,WRANGLER_SEND_METRICS:'false',
   CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',
   ...(canary?{JILL_BUILD_TARGET:'canary'}:{})}});
 gate(!result.error&&!result.signal&&result.status===0,'local_build_failed');
}
async function inventory(){
 const report=await inspectM1M2WorkRuntime({
  readMetadata:args=>read(args),readHealth:readConnectedHealth});
 gate(report.status==='READ_ONLY_RUNTIME_VERIFIED'&&
  report.observed_deployment===BASELINE.deployment&&
  report.active_version===BASELINE.active&&
  report.quote_canary===BASELINE.quote&&
  report.direct_active_version_verified===true&&
  report.direct_quote_version_verified===true&&
  report.bindings_verified===true&&report.health_verified===true,
  'fresh_provider_baseline_unverified');
 const baseline=allocation();assertBaseline(baseline);
 const active=view(BASELINE.active),quote=view(BASELINE.quote);
 return {baseline,active,quote};
}
// Read-only diagnostic surface: finite classification and shape booleans
// ONLY. Never serialize provider bindings, Shopify/customer data, config,
 // secret text, or upload receipts. It cannot authorize a release.
// The provider inventory intentionally calls the allocation "baseline".
 // Adapt it ONCE here for BOTH the diagnostic and real stage path, so they
 // can never disagree about the same validated snapshot.
export function planM1M2StageManifest({baseline,active,quote}={},compiled){
 return planWorkFiveTabLocalDryRun({
  compiled,active,quote,allocation:baseline});
}
export function explainWorkM1M2Plan({compiled,active,quote,baseline}={}){
 const planned=planM1M2StageManifest({baseline,active,quote},compiled);
 const code=planned.state==='LOCAL_DRY_RUN_MANIFEST_PREPARED'?
  'local_manifest_prepared':planned.reason;
 const safe=new Set([
  'local_manifest_prepared','live_allocation_changed',
  'version_source_unverified','ambiguous_live_bindings',
  'quote_canary_bindings_unverified','quote_canary_identity_changed',
  'correct_canary_compiled_manifest_required',
  'unapproved_compiled_resource','existing_d1_changed',
  'live_secret_presence_unverified','version_identity_binding_missing',
  'unsafe_live_binding_name','unsafe_plaintext_binding',
  'unreviewed_secret_binding','unreviewed_d1_binding',
  'unreviewed_runtime_binding','unreviewed_active_resource_type',
  'required_live_stage_flag_changed','unsafe_optional_feature_enabled',
  'secret_as_plaintext'
 ]);
 return Object.freeze({
  status:planned.state==='LOCAL_DRY_RUN_MANIFEST_PREPARED'?
   'READ_ONLY_LOCAL_MANIFEST_PREPARED':'HOLD',
  reason:safe.has(code)?code:'unverified_manifest_policy',
  source:'authenticated_WORK_metadata_and_local_build',
  shape:{
   active_id_matches:active?.id===BASELINE.active,
   quote_id_matches:quote?.id===BASELINE.quote,
   active_handlers_array:Array.isArray(active?.resources?.script?.handlers),
   quote_handlers_array:Array.isArray(quote?.resources?.script?.handlers),
   active_bindings_array:Array.isArray(active?.resources?.bindings),
   quote_bindings_array:Array.isArray(quote?.resources?.bindings),
   active_version_metadata_present:
    active?.resources?.bindings?.some(x=>x.name==='CF_VERSION_METADATA'&&
      x.type==='version_metadata')===true,
   active_binding_count:Array.isArray(active?.resources?.bindings)?
      active.resources.bindings.length:null,
   quote_binding_count:Array.isArray(quote?.resources?.bindings)?
      quote.resources.bindings.length:null,
  },
  upload_requested:false,traffic_changed:false,
  deployment_requested:false,new_paid_resources:false,
 });
}
function compileManifest(inputs){
 const dist=path.join(APP,'dist');
 gate(fs.existsSync(dist)&&!fs.lstatSync(dist).isSymbolicLink(),
  'safe_compiled_directory_missing');
 const location=path.join(dist,'server','wrangler.json');
 gate(fs.existsSync(location)&&!fs.lstatSync(location).isSymbolicLink(),
  'compiled_canary_manifest_missing');
 const compiled=JSON.parse(fs.readFileSync(location,'utf8'));
 const planned=planM1M2StageManifest(inputs,compiled);
 if(planned.state!=='LOCAL_DRY_RUN_MANIFEST_PREPARED'){
  console.error('HOLD LOCAL_MANIFEST_REASON '+
    explainWorkM1M2Plan({...inputs,compiled,
      baseline:inputs.baseline}).reason);
 }
 gate(planned.state==='LOCAL_DRY_RUN_MANIFEST_PREPARED',
  'compiled_release_manifest_denied');
 // keep-vars is an explicit Wrangler CLI switch; remove from uploaded JSON.
 const upload=structuredClone(planned.manifest);
 delete upload.keep_vars;
 const target=path.join(dist,'server','wrangler.hq-five-tab-inactive.json');
 fs.writeFileSync(target,JSON.stringify(upload,null,2)+'\n',{
  encoding:'utf8',flag:'wx',mode:0o600});
 return {planned,package_sha256:bundleDigest(dist),
  config:'./dist/server/wrangler.hq-m1m2-inactive.json'};
}
function uploadArgs(config,marker){
 return ['versions','upload','--config',config,
  '--keep-vars','--message',marker];
}
export async function runOwnerStage(mode){
 let phase='source',reserved=false;
 try{
  const source=sourceGuard(),receipt=receiptLocation(source);
  const prior=readReceipt(receipt);
  if(mode==='--stage-once')gate(prior===null,'one_use_receipt_already_spent');
  phase='provider_preflight';
  const before=await inventory();
  if(mode==='--diagnose'){
   gate(prior===null,'diagnosis_requires_no_upload_receipt');
   // Existing local canary build is read-only and was just typechecked/built
   // by the prior failed staging attempt. No new compilation or cloud writes.
   const file=path.join(APP,'dist/server/wrangler.json');
   gate(fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink(),
    'compiled_canary_manifest_missing');
   const compiled=JSON.parse(fs.readFileSync(file,'utf8'));
   const diagnosis=explainWorkM1M2Plan({...before,compiled});
   gate(equal(before.baseline,allocation()),
    'allocation_changed_during_diagnosis');
   console.log(JSON.stringify({environment:'WORK',source,
    ...diagnosis,receipt_present:false},null,2));
   if(diagnosis.status==='HOLD')process.exitCode=1;
   return;
  }
  if(mode==='--inspect'){
   const marker=prior?MESSAGE+source+' '+prior.nonce:null;
   const candidateId=marker?
    selectStageCandidate(read(['versions','list']),marker):null;
   let check=null;
   if(candidateId){
    // Inspector must not assume local compiled files are still available.
    // Compare original bindings and runtime directly; never alter traffic.
    const candidate=view(candidateId);
    const b=new Map(before.active.resources.bindings.map(v=>[v.name,v]));
    const c=new Map(candidate.resources?.bindings?.map(v=>[v.name,v])||[]);
    gate(b.size===c.size&&[...b].every(([k,v])=>
      equal(v,c.get(k))),'candidate_binding_changed');
    gate(candidate?.annotations?.['workers/message']===marker&&
      candidate.resources?.script?.etag&&
      before.active.resources?.script?.etag&&
      candidate.resources.script.etag!==before.active.resources.script.etag,
      'candidate_code_or_identity_unverified');
    const previous=before.active.resources,uploaded=candidate.resources;
    gate(equal(previous.script?.handlers,uploaded.script?.handlers),
      'candidate_handlers_changed');
    const noAssets=value=>{
      gate(value&&typeof value==='object','candidate_runtime_metadata_missing');
      const copy={...value};delete copy.assets;return copy;
    };
    gate(equal(noAssets(previous.script_runtime),
      noAssets(uploaded.script_runtime)),'candidate_runtime_changed');
    const priorAssets=previous.script_runtime.assets;
    const candidateAssets=uploaded.script_runtime.assets;
    gate(Boolean(priorAssets)===Boolean(candidateAssets),
      'candidate_asset_routing_changed');
    if(priorAssets)for(const [key,defaultValue] of [
      ['html_handling','auto-trailing-slash'],
      ['not_found_handling','none'],['run_worker_first',undefined]])
      gate(equal(priorAssets[key]??defaultValue,
        candidateAssets[key]??defaultValue),'candidate_asset_routing_changed');
    check={candidate_id:candidateId,bindings_preserved:true,
      code_changed:true,runtime_preserved:true,asset_routing_preserved:true};
   }
   const after=allocation();
   gate(equal(before.baseline,after),'inspection_allocation_changed');
   console.log(JSON.stringify({
    status:prior?(check?'INACTIVE_VERSION_VERIFIED':'HOLD_CANDIDATE_NOT_LOCATED'):
      'NO_UPLOAD_RECEIPT',
    source,environment:'WORK',baseline:after,candidate:check,
    upload_attempt_spent:prior!==null,upload_requested:false,
    deploy_requested:false,new_paid_resources:false},null,2));
   if(prior&&!check)process.exitCode=1;
   return;
  }
  gate(mode==='--stage-once','explicit_mode_required');
  phase='local_build';
  runNode(['scripts/test-work-hq-m1-m2-source-edition.mjs']);
  runNode(['scripts/test-work-hq-m1-m2-inactive-dry-run.mjs']);
  runNode(['scripts/test-work-hq-five-tab-navigation.mjs']);
  runNode(['scripts/test-plan-work-hq-five-tab-inactive-dry-run.mjs']);
  runNpm('typecheck');
  runNpm('build',true);
  runNode(['scripts/test-work-hq-m1-m2-inactive-dry-run.mjs',
   '--compiled-canary']);
  const packet=compileManifest(before),nonce=randomUUID();
  const marker=MESSAGE+source+' '+nonce;
  phase='wrangler_dry_run';
  cloud([...uploadArgs(packet.config,marker),'--dry-run']);
  gate(sourceGuard()===source,'source_changed_before_stage');
  const fresh=await inventory();
  gate(equal(before.baseline,fresh.baseline)&&
   equal(before.active,fresh.active)&&
   equal(before.quote,fresh.quote),'provider_changed_before_upload');
  // Receipt reservation happens only after both guards and the local dry-run.
  // Any ambiguous upload outcome is SPENT and MUST NOT be retried.
  phase='reserve_one_use_attempt';
  reserveOnce(receipt,{operation:'HQ_FIVE_TAB_WORK_INACTIVE_UPLOAD',
   source,nonce,baseline:before.baseline,
   package_sha256:packet.package_sha256,
   reserved_at:new Date().toISOString()});
  reserved=true;
  phase='inactive_upload';
  cloud(uploadArgs(packet.config,marker)); // NEVER versions deploy.
  phase='candidate_readback';
  const after=allocation();gate(equal(before.baseline,after),
   'traffic_changed_after_upload');
  const id=selectStageCandidate(read(['versions','list']),marker);
  gate(id!==null,'candidate_not_in_current_page_inspect_only');
  const checked=assertCandidate({
   active:view(BASELINE.active),quote:view(BASELINE.quote),
   candidate:view(id),marker,planned:packet.planned,baseline:after});
  gate(equal(after,allocation()),'allocation_changed_during_readback');
  console.log(JSON.stringify({
   status:'INACTIVE_WORK_VERSION_VERIFIED',
   source,environment:'WORK',package_sha256:packet.package_sha256,
   candidate:checked,allocation:after,upload_attempt_spent:true,
   deployment_requested:false,traffic_changed:false,
   quote_canary_unchanged:true,shopify_or_customer_writes:false,
   migrations:false,new_billable_services:false,
   activation_authorized:false,rollback_authorized:false},null,2));
 }catch(error){
  const code=/^five_tab_stage_[a-z_]+$/.test(error?.message||'')?
   error.message:'m1m2_stage_unverified';
  console.error('HOLD '+code+' at '+phase+'.');
  console.error(reserved?
   'One-use upload attempt SPENT. Candidate may exist. NEVER retry; run --inspect.':
   'No upload requested. Review the HOLD before proceeding.');
  process.exitCode=1;
 }
}
if(process.argv[1]&&
 pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||
   !['--stage-once','--inspect','--diagnose'].includes(process.argv[2])){
  console.error('STOP explicit --stage-once, --inspect or --diagnose required');process.exitCode=1;
 }else await runOwnerStage(process.argv[2]);
}
