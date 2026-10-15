// WORK-only: upload new JILL HQ request-management code AND the local
// dedicated HMAC secret as a SINGLE INACTIVE Cloudflare Worker version.
// Never switch traffic here. An independent approved release is required.
// Secret flows only through an ephemeral 0600 local JSON file (Wrangler
// --secrets-file); its value is never in argv, logs, tracked files or env.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {writeOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';
import {assertWorkHqInboxManifest,currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {privateWorkWriteKey} from './stage-work-hq-write-key.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const NAME='jill-order-desk-canary-work';
const ACTIVE='e67a2209-f6d9-4671-b6fc-33994015af30';
const STAGED_KEY='6b70350e-0a5f-4630-8888-fe8a356a0a54';
const D1='3f17c186-c794-4e00-8f20-017191373a19';
const SECRET='JILL_HQ_MERCHANT_WRITE_SECRET';
export const RELEASE_MARKER='JILL HQ WORK verified inline commands and source-cache v1; inactive';
const KEEP_SECRETS=['JILL_HQ_MERCHANT_READ_SECRET',
  'JILL_WORK_SESSION_KEY_B64','SHOPIFY_API_SECRET'];
const flags={
  JILL_WORK_HOST_STAGE:'canary',
  JILL_WORK_OWNER_BOOTSTRAP_ENABLED:'false',
  JILL_WORK_OAUTH_ENABLED:'true',
};

function gate(ok,code){if(!ok)throw Error(code);}
export function prepareWorkWriteManifest(config) {
  gate(config&&typeof config==='object'&&!Array.isArray(config),
    'invalid_candidate_config');
  assertWorkHqInboxManifest(config);
  gate(config.vars?.JILL_WORK_OAUTH_ENABLED==='true' &&
    config.vars?.JILL_WORK_MERCHANT_WRITES_ENABLED===undefined &&
    config.name===NAME, 'invalid_base_flags');
  const result=structuredClone(config);
  result.vars.JILL_WORK_MERCHANT_WRITES_ENABLED='true';
  gate(Object.keys(result.vars).length===Object.keys(config.vars).length+1 &&
    Object.entries(config.vars).every(([k,v])=>result.vars[k]===v) &&
    !Object.hasOwn(result.vars,SECRET),'invalid_write_manifest');
  return result;
}
function compareAssetPolicy(a,c) {
  // Compiled asset hashes and manifests SHOULD change with this UI upgrade.
  // Only routing semantics must remain equivalent to the active Worker.
  if(!a || !c || typeof a!=='object' || typeof c!=='object')return false;
  for(const [k,def] of [
    ['html_handling','auto-trailing-slash'],
    ['not_found_handling','none'],
  ])if((a[k]??def)!==(c[k]??def))return false;
  if('run_worker_first' in a || 'run_worker_first' in c)
    if(!sameStructuredData(a.run_worker_first,c.run_worker_first))return false;
  return true;
}
export function assertWriteReleaseVersion({active,stagedKey,candidate}) {
  gate(active?.id===ACTIVE && stagedKey?.id===STAGED_KEY &&
    candidate?.id && candidate.id!==active.id &&
    candidate.id!==stagedKey.id,'wrong_worker_version');
  const map=version=>{
    const all=version?.resources?.bindings;
    gate(Array.isArray(all),'missing_bindings');
    const out=new Map(all.map(x=>[x.name,x]));
    gate(out.size===all.length,'duplicate_bindings');
    return out;
  };
  const a=map(active),k=map(stagedKey),c=map(candidate);
  gate(a.size+1===k.size && !a.has(SECRET) &&
    k.get(SECRET)?.type==='secret_text' &&
    a.size+2===c.size && c.get(SECRET)?.type==='secret_text' &&
    c.get('JILL_WORK_MERCHANT_WRITES_ENABLED')?.type==='plain_text' &&
    c.get('JILL_WORK_MERCHANT_WRITES_ENABLED')?.text==='true',
    'unexpected_write_bindings');
  for(const name of KEEP_SECRETS)
    gate(a.get(name)?.type==='secret_text' &&
      k.get(name)?.type==='secret_text'&&
      c.get(name)?.type==='secret_text','required_secret_missing');
  for(const [name,value] of Object.entries(flags))
    gate(a.get(name)?.type==='plain_text'&&a.get(name)?.text===value &&
      k.get(name)?.text===value && c.get(name)?.text===value,
      'work_security_flag_drift');
  gate(JSON.stringify(a.get('JILL_ORDER_DESK_WORK_DB')||{}).includes(D1),
    'work_d1_mismatch');
  for(const [key,value] of a){
    gate(sameStructuredData(value,k.get(key)) &&
      sameStructuredData(value,c.get(key)),'original_binding_changed');
  }
  const ar=active.resources,kr=stagedKey.resources,cr=candidate.resources;
  gate(ar?.script?.etag && ar.script.etag===kr?.script?.etag &&
    cr?.script?.etag && ar.script.etag!==cr.script.etag,
    'candidate_code_not_updated');
  gate(sameStructuredData(ar.script.handlers,cr.script.handlers),
    'worker_entrypoint_changed');
  const dropAssets=x=>{
    if(!x || typeof x!=='object')return null;
    const rest={...x};
    delete rest.assets;
    return rest;
  };
  gate(sameStructuredData(dropAssets(ar.script_runtime),
    dropAssets(cr.script_runtime)), 'worker_runtime_drift');
  gate(compareAssetPolicy(ar.script_runtime?.assets,
    cr.script_runtime?.assets),'worker_asset_routing_drift');
  return Object.freeze({activeId:active.id,stagedId:stagedKey.id,
    candidateId:candidate.id});
}
export function selectWriteCandidate(list,active){
  gate(Array.isArray(list)&&list.length>0&&list.length<=100 &&
    active?.id===ACTIVE, 'invalid_worker_versions');
  const matches=list.filter(v=>v?.id!==ACTIVE &&
    v?.annotations?.['workers/message']===RELEASE_MARKER);
  gate(matches.length===1,'write_candidate_not_unique');
  const candidate=matches[0];
  gate(Number.isFinite(Date.parse(candidate.metadata?.created_on)) &&
    Number.isFinite(Date.parse(active.metadata?.created_on)) &&
    Date.parse(candidate.metadata.created_on)>
    Date.parse(active.metadata.created_on),'invalid_candidate_time');
  const newer=list.some(v=>v?.id!==candidate.id &&
    Number.isFinite(Date.parse(v.metadata?.created_on)) &&
    Date.parse(v.metadata.created_on)>Date.parse(candidate.metadata.created_on));
  gate(!newer,'newer_unknown_worker_version');
  return candidate.id;
}
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8'}).trim();}
function cli(args,{input}={}){
  gate(fs.existsSync(BIN),'local_wrangler_missing');
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    input,maxBuffer:12*1024*1024,
  });
  gate(!r.error && r.status===0,'wrangler_command_failed');
  return String(r.stdout||'');
}
function npmRun(name,{cwd=ROOT,canary=false}={}){
  const win=process.platform==='win32';
  const r=spawnSync(win?'cmd.exe':'npm',win?[
    '/d','/s','/c','npm.cmd run '+name]:['run',name],{
    cwd,shell:false,encoding:'utf8',stdio:'inherit',windowsHide:false,
    env:canary?{...process.env,JILL_BUILD_TARGET:'canary'}:process.env,
  });
  gate(!r.error&&r.status===0,'build_or_test_failed');
}
function deployed(){return currentWorkerVersion(cli([
  'deployments','status','--name',NAME,'--config',CONFIG]));}
