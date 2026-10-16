// WORK-only detail ON candidate. Only upload INACTIVE after Owner UI QA.
// --inspect is read-only. --stage rechecks, builds, tests and uploads but
// NEVER deploys traffic, creates Google deployments or changes secrets.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {writeOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';
import {prepareInactiveDetailManifest} from './stage-work-hq-detail-v9.mjs';
import {DETAIL_OFF_CANDIDATE}
  from './release-work-hq-detail-v9-off.mjs';
import {reconcileWorkQaDetailRemote}
  from './reconcile-work-hq-qa-detail-deployment.mjs';
import {verifyWorkQaDetailSourcePin}
  from './audit-work-hq-qa-detail-pin.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const WORKER='jill-order-desk-canary-work';
const CONFIG='./wrangler.canary.jsonc';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const SECRETS=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_HQ_MERCHANT_WRITE_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET',
];
const VARS={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
  JILL_WORK_MERCHANT_WRITES_ENABLED:'true',
};
export const DETAIL_ON_FLAG='JILL_WORK_HQ_DETAIL_ENABLED';
export const DETAIL_ON_MARKER=
  'JILL HQ WORK Google v9 exact request detail ON; INACTIVE owner-QA candidate';
export const DETAIL_ON_APPROVAL='STAGE JILL HQ WORK DETAIL V9 ON INACTIVE';
function gate(v,code){if(!v)throw Error(code);}
const baseNames=new Set([...SECRETS,...Object.keys(VARS),
  'JILL_ORDER_DESK_WORK_DB']);
