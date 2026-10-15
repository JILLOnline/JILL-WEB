// Final WORK-only traffic switch. NEVER upload code or rotate secrets here.
// A pre-staged code+write-key candidate is verified, then an explicit local
// approval switches ONLY the exact Cloudflare canary WORK Worker version.
// Previous active version remains the rollback target. No LIVE/KEEP operations.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion,assertAnonymousInboxDenied}
  from './deploy-work-hq-inbox-shell.mjs';
import {
  assertWriteReleaseVersion,selectWriteCandidate,RELEASE_MARKER,
} from './stage-work-hq-write-release.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const WORKER='jill-order-desk-canary-work';
const BASE='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const ACTIVE='e67a2209-f6d9-4671-b6fc-33994015af30';
const STAGED_KEY='6b70350e-0a5f-4630-8888-fe8a356a0a54';
export const CANDIDATE='a57b9b91-84e8-44db-bd2b-144646d5b342';
export const APPROVAL='RELEASE JILL HQ WORK MANAGEMENT';

function gate(ok,code){if(!ok)throw Error(code);}
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8'}).trim();}
function cli(args){
  gate(fs.existsSync(BIN),'local_wrangler_missing');
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!r.error && r.status===0,'wrangler_command_failed');
  return String(r.stdout||'');
}
function workerVersion(){
  return currentWorkerVersion(cli(['deployments','status','--name',
    WORKER,'--config',CONFIG]));
}
function view(id){return JSON.parse(cli(['versions','view',id,
  '--name',WORKER,'--config',CONFIG,'--json']));}
function list(){return JSON.parse(cli(['versions','list',
  '--name',WORKER,'--config',CONFIG,'--json']));}
