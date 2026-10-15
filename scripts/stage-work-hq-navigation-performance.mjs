// WORK-only: stage Auth-safe navigation + ONE canonical reader over
// ACTIVE navigation v1 Worker. Creates ONE INACTIVE version; NO traffic switch.
// Preserve every original binding (including all four secrets), WORK D1,
// OAuth ON, Owner setup OFF, write command ON and Worker routing/runtime.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {assertWorkHqInboxManifest,currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {writeOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {privateWorkWriteKey} from './stage-work-hq-write-key.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORKER='jill-order-desk-canary-work';
const CONFIG='./wrangler.canary.jsonc';
const ACTIVE='e818c639-f962-4a09-9399-54ab521531c3';
const WORK_DB='3f17c186-c794-4e00-8f20-017191373a19';
const WRITE_SECRET='JILL_HQ_MERCHANT_WRITE_SECRET';
const EXPECTED=new Set([
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_WORK_SESSION_KEY_B64',
  'SHOPIFY_API_SECRET',WRITE_SECRET,
  'JILL_ORDER_DESK_WORK_DB','JILL_WORK_HOST_STAGE',
  'JILL_WORK_OWNER_BOOTSTRAP_ENABLED','JILL_WORK_OAUTH_ENABLED',
  'JILL_WORK_MERCHANT_WRITES_ENABLED',
]);
const FLAGS={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
export const NAVIGATION_RELEASE_MARKER=
  'JILL HQ WORK auth-safe single-reader v3; inactive';

function gate(ok,code){if(!ok)throw Error(code);}
function bindings(version) {
  const source=version?.resources?.bindings;
  gate(Array.isArray(source)&&source.length===EXPECTED.size,
    'unexpected_worker_bindings');
  const result=new Map(source.map(b=>[b.name,b]));
  gate(result.size===EXPECTED.size &&
    [...EXPECTED].every(name=>result.has(name)),
    'unexpected_worker_bindings');
  for(const name of [
    'JILL_HQ_MERCHANT_READ_SECRET','JILL_WORK_SESSION_KEY_B64',
    'SHOPIFY_API_SECRET',WRITE_SECRET,
  ])gate(result.get(name)?.type==='secret_text',
    'required_worker_secret_missing');
  for(const [name,value] of Object.entries(FLAGS))
    gate(result.get(name)?.type==='plain_text' &&
      result.get(name).text===value,'worker_security_flag_drift');
  gate(result.get('JILL_ORDER_DESK_WORK_DB')?.type==='d1' &&
    JSON.stringify(result.get('JILL_ORDER_DESK_WORK_DB')).includes(WORK_DB),
    'wrong_work_database');
  return result;
}
function routingPreserved(a,b) {
  if(!a||!b)return false;
  for(const [key,defaultValue] of [
    ['html_handling','auto-trailing-slash'],
    ['not_found_handling','none'],
  ])if((a[key]??defaultValue)!==(b[key]??defaultValue))return false;
  if('run_worker_first' in a || 'run_worker_first' in b)
    if(!sameStructuredData(a.run_worker_first,b.run_worker_first))return false;
  return true;
}
export function assertPerformanceWorkerVersion({active,candidate}={}) {
  gate(active?.id===ACTIVE && typeof candidate?.id==='string' &&
    candidate.id!==ACTIVE,'worker_version_mismatch');
  const before=bindings(active),after=bindings(candidate);
  for(const [name,binding] of before)
    gate(sameStructuredData(binding,after.get(name)),
      'existing_worker_binding_changed');
  const a=active.resources,c=candidate.resources;
  gate(typeof a?.script?.etag==='string' && a.script.etag &&
    typeof c?.script?.etag==='string' && c.script.etag &&
    a.script.etag!==c.script.etag,'new_code_not_present');
  gate(sameStructuredData(a.script.handlers,c.script.handlers),
    'worker_entrypoint_changed');
  const runtimeWithoutAssets=value=>{
    if(!value||typeof value!=='object')return null;
    const clone={...value};delete clone.assets;return clone;
  };
  gate(sameStructuredData(runtimeWithoutAssets(a.script_runtime),
    runtimeWithoutAssets(c.script_runtime)),'worker_runtime_drift');
  gate(routingPreserved(a.script_runtime?.assets,
    c.script_runtime?.assets),'worker_asset_routing_drift');
  return Object.freeze({active:active.id,candidate:candidate.id});
}
export function preparePerformanceManifest(base) {
  gate(base&&typeof base==='object'&&!Array.isArray(base),
    'invalid_candidate_manifest');
  assertWorkHqInboxManifest(base);
  gate(base.name===WORKER &&
    Object.keys(base.vars||{}).length===3 &&
    base.vars?.JILL_WORK_MERCHANT_WRITES_ENABLED===undefined,
    'base_manifest_not_locked');
  const copy=structuredClone(base);
  copy.vars.JILL_WORK_MERCHANT_WRITES_ENABLED='true';
  gate(Object.keys(copy.vars).length===4 &&
    Object.entries(FLAGS).every(([name,value])=>copy.vars[name]===value)&&
    ![...EXPECTED].filter(x=>x.endsWith('_SECRET')).some(name=>
      Object.hasOwn(copy.vars,name)),
    'unsafe_work_manifest');
  return copy;
}
export function selectPerformanceCandidate(versions,active) {
  gate(Array.isArray(versions)&&versions.length>0&&versions.length<=100 &&
    active?.id===ACTIVE,'unverified_worker_versions');
  const matches=versions.filter(item=>
    item?.annotations?.['workers/message']===NAVIGATION_RELEASE_MARKER);
  gate(matches.length===1 &&
    matches[0].id!==ACTIVE,'navigation_candidate_not_unique');
  const item=matches[0];
  const newer=versions.some(version=>version?.id!==item.id &&
    Number.isFinite(Date.parse(version?.metadata?.created_on)) &&
    Number.isFinite(Date.parse(item?.metadata?.created_on)) &&
    Date.parse(version.metadata.created_on)>
      Date.parse(item.metadata.created_on));
  gate(!newer,'unexpected_newer_worker_version');
  gate(Number.isFinite(Date.parse(item?.metadata?.created_on)) &&
    Number.isFinite(Date.parse(active.metadata?.created_on)) &&
    Date.parse(item.metadata.created_on)>
      Date.parse(active.metadata.created_on),'candidate_time_invalid');
  return item.id;
}
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8'}).trim();}
function cli(args) {
  gate(fs.existsSync(BIN),'wrangler_not_installed');
  const res=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!res.error&&res.status===0,'wrangler_command_failed');
  return String(res.stdout||'');
}
function npmRun(name,{cwd=ROOT,canary=false}={}) {
  const win=process.platform==='win32';
  const res=spawnSync(win?'cmd.exe':'npm',
    win?['/d','/s','/c','npm.cmd run '+name]:['run',name],{
      cwd,shell:false,encoding:'utf8',stdio:'inherit',
      env:canary?{...process.env,JILL_BUILD_TARGET:'canary'}:process.env,
    });
  gate(!res.error&&res.status===0,'build_or_test_failed');
}
function current(){return currentWorkerVersion(cli([
  'deployments','status','--name',WORKER,'--config',CONFIG]));}
