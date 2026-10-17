// JILL WORK quote v35 — independent READ-ONLY inspection after upload.
// NO upload/deploy/release, migrations, secret reads, Shopify operations,
// Google QA, R2, customer data, or paid plan changes.
// Emits verified version IDs and non-sensitive status ONLY.
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {existsSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {
  ACTIVE,FALLBACK,FLAG,RELEASE_MESSAGE_PREFIX,
  inspectInactiveQuoteVersion,selectQuoteCandidate,
} from './stage-work-hq-quote-inactive-v35.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=join(ROOT,'services/jill-order-desk/app-home');
const BIN=join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const WORKER='jill-order-desk-canary-work';
const DB='jill-order-desk-work';
const DB_ID='3f17c186-c794-4e00-8f20-017191373a19';
export const SOURCE='4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b';
export const CANDIDATE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
export const MARKER=RELEASE_MESSAGE_PREFIX+SOURCE;
const stop=reason=>{throw Error('quote_v35_readonly_'+reason);};
const assert=(test,reason)=>{if(!test)stop(reason);};

export function verifyInspectedQuoteVersions({
  current,active,rollback,candidate,versions,source,
}={}){
  assert(current===ACTIVE,'active_traffic_drift');
  assert(source===SOURCE,'source_commit_changed');
  assert(active?.id===ACTIVE&&rollback?.id===FALLBACK&&
    candidate?.id===CANDIDATE,'version_id_mismatch');
  assert(candidate?.annotations?.['workers/message']===MARKER,
    'candidate_source_marker_changed');
  const selected=selectQuoteCandidate(versions,active,MARKER);
  assert(selected===CANDIDATE,'candidate_not_unique_or_latest');
  // Fresh remote version readback; repeated, not just trusting upload log.
  const report=inspectInactiveQuoteVersion({active,candidate});
  assert(report.activeId===ACTIVE&&
    report.candidateId===CANDIDATE&&report.extraFlag===FLAG,
    'binding_readback_unverified');
  // Rollback still exists and is independent of the candidate.
  assert(rollback.id!==candidate.id&&rollback.id!==active.id&&
    !!rollback.resources?.script?.etag,
    'rollback_unverifiable');
  return Object.freeze({
    active_version:ACTIVE,rollback_version:FALLBACK,
    inactive_version:CANDIDATE,source_commit:SOURCE,
    bindings_verified:report.bindings,
    additional_flag:FLAG,
    traffic_changed:false,
    binary_and_remote_assets_byte_parity_proven:false,
    work_release_authorized:false,
  });
}
export function verifyQuoteTableReadback(data){
  const item=Array.isArray(data)&&data.length===1?data[0]:null;
  const names=item?.results;
  assert(item?.success===true&&Array.isArray(names)&&names.length===2&&
    names.every(x=>x&&typeof x==='object'&&Object.keys(x).length===1)&&
    names[0].name==='jill_work_quote_draft_operations'&&
    names[1].name==='jill_work_quote_drafts',
    'work_quote_schema_drift');
  return true;
}
function checkSource(){
  assert(process.platform==='win32','owner_windows_required');
  const git=(...a)=>{
    try{return execFileSync('git',['-C',ROOT,...a],{
      encoding:'utf8',timeout:15000,maxBuffer:8192,
      windowsHide:true,
    }).trim();}
    catch{stop('git_source_unverifiable');}
  };
  assert(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===
    git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_source_not_synced');
  assert(git('cat-file','-t',SOURCE)==='commit',
    'uploaded_source_not_present');
  try{execFileSync('git',['-C',ROOT,'merge-base','--is-ancestor',
    SOURCE,'HEAD'],{timeout:15000,windowsHide:true,stdio:'ignore'});}
  catch{stop('uploaded_source_not_ancestor');}
  const config=JSON.parse(readFileSync(join(APP,'wrangler.canary.jsonc'),
    'utf8'));
  assert(config.name===WORKER&&config.d1_databases?.length===1&&
    config.d1_databases[0]?.database_name===DB&&
    config.d1_databases[0]?.database_id===DB_ID&&
    config.d1_databases[0]?.binding==='JILL_ORDER_DESK_WORK_DB'&&
    config.vars?.JILL_WORK_HOST_STAGE==='canary'&&
    config.vars?.JILL_WORK_OAUTH_ENABLED==='false'&&
    config.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false'&&
    !Object.hasOwn(config.vars,FLAG),'manifest_scope_drift');
  assert(existsSync(BIN),'wrangler_unavailable');
}
function command(args,{timeout=65000}={}){
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,shell:false,encoding:'utf8',windowsHide:true,
    maxBuffer:6*1024*1024,timeout,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  assert(!r.error&&!r.signal&&r.status===0,
    'cloudflare_read_unavailable');
  return r.stdout;
}
function json(args){
  try{return JSON.parse(command(args));}
  catch{stop('cloudflare_metadata_invalid');}
}
function view(id){
  return json(['versions','view',id,'--name',WORKER,
    '--config',CONFIG,'--json']);
}
function active(){
  try{return currentWorkerVersion(command(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));}
  catch{stop('work_traffic_readback_unavailable');}
}
const invoked=process.argv[1]&&
  pathToFileURL(resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    assert(process.argv.length===2,'unsupported_mode');
    checkSource();
    // Check active BEFORE reading potentially stale version-list metadata.
    const current=active();
    assert(current===ACTIVE,'active_traffic_drift');
    const versions=json(['versions','list','--name',WORKER,
      '--config',CONFIG,'--json']);
    const inspected=verifyInspectedQuoteVersions({
      current,source:SOURCE,versions,
      active:view(ACTIVE),rollback:view(FALLBACK),
      candidate:view(CANDIDATE),
    });
    const sql="SELECT name FROM sqlite_master WHERE type='table' "+
      "AND name IN ('jill_work_quote_drafts',"+
      "'jill_work_quote_draft_operations') ORDER BY name";
    verifyQuoteTableReadback(json(['d1','execute',DB,'--remote',
      '--config',CONFIG,'--json','--command',sql]));
    // Detect concurrent deployment DURING inspection.
    assert(active()===ACTIVE,'active_traffic_changed_during_readback');
    console.log('PASS WORK v35 INACTIVE read-only version: '+
      inspected.inactive_version);
    console.log('PASS source commit marker: '+
      inspected.source_commit);
    console.log('PASS WORK active v34 100% unchanged: '+
      inspected.active_version);
    console.log('PASS WORK rollback v33 still available: '+
      inspected.rollback_version);
    console.log('PASS WORK D1 quote tables, original secrets, all existing bindings and only one new quote flag.');
    console.log('PASS code etag differs and entrypoint/runtime plus static-asset routing policy match expected metadata.');
    console.log('HOLD: Cloudflare version metadata and upload source marker do NOT prove byte-for-byte script or inactive asset parity. No inactive HTTP test performed.');
    console.log('READ ONLY. No new Worker upload, traffic switch, customer data read, R2, paid plan, LIVE or KEEP.');
  }catch(error){
    const code=String(error?.message||'');
    const safe=/^(quote_v35_readonly_|work_quote_stage_)[a-z0-9_]+$/.test(code)?
      code:'quote_v35_readonly_unverified';
    console.error('STOP WORK v35 read-only inspection: '+safe);
    console.error('DO NOT upload again or change traffic. Keep v34 active and review metadata.');
    process.exitCode=1;
  }
}
