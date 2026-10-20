// Explicit local WORK-only staging. Wrangler "versions secret put" creates an
// INACTIVE version; never uses "secret put" (which deploys immediately).
// Secret is read from the owner's private vault and supplied via stdin only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {localFilePath} from './initialize-jill-private-catalog.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {sameStructuredData} from './release-work-hq-merchant-inbox.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const BIN=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.canary.jsonc';
const WORKER='jill-order-desk-canary-work';
const SECRET='JILL_HQ_MERCHANT_WRITE_SECRET';
const MESSAGE='JILL HQ WORK isolated merchant WRITE key — staged only';
const REQUIRED=[
  'JILL_HQ_MERCHANT_READ_SECRET','JILL_WORK_SESSION_KEY_B64',
  'SHOPIFY_API_SECRET',
];
const BINDING_DB='JILL_ORDER_DESK_WORK_DB';
export function privateWorkWriteKey(text) {
  if(typeof text!=='string')throw Error('invalid_private_catalog');
  function get(sectionName){
    const lines=text.split(/\r?\n/);
    const indexes=lines.flatMap((line,i)=>line===sectionName?[i]:[]);
    if(indexes.length!==1)throw Error('invalid_work_section');
    const at=indexes[0],found=[];
    for(let i=at+1;i<lines.length && !/^\[[A-Za-z0-9._-]+\]$/.test(lines[i]);i++)
      if(lines[i].startsWith(SECRET+'='))found.push(lines[i].slice(SECRET.length+1).trim());
    if(found.length!==1 || !/^[A-Za-z0-9_-]{48,96}$/.test(found[0]))
      throw Error('missing_or_invalid_work_write_key');
    return found[0];
  }
  const qa=get('[WORK.GOOGLE_CUSTOM_ORDERS_QA]');
  const worker=get('[WORK.CLOUDFLARE_ORDER_DESK]');
  if(qa!==worker)throw Error('work_write_key_mismatch');
  return worker;
}
export function verifyWorkSecretCandidate(active,candidate) {
  if(!active?.id||!candidate?.id||candidate.id===active.id)
    throw Error('candidate_not_inactive');
  const a=active.resources?.bindings,c=candidate.resources?.bindings;
  if(!Array.isArray(a)||!Array.isArray(c))throw Error('missing_bindings');
  const originals=new Map(a.map(v=>[v.name,v]));
  const staged=new Map(c.map(v=>[v.name,v]));
  if(originals.size!==a.length||staged.size!==c.length||
     staged.size!==originals.size+1 ||
     originals.has(SECRET) || staged.get(SECRET)?.type!=='secret_text')
    throw Error('invalid_secret_change');
  for(const name of REQUIRED)if(originals.get(name)?.type!=='secret_text')
    throw Error('missing_original_secret');
  for(const [name,value] of originals)
    if(!sameStructuredData(value,staged.get(name)))
      throw Error('binding_changed');
  if(!JSON.stringify(originals.get(BINDING_DB)||{}).includes(
    '3f17c186-c794-4e00-8f20-017191373a19'))
    throw Error('wrong_work_d1');
  for(const [name,value] of [
    ['JILL_WORK_HOST_STAGE','canary'],
    ['JILL_WORK_OWNER_BOOTSTRAP_ENABLED','false'],
    ['JILL_WORK_OAUTH_ENABLED','true'],
  ])if(originals.get(name)?.text!==value||originals.get(name)?.type!=='plain_text')
    throw Error('unsafe_work_flags');
  if(!sameStructuredData(active.resources?.script?.etag,
     candidate.resources?.script?.etag))
    throw Error('unexpected_worker_code');
  return true;
}
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8'}).trim();}
function wrangler(args,{input}={}){
  if(!fs.existsSync(BIN))throw Error('missing_local_wrangler');
  const r=spawnSync(process.execPath,[BIN,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    input,maxBuffer:8*1024*1024,
  });
  // Never print stderr/stdout from a secret-input command.
  if(r.error||r.status!==0)throw Error('wrangler_command_failed');
  return String(r.stdout||'');
}
function activeId(){
  return currentWorkerVersion(wrangler(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));
}
function versions(){return JSON.parse(wrangler(['versions','list',
  '--name',WORKER,'--config',CONFIG,'--json']));}
function inspect(id){return JSON.parse(wrangler(['versions','view',id,
  '--name',WORKER,'--config',CONFIG,'--json']));}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try {
    if(git('branch','--show-current')!=='jill/rewards-work'||
      git('status','--porcelain','--untracked-files=no')||
      git('rev-parse','HEAD')!==git('rev-parse','refs/remotes/origin/jill/rewards-work'))
      throw Error('work_source_not_synced');
    const {folder,full}=localFilePath({repo:ROOT});
    if(!fs.existsSync(full)||fs.lstatSync(full).isSymbolicLink()||
       fs.lstatSync(folder).isSymbolicLink())
      throw Error('missing_local_private_vault');
    const key=privateWorkWriteKey(fs.readFileSync(full,'utf8'));
    const before=activeId();
    const previous=versions();
    const active=inspect(before);
    if(active?.id!==before)throw Error('work_active_changed');
    // Secret-input subprocess emits no sensitive output. NEVER put key in
    // command arguments, environment variables or PowerShell history.
    wrangler(['versions','secret','put',SECRET,'--name',WORKER,
      '--config',CONFIG,'--message',MESSAGE],{input:key+'\n'});
    if(activeId()!==before)throw Error('unexpected_active_worker_change');
    const after=versions();
    const prior=new Set(previous.map(v=>v.id));
    const found=after.filter(v=>!prior.has(v.id)&&
      v.annotations?.['workers/message']===MESSAGE);
    if(found.length!==1)throw Error('unknown_staged_version');
    verifyWorkSecretCandidate(active,inspect(found[0].id));
    console.log('PASS new WORK merchant WRITE secret staged INACTIVE: '+found[0].id);
    console.log('PASS old OAuth/Owner/D1/read secret/session/Shopify bindings preserved.');
    console.log('PASS active WORK deployment unchanged: '+before);
    console.log('NO deployment, LIVE changes or email messages occurred.');
  }catch(error){
    const allowed=new Set([
      'invalid_private_catalog','invalid_work_section',
      'missing_or_invalid_work_write_key','work_write_key_mismatch',
      'candidate_not_inactive','missing_bindings','invalid_secret_change',
      'missing_original_secret','binding_changed','wrong_work_d1',
      'unsafe_work_flags','unexpected_worker_code','missing_local_wrangler',
      'wrangler_command_failed','work_source_not_synced',
      'missing_local_private_vault','work_active_changed',
      'unexpected_active_worker_change','unknown_staged_version',
    ]);
    console.error('WORK write-secret staging STOPPED: '+
      (allowed.has(error?.message)?error.message:'unverified_remote_state'));
    process.exitCode=1;
  }
}
