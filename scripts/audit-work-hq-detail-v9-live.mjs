// Read-only post-release audit of existing WORK v34, no customer reads.
// Never stage/release/rollback Worker or touch secrets, Google source data,
// Shopify, D1, LIVE, KEEP, or Rewards. Print only status and version IDs.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {DETAIL_OFF_CANDIDATE,requireAnonymousWorkSafety}
  from './release-work-hq-detail-v9-off.mjs';
import {DETAIL_ON_CANDIDATE,verifyExactDetailOnRelease}
  from './release-work-hq-detail-v9-on.mjs';
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
function gate(condition,code){if(!condition)throw Error(code);}
export function verifyWorkDetailLive({
  activeVersion,baseline,candidate,versions,
}={}){
  gate(activeVersion===DETAIL_ON_CANDIDATE,'work_v34_not_active');
  // The existing release gate validates exact v33/v34 identities, only
  // the added ON flag, preserved private bindings, and newer uploads.
  const receipt=verifyExactDetailOnRelease({
    baseline,candidate,versions,
    current:DETAIL_ON_CANDIDATE,mode:'rollback',
  });
  gate(receipt.from===DETAIL_ON_CANDIDATE &&
    receipt.to===DETAIL_OFF_CANDIDATE,'work_live_parity_failed');
  return Object.freeze({
    version:DETAIL_ON_CANDIDATE,
    fallback:DETAIL_OFF_CANDIDATE,
    detailFlag:'JILL_WORK_HQ_DETAIL_ENABLED',
  });
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],
    {encoding:'utf8'}).trim();
}
function cli(args){
  gate(fs.existsSync(BIN),'local_wrangler_not_found');
  const p=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!p.error&&p.status===0,'cloudflare_read_failed');
  return String(p.stdout||'');
}
// Match the exact known-working Wrangler CLI ordering used during the
// certified v34 release and operator's read-only recovery. Never accept an
// arbitrary Worker name, config path, version or command from a caller.
export function workLiveAuditReadArgs(step){
  const scoped=['--name',WORKER,'--config',CONFIG];
  switch(step){
    case 'deployment_status':
      return ['deployments','status',...scoped];
    case 'baseline_v33':
      return ['versions','view',DETAIL_OFF_CANDIDATE,...scoped,'--json'];
    case 'candidate_v34':
      return ['versions','view',DETAIL_ON_CANDIDATE,...scoped,'--json'];
    case 'version_listing':
      return ['versions','list',...scoped,'--json'];
    default:
      throw Error('invalid_cloudflare_read_step');
  }
}
async function anonymous(){
  async function req(route,init={}){
    const response=await fetch(ORIGIN+route,{
      redirect:'manual',signal:AbortSignal.timeout(20000),...init,
    });
    return response;
  }
  const health=await req('/healthz');
  const login=await req('/auth/login');
  const inbox=await req('/app/requests');
  const detail=await req('/app/requests/jill%3Ahq%3Aqa-nonexistent-00001');
  const owner=await req('/app/setup-owner');
  const commandResponse=await req('/app/requests/command',{
    method:'POST',
    headers:{'content-type':'application/x-www-form-urlencoded'},
    body:'probe=1',
  });
  let code=null;
  try{code=(await commandResponse.json())?.error??null;}catch{}
  requireAnonymousWorkSafety({
    health:health.status,login:login.status,
    inbox:inbox.status,detail:detail.status,owner:owner.status,
    command:commandResponse.status,
    commandLocation:commandResponse.headers.get('location'),
    commandError:code,
  });
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='start';
  try{
    gate(process.argv.length===2,'invalid_live_audit_args');
    gate(git('branch','--show-current')==='jill/rewards-work' &&
      git('rev-parse','HEAD')===
        git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
      !git('status','--porcelain','--untracked-files=no'),
      'work_source_not_synced');
    phase='google_deployment_listing';
    const remote=await reconcileWorkQaDetailRemote({root:ROOT});
    gate(remote.state==='present_unprobed'&&remote.version===9,
      'google_detail_v9_missing');
    verifyWorkQaDetailSourcePin({
      deploymentId:remote.deploymentId,version:remote.version,
    });
    phase='cloudflare_deployment_status';
    const deployed=currentWorkerVersion(
      cli(workLiveAuditReadArgs('deployment_status')));
    phase='cloudflare_baseline_v33_view';
    const baseline=JSON.parse(cli(workLiveAuditReadArgs('baseline_v33')));
    phase='cloudflare_candidate_v34_view';
    const candidate=JSON.parse(cli(workLiveAuditReadArgs('candidate_v34')));
    phase='cloudflare_version_listing';
    const versions=JSON.parse(cli(workLiveAuditReadArgs('version_listing')));
    phase='cloudflare_certification';
    const receipt=verifyWorkDetailLive({
      activeVersion:deployed,baseline,candidate,versions,
    });
    console.log('PASS WORK active Cloudflare exact v34 '+receipt.version);
    console.log('PASS rollback v33 preserved '+receipt.fallback);
    console.log('PASS all four secrets, WORK D1, OAuth ON, Owner setup OFF, writes ON; only detail flag added.');
    console.log('PASS Google QA @9 source pin, original @7 inbox/status isolation.');
    phase='anonymous_work_boundary';
    await anonymous();
    console.log('PASS live anonymous /healthz, /auth/login and Owner-only route denial.');
    console.log('READ ONLY. No customer data read, Google/Shopify/D1 writes, traffic changes, secrets or LIVE/KEEP changes.');
    console.log('OWNER QA STILL REQUIRED: verify actual full detail in signed-in Shopify WORK JILL HQ.');
  }catch(e){
    const errors=new Set([
      'invalid_live_audit_args','work_source_not_synced',
      'google_detail_v9_missing','work_detail_v9_pin_mismatch',
      'uncertified_qa_detail_deployment','work_v34_not_active',
      'work_live_parity_failed','local_wrangler_not_found',
      'cloudflare_read_failed','work_active_version_changed',
      'work_detail_exact_version_mismatch','work_versions_invalid',
      'work_on_candidate_not_unique','work_on_candidate_mismatch',
      'work_on_flag_not_unique','work_candidate_version_drift',
      'work_binding_count_drift','work_binding_names_drift',
      'work_secret_binding_drift','work_security_flag_drift',
      'work_d1_binding_drift','work_detail_flag_drift',
      'work_original_binding_changed','work_script_fingerprint_changed',
      'work_handler_changed','work_runtime_changed',
      'work_asset_routing_changed','detail_on_candidate_not_unique',
      'detail_on_candidate_not_newer','newer_unknown_work_version',
      'work_anonymous_health_login_drift',
      'work_anonymous_auth_denial_drift',
      'work_anonymous_command_not_denied',
    ]);
    console.error('WORK DETAIL v9 LIVE AUDIT STOPPED: '+
      (errors.has(e?.message)?e.message:'unverified_work_live_state'));
    // Never print raw Wrangler stderr/stdout: these may contain private
    // provider metadata. A fixed phase tells the operator which read failed.
    console.error('READ ONLY FAILURE PHASE: '+phase);
    process.exitCode=1;
  }
}
