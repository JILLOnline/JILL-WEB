// JILL HQ WORK: certify and stage the Google v9 detail-reader code INACTIVE.
// --inspect is read-only; --stage uploads ONE INACTIVE Cloudflare version.
// NEVER deploy traffic, change Shopify, rotate keys or enable detail reads.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {assertWorkHqInboxManifest,currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {writeOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';
import {reconcileWorkQaDetailRemote}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {verifyWorkQaDetailSourcePin}
  from './audit-work-hq-qa-detail-pin.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const WORKER='jill-order-desk-canary-work';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
export const DETAIL_BASELINE='52adfbde-afb6-453e-b779-7be6f4e02519';
export const DETAIL_STAGE_MARKER=
  'JILL HQ WORK Google exact detail v9 PINNED; UI staged inactive; detail OFF';
const SECRETS=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const VARS={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
const NAMES=new Set([...SECRETS,...Object.keys(VARS),'JILL_ORDER_DESK_WORK_DB']);
function gate(ok,code){if(!ok)throw Error(code);}
function guardBindings(ver){
  const bs=ver?.resources?.bindings;
  gate(Array.isArray(bs) && bs.length===NAMES.size,'work_binding_count_drift');
  const map=new Map(bs.map(b=>[b?.name,b]));
  gate(map.size===NAMES.size &&
    [...NAMES].every(n=>map.has(n)),'work_binding_names_drift');
  for(const n of SECRETS)
    gate(map.get(n)?.type==='secret_text','work_secret_binding_missing');
  for(const [n,v] of Object.entries(VARS))
    gate(map.get(n)?.type==='plain_text' &&
      map.get(n).text===v,'work_security_flag_drift');
  gate(map.get('JILL_ORDER_DESK_WORK_DB')?.type==='d1' &&
    JSON.stringify(map.get('JILL_ORDER_DESK_WORK_DB')).includes(D1),
    'work_d1_drift');
  gate(!map.has('JILL_WORK_HQ_DETAIL_ENABLED'),'detail_not_off');
  return map;
}
export function prepareInactiveDetailManifest(oauth){
  assertWorkHqInboxManifest(oauth);
  gate(oauth.name===WORKER && Object.keys(oauth.vars||{}).length===3 &&
    oauth.vars.JILL_WORK_OAUTH_ENABLED==='true' &&
    oauth.vars.JILL_WORK_HOST_STAGE==='canary' &&
    oauth.vars.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false',
    'work_oauth_manifest_drift');
  const next=structuredClone(oauth);
  next.vars.JILL_WORK_MERCHANT_WRITES_ENABLED='true';
  gate(Object.keys(next.vars).length===4 &&
    Object.entries(VARS).every(([name,val])=>next.vars[name]===val) &&
    !Object.hasOwn(next.vars,'JILL_WORK_HQ_DETAIL_ENABLED') &&
    SECRETS.every(name=>!Object.hasOwn(next.vars,name)),
    'unsafe_detail_candidate_manifest');
  return next;
}
function routingSafe(a,b){
  if(!a||!b)return false;
  for(const [k,def] of [
    ['html_handling','auto-trailing-slash'],
    ['not_found_handling','none'],
  ])if((a[k]??def)!==(b[k]??def))return false;
  if('run_worker_first' in a || 'run_worker_first' in b)
    if(!sameStructuredData(a.run_worker_first,b.run_worker_first))
      return false;
  return true;
}
export function verifyInactiveDetailCandidate({active,candidate}={}){
  gate(active?.id===DETAIL_BASELINE && candidate?.id &&
    candidate.id!==DETAIL_BASELINE,'work_version_changed');
  const old=guardBindings(active),fresh=guardBindings(candidate);
  for(const [n,b] of old)
    gate(sameStructuredData(b,fresh.get(n)),'work_binding_changed');
  const a=active.resources,c=candidate.resources;
  gate(a?.script?.etag && c?.script?.etag &&
    a.script.etag!==c.script.etag,'new_detail_code_missing');
  gate(sameStructuredData(a.script.handlers,c.script.handlers),
    'work_handler_drift');
  const withoutAssets=v=>{
    if(!v || typeof v!=='object')return null;
    const x={...v};delete x.assets;return x;
  };
  gate(sameStructuredData(withoutAssets(a.script_runtime),
    withoutAssets(c.script_runtime)),'work_runtime_drift');
  gate(routingSafe(a.script_runtime?.assets,c.script_runtime?.assets),
    'work_assets_routing_drift');
  return Object.freeze({active:active.id,candidate:candidate.id});
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function cli(args){
  gate(fs.existsSync(BIN),'local_wrangler_missing');
  const p=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!p.error && p.status===0,'wrangler_command_failed');
  return String(p.stdout||'');
}
function npmRun(script,{cwd=ROOT,canary=false}={}){
  const win=process.platform==='win32';
  const p=spawnSync(win?'cmd.exe':'npm',
    win?['/d','/s','/c','npm.cmd run '+script]:['run',script],{
      cwd,shell:false,encoding:'utf8',stdio:'inherit',
      env:canary?{...process.env,JILL_BUILD_TARGET:'canary'}:process.env,
    });
  gate(!p.error && p.status===0,'work_build_or_test_failed');
}
function deployed(){
  return currentWorkerVersion(cli(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));
}
function view(id){
  return JSON.parse(cli(['versions','view',id,
    '--name',WORKER,'--config',CONFIG,'--json']));
}
function versions(){
  return JSON.parse(cli(['versions','list',
    '--name',WORKER,'--config',CONFIG,'--json']));
}
function selectStaged(list,active){
  gate(Array.isArray(list) && list.length<=100 &&
    active?.id===DETAIL_BASELINE,'work_versions_unverifiable');
  const matches=list.filter(v=>
    v?.annotations?.['workers/message']===DETAIL_STAGE_MARKER);
  gate(matches.length===1 &&
    matches[0].id!==DETAIL_BASELINE,'detail_candidate_not_unique');
  const chosen=matches[0];
  gate(Number.isFinite(Date.parse(chosen.metadata?.created_on)) &&
    Number.isFinite(Date.parse(active.metadata?.created_on)) &&
    Date.parse(chosen.metadata.created_on)>
      Date.parse(active.metadata.created_on),'detail_candidate_not_newer');
  gate(list.every(v=>v.id===chosen.id ||
    Date.parse(v.metadata?.created_on)<=Date.parse(chosen.metadata.created_on)),
    'newer_unknown_worker_version');
  return chosen.id;
}
function sourceReady(){
  gate(git('branch','--show-current')==='jill/rewards-work' &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
    !git('status','--porcelain','--untracked-files=no'),
    'work_source_not_synced');
}
async function preflight(){
  sourceReady();
  const remote=await reconcileWorkQaDetailRemote({root:ROOT});
  gate(remote.state==='present_unprobed' && remote.version===9,
    'work_google_detail_v9_not_found');
  verifyWorkQaDetailSourcePin({
    deploymentId:remote.deploymentId,version:remote.version,
  });
  gate(deployed()===DETAIL_BASELINE,'active_worker_changed');
  const active=view(DETAIL_BASELINE);
  guardBindings(active);
  const all=versions();
  gate(!all.some(v=>v?.annotations?.['workers/message']===
    DETAIL_STAGE_MARKER),'detail_candidate_already_staged');
  console.log('PASS exact Google QA detail v9 pin matches deployment.');
  console.log('PASS current WORK Cloudflare Worker '+DETAIL_BASELINE);
  console.log('PASS all 4 existing secrets, D1, OAuth ON, Owner OFF, writes ON, detail OFF.');
  return active;
}
const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='preflight';
  try{
    gate(process.argv.length===3 &&
      ['--inspect','--stage'].includes(process.argv[2]),
      'invalid_work_detail_stage_mode');
    const active=await preflight();
    if(process.argv[2]==='--inspect'){
      console.log('READ ONLY. No Cloudflare or Google changes; existing WORK traffic unchanged.');
    }else{
      phase='tests';
      for(const name of [
        'test:work-hq-google-exact-detail',
        'test:work-hq-qa-detail-pin',
        'test:work-hq-detail-view',
        'test:work-hq-merchant-command',
        'test:work-hq-request-auth-stages',
        'test:work-hq-navigation-stage',
      ])npmRun(name);
      phase='build';
      const dist=path.join(APP,'dist');
      if(fs.existsSync(dist)){
        gate(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_work_build');
        fs.renameSync(dist,path.join(os.tmpdir(),
          'jill-work-detail-prior-'+randomUUID()));
        console.log('Previous ignored local dist archived to OS temp.');
      }
      npmRun('typecheck',{cwd:APP});
      npmRun('build',{cwd:APP,canary:true});
      const oauth=path.join(dist,'server/wrangler.oauth-canary.json');
      writeOAuthManifest({output:oauth});
      const manifest=path.join(dist,'server/wrangler.hq-detail-v9-inactive.json');
      const config=prepareInactiveDetailManifest(JSON.parse(
        fs.readFileSync(oauth,'utf8')));
      fs.writeFileSync(manifest,JSON.stringify(config,null,2)+'\n',
        {encoding:'utf8',flag:'wx',mode:0o600});
      npmRun('test:workerd-oauth',{cwd:APP});
      const args=['--config',manifest,'--message',DETAIL_STAGE_MARKER];
      cli(['versions','upload','--dry-run',...args]);
      gate(deployed()===DETAIL_BASELINE,'active_worker_changed');
      guardBindings(view(DETAIL_BASELINE));
      gate(!versions().some(v=>v?.annotations?.['workers/message']===
        DETAIL_STAGE_MARKER),'detail_candidate_already_staged');
      phase='upload';
      // Upload only: NO 'versions deploy' or 'wrangler deploy'.
      // Existing secret bindings must survive unchanged, or refuse rollout.
      cli(['versions','upload',...args]);
      phase='verify';
      gate(deployed()===DETAIL_BASELINE,'active_worker_changed_after_upload');
      const candidate=selectStaged(versions(),active);
      const receipt=verifyInactiveDetailCandidate({
        active:view(DETAIL_BASELINE),candidate:view(candidate),
      });
      console.log('PASS new WORK detail-v9 code staged INACTIVE: '+receipt.candidate);
      console.log('PASS same 4 secret bindings, D1, OAuth ON, Owner OFF, writes ON, detail OFF.');
      console.log('PASS current WORK version STILL ACTIVE: '+receipt.active);
      console.log('No customer reads, Google writes, Shopify, LIVE, KEEP or Rewards changes.');
      console.log('Do not activate this candidate until separately inspected.');
    }
  }catch(e){
    const allowed=new Set([
      'invalid_work_detail_stage_mode','work_source_not_synced',
      'work_google_detail_v9_not_found','work_detail_v9_pin_mismatch',
      'uncertified_qa_detail_deployment','active_worker_changed',
      'work_binding_count_drift','work_binding_names_drift',
      'work_secret_binding_missing','work_security_flag_drift',
      'work_d1_drift','detail_not_off','detail_candidate_already_staged',
      'local_wrangler_missing','wrangler_command_failed',
      'work_build_or_test_failed','symlinked_work_build',
      'work_oauth_manifest_drift','unsafe_detail_candidate_manifest',
      'active_worker_changed_after_upload','work_versions_unverifiable',
      'detail_candidate_not_unique','detail_candidate_not_newer',
      'newer_unknown_worker_version','work_version_changed',
      'work_binding_changed','new_detail_code_missing','work_handler_drift',
      'work_runtime_drift','work_assets_routing_drift',
    ]);
    console.error('WORK detail v9 '+phase+' STOPPED: '+
      (allowed.has(e?.message)?e.message:'uncertified_work_detail_state'));
    if(phase==='upload'||phase==='verify')
      console.error('An INACTIVE Cloudflare version might exist. Inspect before retrying.');
    process.exitCode=1;
  }
}