function versions(){return JSON.parse(cli([
  'versions','list','--name',NAME,'--config',CONFIG,'--json']));}
function view(id){return JSON.parse(cli([
  'versions','view',id,'--name',NAME,'--config',CONFIG,'--json']));}

const invoked=process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked) {
  let phase='preflight',temp=null;
  try {
    gate(git('branch','--show-current')==='jill/rewards-work' &&
      git('rev-parse','HEAD')===
        git('rev-parse','refs/remotes/origin/jill/rewards-work') &&
      !git('status','--porcelain','--untracked-files=no'),
      'work_source_not_synced');
    gate(deployed()===ACTIVE,'active_worker_changed');
    // Owner has already verified this exact isolated key-only version,
    // not activated it. Ensure it was not silently switched or modified.
    const active=view(ACTIVE),prior=view(STAGED_KEY);
    const original=active.resources?.bindings||[];
    gate(prior.resources?.script?.etag===
      active.resources?.script?.etag && 
      original.every(x=>(prior.resources?.bindings||[]).some(y=>
        y.name===x.name&&sameStructuredData(x,y))) &&
      (prior.resources?.bindings||[]).length===original.length+1 &&
      (prior.resources.bindings||[]).some(x=>
        x.name===SECRET&&x.type==='secret_text'),
      'staged_write_key_drift');
    phase='tests';
    for(const name of ['test:work-merchant-inbox','test:work-hq-inbox-ui',
      'test:work-hq-request-detail','test:work-hq-source-cache',
      'test:work-hq-google-source-cache','test:work-hq-merchant-command',
      'test:work-hq-mail-outbox','test:work-hq-qa-write-key-probe',
      'test:work-hq-write-key-stage'])
      npmRun(name);
    phase='build';
    const dist=path.join(APP,'dist');
    if(fs.existsSync(dist)) {
      gate(!fs.lstatSync(dist).isSymbolicLink(),'symlinked_dist');
      fs.renameSync(dist,path.join(os.tmpdir(),'jill-hq-work-dist-'+randomUUID()));
    }
    npmRun('typecheck',{cwd:APP});
    npmRun('build',{cwd:APP,canary:true});
    const oauth=path.join(dist,'server/wrangler.oauth-canary.json');
    writeOAuthManifest({output:oauth});
    const work=prepareWorkWriteManifest(JSON.parse(fs.readFileSync(oauth,'utf8')));
    const manifest=path.join(dist,'server/wrangler.hq-write-canary.json');
    fs.writeFileSync(manifest,JSON.stringify(work,null,2)+'\n',{
      flag:'wx',mode:0o600});
    npmRun('test:workerd-oauth',{cwd:APP});
    const {full,folder}=localFilePath({repo:ROOT});
    gate(fs.existsSync(full)&&!fs.lstatSync(full).isSymbolicLink() &&
      !fs.lstatSync(folder).isSymbolicLink(),'private_vault_missing');
    const secret=privateWorkWriteKey(fs.readFileSync(full,'utf8'));
    // JSON secret input exists only for the few milliseconds of Wrangler
    // upload, in a private randomized OS temp directory; ALWAYS delete.
    temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-hq-private-stage-'));
    const secretPath=path.join(temp,'work-secret.json');
    fs.writeFileSync(secretPath,JSON.stringify({[SECRET]:secret}),{
      flag:'wx',mode:0o600});
    cli(['versions','upload','--dry-run','--config',manifest,
      '--secrets-file',secretPath,'--message',RELEASE_MARKER]);
    gate(deployed()===ACTIVE,'active_worker_changed');
    phase='stage';
    cli(['versions','upload','--config',manifest,
      '--secrets-file',secretPath,'--message',RELEASE_MARKER]);
    gate(deployed()===ACTIVE,'active_worker_changed_after_stage');
    const id=selectWriteCandidate(versions(),active);
    const checked=assertWriteReleaseVersion({
      active:view(ACTIVE),stagedKey:view(STAGED_KEY),candidate:view(id),
    });
    console.log('PASS JILL HQ WORK new code + verified key staged INACTIVE: '+checked.candidateId);
    console.log('PASS original secrets, WORK D1, OAuth ON, Owner commissioning OFF.');
    console.log('PASS write controls opt-in TRUE only on inactive candidate.');
    console.log('PASS active dashboard unchanged: '+checked.activeId);
    console.log('No LIVE changes, request writes, customer messages or emails.');
    console.log('Release requires separate review and approval.');
  } catch(err) {
    const codes=new Set([
      'work_source_not_synced','active_worker_changed','staged_write_key_drift',
      'build_or_test_failed','symlinked_dist','local_wrangler_missing',
      'wrangler_command_failed','active_worker_changed_after_stage',
      'private_vault_missing','wrong_worker_version','missing_bindings',
      'duplicate_bindings','unexpected_write_bindings','required_secret_missing',
      'work_security_flag_drift','work_d1_mismatch','original_binding_changed',
      'candidate_code_not_updated','worker_entrypoint_changed',
      'worker_runtime_drift','worker_asset_routing_drift','invalid_worker_versions',
      'write_candidate_not_unique','invalid_candidate_time',
      'newer_unknown_worker_version','invalid_candidate_config',
      'invalid_base_flags','invalid_write_manifest',
    ]);
    console.error('JILL HQ WORK '+phase+' STOPPED: '+
      (codes.has(err?.message)?err.message:'unverified_candidate_state'));
    if(phase==='stage')console.error('An INACTIVE candidate might exist. Do not rerun before inspection.');
    process.exitCode=1;
  } finally {
    if(temp)fs.rmSync(temp,{recursive:true,force:true});
  }
}
