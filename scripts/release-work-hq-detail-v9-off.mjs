// Release one ALREADY staged WORK-only detail-v9 code version with details OFF.
// --inspect never switches traffic. --release requires explicit local approval.
// No uploads, Google writes, Shopify app release, D1 migration or key changes.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {verifyInactiveDetailCandidate,DETAIL_BASELINE,DETAIL_STAGE_MARKER}
  from './stage-work-hq-detail-v9.mjs';
import {reconcileWorkQaDetailRemote}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {verifyWorkQaDetailSourcePin}
  from './audit-work-hq-qa-detail-pin.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORKER='jill-order-desk-canary-work';
const CONFIG='./wrangler.canary.jsonc';
const BASE='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
export const DETAIL_OFF_CANDIDATE='204d66c3-3296-430d-8288-39c354876600';
export const DETAIL_OFF_APPROVAL='RELEASE JILL HQ WORK DETAIL V9 OFF';
function gate(ok,code){if(!ok)throw Error(code);}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function cli(args){
  gate(fs.existsSync(BIN),'wrangler_not_installed');
  const p=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!p.error&&p.status===0,'wrangler_command_failed');
  return String(p.stdout||'');
}
function deployed(){
  return currentWorkerVersion(cli(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));
}
function view(id){
  return JSON.parse(cli(['versions','view',id,
    '--name',WORKER,'--config',CONFIG,'--json']));
}
function list(){
  return JSON.parse(cli(['versions','list',
    '--name',WORKER,'--config',CONFIG,'--json']));
}
export function verifyDetailOffRelease({active,candidate,versions,current}={}){
  gate(current===DETAIL_BASELINE,'active_worker_changed');
  gate(candidate?.id===DETAIL_OFF_CANDIDATE &&
    candidate?.annotations?.['workers/message']===DETAIL_STAGE_MARKER,
    'detail_off_candidate_mismatch');
  gate(Array.isArray(versions) && versions.length>=2 &&
    versions.length<=100,'worker_versions_unverifiable');
  const matching=versions.filter(v=>
    v?.annotations?.['workers/message']===DETAIL_STAGE_MARKER);
  gate(matching.length===1 && matching[0].id===DETAIL_OFF_CANDIDATE,
    'detail_off_candidate_not_unique');
  const time=Date.parse(matching[0].metadata?.created_on);
  const oldTime=Date.parse(active?.metadata?.created_on);
  gate(Number.isFinite(time)&&Number.isFinite(oldTime)&&time>oldTime,
    'detail_off_candidate_time_invalid');
  gate(versions.every(v=>v.id===DETAIL_OFF_CANDIDATE ||
    Number.isFinite(Date.parse(v.metadata?.created_on)) &&
    Date.parse(v.metadata.created_on)<=time),
    'newer_unknown_worker_version');
  const checked=verifyInactiveDetailCandidate({active,candidate});
  gate(checked.active===DETAIL_BASELINE &&
    checked.candidate===DETAIL_OFF_CANDIDATE,
    'detail_off_candidate_invalid');
  return Object.freeze(checked);
}
export function detailOffReleaseArgs(id,message='JILL HQ WORK detail v9 code; feature OFF'){
  gate(id===DETAIL_OFF_CANDIDATE||id===DETAIL_BASELINE,
    'unknown_work_version');
  return ['versions','deploy',id+'@100%',
    '--name',WORKER,'--config',CONFIG,'--yes','--message',message];
}
export function requireAnonymousWorkSafety({
  health,login,inbox,detail,owner,command,commandLocation,commandError,
}={}){
  gate(health===200&&login===200,'work_anonymous_health_login_drift');
  gate([404,410].includes(inbox) && [404,410].includes(detail) &&
    owner===410,'work_anonymous_auth_denial_drift');
  gate(command===403 && commandLocation===null &&
    commandError==='invalid_origin','work_anonymous_command_not_denied');
  return true;
}
async function checkWorkBoundary(){
  async function request(route,{method='GET'}={}){
    const response=await fetch(BASE+route,{
      method,redirect:'manual',signal:AbortSignal.timeout(20000),
      ...(method==='POST'?{
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:'probe=1',
      }:{}),
    });
    return response;
  }
  const health=await request('/healthz'),login=await request('/auth/login');
  const inbox=await request('/app/requests');
  const detail=await request('/app/requests/jill%3Ahq%3Adetail-diagnostic%3Anonexistent');
  const owner=await request('/app/setup-owner');
  const command=await request('/app/requests/command',{method:'POST'});
  let error=null;
  try{error=(await command.json())?.error??null;}catch{}
  return requireAnonymousWorkSafety({
    health:health.status,login:login.status,inbox:inbox.status,
    detail:detail.status,owner:owner.status,command:command.status,
    commandLocation:command.headers.get('location'),commandError:error,
  });
}
async function inspect(){
  gate(git('branch','--show-current')==='jill/rewards-work' &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
    !git('status','--porcelain','--untracked-files=no'),
    'work_source_not_synced');
  const google=await reconcileWorkQaDetailRemote({root:ROOT});
  gate(google.state==='present_unprobed'&&google.version===9,
    'google_qa_detail_deployment_drift');
  verifyWorkQaDetailSourcePin({
    deploymentId:google.deploymentId,version:google.version,
  });
  const current=deployed();
  const active=view(DETAIL_BASELINE),candidate=view(DETAIL_OFF_CANDIDATE);
  return verifyDetailOffRelease({active,candidate,versions:list(),current});
}
async function rollbackOnlyOurVersion(){
  try{
    const current=deployed();
    if(current===DETAIL_BASELINE){
      console.error('PASS original WORK version remains active.');return;
    }
    if(current!==DETAIL_OFF_CANDIDATE){
      console.error('WORK traffic changed outside this release. Manual review required.');
      return;
    }
    cli(detailOffReleaseArgs(DETAIL_BASELINE,
      'JILL HQ WORK rollback: detail v9 gate remains OFF'));
    if(deployed()===DETAIL_BASELINE)
      console.error('PASS WORK automatic rollback to verified previous version.');
    else console.error('WORK rollback not confirmed. Inspect Cloudflare manually.');
  }catch{console.error('WORK rollback not confirmed. Inspect Cloudflare manually.');}
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='inspect',io=null;
  try{
    gate(process.argv.length===3 &&
      ['--inspect','--release'].includes(process.argv[2]),
      'invalid_detail_off_release_mode');
    const versions=await inspect();
    console.log('PASS active WORK version '+versions.active);
    console.log('PASS exact new INACTIVE detail OFF version '+versions.candidate);
    console.log('PASS all 4 secrets, WORK D1, Owner OFF, OAuth ON, writes ON, detail OFF.');
    console.log('PASS Google QA v9 exact pin and original v7 list/status isolation.');
    if(process.argv[2]==='--inspect'){
      console.log('READ-ONLY. No traffic switched; no secrets or customer data read.');
    }else{
      phase='preflight';
      await checkWorkBoundary();
      console.log('PASS existing WORK health/login, anonymous Owner denial and command 403.');
      io=createInterface({input:process.stdin,output:process.stdout});
      const approval=await io.question(
        '\nType '+DETAIL_OFF_APPROVAL+' to switch WORK-only code (detail stays OFF): ');
      gate(approval===DETAIL_OFF_APPROVAL,'detail_off_release_not_approved');
      io.close();io=null;
      await inspect(); // Last-second race protection.
      phase='release';
      cli(detailOffReleaseArgs(DETAIL_OFF_CANDIDATE));
      phase='post_release';
      gate(deployed()===DETAIL_OFF_CANDIDATE,'work_deployed_version_mismatch');
      await checkWorkBoundary();
      console.log('PASS WORK detail-v9 code active, exact original request detail OFF.');
      console.log('PASS WORK health/login, anonymous direct detail DENIED, Owner setup OFF.');
      console.log('PASS existing status command requires valid Origin and Owner.');
      console.log('NEXT: Owner QA of inbox/status in Shopify WORK; then separate detail ON stage.');
      console.log('Google, Shopify app versions, D1, secrets, LIVE, KEEP, Rewards unchanged.');
    }
  }catch(e){
    const safe=new Set([
      'invalid_detail_off_release_mode','work_source_not_synced',
      'google_qa_detail_deployment_drift','work_detail_v9_pin_mismatch',
      'uncertified_qa_detail_deployment','active_worker_changed',
      'detail_off_candidate_mismatch','worker_versions_unverifiable',
      'detail_off_candidate_not_unique','detail_off_candidate_time_invalid',
      'newer_unknown_worker_version','detail_off_candidate_invalid',
      'detail_off_release_not_approved','work_deployed_version_mismatch',
      'wrangler_not_installed','wrangler_command_failed',
      'work_anonymous_health_login_drift',
      'work_anonymous_auth_denial_drift',
      'work_anonymous_command_not_denied',
      'work_version_changed','work_binding_changed',
      'work_binding_count_drift','work_binding_names_drift',
      'work_secret_binding_missing','work_security_flag_drift','work_d1_drift',
      'detail_not_off','new_detail_code_missing','work_handler_drift',
      'work_runtime_drift','work_assets_routing_drift',
    ]);
    console.error('WORK detail v9 OFF '+phase+' STOPPED: '+
      (safe.has(e?.message)?e.message:'unverified_work_release_state'));
    if(phase==='release'||phase==='post_release')
      await rollbackOnlyOurVersion();
    process.exitCode=1;
  }finally{io?.close();}
}
