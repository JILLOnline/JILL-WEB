// Release ONLY the inspected, inactive WORK navigation-performance Worker.
// No code upload, secret changes, Shopify deployment or Google mutations.
// Exact current navigation v1 is the rollback target. Explicit owner approval.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {currentWorkerVersion,assertAnonymousInboxDenied}
  from './deploy-work-hq-inbox-shell.mjs';
import {
  assertPerformanceWorkerVersion,selectPerformanceCandidate,
  NAVIGATION_RELEASE_MARKER,
} from './stage-work-hq-navigation-performance.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const WORKER='jill-order-desk-canary-work';
const BASE='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
export const ACTIVE='e818c639-f962-4a09-9399-54ab521531c3';
// Last prior management version that rendered successfully before the
// broken navigation-v1 release. Use as recovery instead of known-bad v1.
export const ROLLBACK='a57b9b91-84e8-44db-bd2b-144646d5b342';
export const CANDIDATE='f777d728-ef6f-456a-b0be-2e2495bcd804';
export const APPROVAL='RELEASE JILL HQ WORK SINGLE READER V2';
function gate(ok,code){if(!ok)throw Error(code);}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function cli(args){
  gate(fs.existsSync(BIN),'local_wrangler_missing');
  const result=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!result.error && result.status===0,'wrangler_command_failed');
  return String(result.stdout||'');
}
function deployed(){
  return currentWorkerVersion(cli(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));
}
function view(id){
  return JSON.parse(cli(['versions','view',id,'--name',WORKER,
    '--config',CONFIG,'--json']));
}
function list(){
  return JSON.parse(cli(['versions','list','--name',WORKER,
    '--config',CONFIG,'--json']));
}
export function assertNavigationRelease({active,candidate,rollback,versions,current}={}){
  gate(current===ACTIVE,'active_worker_changed');
  gate(candidate?.id===CANDIDATE &&
    candidate?.annotations?.['workers/message']===
      NAVIGATION_RELEASE_MARKER,'candidate_version_mismatch');
  gate(selectPerformanceCandidate(versions,active)===CANDIDATE,
    'navigation_candidate_not_latest');
  const checked=assertPerformanceWorkerVersion({active,candidate});
  gate(rollback?.id===ROLLBACK,'rollback_version_mismatch');
  // Exactly the same WORK-only secrets, Owner/OAuth flags and routing.
  assertPerformanceWorkerVersion({active,candidate:rollback});
  gate(checked.active===ACTIVE && checked.candidate===CANDIDATE,
    'unexpected_release_version');
  return Object.freeze(checked);
}
export function releaseArgs(id,message='JILL HQ WORK single-reader stability v2'){
  gate(id===ROLLBACK || id===CANDIDATE,'unapproved_worker_version');
  return ['versions','deploy',id+'@100%','--name',WORKER,
    '--config',CONFIG,'--yes','--message',message];
}
export function requireCommandDenial({status,location,body}){
  // Our compiled WORK ingress must reject Origin-less writes BEFORE OAuth.
  // No generic 401/404, or Shopify redirect, is considered sufficient.
  gate(status===403 && location===null &&
    body?.ok===false && body?.error==='invalid_origin',
    'anonymous_command_not_denied');
  return true;
}
async function verifyPublicWorkBoundary(){
  async function checked(pathname,{expected,method='GET'}={}){
    const reply=await fetch(BASE+pathname,{
      method,redirect:'manual',
      ...(method==='POST'?{
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:'probe=1',
      }:{}),
      signal:AbortSignal.timeout(20000),
    });
    if(expected==='inbox_denied')assertAnonymousInboxDenied(reply.status);
    else if(expected==='command_denied'){
      let parsed;
      try {parsed=await reply.json();}
      catch {throw Error('anonymous_command_not_denied');}
      requireCommandDenial({
        status:reply.status,location:reply.headers.get('location'),
        body:parsed,
      });
    }
    else gate(reply.status===expected,'unexpected_public_http_status');
  }
  await checked('/healthz',{expected:200});
  await checked('/auth/login',{expected:200});
  await checked('/app/requests',{expected:'inbox_denied'});
  await checked('/app/setup-owner',{expected:410});
  await checked('/app/requests/command',{
    expected:'command_denied',method:'POST',
  });
}
function verifySource(){
  gate(git('branch','--show-current')==='jill/rewards-work' &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
    !git('status','--porcelain','--untracked-files=no'),
    'work_source_not_synced');
}
function inspect(){
  verifySource();
  const current=deployed();
  gate(current===ACTIVE,'active_worker_changed');
  const active=view(ACTIVE),candidate=view(CANDIDATE),rollback=view(ROLLBACK);
  return assertNavigationRelease({
    active,candidate,rollback,versions:list(),current,
  });
}
async function probeGoogleQaKey(){
  const win=process.platform==='win32';
  const result=spawnSync(win?'cmd.exe':'npm',
    win?['/d','/s','/c','npm.cmd run work:hq:qa:write-key:probe']:
      ['run','work:hq:qa:write-key:probe'],{
      cwd:ROOT,shell:false,encoding:'utf8',stdio:'inherit',
    });
  gate(!result.error && result.status===0,'qa_write_key_probe_failed');
}
async function rollbackIfOwnedCandidate(){
  // A CLI failure can happen AFTER Wrangler changes deployment traffic.
  // Roll back also on release-command errors, but only if our exact
  // candidate is now active. Never overwrite a different user's rollout.
  try {
    const seen=deployed();
    if(seen===ROLLBACK){
      console.error('PASS previous WORK management v2 remains active.');
      return;
    }
    if(seen!==CANDIDATE){
      console.error('WORK version changed unexpectedly; manual review required.');
      return;
    }
    cli(releaseArgs(ROLLBACK,'JILL HQ WORK rollback to prior management v2'));
    if(deployed()===ROLLBACK)
      console.error('PASS automatic WORK rollback to prior management v2.');
    else console.error('WORK rollback not confirmed; inspect Cloudflare now.');
  }catch{
    console.error('WORK rollback not confirmed; inspect Cloudflare now.');
  }
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='preflight',io=null;
  try{
    const inspectOnly=process.argv.length===3 &&
      process.argv[2]==='--inspect';
    gate(inspectOnly || process.argv.length===2,'invalid_release_mode');
    const verified=inspect();
    console.log('PASS currently active JILL HQ WORK navigation v1: '+verified.active);
    console.log('PASS inactive single-reader repair candidate v2: '+verified.candidate);
    console.log('PASS all FOUR secrets, WORK D1, OAuth ON, Owner OFF, writes ON.');
    console.log('PASS updated code, identical Worker entrypoint and routing policy.');
    if(inspectOnly){
      console.log('READ-ONLY inspection complete. WORK traffic unchanged.');
    }else{
      phase='pre_release';
      await probeGoogleQaKey();
      await verifyPublicWorkBoundary();
      console.log('PASS current WORK health, OAuth, Owner OFF and exact anonymous command 403.');
      io=createInterface({input:process.stdin,output:process.stdout});
      const agreed=await io.question('\nType '+APPROVAL+
        ' to switch ONLY JILL HQ WORK navigation traffic: ');
      gate(agreed===APPROVAL,'release_not_approved');
      io.close();io=null;
      inspect(); // Detect changes between approval and the actual switch.
      phase='release';
      cli(releaseArgs(CANDIDATE));
      phase='post_release';
      gate(deployed()===CANDIDATE,'deployed_version_mismatch');
      await verifyPublicWorkBoundary();
      console.log('PASS JILL HQ WORK single-reader repair ACTIVE: '+CANDIDATE);
      console.log('PASS health, WORK OAuth, Owner OFF, inbox denial and exact command HTTP 403.');
      console.log('PASS prior WORK management v2 certified for rollback: '+ROLLBACK);
      console.log('No LIVE, KEEP, Rewards, Google script or customer email changes.');
      console.log('NEXT: Shopify Owner browser render + navigation stress QA and timing (public health alone is NOT sufficient).');
    }
  }catch(error){
    const allowed=new Set([
      'work_source_not_synced','active_worker_changed',
      'candidate_version_mismatch','navigation_candidate_not_latest',
      'unexpected_release_version','unapproved_worker_version',
      'anonymous_command_not_denied','local_wrangler_missing',
      'wrangler_command_failed','unexpected_public_http_status',
      'qa_write_key_probe_failed','release_not_approved',
      'deployed_version_mismatch','invalid_release_mode',
      'unverified_worker_versions','navigation_candidate_not_unique',
      'unexpected_newer_worker_version','candidate_time_invalid',
      'worker_version_mismatch','unexpected_worker_bindings',
      'required_worker_secret_missing','worker_security_flag_drift',
      'wrong_work_database','existing_worker_binding_changed',
      'new_code_not_present','worker_entrypoint_changed',
      'worker_runtime_drift','worker_asset_routing_drift',
      'rollback_version_mismatch',
    ]);
    console.error('JILL HQ WORK navigation '+phase+' STOPPED: '+
      (allowed.has(error?.message)?error.message:'unverified_release_state'));
    if(phase==='release'||phase==='post_release')
      await rollbackIfOwnedCandidate();
    process.exitCode=1;
  }finally{io?.close();}
}
