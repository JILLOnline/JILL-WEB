// Deploy ONLY the reviewed JILL HQ WORK inbox UI code, preserving all
// canonical Google/Shopify secrets and the already-bound WORK Owner.
// Source-only CI never calls this command. Operator must authorize rollout.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {assertWorkHqInboxManifest,currentWorkerVersion,assertAnonymousInboxDenied}
  from './deploy-work-hq-inbox-shell.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WORKER='jill-order-desk-canary-work';
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const BASE='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const ACTIVE='76eda941-abcf-4838-a147-b5450a7c1148';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const MESSAGE='JILL HQ WORK Custom Orders inbox UI v1; read-only release';
const SECRETS=['JILL_HQ_MERCHANT_READ_SECRET','JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET'];

function gate(ok,code){if(!ok)throw Error(code);}
export function assertVersionBindings(active,candidate){
  gate(active?.id===ACTIVE &&
    typeof candidate?.id==='string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(candidate.id) &&
    candidate.id!==ACTIVE,
    'wrong_work_version');
  const a=active.resources?.bindings,c=candidate.resources?.bindings;
  gate(Array.isArray(a)&&Array.isArray(c),'missing_worker_bindings');
  const byName=arr=>new Map(arr.map(b=>[b.name,b]));
  const ab=byName(a),cb=byName(c);
  gate(ab.size===a.length && cb.size===c.length,'duplicate_bindings');
  for(const name of SECRETS){
    gate(ab.get(name)?.type==='secret_text' &&
      cb.get(name)?.type==='secret_text','merchant_or_shopify_secret_missing');
  }
  for(const [name,text] of [
    ['JILL_WORK_HOST_STAGE','canary'],
    ['JILL_WORK_OWNER_BOOTSTRAP_ENABLED','false'],
    ['JILL_WORK_OAUTH_ENABLED','true'],
  ]){
    gate(ab.get(name)?.type==='plain_text' && ab.get(name)?.text===text &&
      cb.get(name)?.type==='plain_text' && cb.get(name)?.text===text,
      'work_security_flag_changed');
  }
  gate(JSON.stringify(ab.get('JILL_ORDER_DESK_WORK_DB')??{}).includes(D1) &&
    JSON.stringify(cb.get('JILL_ORDER_DESK_WORK_DB')??{}).includes(D1),
    'work_d1_binding_changed');
  // No additional secret, unknown data store, route or permission binding.
  gate(ab.size===cb.size,'binding_count_changed');
  for(const binding of a)
    gate(sameStructuredData(binding,cb.get(binding.name)),
      'candidate_binding_changed');
  gate(active.resources?.script?.etag && candidate.resources?.script?.etag &&
    active.resources.script.etag!==candidate.resources.script.etag,
    'expected_new_ui_code_missing');
  gate(sameStructuredData(active.resources.script.handlers,
      candidate.resources.script.handlers),
    'worker_handlers_changed');
  const ar={...active.resources.script_runtime},
    cr={...candidate.resources.script_runtime};
  delete ar.assets;
  delete cr.assets;
  gate(sameStructuredData(ar,cr),'non_asset_runtime_changed');
  // Assets MUST exist in the new version; their contents are intentionally
  // different because this is a visual UI update, not secret-only staging.
  gate(cr && candidate.resources.script_runtime.assets &&
    typeof candidate.resources.script_runtime.assets==='object',
    'new_assets_missing');
  // Keep active and candidate asset routing behavior equivalent; tolerate
  // only documented implicit-to-explicit defaults.
  const aa=active.resources.script_runtime.assets||{};
  const ca=candidate.resources.script_runtime.assets||{};
  for(const [name,defaultValue] of [
    ['html_handling','auto-trailing-slash'],
    ['not_found_handling','none'],
  ]){
    gate((aa[name]??defaultValue)===(ca[name]??defaultValue),
      'asset_routing_behavior_changed');
  }
  if('run_worker_first' in aa || 'run_worker_first' in ca)
    gate(sameStructuredData(aa.run_worker_first,ca.run_worker_first),
      'asset_worker_routing_changed');
  return Object.freeze({candidateId:candidate.id,activeId:active.id});
}
export function selectUiVersion(list,active) {
  gate(Array.isArray(list) && list.length>=2,'invalid_version_list');
  const found=list.filter(v=>
    v?.id && v.id!==active.id &&
    v.annotations?.['workers/message']===MESSAGE &&
    Number.isFinite(Date.parse(v.metadata?.created_on)) &&
    Date.parse(v.metadata.created_on)>
      Date.parse(active.metadata?.created_on));
  gate(found.length===1,'missing_or_duplicate_ui_version');
  const candidate=found[0];
  gate(list.every(v=>!v?.metadata?.created_on ||
    Date.parse(v.metadata.created_on)<=Date.parse(candidate.metadata.created_on)),
    'newer_unknown_cloudflare_version');
  return candidate.id;
}
export function assertReleaseReady({branch,head,remote,dirty,activeVersion,secrets}){
  gate(branch==='jill/rewards-work'&&head===remote&&!dirty,
    'work_source_not_synced_or_clean');
  gate(activeVersion===ACTIVE,'active_worker_changed');
  gate(Array.isArray(secrets),'unreadable_secret_names');
  for(const name of SECRETS)gate(secrets.includes(name),'missing_required_secret');
  return true;
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function cmd(args){
  gate(fs.existsSync(BIN),'missing_wrangler_runtime');
  const proc=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,stdio:['pipe','pipe','pipe'],
  });
  gate(!proc.error&&proc.status===0,'wrangler_command_failed');
  return String(proc.stdout||'');
}
function npmRun(script,{cwd=ROOT,canary=false}={}){
  // These are fixed repository-controlled script names, never secret values.
  const windows=process.platform==='win32';
  const proc=spawnSync(windows?'cmd.exe':'npm',
    windows?['/d','/s','/c','npm.cmd run '+script]:['run',script],{
      cwd,env:canary?{...process.env,JILL_BUILD_TARGET:'canary'}:process.env,
      shell:false,encoding:'utf8',stdio:'inherit',windowsHide:false,
    });
  gate(!proc.error&&proc.status===0,'build_or_test_failed');
}
function deployment(){
  return currentWorkerVersion(cmd(['deployments','status','--name',WORKER,'--config',CONFIG]));
}
function version(id){
  return JSON.parse(cmd(['versions','view',id,'--name',WORKER,'--config',CONFIG,'--json']));
}
function versionList(){
  return JSON.parse(cmd(['versions','list','--name',WORKER,'--config',CONFIG,'--json']));
}
function secretNames(){
  const raw=cmd(['secret','list','--name',WORKER,'--config',CONFIG]);
  const ix=raw.indexOf('[');
  gate(ix>=0,'unreadable_secret_names');
  return JSON.parse(raw.slice(ix)).map(x=>x.name);
}
async function assertHttp(pathname,expected){
  const res=await fetch(BASE+pathname,{redirect:'manual',signal:AbortSignal.timeout(20000)});
  if(expected==='denied')assertAnonymousInboxDenied(res.status);
  else gate(res.status===expected,'unexpected_http_status');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='preflight',ui;
  try{
    assertReleaseReady({
      branch:git('branch','--show-current'),
      head:git('rev-parse','HEAD'),
      remote:git('rev-parse','refs/remotes/origin/jill/rewards-work'),
      dirty:git('status','--porcelain','--untracked-files=no'),
      activeVersion:deployment(),secrets:secretNames(),
    });
    console.log('PASS active JILL HQ WORK, all 3 secrets and Owner setup OFF.');
    phase='tests';
    npmRun('test:work-merchant-inbox');
    npmRun('test:work-hq-inbox-ui');
    phase='build';
    const dist=path.join(APP,'dist');
    if(fs.existsSync(dist)){
      gate(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_build_directory');
      const archive=path.join(os.tmpdir(),'jill-work-hq-ui-backup-'+randomUUID());
      fs.renameSync(dist,archive);
      console.log('Previous local build archived under Windows temp.');
    }
    npmRun('typecheck',{cwd:APP});
    npmRun('build',{cwd:APP,canary:true});
    writeOAuthManifest({output:path.join(dist,'server/wrangler.oauth-canary.json')});
    const manifest=JSON.parse(fs.readFileSync(
      path.join(dist,'server/wrangler.oauth-canary.json'),'utf8'));
    assertWorkHqInboxManifest(manifest);
    npmRun('test:workerd-oauth',{cwd:APP});
    const configPath=path.join(dist,'server/wrangler.oauth-canary.json');
    cmd(['versions','upload','--dry-run','--config',configPath,
      '--message',MESSAGE]);
    gate(deployment()===ACTIVE,'active_version_changed_during_build');
    assertReleaseReady({
      branch:git('branch','--show-current'),
      head:git('rev-parse','HEAD'),
      remote:git('rev-parse','refs/remotes/origin/jill/rewards-work'),
      dirty:git('status','--porcelain','--untracked-files=no'),
      activeVersion:deployment(),secrets:secretNames(),
    });
    phase='upload';
    cmd(['versions','upload','--config',configPath,'--message',MESSAGE]);
    gate(deployment()===ACTIVE,'active_version_changed_after_upload');
    const active=version(ACTIVE);
    const id=selectUiVersion(versionList(),active);
    assertVersionBindings(active,version(id));
    console.log('PASS new WORK UI version staged INACTIVE: '+id);
    console.log('PASS OAuth, Owner OFF, D1 and all 3 existing secrets retained.');
    console.log('PASS identical non-asset runtime; original active Worker unchanged.');
    phase='approval';
    ui=createInterface({input:process.stdin,output:process.stdout});
    const approval=await ui.question(
      '\nType RELEASE JILL HQ WORK UI to deploy this version to WORK only: ');
    gate(approval==='RELEASE JILL HQ WORK UI','release_not_authorized');
    gate(deployment()===ACTIVE,'active_version_changed_before_release');
    assertVersionBindings(version(ACTIVE),version(id));
    phase='release';
    cmd(['versions','deploy',id+'@100%','--name',WORKER,'--config',CONFIG,
      '--yes','--message','JILL HQ WORK read-only Custom Orders UI']);
    phase='post_release';
    gate(deployment()===id,'deployed_version_mismatch');
    await assertHttp('/healthz',200);
    await assertHttp('/auth/login',200);
    await assertHttp('/app/requests','denied');
    await assertHttp('/app/setup-owner',410);
    console.log('PASS JILL HQ WORK new Custom Orders UI deployed: '+id);
    console.log('PASS health, OAuth login, anonymous inbox denial and Owner OFF.');
    console.log('Review signed-in Shopify WORK Admin > JILL HQ > Custom Orders.');
    console.log('LIVE/KEEP/My JILL/Rewards/Google QA unchanged by this command.');
  }catch(error){
    const safe=typeof error?.message==='string' &&
      /^[a-z][a-z0-9_]{2,90}$/.test(error.message)
      ?error.message:'unexpected_error';
    console.error('JILL HQ WORK UI '+phase+' STOPPED: '+safe);
    if(phase==='post_release')
      console.error('Cloudflare MAY have switched traffic; inspect deployment status before retry.');
    process.exitCode=1;
  }finally{ui?.close();}
}
