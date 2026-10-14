// JILL HQ WORK: first deploy the merchant inbox shell with its Google read secret ABSENT.
// This command cannot provision secrets, invoke Google Apps Script or touch Shopify/LIVE.
// Owner authentication and D1 access remain canonical; no merchant writes are enabled.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createInterface} from 'node:readline/promises';
import {pathToFileURL} from 'node:url';
import {writeOAuthManifest} from './prepare-work-canary-oauth-manifest.mjs';

const ROOT=path.resolve(new URL('../',import.meta.url).pathname);
const APP=path.join(ROOT,'services/jill-order-desk/app-home');
const WORKER='jill-order-desk-canary-work';
const DB='3f17c186-c794-4e00-8f20-017191373a19';
const HOST='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const EXPECTED_SECRET_NAMES=['SHOPIFY_API_SECRET','JILL_WORK_SESSION_KEY_B64'];

function assert(ok,reason) {if(!ok)throw Error('WORK HQ canary rollout refused: '+reason);}
export function assertWorkHqInboxManifest(config) {
  assert(config && !Array.isArray(config) && typeof config==='object','invalid config');
  assert(config.name===WORKER,'wrong Worker');
  assert(config.vars?.JILL_WORK_HOST_STAGE==='canary','wrong stage');
  assert(config.vars?.JILL_WORK_OAUTH_ENABLED==='true','OAuth must be enabled');
  assert(config.vars?.JILL_WORK_OWNER_BOOTSTRAP_ENABLED==='false','Owner setup must be OFF');
  assert(!('JILL_HQ_MERCHANT_READ_SECRET' in config.vars),'secret in plaintext variables');
  assert(config.d1_databases?.length===1 &&
    config.d1_databases[0].database_id===DB &&
    config.d1_databases[0].binding==='JILL_ORDER_DESK_WORK_DB',
    'wrong WORK D1 binding');
  assert(config.compatibility_flags?.includes('nodejs_compat'),'missing compatibility flag');
  return true;
}
export function currentWorkerVersion(output) {
  const versions=[...String(output||'').matchAll(/Version\(s\):\s*\(100%\)\s*([0-9a-f-]{36})/g)];
  assert(versions.length===1,'cannot identify unique 100% deployed Worker');
  return versions[0][1];
}
export function assertSecretNames(raw) {
  const idx=String(raw||'').indexOf('[');
  assert(idx>=0,'cannot parse Cloudflare secret list');
  let parsed;
  try{parsed=JSON.parse(String(raw).slice(idx));}
  catch{throw Error('WORK HQ canary rollout refused: malformed secret list');}
  assert(Array.isArray(parsed),'invalid Worker secrets response');
  const names=new Set(parsed.map(s=>s?.name));
  for(const key of EXPECTED_SECRET_NAMES)assert(names.has(key),'missing '+key);
  assert(!names.has('JILL_HQ_MERCHANT_READ_SECRET'),
    'merchant source secret already exists; this is not a disconnected inbox rollout');
  return true;
}
function git(...args) {
  return execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
}
function tool(program,args,{cwd=ROOT,env=process.env,capture=false}={}) {
  const windows=process.platform==='win32';
  const res=spawnSync(windows?program+'.cmd':program,args,{
    cwd,env,encoding:'utf8',shell:windows,maxBuffer:8*1024*1024,
    stdio:capture?'pipe':'inherit',
  });
  if(res.error||res.status!==0) {
    throw Error(program+' '+args[0]+' failed; no further steps attempted');
  }
  return capture?String(res.stdout||''):'';
}
async function http(pathname,expected) {
  const res=await fetch(HOST+pathname,{
    method:'GET',redirect:'manual',signal:AbortSignal.timeout(20000),
  });
  assert(res.status===expected,pathname+' returned HTTP '+res.status);
}
const run=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(run) {
  try{
    assert(git('branch','--show-current')==='jill/rewards-work','wrong Git branch');
    assert(git('rev-parse','HEAD')===git('rev-parse','refs/remotes/origin/jill/rewards-work'),
      'local source must equal fetched WORK remote');
    assert(!git('status','--porcelain','--untracked-files=no'),
      'tracked local changes; preserve your work');
    // Before touching the local build or asking for deployment approval,
    // assert Google feed secret is absent, preserving disabled first rollout.
    assertSecretNames(tool('npx',['--no-install','wrangler','secret','list',
      '--name',WORKER,'--config','./wrangler.canary.jsonc'],{cwd:APP,capture:true}));
    const initial=currentWorkerVersion(tool('npx',[
      '--no-install','wrangler','deployments','status','--name',WORKER,
      '--config','./wrangler.canary.jsonc'],{cwd:APP,capture:true}));
    console.log('PASS WORK Worker baseline '+initial);
    console.log('PASS merchant Google read secret is absent; source stays disconnected');
    tool('npm',['run','test:work-merchant-inbox']);
    tool('npm',['run','test:work-hq-google-merchant-feed']);
    const output=path.join(APP,'dist');
    if(fs.existsSync(output)){
      const archive=path.join(os.tmpdir(),'jill-hq-inbox-prior-dist-'+randomUUID());
      fs.renameSync(output,archive);
      console.log('Previous local dist archived: '+archive);
    }
    tool('npm',['run','typecheck'],{cwd:APP});
    tool('npm',['run','build'],{cwd:APP,env:{...process.env,JILL_BUILD_TARGET:'canary'}});
    const manifest=path.join(APP,'dist/server/wrangler.oauth-canary.json');
    writeOAuthManifest({output:manifest});
    assertWorkHqInboxManifest(JSON.parse(fs.readFileSync(manifest,'utf8')));
    tool('npm',['run','test:workerd-oauth'],{cwd:APP});
    tool('npx',['--no-install','wrangler','deploy','--dry-run',
      '--config',manifest],{cwd:APP});
    // Detect even a concurrent Cloudflare deployment. Never overwrite blindly.
    const still=currentWorkerVersion(tool('npx',[
      '--no-install','wrangler','deployments','status','--name',WORKER,
      '--config','./wrangler.canary.jsonc'],{cwd:APP,capture:true}));
    assert(still===initial,'live Worker changed while preparing candidate');
    assertSecretNames(tool('npx',['--no-install','wrangler','secret','list',
      '--name',WORKER,'--config','./wrangler.canary.jsonc'],{cwd:APP,capture:true}));
    console.log('WORK-only OAuth enabled, Owner commissioning OFF, merchant feed unconfigured.');
    const ui=createInterface({input:process.stdin,output:process.stdout});
    let answer='';
    try{answer=await ui.question('Type DEPLOY WORK INBOX SHELL to authorize Cloudflare rollout: ');}
    finally{ui.close();}
    assert(answer==='DEPLOY WORK INBOX SHELL','no deployment authorization');
    tool('npx',['--no-install','wrangler','deploy','--config',manifest],{cwd:APP});
    await http('/healthz',200);
    await http('/auth/login',200);
    await http('/app/requests',410);
    await http('/app/setup-owner',410);
    console.log('PASS JILL HQ inbox shell deployed to WORK canary.');
    console.log('Merchant Google read source: NOT CONNECTED (by design).');
    console.log('Cloudflare secrets, Google QA, customer account and LIVE: UNCHANGED.');
    console.log('Next: sign in to Shopify WORK Admin > JILL HQ > Custom Orders inbox.');
  }catch(error){
    console.error(error?.message??String(error));
    process.exitCode=1;
  }
}
