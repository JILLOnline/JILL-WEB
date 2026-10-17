// JILL WORK Phase 31: READ-ONLY source/candidate vs ACTIVE v34 metadata.
// Never stages, uploads, deploys, reads customer data or changes a plan.
// It does NOT inspect v34's deployable binary or build asset equivalence.
import {spawnSync,execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {prepareWorkHqV34LocalUi} from './prepare-work-hq-v34-ui-local.mjs';
import {verifyWorkDetailLive,workLiveAuditReadArgs}
  from './audit-work-hq-detail-v9-live.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const BASE=join(APP,'dist/server/wrangler.json');
const OUTPUT=join(APP,'dist/server/wrangler.hq-v34-ui-LOCAL-NOUPLOAD.json');
const BIN=join(APP,'node_modules/wrangler/bin/wrangler.js');
const SECRET_NAMES=Object.freeze([
  'JILL_HQ_MERCHANT_READ_SECRET',
  'JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
]);
const STOP=code=>{throw Error('work_hq_v34_ui_parity_'+code);};
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const safeEqual=(a,b)=>isDeepStrictEqual(a,b);
const ver=Object.freeze({
  active:'4973b74d-d479-41da-897c-e36129303279',
  rollback:'204d66c3-3296-430d-8288-39c354876600',
});
/**
 * Pure READ-ONLY crosscheck. Verifies remote v34 binding shape against
 * candidate config but deliberately does not assert code/asset equality.
 */
export function verifyWorkV34UiReadiness({
  baseManifest,localCandidate,activeVersion,baseline,candidate,versions,
}={}){
  let local;
  try{local=prepareWorkHqV34LocalUi(baseManifest);}
  catch{STOP('local_base_unverified');}
  if(!safeEqual(local.candidate,localCandidate))
    STOP('candidate_config_drift');
  let certified;
  try{
    certified=verifyWorkDetailLive({
      activeVersion,baseline,candidate,versions,
    });
  }catch{STOP('live_v34_metadata_unverified');}
  if(certified.version!==ver.active||
     certified.fallback!==ver.rollback)
    STOP('version_drift');
  const bindings=candidate?.resources?.bindings;
  if(!Array.isArray(bindings)||bindings.length!==10)
    STOP('binding_count_drift');
  const byName=new Map(bindings.map(b=>[b?.name,b]));
  if(byName.size!==10)STOP('binding_duplicate');
  const localVars=localCandidate.vars;
  if(!plain(localVars)||Object.keys(localVars).length!==5)
    STOP('local_flags_drift');
  for(const [name,value] of Object.entries(localVars)){
    const actual=byName.get(name);
    if(actual?.type!=='plain_text'||actual.text!==value)
      STOP('live_flag_drift');
  }
  for(const name of SECRET_NAMES)
    if(byName.get(name)?.type!=='secret_text')
      STOP('live_secret_binding_missing');
  const db=byName.get('JILL_ORDER_DESK_WORK_DB');
  if(db?.type!=='d1'||
     !JSON.stringify(db).includes(
       localCandidate.d1_databases[0].database_id))
    STOP('live_work_d1_drift');
  const aDate=candidate?.resources?.script_runtime?.compatibility_date;
  if(typeof aDate!=='string'||
     aDate!==localCandidate.compatibility_date)
    STOP('compatibility_date_drift');
  if(!Array.isArray(candidate?.resources?.script?.handlers)||
     !candidate.resources.script.handlers.includes('fetch'))
    STOP('runtime_handler_unverified');
  return Object.freeze({
    state:'read_only_work_v34_binding_parity',
    expected_live_v34:ver.active,
    expected_rollback_v33:ver.rollback,
    local_config_exact:true,
    live_binding_names_types_and_flags_match:true,
    work_d1_identity_matches:true,
    compatibility_date_matches:true,
    local_asset_and_binary_equivalence_verified:false,
    local_script_etag_matches_live:false,
    live_asset_equivalence_verified:false,
    google_qa_source_checked_in_this_run:false,
    authenticated_owner_status_mutation_verified:false,
    cloudflare_upload_authorized:false,
    version_stage_authorized:false,
    traffic_switch_authorized:false,
    billing_approved:false,
    live_keep_touched:false,
  });
}
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000,
  }).trim();}
  catch{STOP('git_unavailable');}
}
function readCloudflare(step){
  const args=workLiveAuditReadArgs(step);
  const p=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    timeout:35000,maxBuffer:12*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  if(p.error||p.status!==0||p.signal)
    STOP('provider_read_failed');
  // Remote data is never printed raw (could contain binding IDs).
  return String(p.stdout||'');
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='arguments';
  try{
    if(process.argv.length!==3||process.argv[2]!=='--inspect')
      STOP('invalid_mode');
    phase='local_work_source';
    if(git('branch','--show-current')!=='jill/rewards-work'||
       git('rev-parse','HEAD')!==
         git('rev-parse','refs/remotes/origin/jill/rewards-work')||
       git('status','--porcelain','--untracked-files=no'))
      STOP('unsynced_or_modified');
    const base=JSON.parse(readFileSync(BASE,'utf8'));
    const localCandidate=JSON.parse(readFileSync(OUTPUT,'utf8'));
    phase='cloudflare_v34_metadata';
    const deployed=currentWorkerVersion(
      readCloudflare('deployment_status'));
    const baseline=JSON.parse(readCloudflare('baseline_v33'));
    const candidate=JSON.parse(readCloudflare('candidate_v34'));
    const versions=JSON.parse(readCloudflare('version_listing'));
    phase='exact_parity_contract';
    const receipt=verifyWorkV34UiReadiness({
      baseManifest:base,localCandidate,activeVersion:deployed,
      baseline,candidate,versions,
    });
    console.log('PASS WORK active v34 and preserved v33 rollback metadata.');
    console.log('PASS WORK v34 live secret-binding names/types, D1, OAuth, Owner OFF, writes ON and detail ON match LOCAL UI candidate.');
    console.log('PASS WORK canary compatibility date and fetch handler match.');
    console.log('HOLD: Live Worker binary and client asset parity NOT proven; staging and deployment NOT approved.');
    console.log('READ ONLY: Local manifest + Cloudflare metadata only, no customer reads or remote writes.');
    if(receipt.cloudflare_upload_authorized!==false)
      STOP('permission_violation');
  }catch(e){
    const code=String(e?.message||'work_hq_v34_ui_parity_unverified');
    console.error('STOP WORK HQ v34 UI PARITY: '+
      (/^work_hq_v34_ui_parity_[a-z0-9_]+$/.test(code)?
        code:'work_hq_v34_ui_parity_unverified'));
    console.error('READ ONLY PHASE: '+phase);
    process.exitCode=1;
  }
}
