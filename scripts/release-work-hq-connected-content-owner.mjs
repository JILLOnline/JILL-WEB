// JILL five-tab HQ activation: ONE-USE WORK version traffic switch, reversible.
// Exact already uploaded version only. No upload, app publish, Shopify write,
// D1 migration, secret setting, R2, paid upgrade, LIVE or KEEP operation.
// Never replay historical M1/M2 source/upload/activation receipts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {certifyM1M2SourceEdition} from './certify-work-hq-m1-m2-source-edition.mjs';
import {receiptPath} from './probe-work-gateway-connection-owner.mjs';
import {read,view,cloud,bundleDigest}
 from './stage-work-hq-connected-read-owner.mjs';
import {currentAllocation} from './collect-work-runtime-readonly.mjs';
import {readConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
import {BASELINE,assertBaseline}
 from './stage-work-hq-connected-content-owner.mjs';
import {UPLOADED,evaluateUploadedConnectedContentProof,verifyUploadedConnectedContentReceipt}
 from './inspect-work-hq-connected-content-uploaded-owner.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BRANCH='jill/m1-work-queue-preview-20261021';
const WORKER='jill-order-desk-canary-work';
const ACTIVATE='JILL HQ WORK CONNECTED-CONTENT activate ';
const RESTORE='JILL HQ WORK CONNECTED-CONTENT restore ';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=reason=>{throw Error('connected_content_release_'+reason);};
const gate=(ok,reason)=>{if(!ok)fail(reason);};
const same=(a,b)=>isDeepStrictEqual(a,b);
export const RELEASE=Object.freeze({
 source:UPLOADED.source,candidate:UPLOADED.candidate,
 package:UPLOADED.package,previous:BASELINE.active,quote:BASELINE.quote,
 original_deployment:BASELINE.deployment
});

export function verifyActivationReceipt(attempt){
 gate(attempt?.operation==='HQ_CONNECTED_CONTENT_WORK_ACTIVATE_ONCE'&&
  attempt.source===RELEASE.source&&attempt.candidate===RELEASE.candidate&&
  attempt.package_sha256===RELEASE.package&&
  attempt.original_deployment===RELEASE.original_deployment&&
  attempt.retry_allowed===false&&UUID.test(attempt.nonce||''),
  'activation_receipt_invalid');
 return attempt;
}
export function verifyRestorationReceipt(restored,attempt){
 verifyActivationReceipt(attempt);
 gate(restored?.operation==='HQ_CONNECTED_CONTENT_WORK_RESTORE_ONCE'&&
  restored.source===RELEASE.source&&restored.candidate===RELEASE.candidate&&
  restored.activation_nonce===attempt.nonce&&
  UUID.test(restored.activation_deployment||'')&&
  restored.retry_allowed===false,'restore_receipt_invalid');
 return restored;
}
export function checkReleaseAllocation(state,mode,attempt=null){
 gate(state&&UUID.test(state.deployment||'')&&
  Array.isArray(state.versions)&&state.versions.length===2&&
  state.versions.some(v=>v.id===RELEASE.quote&&v.percentage===0),
  'allocation_unverified');
 if(mode==='baseline'){
  assertBaseline(state);
  return true;
 }
 verifyActivationReceipt(attempt);
 const target=mode==='activated'?RELEASE.candidate:mode==='restored'?
  RELEASE.previous:null;
 gate(target!==null&&state.deployment!==RELEASE.original_deployment&&
  state.versions.some(v=>v.id===target&&v.percentage===100)&&
  state.message===(mode==='activated'?ACTIVATE:RESTORE)+attempt.nonce,
  'deployment_not_owned');
 return true;
}
export function releaseArguments(mode,nonce){
 gate((mode==='activated'||mode==='restored')&&UUID.test(nonce||''),
  'unsafe_release_command');
 const version=mode==='activated'?RELEASE.candidate:RELEASE.previous;
 const message=(mode==='activated'?ACTIVATE:RESTORE)+nonce;
 return ['versions','deploy',version+'@100',RELEASE.quote+'@0',
  '--name',WORKER,'--config','./wrangler.canary.jsonc',
  '--message',message,'--yes'];
}
function git(...args){
 return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000}).trim();
}
function sourceGuard(){
 gate(process.platform==='win32','windows_owner_required');
 const root=fs.realpathSync(ROOT).toLowerCase();
 const temp=fs.realpathSync(os.tmpdir()).toLowerCase()+path.sep;
 gate(root.startsWith(temp)&&path.basename(root).startsWith('jill_m1_m2_qa_'),
  'isolated_qa_checkout_required');
 gate(git('branch','--show-current')===BRANCH&&
  git('status','--porcelain','--untracked-files=no')===''&&
  git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/'+BRANCH)&&
  certifyM1M2SourceEdition().ok===true,
  'source_certification_unverified');
 try{git('merge-base','--is-ancestor',RELEASE.source,'HEAD');}
 catch{fail('original_uploaded_source_missing');}
 return git('rev-parse','HEAD');
}
function paths(){
 const base=path.dirname(receiptPath());
 return {
  upload:path.join(base,'work-hq-connected-content-inactive-upload-once-'+RELEASE.source+'.json'),
  activation:path.join(base,'work-hq-connected-content-activate-once-'+RELEASE.source+'.json'),
  restore:path.join(base,'work-hq-connected-content-restore-once-'+RELEASE.source+'.json')
 };
}
function receipt(file,required=false){
 if(!fs.existsSync(file)){
  gate(!required,'required_private_receipt_missing');return null;
 }
 gate(!fs.lstatSync(file).isSymbolicLink(),'receipt_symlink_denied');
 const raw=fs.readFileSync(file,'utf8');
 gate(raw.length>0&&raw.length<4096,'receipt_size_denied');
 try{return JSON.parse(raw);}catch{fail('receipt_json_invalid');}
}
function reserveOnce(file,value){
 const descriptor=fs.openSync(file,'wx',0o600);
 try{
  fs.writeFileSync(descriptor,JSON.stringify({...value,retry_allowed:false})+'\n');
  fs.fsyncSync(descriptor);
 }finally{fs.closeSync(descriptor);}
}
export function observeCurrentAllocation(raw){
 gate(Array.isArray(raw),'deployment_read_invalid');
 const state=currentAllocation(raw);
 const entry=raw.find(x=>x.id===state.deployment);
 return {...state,message:entry?.annotations?.['workers/message']??null};
}
function snapshot(){
 return observeCurrentAllocation(read(['deployments','list']));
}
function verifyOriginalState(current,proof){
 checkReleaseAllocation(current,'baseline');
 const recorded=proof.baseline;
 gate(same({deployment:current.deployment,created_at:current.created_at,
  versions:current.versions},recorded),
  'original_allocation_changed');
}
function verifyCandidateImmutable(proof){
 const dist=path.join(APP,'dist');
 gate(fs.existsSync(dist)&&!fs.lstatSync(dist).isSymbolicLink(),
  'staged_package_missing');
 const compiledFile=path.join(dist,'server/wrangler.json');
 gate(fs.existsSync(compiledFile)&&!fs.lstatSync(compiledFile).isSymbolicLink(),
  'staged_manifest_missing');
 const compiled=JSON.parse(fs.readFileSync(compiledFile,'utf8'));
 const original=view(RELEASE.previous),quote=view(RELEASE.quote);
 const candidate=view(RELEASE.candidate);
 gate(bundleDigest(dist)===RELEASE.package,'original_uploaded_digest_changed');
 // This compares exact existing bindings, runtime, handlers, asset routing,
 // byte-locked local package and upload receipt's original deployment.
 const before=proof.baseline;
 const report=evaluateUploadedConnectedContentProof({
  before,after:before,active:original,quote,candidate,
  health:{status:200,runtime_version:RELEASE.previous,database_ready:true},
  receipt:proof,compiled,digest:RELEASE.package
 });
 gate(report.status==='CONNECTED_CONTENT_INACTIVE_WORK_CANDIDATE_VERIFIED',
  'candidate_integrity_unverified');
 return report;
}
async function exactHealth(version){
 const result=await readConnectedHealth(version);
 gate(result?.status===200&&result.runtime_version===version&&
  result.database_ready===true,'exact_work_health_unverified');
 return {status:200,version,database_ready:true};
}
// Verification is read-only and distinguishes queued/inactive, active,
// restored and anomalous/ambiguous provider state. It never claims success
// merely because an activation/rollback receipt file exists.
export function classifyRelease({current,proof,activation,restoration}){
 verifyUploadedConnectedContentReceipt(proof);
 if(!activation){
  gate(!restoration,'restore_without_activation');
  verifyOriginalState(current,proof);
  return {status:'CONNECTED_CONTENT_INACTIVE_READY',serving:RELEASE.previous};
 }
 verifyActivationReceipt(activation);
 if(restoration){
  verifyRestorationReceipt(restoration,activation);
  checkReleaseAllocation(current,'restored',activation);
  gate(current.deployment!==restoration.activation_deployment,
   'restoration_deployment_not_new');
  return {status:'CONNECTED_CONTENT_WORK_ORIGINAL_RESTORED',serving:RELEASE.previous};
 }
 checkReleaseAllocation(current,'activated',activation);
 return {status:'CONNECTED_CONTENT_WORK_ACTIVE',serving:RELEASE.candidate};
}
async function inspect(p){
 const proof=receipt(p.upload,true);
 const activation=receipt(p.activation);
 const restoration=receipt(p.restore);
 const before=snapshot();
 const classified=classifyRelease({current:before,proof,activation,restoration});
 verifyCandidateImmutable(proof);
 const health=await exactHealth(classified.serving);
 gate(same(before,snapshot()),'deployment_changed_during_inspection');
 return {
  status:classified.status,environment:'WORK',candidate:RELEASE.candidate,
  deployment:before.deployment,serving_version:classified.serving,
  health,source_and_package_verified:true,
  upload_receipt_spent:true,activation_receipt_spent:!!activation,
  restoration_receipt_spent:!!restoration,
  uploads_performed:false,deployments_requested:false,
  new_billable_resources:false,owner_ui_accepted:false
 };
}
async function restoreOnce(p,activation,{automatic=false}={}){
 verifyActivationReceipt(activation);
 const prior=snapshot();
 checkReleaseAllocation(prior,'activated',activation);
 gate(!fs.existsSync(p.restore),'restore_attempt_already_spent');
 const proof=receipt(p.upload,true);
 verifyCandidateImmutable(proof);
 gate(same(prior,snapshot()),'allocation_changed_before_restore');
 // This is a distinct one-use, fail-closed rollback receipt.
 reserveOnce(p.restore,{
  operation:'HQ_CONNECTED_CONTENT_WORK_RESTORE_ONCE',
  source:RELEASE.source,candidate:RELEASE.candidate,
  activation_nonce:activation.nonce,
  activation_deployment:prior.deployment,
  reserved_at:new Date().toISOString()
 });
 let acknowledged=true;
 try{cloud(releaseArguments('restored',activation.nonce));}
 catch{acknowledged=false;}
 const after=snapshot();
 checkReleaseAllocation(after,'restored',activation);
 gate(after.deployment!==prior.deployment,'restore_deployment_not_new');
 const health=await exactHealth(RELEASE.previous);
 gate(same(after,snapshot()),'restore_allocation_changed');
 return {status:'CONNECTED_CONTENT_WORK_ORIGINAL_RESTORED',
  environment:'WORK',serving_version:RELEASE.previous,
  restored_deployment:after.deployment,health,automatic,
  command_acknowledged:acknowledged,restoration_receipt_spent:true,
  activation_receipt_spent:true};
}
async function activateOnce(p,source){
 gate(!fs.existsSync(p.activation)&&!fs.existsSync(p.restore),
  'activation_attempt_already_spent');
 const proof=receipt(p.upload,true);
 verifyUploadedConnectedContentReceipt(proof);
 const before=snapshot();
 verifyOriginalState(before,proof);
 verifyCandidateImmutable(proof);
 await exactHealth(RELEASE.previous);
 gate(sourceGuard()===source&&same(before,snapshot()),
  'activation_preflight_changed');
 verifyCandidateImmutable(proof);
 const nonce=randomUUID();
 const attempt={
  operation:'HQ_CONNECTED_CONTENT_WORK_ACTIVATE_ONCE',
  source:RELEASE.source,candidate:RELEASE.candidate,
  package_sha256:RELEASE.package,
  original_deployment:RELEASE.original_deployment,
  nonce,requested_at:new Date().toISOString()
 };
 // The ONE-USE boundary: an ambiguous Wrangler result burns this nonce.
 reserveOnce(p.activation,attempt);
 let acknowledged=true;
 try{cloud(releaseArguments('activated',nonce));}
 catch{acknowledged=false;}
 try{
  const after=snapshot();
  checkReleaseAllocation(after,'activated',{...attempt,retry_allowed:false});
  gate(after.deployment!==before.deployment,'activation_deployment_not_new');
  // Propagation can lag across edges. Bounded read-only /healthz retries.
  let good=false;
  for(let i=0;i<8;i++){
   try{await exactHealth(RELEASE.candidate);good=true;break;}
   catch{if(i<7)await new Promise(resolve=>setTimeout(resolve,1400));}
  }
  gate(good,'candidate_runtime_health_not_verified');
  gate(same(after,snapshot()),'deployment_changed_after_health');
  return {
   status:'CONNECTED_CONTENT_WORK_ACTIVE_VERIFIED',environment:'WORK',
   candidate:RELEASE.candidate,deployment:after.deployment,
   active_percentage:100,quote_percentage:0,
   runtime_health_verified:true,activation_receipt_spent:true,
   command_acknowledged:acknowledged,
   upload_performed:false,new_paid_services:false,
   owner_ui_accepted:false
  };
 }catch(e){
  // AUTOMATIC RESTORE ONLY a 100% candidate deployment carrying OUR nonce.
  // Ambiguous/unattributed state is HOLD; do not overwrite another deployment.
  let restored=false;
  try{
   const current=snapshot();
   checkReleaseAllocation(current,'activated',{...attempt,retry_allowed:false});
   const report=await restoreOnce(p,{...attempt,retry_allowed:false},
    {automatic:true});
   restored=true;
   console.error('AUTOMATIC_ORIGINAL_WORK_RESTORED '+JSON.stringify(report));
  }catch{
   console.error('HOLD: activation or rollback state ambiguous. NEVER retry. Read-only --inspect only.');
  }
  fail(restored?'activation_failed_original_restored':
   'activation_or_rollback_unverified');
 }
}
async function main(mode){
 let phase='source';
 try{
  const source=sourceGuard(),p=paths();
  phase='provider';
  let report;
  if(mode==='--inspect')report=await inspect(p);
  else if(mode==='--activate-once'){
   phase='activation';report=await activateOnce(p,source);
  }else if(mode==='--restore-once'){
   phase='restoration';
   report=await restoreOnce(p,receipt(p.activation,true));
  }else fail('explicit_mode_required');
  console.log(JSON.stringify(report,null,2));
 }catch(e){
  const code=/^connected_content_release_[a-z_]+$/.test(e?.message||'')?
   e.message:'connected_content_release_unverified';
  console.error('HOLD '+code+' at '+phase);
  console.error('NEVER retry a spent --activate-once or --restore-once. Use --inspect and share output.');
  process.exitCode=1;
 }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 if(process.argv.length!==3||
  !['--inspect','--activate-once','--restore-once'].includes(process.argv[2])){
  console.error('STOP explicit --inspect / --activate-once / --restore-once required');
  process.exitCode=1;
 }else await main(process.argv[2]);
}
