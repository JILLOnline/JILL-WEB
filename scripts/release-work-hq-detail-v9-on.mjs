// WORK-only: promote EXACT existing inactive v34 with full details ON.
// --inspect: metadata only. --release: explicit approval + safety checks.
// --rollback: operator-controlled return to the certified v33 OFF version.
// Never upload versions, rotate secrets, modify Google/Shopify/D1 or LIVE/KEEP.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {DETAIL_OFF_CANDIDATE,requireAnonymousWorkSafety}
  from './release-work-hq-detail-v9-off.mjs';
import {selectInactiveDetailOnVersion,verifyWorkDetailOnCandidate,
  DETAIL_ON_MARKER,DETAIL_ON_FLAG}
  from './stage-work-hq-detail-v9-on.mjs';
import {reconcileWorkQaDetailRemote}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {verifyWorkQaDetailSourcePin}
  from './audit-work-hq-qa-detail-pin.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORKER='jill-order-desk-canary-work';
const CONFIG='./wrangler.canary.jsonc';
const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
export const DETAIL_ON_CANDIDATE='4973b74d-d479-41da-897c-e36129303279';
export const DETAIL_ON_RELEASE_APPROVAL='RELEASE JILL HQ WORK EXACT DETAIL V9 ON';
export const DETAIL_ON_ROLLBACK_APPROVAL='ROLLBACK JILL HQ WORK EXACT DETAIL V9';
const gate=(ok,code)=>{if(!ok)throw Error(code);};
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],
    {encoding:'utf8'}).trim();
}
function cli(args) {
  gate(fs.existsSync(BIN),'wrangler_not_installed');
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!r.error&&r.status===0,'cloudflare_command_failed');
  return String(r.stdout||'');
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
  return JSON.parse(cli(['versions','list',
    '--name',WORKER,'--config',CONFIG,'--json']));
}
export function verifyExactDetailOnRelease({
  baseline,candidate,versions,current,mode='release',
}={}){
  gate(mode==='release'||mode==='rollback','unsupported_work_release_mode');
  const expected=mode==='release'?DETAIL_OFF_CANDIDATE:DETAIL_ON_CANDIDATE;
  gate(current===expected,'work_active_version_changed');
  gate(baseline?.id===DETAIL_OFF_CANDIDATE &&
    candidate?.id===DETAIL_ON_CANDIDATE,
    'work_detail_exact_version_mismatch');
  gate(Array.isArray(versions)&&versions.length>=2&&versions.length<=100,
    'work_versions_invalid');
  const matches=versions.filter(v=>
    v?.annotations?.['workers/message']===DETAIL_ON_MARKER);
  gate(matches.length===1 && matches[0].id===DETAIL_ON_CANDIDATE,
    'work_on_candidate_not_unique');
  const selected=selectInactiveDetailOnVersion(versions,baseline);
  gate(selected===DETAIL_ON_CANDIDATE,'work_on_candidate_mismatch');
  const checked=verifyWorkDetailOnCandidate({
    active:baseline,candidate,
  });
  gate(checked.addition===DETAIL_ON_FLAG,
    'work_on_flag_not_unique');
  return Object.freeze({
    from:expected,
    to:mode==='release'?DETAIL_ON_CANDIDATE:DETAIL_OFF_CANDIDATE,
    flag:checked.addition,
  });
}
export function detailOnReleaseArgs(id){
  gate([DETAIL_OFF_CANDIDATE,DETAIL_ON_CANDIDATE].includes(id),
    'unknown_work_release_target');
  const description=id===DETAIL_ON_CANDIDATE?
    'JILL HQ WORK Google exact detail v9 ON; Owner+D1 only':
    'JILL HQ WORK rollback to detail OFF v33';
  return ['versions','deploy',id+'@100%',
    '--name',WORKER,'--config',CONFIG,'--yes','--message',description];
}
async function checkAnonymousSafety(){
  async function request(endpoint,{method='GET'}={}){
    return fetch(ORIGIN+endpoint,{
      method,redirect:'manual',signal:AbortSignal.timeout(20000),
      ...(method==='POST'?{
        headers:{'content-type':'application/x-www-form-urlencoded'},
        body:'probe=1',
      }:{}),
    });
  }
  const health=await request('/healthz');
  const login=await request('/auth/login');
  const inbox=await request('/app/requests');
  const detail=await request('/app/requests/jill%3Ahq%3Adetail-diagnostic%3Anonexistent');
  const owner=await request('/app/setup-owner');
  const command=await request('/app/requests/command',{method:'POST'});
  let body=null;
  try{body=await command.json();}catch{}
  return requireAnonymousWorkSafety({
    health:health.status,login:login.status,inbox:inbox.status,
    detail:detail.status,owner:owner.status,command:command.status,
    commandLocation:command.headers.get('location'),
    commandError:body?.error??null,
  });
}
async function verifiedSource(){
  gate(git('branch','--show-current')==='jill/rewards-work' &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
    !git('status','--porcelain','--untracked-files=no'),
    'work_source_not_synced');
  const google=await reconcileWorkQaDetailRemote({root:ROOT});
  gate(google.state==='present_unprobed'&&google.version===9,
    'work_google_v9_drift');
  verifyWorkQaDetailSourcePin({
    deploymentId:google.deploymentId,version:google.version,
  });
}
async function inspect(mode){
  await verifiedSource();
  const current=deployed();
  return verifyExactDetailOnRelease({
    baseline:view(DETAIL_OFF_CANDIDATE),
    candidate:view(DETAIL_ON_CANDIDATE),
    versions:list(),current,mode,
  });
}
async function approval(required){
  const io=createInterface({input:process.stdin,output:process.stdout});
  try{
    const answer=await io.question(
      '\nType '+required+' to confirm WORK-only traffic switch: ');
    gate(answer===required,'work_operator_confirmation_denied');
  }finally{io.close();}
}
async function rollbackOurFailedRelease(){
  try{
    const live=deployed();
    if(live===DETAIL_OFF_CANDIDATE){
      console.error('PASS original WORK detail OFF version remains active.');
      return;
    }
    if(live!==DETAIL_ON_CANDIDATE){
      console.error('STOP: unexpected WORK version; do not auto-rollback external changes.');
      return;
    }
    cli(detailOnReleaseArgs(DETAIL_OFF_CANDIDATE));
    gate(deployed()===DETAIL_OFF_CANDIDATE,'rollback_not_confirmed');
    console.error('PASS automatic WORK rollback to exact previous detail-OFF version.');
  }catch{
    console.error('URGENT: WORK rollback not verified; inspect Cloudflare before any retry.');
  }
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='inspect';
  try{
    gate(process.argv.length===3 &&
      ['--inspect','--release','--rollback'].includes(process.argv[2]),
      'invalid_work_detail_on_release_mode');
    const mode=process.argv[2]==='--rollback'?'rollback':'release';
    const pair=await inspect(mode);
    console.log('PASS exact WORK version: '+pair.from+' -> '+pair.to);
    console.log('PASS verified Google QA @9; original v7 inbox/status isolated.');
    console.log('PASS only added binding is '+pair.flag+
      '; four secrets, D1, OAuth, Owner and status writes unchanged.');
    if(process.argv[2]==='--inspect'){
      console.log('READ ONLY. Candidate remains inactive and current WORK traffic unchanged.');
    }else{
      phase='preflight';
      if(mode==='release'){
        await checkAnonymousSafety();
        console.log('PASS anonymous inbox/detail denied, Owner setup disabled, command Origin guard 403.');
      }else{
        console.log('ROLLBACK: skipping health precheck because the ON candidate may be unhealthy; exact version/source gates still required.');
      }
      await approval(mode==='release'?
        DETAIL_ON_RELEASE_APPROVAL:DETAIL_ON_ROLLBACK_APPROVAL);
      await inspect(mode); // catch Cloudflare/Git/Google drift immediately before switch
      phase='switch';
      cli(detailOnReleaseArgs(pair.to));
      phase='post_switch';
      gate(deployed()===pair.to,'work_release_version_not_confirmed');
      await checkAnonymousSafety();
      console.log('PASS WORK 100% serving exact version '+pair.to);
      console.log('PASS WORK health/login, anonymous exact-detail denial and status command guard.');
      console.log(mode==='release'?
        'DETAIL ON. Signed-in Shopify WORK Owner MUST check one known request full detail immediately; NOT yet validated by this automated test.':
        'PASS WORK full-detail OFF rollback; no private original request reads enabled.');
      console.log('No LIVE, KEEP, Rewards, Shopify app, Google, D1 or secret mutations.');
    }
  }catch(e){
    const safe=new Set([
      'invalid_work_detail_on_release_mode','unsupported_work_release_mode',
      'work_active_version_changed','work_detail_exact_version_mismatch',
      'work_versions_invalid','work_on_candidate_not_unique',
      'work_on_candidate_mismatch','work_on_flag_not_unique',
      'unknown_work_release_target','work_source_not_synced',
      'work_google_v9_drift','work_detail_v9_pin_mismatch',
      'uncertified_qa_detail_deployment','wrangler_not_installed',
      'cloudflare_command_failed','work_operator_confirmation_denied',
      'work_release_version_not_confirmed',
      'work_candidate_version_drift','work_binding_count_drift',
      'work_binding_names_drift','work_secret_binding_drift',
      'work_security_flag_drift','work_d1_binding_drift',
      'work_detail_flag_drift','work_original_binding_changed',
      'work_script_fingerprint_changed','work_handler_changed',
      'work_runtime_changed','work_asset_routing_changed',
      'work_versions_invalid','detail_on_candidate_not_unique',
      'detail_on_candidate_not_newer','newer_unknown_work_version',
      'work_anonymous_health_login_drift',
      'work_anonymous_auth_denial_drift',
      'work_anonymous_command_not_denied',
    ]);
    console.error('WORK detail v9 ON '+phase+' STOPPED: '+
      (safe.has(e?.message)?e.message:'unverified_work_detail_on_release'));
    if(process.argv[2]==='--release'&&
      (phase==='switch'||phase==='post_switch'))
      await rollbackOurFailedRelease();
    if(phase==='switch'||phase==='post_switch')
      console.error('DO NOT retry deployment blindly. Inspect deployed WORK version first.');
    process.exitCode=1;
  }
}
