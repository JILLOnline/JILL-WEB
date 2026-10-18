// PREPARED SOURCE ONLY. DO NOT INVOKE until separate explicit Owner approval.
// One potential Cloudflare deployment: JILL WORK gateway candidate 100%,
// original 0% retained for separately approved recovery. Never LIVE/KEEP.
// One anonymous unpinned GET after a successful deployment. Never POST.
// On timeout/inconclusive outcome: HOLD, no retries, no automatic rollback.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {
  WORKER,ORIGINAL,CANDIDATE,CURRENT_DEPLOYMENT,
  HOST,VERSION_HEADER,VERSION_PARAMETER,
  verifiedBaseline,certifiedPromotion,certifyUnpinnedRuntime,promotionArgs,
} from './work-custom-order-candidate-promotion-policy.mjs';
import {
  PREVIOUS,exactManifest,inspectNewInactiveVersion,exactNewVersion,
} from './work-gateway-version-metadata-inactive-policy.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CFG='./wrangler.toml';
const SOURCE_COMMIT='a4a9840ce83e04dd85f7f2e306cdcdd037b56d6a';
const RECEIPT='work-custom-order-candidate-100-original-0-ONCE-20261017.json';
const fail=x=>{throw Error('work_custom_promote_owner_'+x);};
const ok=(condition,reason)=>{if(!condition)fail(reason);};
function git(...a){
  try{return execFileSync('git',['-C',ROOT,...a],{
    windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:8192,
  }).trim();}catch{fail('git_unavailable');}
}
function sourceGuard(){
  ok(process.platform==='win32','windows_owner_only');
  ok(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_branch_unsynced');
  ok(git('cat-file','-t',SOURCE_COMMIT)==='commit','upload_commit_missing');
  ok(git('diff','--name-only',SOURCE_COMMIT,'HEAD','--',
    'services/custom-order-cloudflare',
    'backend/custom-order-gateway.mjs',
    'backend/custom-order-work-proxy-route.mjs',
    'backend/shopify-work-app-proxy-auth.mjs',
    'backend/custom-order-account-read.mjs',
    'backend/customer-account-work-session.mjs')==='',
    'worker_backend_changed_since_upload');
  exactManifest(fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8'));
  ok(fs.existsSync(CLI),'wrangler_missing');
  return git('rev-parse','HEAD');
}
function cli(args,{timeout=60000}={}){
  const r=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  // Do not expose provider stdout/stderr: both may contain account metadata.
  ok(!r.error&&!r.signal&&r.status===0,'wrangler_failed');
  return String(r.stdout||'');
}
function json(a){
  try{return JSON.parse(cli(a));}
  catch{fail('cloudflare_json_unverified');}
}
const commands={
  deployments:['deployments','list','--name',WORKER,'--config',CFG,'--json'],
  status:['deployments','status','--name',WORKER,'--config',CFG],
  versions:['versions','list','--name',WORKER,'--config',CFG,'--json'],
};
function current(){
  try{return currentWorkerVersion(cli(commands.status));}
  catch{fail('worker_status_unverified');}
}
function version(id){
  return json(['versions','view',id,'--name',WORKER,
    '--config',CFG,'--json']);
}
function preflight(){
  const currentDeployment=verifiedBaseline(json(commands.deployments));
  ok(currentDeployment.deployment===CURRENT_DEPLOYMENT&&
    current()===ORIGINAL,'unexpected_current_worker');
  const selected=exactNewVersion({
    versions:json(commands.versions),commit:SOURCE_COMMIT,
  });
  ok(selected===CANDIDATE,'metadata_candidate_not_pinned');
  inspectNewInactiveVersion({
    original:version(ORIGINAL),previous:version(PREVIOUS),
    candidate:version(CANDIDATE),
  });
  verifiedBaseline(json(commands.deployments));
  ok(current()===ORIGINAL,'concurrent_worker_change');
}
function receiptPath(){
  const base=process.env.LOCALAPPDATA;
  ok(typeof base==='string'&&path.isAbsolute(base)&&
    !/(?:^|[\\/])(OneDrive|Dropbox|Google Drive)(?:[\\/]|$)/i.test(base),
    'local_private_path_invalid');
  const root=path.join(base,'JILL-WEB');
  const folder=path.join(root,'private-release-receipts');
  for(const p of [root,folder]){
    fs.mkdirSync(p,{recursive:true,mode:0o700});
    ok(!fs.lstatSync(p).isSymbolicLink(),'receipt_path_symlink_refused');
  }
  return path.join(folder,RECEIPT);
}
function consumeOnce(file,commit){
  let fd;
  try{
    fd=fs.openSync(file,'wx',0o600);
    fs.writeFileSync(fd,JSON.stringify({
      operation:'WORK_CUSTOM_ORDER_100_CANDIDATE_0_ORIGINAL_ONE_TIME',
      source_commit:commit,current_deployment:CURRENT_DEPLOYMENT,
      worker:WORKER,from:ORIGINAL,to:CANDIDATE,
      approved_count:1,retry:false,reserved_at:new Date().toISOString(),
    })+'\n');
    fs.fsyncSync(fd);
  }catch{fail('approval_already_spent_or_receipt_unavailable');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function unpinnedHealth(){
  const url=HOST+'/healthz?'+VERSION_PARAMETER+'='+randomUUID();
  let response;
  try{
    response=await fetch(url,{
      method:'GET',headers:{Accept:'application/json',
        'Cache-Control':'no-store'},
      redirect:'manual',credentials:'omit',
      signal:AbortSignal.timeout(15000),
    });
  }catch{fail('unpinned_health_unavailable');}
  const mime=(response.headers.get('content-type')||'')
    .split(';',1)[0].trim().toLowerCase();
  let body;
  try{
    const raw=await response.text();
    ok(raw.length>0&&raw.length<=512,'health_reply_unexpected');
    body=JSON.parse(raw);
  }catch{fail('health_reply_unverifiable');}
  return certifyUnpinnedRuntime({
    status:response.status,mime,body,
    versionHeader:response.headers.get(VERSION_HEADER),
    cacheControl:response.headers.get('cache-control'),
    redirect:response.headers.get('location'),
  });
}
async function execute(){
  const head=sourceGuard();
  const receipt=receiptPath();
  ok(!fs.existsSync(receipt),'approval_already_spent');
  preflight();
  cli([...promotionArgs(),'--dry-run']);
  ok(sourceGuard()===head,'source_changed_during_preflight');
  preflight();
  ok(!fs.existsSync(receipt),'approval_already_spent');
  console.log('PASS: Exact WORK original 100%/candidate 0%, immutable candidate and version metadata binding verified.');
  console.log('PASS: Source unchanged since inactive upload; promotion dry-run passed.');
  let attempted=false,phase='deployment';
  try{
    // One approval consumed immediately BEFORE sole Cloudflare write.
    consumeOnce(receipt,head);
    attempted=true;
    cli(promotionArgs(),{timeout:120000});
    phase='readback';
    const switched=certifiedPromotion(json(commands.deployments));
    ok(current()===CANDIDATE,'candidate_not_active');
    console.log('PASS WORK candidate 100% original 0% deployment: '+
      switched.new_deployment_id);
    phase='unpinned_runtime_health';
    await unpinnedHealth();
    const again=certifiedPromotion(json(commands.deployments));
    ok(again.new_deployment_id===switched.new_deployment_id&&
      current()===CANDIDATE,'allocation_changed_after_health');
    console.log('PASS unpinned WORK gateway runtime identifies candidate '+CANDIDATE);
    console.log('HOLD: Shopify signed proxy -> Google QA submission and authenticated My JILL remain UNTESTED.');
    console.log('ONE-TIME PROMOTION APPROVAL SPENT. DO NOT RUN AGAIN.');
  }catch(e){
    const msg=String(e?.message||'');
    const safe=/^(work_custom_promote_owner_|work_custom_promotion_|work_custom_acceptance_|gateway_metadata_upload_|gateway_inactive_policy_)[a-z0-9_]+$/.test(msg)?
      msg:'work_custom_promote_owner_unverified';
    console.error('HOLD WORK candidate promotion: '+safe+' at '+phase);
    console.error(attempted?
      'A Cloudflare deployment MAY have committed. DO NOT RETRY. Inspect deployment read-only.':
      'No Cloudflare write attempted.');
    console.error('No automatic rollback, customer submission, secret changes, paid resources or LIVE/KEEP changes.');
    process.exitCode=1;
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    ok(process.argv.length===2,'arguments_refused');
    await execute();
  }catch(e){
    const msg=String(e?.message||'');
    console.error('STOP WORK candidate promotion preflight: '+
      (/^(work_custom_promote_owner_|work_custom_promotion_|work_custom_acceptance_|gateway_metadata_upload_|gateway_inactive_policy_)[a-z0-9_]+$/.test(msg)?
        msg:'work_custom_promote_owner_preflight_unverified'));
    console.error('No changes authorized unless a NEW scoped Owner approval was given. DO NOT RETRY after an uncertain outcome.');
    process.exitCode=1;
  }
}