export function assertReleaseCandidate({active,staged,candidate,versions,current}){
  gate(current===ACTIVE,'active_worker_changed');
  gate(candidate?.id===CANDIDATE &&
    candidate?.annotations?.['workers/message']===RELEASE_MARKER,
    'candidate_version_mismatch');
  gate(selectWriteCandidate(versions,active)===CANDIDATE,
    'candidate_not_latest');
  const result=assertWriteReleaseVersion({
    active,stagedKey:staged,candidate,
  });
  gate(result.activeId===ACTIVE && result.stagedId===STAGED_KEY &&
    result.candidateId===CANDIDATE,'unexpected_release_version');
  return Object.freeze({active:ACTIVE,candidate:CANDIDATE});
}
export function releaseArgs(id,message='JILL HQ WORK verified request management'){
  gate(id===CANDIDATE||id===ACTIVE,'unknown_work_rollback_version');
  return ['versions','deploy',id+'@100%','--name',WORKER,'--config',
    CONFIG,'--yes','--message',message];
}
export function anonymousCommandSafe(status,location) {
  // This exact WORK v2 release guarantees that an Origin-less merchant
  // command POST is refused at the outer Worker ingress BEFORE Shopify.
  // Redirects, 404s and generic authentication responses are insufficient:
  // they would hide a failure of the explicit fail-closed Origin guard.
  if(status!==403 || location!==null)throw Error('anonymous_command_not_denied');
  return true;
}
async function check(pathname,{status,method='GET',body}={}){
  const result=await fetch(BASE+pathname,{
    method,redirect:'manual',
    ...(method==='POST'?{
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:body??'probe=1',
    }:{}),
    signal:AbortSignal.timeout(20000),
  });
  if(status==='denied')assertAnonymousInboxDenied(result.status);
  else if(status==='command_denied') {
    gate(anonymousCommandSafe(result.status,
      result.headers.get('location')),'anonymous_command_not_denied');
    let reply;
    try {reply=await result.json();} catch {
      throw Error('anonymous_command_bad_ack');
    }
    gate(reply?.ok===false && reply?.error==='invalid_origin',
      'anonymous_command_bad_ack');
  }
  else gate(result.status===status,'unexpected_public_http_status');
}
function sourceReady(){
  gate(git('branch','--show-current')==='jill/rewards-work' &&
    !git('status','--porcelain','--untracked-files=no') &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_source_not_synced');
}
function inspect(){
  sourceReady();
  const deployed=workerVersion();
  gate(deployed===ACTIVE,'active_worker_changed');
  const active=view(ACTIVE),staged=view(STAGED_KEY),
    candidate=view(CANDIDATE);
  const result=assertReleaseCandidate({active,staged,candidate,
    versions:list(),current:deployed});
  return result;
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='preflight',io=null;
  try{
    const mode=process.argv.includes('--inspect')?'inspect':'release';
    const validated=inspect();
    console.log('PASS current WORK dashboard: '+validated.active);
    console.log('PASS reviewed inactive WORK write candidate: '+validated.candidate);
    console.log('PASS original secrets, WORK D1, OAuth ON, Owner commissioning OFF.');
    console.log('PASS only new bindings: dedicated WRITE secret and opt-in flag.');
    console.log('PASS updated Worker code, unchanged entrypoint and routing policy.');
    if(mode==='inspect') {
      console.log('READ-ONLY release inspection complete. Active traffic unchanged.');
    }else{
      phase='pre_release';
      // Verify remote Google key every time, not just at the previous stage.
      const probe=spawnSync(process.platform==='win32'?'cmd.exe':'npm',
        process.platform==='win32'?
          ['/d','/s','/c','npm.cmd run work:hq:qa:write-key:probe']:
          ['run','work:hq:qa:write-key:probe'],{
          cwd:ROOT,shell:false,encoding:'utf8',stdio:'inherit',
        });
      gate(!probe.error&&probe.status===0,'qa_write_key_handshake_failed');
      await check('/healthz',{status:200});
      await check('/auth/login',{status:200});
      await check('/app/requests',{status:'denied'});
      await check('/app/setup-owner',{status:410});
      console.log('PASS current WORK health, OAuth, Owner OFF and anonymous denial.');
      io=createInterface({input:process.stdin,output:process.stdout});
      const response=await io.question(
        '\nType '+APPROVAL+' to switch ONLY JILL HQ WORK traffic: ');
      gate(response===APPROVAL,'release_not_approved');
      io.close();io=null;
      // Last-second drift detection. No other app or environment is changed.
      inspect();
      phase='release';
      cli(releaseArgs(CANDIDATE));
      phase='post_release';
      gate(workerVersion()===CANDIDATE,'deployed_version_mismatch');
      await check('/healthz',{status:200});
      await check('/auth/login',{status:200});
      await check('/app/requests',{status:'denied'});
      await check('/app/setup-owner',{status:410});
      await check('/app/requests/command',{
        method:'POST',body:'probe=1',status:'command_denied',
      });
      console.log('PASS JILL HQ WORK management candidate is ACTIVE: '+CANDIDATE);
      console.log('PASS health, OAuth, anonymous Owner-only command denial, Owner OFF.');
      console.log('LIVE/KEEP/Rewards, Google QA and outbound mail unchanged.');
      console.log('Next: verify signed-in Owner UI using disposable WORK QA request.');
    }
  }catch(err){
    const safe=new Set([
      'active_worker_changed','candidate_version_mismatch',
      'candidate_not_latest','unexpected_release_version',
      'unknown_work_rollback_version','anonymous_command_not_denied',
      'work_source_not_synced','local_wrangler_missing',
      'wrangler_command_failed','unexpected_public_http_status',
      'release_not_approved','qa_write_key_handshake_failed',
      'deployed_version_mismatch','anonymous_command_bad_ack',
    ]);
    console.error('JILL HQ WORK release '+phase+' STOPPED: '+
      (safe.has(err?.message)?err.message:'unverified_release_state'));
    if(phase==='post_release'){
      // The newly deployed version might be unhealthy. Attempt rollback
      // ONLY if our exact candidate is currently active. Otherwise halt.
      try {
        if(workerVersion()===CANDIDATE) {
          cli(releaseArgs(ACTIVE,'JILL HQ WORK rollback to verified prior version'));
          if(workerVersion()===ACTIVE)
            console.error('PASS automatic WORK rollback to prior active version.');
          else
            console.error('WORK rollback unconfirmed; inspect deployments manually.');
        }else console.error('WORK active version changed; manual inspection required.');
      }catch{
        console.error('WORK rollback unconfirmed; inspect deployments manually.');
      }
    }
    process.exitCode=1;
  }finally{io?.close();}
}
