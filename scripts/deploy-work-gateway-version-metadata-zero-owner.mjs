// JILL WORK gateway NEW metadata candidate 0% release.
// SOURCE ONLY. DO NOT RUN without a separate explicit Owner approval.
// EXACTLY ONE Cloudflare versions deploy; original remains 100%.
// Anonymous GET-only probes. NO Google, Shopify, customer POST, R2,
// paid logging, secret writes, LIVE/KEEP, automatic rollback or retry.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {
  WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,NEW,UPLOAD_COMMIT,
  OVERRIDE_HEADER,VERSION_HEADER,
  exactManifest,exactAllocation,inspectNewInactiveVersion,exactNewVersion,
  releaseArguments,overrideValue,metadataProbeUrl,
  verifyNewZeroAllocation,certifyProbe,certifyBaselineHealth,
} from './work-gateway-version-metadata-zero-policy.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CFG='./wrangler.toml';
const RECEIPT='work-gateway-metadata-100-original-0-candidate-once-20261017.json';
const fail=x=>{throw Error('gateway_metadata_owner_zero_'+x);};
const ok=(value,code)=>{if(!value)fail(code);};
function git(...a){
  try{return execFileSync('git',['-C',ROOT,...a],{
    windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:8192,
  }).trim();}catch{fail('git_unverifiable');}
}
function sourceGuard(){
  ok(process.platform==='win32','owner_windows_only');
  ok(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_source_unsynced');
  ok(git('cat-file','-t',UPLOAD_COMMIT)==='commit',
    'uploaded_source_commit_unavailable');
  const sensitive=[
    'services/custom-order-cloudflare',
    'backend/custom-order-gateway.mjs',
    'backend/custom-order-work-proxy-route.mjs',
    'backend/shopify-work-app-proxy-auth.mjs',
    'backend/custom-order-account-read.mjs',
    'backend/customer-account-work-session.mjs',
  ];
  ok(git('diff','--name-only',UPLOAD_COMMIT,'HEAD','--',...sensitive)==='',
    'uploaded_gateway_source_changed');
  exactManifest(fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8'));
  ok(fs.existsSync(CLI),'local_wrangler_missing');
  return git('rev-parse','HEAD');
}
function cli(a,{timeout=60000}={}){
  const r=spawnSync(process.execPath,[CLI,...a],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Never print/snapshot full stdout or stderr: may contain account data.
  ok(!r.error&&!r.signal&&r.status===0,'wrangler_failed');
  return String(r.stdout||'');
}
function json(a){
  try{return JSON.parse(cli(a));}
  catch{fail('cloudflare_json_unverifiable');}
}
const commands={
  deployments:['deployments','list','--name',WORKER,'--config',CFG,'--json'],
  status:['deployments','status','--name',WORKER,'--config',CFG],
  versions:['versions','list','--name',WORKER,'--config',CFG,'--json'],
};
function view(id){
  return json(['versions','view',id,'--name',WORKER,
    '--config',CFG,'--json']);
}
function activeStatus(){
  try{return currentWorkerVersion(cli(commands.status));}
  catch{fail('current_worker_unverifiable');}
}
function preflight(){
  const baseline=exactAllocation(json(commands.deployments));
  ok(baseline.deployment_id===DEPLOYMENT&&activeStatus()===ACTIVE,
    'unexpected_original_allocation');
  const uploaded=exactNewVersion({
    versions:json(commands.versions),commit:UPLOAD_COMMIT,
  });
  ok(uploaded===NEW,'candidate_identity_changed');
  inspectNewInactiveVersion({
    original:view(ACTIVE),previous:view(PREVIOUS),candidate:view(NEW),
  });
  ok(exactAllocation(json(commands.deployments)).deployment_id===DEPLOYMENT&&
    activeStatus()===ACTIVE,'concurrent_gateway_change');
  return baseline;
}
function receiptPath(){
  const base=process.env.LOCALAPPDATA;
  ok(typeof base==='string'&&path.isAbsolute(base)&&
    !/(?:^|[\\/])(OneDrive|Dropbox|Google Drive)(?:[\\/]|$)/i.test(base),
    'private_receipt_location_unavailable');
  const root=path.join(base,'JILL-WEB');
  const dir=path.join(root,'private-release-receipts');
  for(const p of [root,dir]){
    fs.mkdirSync(p,{recursive:true,mode:0o700});
    ok(!fs.lstatSync(p).isSymbolicLink(),
      'receipt_location_symlink_refused');
  }
  return path.join(dir,RECEIPT);
}
function consumeOnce(file,commit){
  let fd;
  try{
    fd=fs.openSync(file,'wx',0o600);
    fs.writeFileSync(fd,JSON.stringify({
      operation:'WORK_GATEWAY_METADATA_100_ORIGINAL_0_NEW_ONCE',
      source_commit:commit,old:ACTIVE,replaced_zero:PREVIOUS,
      new_candidate:NEW,from_deployment:DEPLOYMENT,
      reserved_at:new Date().toISOString(),retry_allowed:false,
    })+'\n');
    fs.fsyncSync(fd);
  }catch{fail('approval_spent_or_receipt_failed');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function health({pinned=false}={}){
  const url=pinned?metadataProbeUrl(randomUUID()):
    metadataProbeUrl(randomUUID()).split('?',1)[0];
  const headers={Accept:'application/json','Cache-Control':'no-store'};
  if(pinned)headers[OVERRIDE_HEADER]=overrideValue();
  let res;
  try{res=await fetch(url,{
    method:'GET',redirect:'manual',credentials:'omit',headers,
    signal:AbortSignal.timeout(15000),
  });}
  catch{fail('anonymous_health_unavailable');}
  const mime=(res.headers.get('content-type')||'')
    .split(';',1)[0].trim().toLowerCase();
  let body;
  try {
    const raw=await res.text();
    ok(raw.length>0&&raw.length<=512,'unexpected_health_size');
    body=JSON.parse(raw);
  }catch{fail('health_unreadable');}
  return {
    status:res.status,mime,body,
    versionHeader:res.headers.get(VERSION_HEADER),
    cacheControl:res.headers.get('cache-control'),
    redirect:res.headers.get('location'),
  };
}
async function execute(){
  const currentCommit=sourceGuard();
  const receipt=receiptPath();
  ok(!fs.existsSync(receipt),'approval_already_spent');
  preflight();
  certifyBaselineHealth(await health());
  // The authorized deployment MUST be available as a Wrangler dry run.
  cli([...releaseArguments(),'--dry-run'],{timeout:60000});
  ok(sourceGuard()===currentCommit,
    'source_changed_before_deployment');
  preflight();
  ok(!fs.existsSync(receipt),'approval_already_spent');
  console.log('PASS preflight: source fixed to uploaded code, original 100% and previous repair 0%, new metadata version verified.');
  console.log('PASS WORK anonymous baseline health, version metadata binding, and deployment dry-run.');
  let attempted=false,phase='deployment';
  try {
    // Separate scoped Owner permission will be consumed once BEFORE write.
    consumeOnce(receipt,currentCommit);
    attempted=true;
    cli(releaseArguments(),{timeout:120000});
    phase='deployment_readback';
    const result=verifyNewZeroAllocation(json(commands.deployments));
    ok(activeStatus()===ACTIVE,'active_worker_not_original');
    console.log('PASS WORK new 100%-original / 0%-metadata candidate deployment: '+result.deployment_id);
    phase='candidate_version_health';
    certifyProbe(await health({pinned:true}));
    const verified=verifyNewZeroAllocation(json(commands.deployments),{
      previousDeployment:DEPLOYMENT,
    });
    ok(verified.deployment_id===result.deployment_id&&
      activeStatus()===ACTIVE,'deployment_changed_during_probe');
    console.log('PASS executed Cloudflare candidate '+NEW+
      ' (runtime version metadata matched the pinned health request).');
    console.log('PASS original 100%; new metadata 0%; old repaired candidate remains in version history.');
    console.log('HOLD: Google HMAC, Shopify app proxy, HQ Owner inbox and My JILL real customer session still NOT tested.');
    console.log('ONE-TIME APPROVAL SPENT. DO NOT RUN AGAIN.');
  }catch(e){
    const msg=String(e?.message||'');
    const safe=/^(gateway_metadata_owner_zero_|gateway_metadata_zero_|gateway_metadata_upload_|gateway_inactive_policy_|work_gateway_tail_)[a-z0-9_]+$/.test(msg)?
      msg:'gateway_metadata_owner_zero_unverified';
    console.error('HOLD WORK metadata 0% deployment: '+safe+' at '+phase);
    console.error(attempted?
      'Cloudflare deployment MAY have committed. DO NOT RETRY. Inspect deployment read-only before any further action.':
      'No remote deployment was attempted by this run.');
    console.error('No automatic rollback, customer request, secret changes or traffic promotion authorized.');
    process.exitCode=1;
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    ok(process.argv.length===2,'extra_options_refused');
    await execute();
  }catch(e){
    const msg=String(e?.message||'');
    console.error('STOP WORK metadata 0% preflight: '+
      (/^(gateway_metadata_owner_zero_|gateway_metadata_zero_|gateway_metadata_upload_|gateway_inactive_policy_|work_gateway_tail_)[a-z0-9_]+$/.test(msg)?
        msg:'gateway_metadata_owner_zero_unverified'));
    console.error('No deployment retries, new order submissions, Cloudflare uploads or other mutations authorized.');
    process.exitCode=1;
  }
}