function versions(){return JSON.parse(cli([
  'versions','list','--name',WORKER,'--config',CONFIG,'--json']));}
function view(id){return JSON.parse(cli([
  'versions','view',id,'--name',WORKER,'--config',CONFIG,'--json']));}

const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked) {
  let phase='preflight',temporary=null;
  try {
    gate(git('branch','--show-current')==='jill/rewards-work' &&
      git('rev-parse','HEAD')===
        git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
      !git('status','--porcelain','--untracked-files=no'),
      'work_source_not_synced');
    gate(current()===ACTIVE,'active_worker_changed');
    const old=view(ACTIVE);
    bindings(old);
    gate(!versions().some(v=>
      v?.annotations?.['workers/message']===NAVIGATION_RELEASE_MARKER),
      'navigation_candidate_already_staged');
    phase='tests';
    for(const name of [
      'test:work-merchant-inbox','test:work-hq-inbox-ui',
      'test:work-hq-request-detail','test:work-hq-source-cache',
      'test:work-hq-google-source-cache','test:work-hq-merchant-command',
      'test:work-hq-mail-outbox','test:work-hq-qa-write-key-probe',
    ])npmRun(name);
    phase='build';
    const dist=path.join(APP,'dist');
    if(fs.existsSync(dist)) {
      gate(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_build');
      fs.renameSync(dist,path.join(os.tmpdir(),
        'jill-hq-work-dist-'+randomUUID()));
    }
    npmRun('typecheck',{cwd:APP});
    npmRun('build',{cwd:APP,canary:true});
    const oauth=path.join(dist,'server/wrangler.oauth-canary.json');
    writeOAuthManifest({output:oauth});
    const manifest=path.join(dist,'server/wrangler.hq-navigation.json');
    fs.writeFileSync(manifest,JSON.stringify(preparePerformanceManifest(
      JSON.parse(fs.readFileSync(oauth,'utf8'))),null,2)+'\n',{
        flag:'wx',mode:0o600,
      });
    npmRun('test:workerd-oauth',{cwd:APP});
    const {full,folder}=localFilePath({repo:ROOT});
    gate(fs.existsSync(full) && !fs.lstatSync(full).isSymbolicLink() &&
      !fs.lstatSync(folder).isSymbolicLink(),'private_vault_unavailable');
    const key=privateWorkWriteKey(fs.readFileSync(full,'utf8'));
    temporary=fs.mkdtempSync(path.join(os.tmpdir(),
      'jill-hq-nav-private-'));
    const file=path.join(temporary,'work-write.json');
    fs.writeFileSync(file,JSON.stringify({[WRITE_SECRET]:key}),{
      flag:'wx',mode:0o600,
    });
    const upload=['--config',manifest,'--secrets-file',file,
      '--message',NAVIGATION_RELEASE_MARKER];
    cli(['versions','upload','--dry-run',...upload]);
    gate(current()===ACTIVE,'active_worker_changed');
    phase='stage';
    cli(['versions','upload',...upload]);
    gate(current()===ACTIVE,'active_worker_changed_after_stage');
    const id=selectPerformanceCandidate(versions(),old);
    const checked=assertPerformanceWorkerVersion({
      active:view(ACTIVE),candidate:view(id),
    });
    console.log('PASS JILL HQ WORK navigation candidate staged INACTIVE: '+checked.candidate);
    console.log('PASS all FOUR WORK secrets, WORK D1, OAuth ON, Owner OFF, writes ON.');
    console.log('PASS same Worker entrypoint, runtime and asset routing.');
    console.log('PASS currently deployed navigation v1 unchanged: '+checked.active);
    console.log('No LIVE, KEEP, Rewards, Google or customer records changed.');
    console.log('Do NOT activate until separately inspected and approved.');
  }catch(error){
    const safe=new Set([
      'work_source_not_synced','active_worker_changed',
      'navigation_candidate_already_staged','build_or_test_failed',
      'symlinked_build','private_vault_unavailable',
      'wrangler_not_installed','wrangler_command_failed',
      'active_worker_changed_after_stage','worker_version_mismatch',
      'unexpected_worker_bindings','required_worker_secret_missing',
      'worker_security_flag_drift','wrong_work_database',
      'existing_worker_binding_changed','new_code_not_present',
      'worker_entrypoint_changed','worker_runtime_drift',
      'worker_asset_routing_drift','invalid_candidate_manifest',
      'base_manifest_not_locked','unsafe_work_manifest',
      'unverified_worker_versions','navigation_candidate_not_unique',
      'unexpected_newer_worker_version','candidate_time_invalid',
    ]);
    console.error('JILL HQ WORK navigation '+phase+' STOPPED: '+
      (safe.has(error?.message)?error.message:'unverified_work_state'));
    if(phase==='stage')
      console.error('An INACTIVE version may already exist. Do not rerun.');
    process.exitCode=1;
  }finally{
    if(temporary)fs.rmSync(temporary,{recursive:true,force:true});
  }
}