export function prepareWorkDetailOnManifest(oauth){
  const prev=prepareInactiveDetailManifest(oauth);
  gate(!Object.hasOwn(prev.vars,DETAIL_ON_FLAG) &&
    Object.keys(prev.vars).length===4,'unsafe_detail_on_base');
  const candidate=structuredClone(prev);
  candidate.vars[DETAIL_ON_FLAG]='true';
  gate(candidate.name===WORKER &&
    Object.keys(candidate.vars).length===5 &&
    Object.entries(VARS).every(([key,value])=>
      candidate.vars[key]===value) &&
    candidate.vars[DETAIL_ON_FLAG]==='true' &&
    SECRETS.every(key=>!Object.hasOwn(candidate.vars,key)) &&
    candidate.d1_databases?.length===1 &&
    candidate.d1_databases[0].database_id===D1,
    'unsafe_detail_on_manifest');
  return candidate;
}
function bindingMap(version,flagOn){
  const bs=version?.resources?.bindings;
  const size=baseNames.size+(flagOn?1:0);
  gate(Array.isArray(bs)&&bs.length===size,'work_binding_count_drift');
  const out=new Map(bs.map(b=>[b?.name,b]));
  gate(out.size===size&&[...baseNames].every(key=>out.has(key)),
    'work_binding_names_drift');
  for(const name of SECRETS)
    gate(out.get(name)?.type==='secret_text',
      'work_secret_binding_drift');
  for(const [name,value] of Object.entries(VARS))
    gate(out.get(name)?.type==='plain_text' &&
      out.get(name).text===value,'work_security_flag_drift');
  gate(out.get('JILL_ORDER_DESK_WORK_DB')?.type==='d1' &&
    JSON.stringify(out.get('JILL_ORDER_DESK_WORK_DB')).includes(D1),
    'work_d1_binding_drift');
  const detail=out.get(DETAIL_ON_FLAG);
  gate(flagOn ? detail?.type==='plain_text'&&detail.text==='true' :
    !detail,'work_detail_flag_drift');
  return out;
}
export function verifyWorkDetailOnCandidate({active,candidate}={}){
  gate(active?.id===DETAIL_OFF_CANDIDATE &&
    typeof candidate?.id==='string' &&
    candidate.id!==DETAIL_OFF_CANDIDATE,'work_candidate_version_drift');
  const before=bindingMap(active,false),
    after=bindingMap(candidate,true);
  for(const [name,b] of before)
    gate(sameStructuredData(b,after.get(name)),
      'work_original_binding_changed');
  const a=active.resources,c=candidate.resources;
  gate(typeof a?.script?.etag==='string' &&
    a.script.etag && a.script.etag===c?.script?.etag,
    'work_script_fingerprint_changed');
  gate(sameStructuredData(a.script.handlers,c.script.handlers),
    'work_handler_changed');
  const rt=v=>{
    if(!v||typeof v!=='object')return null;
    const x={...v};delete x.assets;return x;
  };
  gate(sameStructuredData(rt(a.script_runtime),rt(c.script_runtime)),
    'work_runtime_changed');
  const route=v=>v?.script_runtime?.assets||{};
  for(const [name,def] of [
    ['html_handling','auto-trailing-slash'],
    ['not_found_handling','none'],
  ])gate((route(a)[name]??def)===(route(c)[name]??def),
    'work_asset_routing_changed');
  if('run_worker_first' in route(a)||'run_worker_first' in route(c))
    gate(sameStructuredData(route(a).run_worker_first,
      route(c).run_worker_first),'work_asset_routing_changed');
  return Object.freeze({
    active:DETAIL_OFF_CANDIDATE,candidate:candidate.id,
    addition:DETAIL_ON_FLAG,
  });
}
function git(...args){
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function cli(args){
  gate(fs.existsSync(BIN),'wrangler_runtime_missing');
  const p=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    maxBuffer:12*1024*1024,
  });
  gate(!p.error&&p.status===0,'wrangler_command_failed');
  return String(p.stdout||'');
}
function npmRun(script,{cwd=ROOT,canary=false}={}){
  const win=process.platform==='win32';
  const p=spawnSync(win?'cmd.exe':'npm',
    win?['/d','/s','/c','npm.cmd run '+script]:['run',script],{
      cwd,shell:false,encoding:'utf8',stdio:'inherit',
      env:canary?{...process.env,JILL_BUILD_TARGET:'canary'}:process.env,
    });
  gate(!p.error&&p.status===0,'work_local_test_or_build_failed');
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
export function selectInactiveDetailOnVersion(list,active){
  gate(Array.isArray(list)&&list.length>1&&list.length<=100 &&
    active?.id===DETAIL_OFF_CANDIDATE,'work_versions_invalid');
  const found=list.filter(v=>
    v?.annotations?.['workers/message']===DETAIL_ON_MARKER);
  gate(found.length===1&&found[0].id!==DETAIL_OFF_CANDIDATE,
    'detail_on_candidate_not_unique');
  const chosen=found[0],time=Date.parse(chosen.metadata?.created_on);
  gate(Number.isFinite(time)&&
    time>Date.parse(active.metadata?.created_on),
    'detail_on_candidate_not_newer');
  gate(list.every(v=>v.id===chosen.id||
    Number.isFinite(Date.parse(v.metadata?.created_on))&&
    Date.parse(v.metadata.created_on)<=time),
    'newer_unknown_work_version');
  return chosen.id;
}
async function inspect({requireNoCandidate=true}={}){
  gate(git('branch','--show-current')==='jill/rewards-work' &&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
    !git('status','--porcelain','--untracked-files=no'),
    'work_source_not_synced');
  const google=await reconcileWorkQaDetailRemote({root:ROOT});
  gate(google.state==='present_unprobed'&&google.version===9,
    'google_qa_v9_drift');
  verifyWorkQaDetailSourcePin({
    deploymentId:google.deploymentId,version:google.version,
  });
  gate(deployed()===DETAIL_OFF_CANDIDATE,'active_worker_changed');
  const active=view(DETAIL_OFF_CANDIDATE);
  bindingMap(active,false);
  if(requireNoCandidate)
    gate(!versions().some(x=>
      x?.annotations?.['workers/message']===DETAIL_ON_MARKER),
      'detail_on_candidate_already_staged');
  return active;
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  let phase='preflight',io=null;
  try{
    gate(process.argv.length===3&&
      ['--inspect','--stage'].includes(process.argv[2]),
      'invalid_work_stage_mode');
    const active=await inspect();
    console.log('PASS Google QA @9 full ID pinned; legacy @7 inbox isolated.');
    console.log('PASS existing WORK version '+active.id);
    console.log('PASS original 4 secrets/WORK D1/OAuth ON/Owner OFF/writes ON/detail OFF.');
    if(process.argv[2]==='--inspect'){
      console.log('READ ONLY. No upload, deployment, Google request or customer data.');
    }else{
      phase='tests';
      for(const script of [
        'test:work-hq-detail-v9-on-stage',
        'test:work-hq-google-exact-detail',
        'test:work-hq-qa-detail-pin',
        'test:work-hq-detail-view',
        'test:work-hq-merchant-command',
        'test:work-hq-request-auth-stages',
      ])npmRun(script);
      phase='build';
      const dist=path.join(APP,'dist');
      if(fs.existsSync(dist)){
        gate(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_dist');
        fs.renameSync(dist,path.join(os.tmpdir(),
          'jill-work-detail-on-build-'+randomUUID()));
      }
      npmRun('typecheck',{cwd:APP});
      npmRun('build',{cwd:APP,canary:true});
      const oauth=path.join(dist,'server/wrangler.oauth-canary.json');
      writeOAuthManifest({output:oauth});
      const manifest=path.join(dist,
        'server/wrangler.hq-detail-v9-on-INACTIVE.json');
      const config=prepareWorkDetailOnManifest(JSON.parse(
        fs.readFileSync(oauth,'utf8')));
      fs.writeFileSync(manifest,JSON.stringify(config,null,2)+'\n',{
        encoding:'utf8',flag:'wx',mode:0o600,
      });
      npmRun('test:workerd-oauth',{cwd:APP});
      npmRun('test:workerd-detail-on',{cwd:APP});
      const args=['--config',manifest,'--message',DETAIL_ON_MARKER];
      cli(['versions','upload','--dry-run',...args]);
      await inspect(); // prevent concurrent changes before upload
      io=createInterface({input:process.stdin,output:process.stdout});
      const answer=await io.question(
        '\nAfter Shopify WORK Owner UI QA, type '+DETAIL_ON_APPROVAL+
        ' to UPLOAD ONLY an inactive ON candidate: ');
      gate(answer===DETAIL_ON_APPROVAL,'operator_did_not_approve_stage');
      io.close();io=null;
      await inspect();
      phase='upload';
      cli(['versions','upload',...args]);
      phase='verify';
      gate(deployed()===DETAIL_OFF_CANDIDATE,
        'active_worker_changed_after_upload');
      const id=selectInactiveDetailOnVersion(versions(),active);
      const checked=verifyWorkDetailOnCandidate({
        active:view(DETAIL_OFF_CANDIDATE),candidate:view(id),
      });
      console.log('PASS full-detail ON candidate staged INACTIVE: '+checked.candidate);
      console.log('PASS ONLY added WORK detail flag true; four original secrets, D1, OAuth, Owner and writes unchanged.');
      console.log('PASS detail OFF version STILL ACTIVE: '+checked.active);
      console.log('Do not rerun stage. Feature ON has NOT been released to traffic.');
    }
  }catch(e){
    const safe=new Set([
      'invalid_work_stage_mode','work_source_not_synced',
      'google_qa_v9_drift','work_detail_v9_pin_mismatch',
      'uncertified_qa_detail_deployment','active_worker_changed',
      'work_binding_count_drift','work_binding_names_drift',
      'work_secret_binding_drift','work_security_flag_drift',
      'work_d1_binding_drift','work_detail_flag_drift',
      'detail_on_candidate_already_staged','wrangler_runtime_missing',
      'wrangler_command_failed','work_local_test_or_build_failed',
      'symlinked_dist','unsafe_detail_on_base',
      'unsafe_detail_on_manifest','operator_did_not_approve_stage',
      'active_worker_changed_after_upload','work_versions_invalid',
      'detail_on_candidate_not_unique','detail_on_candidate_not_newer',
      'newer_unknown_work_version','work_candidate_version_drift',
      'work_original_binding_changed','work_script_fingerprint_changed',
      'work_handler_changed','work_runtime_changed',
      'work_asset_routing_changed',
    ]);
    console.error('WORK detail v9 ON '+phase+' STOPPED: '+
      (safe.has(e?.message)?e.message:'uncertified_work_detail_on_state'));
    if(phase==='upload'||phase==='verify')
      console.error('An INACTIVE version may exist; inspect versions before retrying.');
    process.exitCode=1;
  }finally{io?.close();}
}
