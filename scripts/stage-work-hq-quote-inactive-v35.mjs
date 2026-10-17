// WORK HQ Quote Save + Reload — owner-approved INACTIVE version upload.
// Never deploy, change routes, issue customer requests or change secrets.
// No paid resources, R2, LIVE, KEEP, or Shopify configuration changes.
// Current WORK v34 must stay 100% active throughout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {prepareOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const NAME='jill-order-desk-canary-work';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
export const ACTIVE='4973b74d-d479-41da-897c-e36129303279';
export const FALLBACK='204d66c3-3296-430d-8288-39c354876600';
export const FLAG='JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED';
export const RELEASE_MESSAGE_PREFIX='JILL HQ WORK Quote Save+Reload v35 INACTIVE source ';
const VAR={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_HQ_DETAIL_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const SECRETS=[
  'SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64',
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
];
const fail=x=>{throw Error('work_quote_stage_'+x);};
function assert(x,reason){if(!x)fail(reason);}
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    encoding:'utf8',windowsHide:true,timeout:15000,
    maxBuffer:8192,
  }).trim();}catch{fail('git_not_ready');}
}
function cli(args,{timeout=120000}={}){
  assert(fs.existsSync(BIN),'local_wrangler_missing');
  const result=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:12*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  assert(!result.error&&!result.signal&&result.status===0,
    'wrangler_command_failed');
  return String(result.stdout||'');
}
function run(name,{cwd=ROOT,canary=false}={}){
  const win=process.platform==='win32';
  const result=spawnSync(win?'cmd.exe':'npm',
    win?['/d','/s','/c','npm.cmd run '+name]:['run',name],{
      cwd,shell:false,encoding:'utf8',stdio:'inherit',
      env:canary?{...process.env,JILL_BUILD_TARGET:'canary'}:
        {...process.env},timeout:240000,
    });
  assert(!result.error&&!result.signal&&result.status===0,
    'source_test_or_build_failed');
}
function readJson(args){
  try{return JSON.parse(cli(args));}
  catch{fail('cloudflare_json_unverified');}
}
function liveVersion(){
  const text=cli(['deployments','status','--name',NAME,
    '--config',CONFIG]);
  try{return currentWorkerVersion(text);}
  catch{fail('deployment_status_unverified');}
}
function view(id){
  return readJson(['versions','view',id,'--name',NAME,
    '--config',CONFIG,'--json']);
}
function list(){
  return readJson(['versions','list','--name',NAME,
    '--config',CONFIG,'--json']);
}
function bindings(version){
  const arr=version?.resources?.bindings;
  assert(Array.isArray(arr)&&arr.length<=25,'missing_worker_bindings');
  const m=new Map(arr.map(x=>[x.name,x]));
  assert(m.size===arr.length,'duplicate_worker_bindings');
  return m;
}
function strippedRuntime(r){
  if(!r||typeof r!=='object'||Array.isArray(r))
    fail('runtime_structure_unverified');
  const copy={...r};delete copy.assets;
  return copy;
}
export function prepareInactiveQuoteManifest(compiled){
  assert(compiled&&typeof compiled==='object'&&
    !Array.isArray(compiled),'compiled_manifest_invalid');
  const config=prepareOAuthManifest(compiled);
  assert(config.name===NAME&&
    config.vars.JILL_WORK_OAUTH_ENABLED==='true',
    'not_work_oauth');
  assert(config.d1_databases?.length===1&&
    config.d1_databases[0].database_id===D1&&
    config.d1_databases[0].database_name==='jill-order-desk-work'&&
    config.d1_databases[0].binding==='JILL_ORDER_DESK_WORK_DB',
    'work_d1_mismatch');
  assert(!Object.hasOwn(config.vars,FLAG)&&
    !Object.hasOwn(config.vars,'JILL_WORK_MERCHANT_WRITES_ENABLED')&&
    !Object.hasOwn(config.vars,'JILL_WORK_HQ_DETAIL_ENABLED'),
    'unexpected_base_flags');
  assert(!config.r2_buckets?.length&&!config.kv_namespaces?.length&&
    !config.queues?.producers?.length&&
    !config.queues?.consumers?.length&&
    !config.services?.length&&!config.routes?.length,
    'unapproved_new_resources');
  assert(!config.images?.binding&&!config.durable_objects?.bindings?.length,
    'unapproved_new_resources');
  assert(!Object.hasOwn(config.vars,'SHOPIFY_API_SECRET')&&
    !Object.hasOwn(config.vars,'JILL_HQ_MERCHANT_WRITE_SECRET'),
    'secret_in_plain_text');
  const next=structuredClone(config);
  next.vars.JILL_WORK_HQ_DETAIL_ENABLED='true';
  next.vars.JILL_WORK_MERCHANT_WRITES_ENABLED='true';
  next.vars[FLAG]='true';
  assert(Object.keys(next.vars).length===6&&
    Object.keys(next.vars).every(k=>Object.hasOwn({...VAR,[FLAG]:'true'},k)),
    'unexpected_candidate_vars');
  for(const [k,v] of Object.entries({...VAR,[FLAG]:'true'}))
    assert(next.vars[k]===v,'unexpected_candidate_var_value');
  assert(sameStructuredData(
    {...next,vars:{
      JILL_WORK_HOST_STAGE:'canary',
      JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
      JILL_WORK_OAUTH_ENABLED:'false',
    }},compiled),'unapproved_candidate_manifest_change');
  return next;
}
export function inspectInactiveQuoteVersion({active,candidate}={}){
  assert(active?.id===ACTIVE&&candidate?.id&&
    candidate.id!==ACTIVE&&candidate.id!==FALLBACK,
    'version_identity_mismatch');
  const a=bindings(active),c=bindings(candidate);
  assert(a.size+1===c.size,'binding_count_drift');
  for(const [name,binding] of a){
    assert(sameStructuredData(binding,c.get(name)),
      'prior_worker_binding_changed');
  }
  for(const [name,val] of Object.entries(VAR)){
    assert(a.get(name)?.type==='plain_text'&&
      a.get(name)?.text===val,
      'old_worker_security_flag_drift');
  }
  for(const name of SECRETS)
    assert(a.get(name)?.type==='secret_text'&&
      c.get(name)?.type==='secret_text','required_secret_not_preserved');
  assert(JSON.stringify(a.get('JILL_ORDER_DESK_WORK_DB')||{})
      .includes(D1),'work_d1_binding_drift');
  assert(!a.has(FLAG),'quote_flag_unexpected_on_active');
  assert(c.get(FLAG)?.type==='plain_text'&&
    c.get(FLAG)?.text==='true','quote_release_flag_missing');
  assert(active.resources?.script?.etag&&
    candidate.resources?.script?.etag&&
    active.resources.script.etag!==candidate.resources.script.etag,
    'source_code_not_updated');
  assert(sameStructuredData(active.resources?.script?.handlers,
    candidate.resources?.script?.handlers),
    'worker_entrypoint_changed');
  assert(sameStructuredData(strippedRuntime(active.resources?.script_runtime),
    strippedRuntime(candidate.resources?.script_runtime)),
    'worker_runtime_changed');
  const assetsA=active.resources?.script_runtime?.assets;
  const assetsC=candidate.resources?.script_runtime?.assets;
  assert(!assetsA&&!assetsC || (assetsA&&assetsC&&
    ['html_handling','not_found_handling','run_worker_first']
      .every(key=>{
        const defaultValue=key==='html_handling'?'auto-trailing-slash':
          key==='not_found_handling'?'none':undefined;
        return sameStructuredData(assetsA[key]??defaultValue,
          assetsC[key]??defaultValue);
      })),'worker_asset_routing_changed');
  return Object.freeze({
    activeId:ACTIVE,candidateId:candidate.id,
    bindings:a.size+1,
    extraFlag:FLAG,
  });
}
export function selectQuoteCandidate(versions,active,marker){
  assert(Array.isArray(versions)&&versions.length>=1&&
    versions.length<=100&&active?.id===ACTIVE&&
    typeof marker==='string'&&
    marker.startsWith(RELEASE_MESSAGE_PREFIX),
    'versions_not_verifiable');
  const matches=versions.filter(v=>
    v?.id!==ACTIVE &&
    v?.annotations?.['workers/message']===marker);
  assert(matches.length===1,'candidate_not_unique');
  const candidate=matches[0];
  assert(Number.isFinite(Date.parse(candidate.metadata?.created_on))&&
    Number.isFinite(Date.parse(active.metadata?.created_on))&&
    Date.parse(candidate.metadata.created_on)>
      Date.parse(active.metadata.created_on),
      'candidate_time_unverified');
  const newer=versions.some(v=>v.id!==candidate.id&&
    Number.isFinite(Date.parse(v.metadata?.created_on))&&
    Date.parse(v.metadata.created_on)>
      Date.parse(candidate.metadata.created_on));
  assert(!newer,'newer_unknown_worker_version');
  return candidate.id;
}
function sourceReady(){
  assert(process.platform==='win32','owner_windows_required');
  assert(git('branch','--show-current')==='jill/rewards-work'&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work')&&
    !git('status','--porcelain','--untracked-files=no'),
    'work_checkout_not_synced');
  return git('rev-parse','HEAD');
}
function quoteTables(){
  const output=readJson(['d1','execute','jill-order-desk-work',
    '--remote','--config',CONFIG,'--json','--command',
    "SELECT name FROM sqlite_master WHERE type='table' AND "+
    "name IN ('jill_work_quote_drafts',"+
    "'jill_work_quote_draft_operations') ORDER BY name"]);
  const rows=Array.isArray(output)&&output.length===1?
    output[0]?.results:null;
  assert(output?.[0]?.success===true&&Array.isArray(rows)&&
    rows.length===2&&
    rows[0]?.name==='jill_work_quote_draft_operations'&&
    rows[1]?.name==='jill_work_quote_drafts',
    'work_quote_tables_unverified');
}
function checkCurrentActive(){
  assert(liveVersion()===ACTIVE,'work_v34_not_100_percent_active');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='preflight',uploadAttempted=false,staged=null;
  try{
    assert(process.argv.length===2,'unsupported_upload_mode');
    const head=sourceReady();
    assert(fs.existsSync(BIN),'local_wrangler_missing');
    checkCurrentActive();
    const existing=view(ACTIVE);
    inspectActive(existing);
    quoteTables();
    phase='tests_and_build';
    for(const test of [
      'test:work-hq-quote-release-candidate',
      'test:work-hq-quote-ui-wiring',
      'test:work-hq-request-detail',
      'test:work-hq-quote-d1-owner-migration',
    ])run(test);
    for(const test of [
      'test:workerd-quote-save-owner-local',
      'test:workerd-quote-read-restore-local',
    ])run(test,{cwd:APP});
    run('typecheck',{cwd:APP});
    run('build',{cwd:APP,canary:true});
    const source=path.join(APP,'dist/server/wrangler.json');
    assert(fs.existsSync(source)&&
      !fs.lstatSync(source).isSymbolicLink(),
      'compiled_manifest_missing');
    const compiled=JSON.parse(fs.readFileSync(source,'utf8'));
    const candidate=prepareInactiveQuoteManifest(compiled);
    const workfile=path.join(APP,'dist/server',
      'wrangler.hq-quote-inactive-'+randomUUID()+'.json');
    fs.writeFileSync(workfile,JSON.stringify(candidate,null,2)+'\n',
      {flag:'wx',mode:0o600});
    // No secrets-file required. Wrangler preserves existing version secrets
    // by documented default. Post-upload bindings must match exactly.
    const message=RELEASE_MESSAGE_PREFIX+head;
    phase='upload_dry_run';
    cli(['versions','upload','--dry-run','--config',workfile,
      '--message',message],{timeout:120000});
    assert(git('rev-parse','HEAD')===head,
      'head_changed_during_build');
    checkCurrentActive();
    quoteTables();
    phase='inactive_version_upload';
    uploadAttempted=true;
    cli(['versions','upload','--config',workfile,
      '--message',message],{timeout:180000});
    phase='read_only_upload_inspection';
    checkCurrentActive();
    const id=selectQuoteCandidate(list(),existing,message);
    staged=id;
    const checked=inspectInactiveQuoteVersion({
      active:view(ACTIVE),candidate:view(id),
    });
    checkCurrentActive();
    console.log('PASS JILL HQ WORK Quote v35 uploaded as INACTIVE version: '+
      checked.candidateId);
    console.log('PASS current active v34 still 100%: '+checked.activeId);
    console.log('PASS exact WORK D1, existing secret bindings and only one new quote flag; no R2.');
    console.log('SOURCE COMMIT '+head);
    console.log('HOLD: No traffic release, payment, Shopify Draft Order, customer email, LIVE/KEEP or paid resource.');
    console.log('Next: independent version/asset provenance inspection, then separate traffic authorization.');
  }catch(error){
    const code=String(error?.message||'');
    const safe=/^work_quote_stage_[a-z0-9_]+$/.test(code)?
      code:'work_quote_stage_unverified';
    console.error('STOP WORK QUOTE VERSION: '+safe+' at '+phase+'.');
    if(uploadAttempted)console.error(
      'An inactive Cloudflare version may exist. DO NOT retry before read-only versions inspection.');
    console.error('No traffic switch was requested. Active v34 must be independently checked.');
    process.exitCode=1;
  }
}
function inspectActive(active){
  assert(active?.id===ACTIVE,'wrong_active_v34_id');
  const b=bindings(active);
  for(const [name,value] of Object.entries(VAR))
    assert(b.get(name)?.type==='plain_text'&&
      b.get(name)?.text===value,
      'old_worker_security_flag_drift');
  for(const name of SECRETS)
    assert(b.get(name)?.type==='secret_text',
      'existing_work_secret_missing');
  assert(!b.has(FLAG),'quote_flag_already_active');
  assert(JSON.stringify(b.get('JILL_ORDER_DESK_WORK_DB')||{})
      .includes(D1),'work_database_mismatch');
}
