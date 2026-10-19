// Activate ONLY the exact reviewed, already uploaded WORK HQ version.
// No upload/build/secret/D1/app/gateway operations. Old receipts stay spent.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {currentAllocation} from './collect-work-runtime-readonly.mjs';
import {HQ_WORKER,HQ_ACTIVE,HQ_QUOTE,HQ_DEPLOYMENT,connectedBaseline,
  inspectConnectedVersion,verifyConnectedActive,sourceGuard,git,cloud,read,view,
  connectedUploadReceipt,reserveConnectedAttempt} from './stage-work-hq-connected-read-owner.mjs';

export const CONNECTED_CANDIDATE='e866e2f2-0746-44d0-8caa-b37a1c9bcf45';
export const CONNECTED_SOURCE='69b709d9c2c6d0a4c075bef073381ec698b39373';
export const CONNECTED_PACKAGE='02aae15f15057c74286dac63400e3883189a3d7f5701ea25f35f99a77655a035';
const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const PREFIX='JILL HQ WORK catalog/access v1 activate ';
const RESTORE='JILL HQ WORK catalog/access v1 restore ';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const check=(ok,code)=>{if(!ok)throw Error('work_hq_connected_release_'+code);};

export function verifyConnectedUploadReceipt(receipt){
  check(receipt?.operation==='HQ_CONNECTED_READ_V1_INACTIVE_UPLOAD'&&
    receipt.source===CONNECTED_SOURCE&&receipt.package_sha256===CONNECTED_PACKAGE&&
    receipt.retry_allowed===false,'upload_receipt_unverified');
  connectedBaseline(receipt.baseline);
}
export function verifyQuoteCanary(active,quote){
  const base=verifyConnectedActive(active);
  check(quote?.id===HQ_QUOTE&&Array.isArray(quote.resources?.bindings),'quote_canary_unverified');
  const b=new Map(quote.resources.bindings.map(x=>[x.name,x]));
  check(b.size===base.size+1&&b.size===quote.resources.bindings.length,'quote_binding_drift');
  for(const [key,value] of base)check(isDeepStrictEqual(value,b.get(key)),'quote_binding_drift');
  check(b.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED')?.type==='plain_text'&&
    b.get('JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED').text==='true','quote_flag_changed');
}
export function verifyConnectedAllocation(state,{restored=false}={}){
  const id=restored?HQ_ACTIVE:CONNECTED_CANDIDATE;
  check(UUID.test(state?.deployment||'')&&state.deployment!==HQ_DEPLOYMENT&&state.versions?.length===2&&
    state.versions.some(x=>x.id===id&&x.percentage===100)&&
    state.versions.some(x=>x.id===HQ_QUOTE&&x.percentage===0),'allocation_unverified');
}
export function verifyOwnedActivation(state,attempt){
  verifyConnectedAllocation(state);
  check(UUID.test(attempt?.nonce||'')&&state.message===PREFIX+attempt.nonce,'activation_not_owned');
}
export function certifyConnectedHealth(evidence,expected=CONNECTED_CANDIDATE){
  check(evidence?.status===200&&evidence.location===null&&evidence.mime==='application/json'&&
    /(?:^|[,\s])no-store(?:$|[,\s])/.test(evidence.cache_control||'')&&
    isDeepStrictEqual(evidence.body,{ok:true,environment:'JILL_ORDER_DESK_WORK',database_ready:true,admin_ready:false}),
    'health_unverified');
  if(expected!==null)check(evidence.runtime_version===expected,'runtime_version_unverified');
  return {status:200,database_ready:true,runtime_version:evidence.runtime_version,
    exact_version_verified:expected!==null};
}
function snapshot(){
  const raw=read(['deployments','list']);
  check(Array.isArray(raw),'deployment_metadata_unverified');
  const state=currentAllocation(raw),record=raw.find(x=>x.id===state.deployment);
  return {...state,message:record?.annotations?.['workers/message']||null};
}
function readReceipt(file,{optional=false}={}){
  if(optional&&!fs.existsSync(file))return null;
  check(fs.existsSync(file)&&!fs.lstatSync(file).isSymbolicLink(),'receipt_unavailable');
  try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{check(false,'receipt_unavailable');}
}
async function health(expected){
  const url=new URL('/healthz',ORIGIN);url.searchParams.set('jill_work_hq_readback',randomUUID());
  const response=await fetch(url,{method:'GET',redirect:'manual',headers:{Accept:'application/json','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(15000)});
  const raw=await response.text();check(raw.length<1024,'health_unverified');
  let body;try{body=JSON.parse(raw);}catch{check(false,'health_unverified');}
  return certifyConnectedHealth({status:response.status,location:response.headers.get('location'),
    mime:(response.headers.get('content-type')||'').split(';')[0],body,
    cache_control:response.headers.get('cache-control'),runtime_version:response.headers.get('x-jill-work-hq-version')},expected);
}
function deploy(id,message){
  cloud(['versions','deploy',id+'@100',HQ_QUOTE+'@0','--name',HQ_WORKER,
    '--config','./wrangler.canary.jsonc','--message',message,'--yes']);
}
function verifyAttempt(attempt){
  check(attempt?.operation==='HQ_CONNECTED_READ_V1_ACTIVATE'&&UUID.test(attempt.nonce||'')&&
    /^[0-9a-f]{40}$/.test(attempt.runner||'')&&attempt.candidate===CONNECTED_CANDIDATE&&
    attempt.source===CONNECTED_SOURCE&&attempt.package_sha256===CONNECTED_PACKAGE&&
    attempt.retry_allowed===false,'activation_receipt_unverified');
  connectedBaseline(attempt.baseline);
}
function fixedVersions(){
  const active=view(HQ_ACTIVE),quote=view(HQ_QUOTE),candidate=view(CONNECTED_CANDIDATE);
  verifyQuoteCanary(active,quote);
  check(candidate.id===CONNECTED_CANDIDATE,'wrong_candidate');
  return inspectConnectedVersion({active,candidate,source:CONNECTED_SOURCE});
}
export async function restoreConnectedOnce({attempt,readState,verifyVersions,checkSource,reserve,deploy,health}){
  verifyAttempt(attempt);const before=readState();verifyOwnedActivation(before,attempt);
  verifyVersions();checkSource();
  check(isDeepStrictEqual(before,readState()),'allocation_changed_before_restore');
  reserve({operation:'HQ_CONNECTED_READ_V1_RESTORE',activation:before.deployment,
    nonce:attempt.nonce,reserved_at:new Date().toISOString()});
  // A command error/timeout is ambiguous. Never repeat it; read provider state.
  let commandAcknowledged=true;try{deploy(HQ_ACTIVE,RESTORE+attempt.nonce);}catch{commandAcknowledged=false;}
  const after=readState();verifyConnectedAllocation(after,{restored:true});
  check(after.deployment!==before.deployment&&after.message===RESTORE+attempt.nonce,'restore_not_owned');
  verifyVersions();const restoredHealth=await health(null);
  check(isDeepStrictEqual(after,readState()),'allocation_changed_after_restore');
  return {allocation:after,health:restoredHealth,command_acknowledged:commandAcknowledged,
    baseline_versions_restored:true,restore_receipt_spent:true};
}
const restoreOnce=(attempt,file)=>restoreConnectedOnce({attempt,readState:snapshot,
  verifyVersions:fixedVersions,checkSource:sourceGuard,reserve:data=>reserveConnectedAttempt(file,data),deploy,health});
export async function readBackConnectedActivation({attempt,deploy,readState,verifyVersions,health}){
  let commandAcknowledged=true;try{deploy(CONNECTED_CANDIDATE,PREFIX+attempt.nonce);}catch{commandAcknowledged=false;}
  const after=readState();verifyOwnedActivation(after,attempt);
  verifyVersions();const verified=await health(CONNECTED_CANDIDATE);
  check(isDeepStrictEqual(after,readState()),'allocation_changed_after_activation');
  return {allocation:after,health:verified,command_acknowledged:commandAcknowledged};
}
async function execute(mode){
  let attempted=false,phase='preflight',attempt=null,restoreFile=null;
  try{
    const runner=sourceGuard();git('merge-base','--is-ancestor',CONNECTED_SOURCE,'HEAD');
    const uploadFile=connectedUploadReceipt();verifyConnectedUploadReceipt(readReceipt(uploadFile));
    const directory=path.dirname(uploadFile);
    const file=path.join(directory,'work-hq-connected-read-v1-activate-once-20261019.json');
    restoreFile=path.join(directory,'work-hq-connected-read-v1-restore-once-20261019.json');
    attempt=readReceipt(file,{optional:true});if(attempt)verifyAttempt(attempt);
    const candidate=fixedVersions();
    if(mode==='--inspect'){
      const before=snapshot();let runtime=null;
      try{runtime=await health(before.versions.some(x=>x.id===CONNECTED_CANDIDATE&&x.percentage===100)?CONNECTED_CANDIDATE:null);}
      catch{runtime={state:'unverified'};}
      check(isDeepStrictEqual(before,snapshot()),'allocation_changed_during_inspection');
      console.log(JSON.stringify({environment:'WORK',mode:'read_only',candidate,allocation:before,health:runtime,
        activation_receipt_present:attempt!==null,restore_receipt_present:fs.existsSync(restoreFile),
        no_upload_or_deployment:true,no_signed_post:true,operational_acceptance:false},null,2));return;
    }
    if(mode==='--restore-once'){
      check(attempt!==null,'activation_receipt_unavailable');phase='explicit_restore';
      const restored=await restoreOnce(attempt,restoreFile);
      console.log(JSON.stringify({environment:'WORK',...restored,operational_acceptance:false},null,2));return;
    }
    check(attempt===null&&!fs.existsSync(restoreFile),'activation_attempt_spent_inspect_only');
    const before=snapshot();connectedBaseline(before);await health(null);
    fixedVersions();
    check(sourceGuard()===runner&&isDeepStrictEqual(before,snapshot()),'source_or_allocation_changed');
    attempt={operation:'HQ_CONNECTED_READ_V1_ACTIVATE',runner,source:CONNECTED_SOURCE,package_sha256:CONNECTED_PACKAGE,
      candidate:CONNECTED_CANDIDATE,baseline:before,nonce:randomUUID(),reserved_at:new Date().toISOString()};
    phase='activation';reserveConnectedAttempt(file,attempt);attempted=true;
    phase='independent_readback';
    const activated=await readBackConnectedActivation({attempt,deploy,readState:snapshot,verifyVersions:fixedVersions,health});
    console.log(JSON.stringify({environment:'WORK',runner,source:CONNECTED_SOURCE,package_sha256:CONNECTED_PACKAGE,
      candidate,...activated,
      activation_receipt_spent:true,existing_quote_canary_preserved:true,upload_performed:false,
      secret_changes:false,data_or_schema_changes:false,new_billable_services:false,
      authenticated_owner_ui_verified:false,operational_acceptance:false},null,2));
  }catch(error){
    const code=/^work_hq_connected_[a-z_]+$/.test(error?.message)?error.message:'work_hq_connected_release_unverified';
    console.error('STOP '+code+' at '+phase+'.');
    if(attempted){
      // Restore only our uniquely attributed activation. If reads fail or
      // another deployment intervenes, hold and never overwrite newer work.
      try{phase='automatic_restore';const restored=await restoreOnce(attempt,restoreFile);
        console.log(JSON.stringify({environment:'WORK',activation_verified:false,...restored,operational_acceptance:false},null,2));}
      catch{console.error('HOLD: current state or restoration is unverified. Do not repeat activation or restoration; use work:hq:connected:release:inspect.');}
    }else console.error(mode==='--restore-once'?
      'Restore outcome may be unverified. Do not repeat; use work:hq:connected:release:inspect.':
      'No activation requested. Inspect any spent receipt; do not reset it.');
    process.exitCode=1;
  }
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  if(process.argv.length!==3||!['--activate-once','--inspect','--restore-once'].includes(process.argv[2])){
    console.error('STOP work_hq_connected_release_explicit_mode_required');process.exitCode=1;
  }else await execute(process.argv[2]);
}
