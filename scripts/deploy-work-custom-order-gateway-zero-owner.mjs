// ONE approved WORK-only Custom Order gateway 100% ORIGINAL / 0% REPAIR
// deployment with bounded rollback. No customer data, Shopify mutation,
// signed Google requests, paid tier, LIVE, KEEP, R2, new Worker version,
// or normal traffic promotion. Only Owner Windows can invoke.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {currentWorkerVersion}
  from './deploy-work-hq-inbox-shell.mjs';
import {inspectGatewayCandidate,inspectActiveGatewayVersion,
  getExactGatewayUploadVersion,gatewayConfigExactlyKnown,MARKER}
  from './work-custom-order-gateway-inactive-repair-policy.mjs';
import {WORKER,OLD,NEW,UPLOAD_SOURCE,HOST,HEADER,versionOverride,
  checkAllocation,deploymentState,deploymentArgs,interpretSmoke}
  from './work-custom-order-gateway-zero-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CFG='./wrangler.toml';
const ONCE='work-gateway-100-0-repair-first-rollout-20261017.json';
const fail=x=>{throw Error('gateway_zero_owner_'+x);};
const ok=(t,x)=>{if(!t)fail(x);};
function git(...a){
  try{return execFileSync('git',['-C',ROOT,...a],{
    encoding:'utf8',windowsHide:true,timeout:15000,maxBuffer:4096,
  }).trim();}catch{fail('git_unverifiable');}
}
function localCheck(){
  ok(process.platform==='win32','windows_owner_only');
  ok(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===
      git('rev-parse','refs/remotes/origin/jill/rewards-work'),
    'work_source_unsynced');
  ok(git('cat-file','-t',UPLOAD_SOURCE)==='commit',
    'candidate_source_unverifiable');
  try{execFileSync('git',['-C',ROOT,'merge-base','--is-ancestor',
    UPLOAD_SOURCE,'HEAD'],{windowsHide:true,stdio:'ignore',timeout:15000});}
  catch{fail('candidate_source_not_ancestor');}
  const source=fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8');
  gatewayConfigExactlyKnown(source);
  // Guard changes to the Worker/DO code and signing/proxy logic since
  // the already uploaded candidate was built; no unapproved code release.
  ok(!git('diff','--name-only',UPLOAD_SOURCE,'HEAD','--',
    'services/custom-order-cloudflare',
    'backend/custom-order-gateway.mjs',
    'backend/custom-order-work-proxy-route.mjs',
    'backend/shopify-work-app-proxy-auth.mjs'),
    'gateway_code_changed_since_upload');
  ok(fs.existsSync(CLI),'wrangler_unavailable');
}
function cli(args,{timeout=60000}={}){
  const r=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',
    timeout,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  ok(!r.error&&!r.signal&&r.status===0,'wrangler_command_failed');
  return String(r.stdout||'');
}
function json(args){
  try{return JSON.parse(cli(args));}
  catch{fail('cloudflare_json_invalid');}
}
function status(){
  try{return currentWorkerVersion(cli(['deployments','status',
    '--name',WORKER,'--config',CFG]));}
  catch{fail('worker_status_unverifiable');}
}
function deployments(){
  return json(['deployments','list','--name',WORKER,
    '--config',CFG,'--json']);
}
function versions(){
  return json(['versions','list','--name',WORKER,
    '--config',CFG,'--json']);
}
function view(id){
  return json(['versions','view',id,'--name',WORKER,
    '--config',CFG,'--json']);
}
function remotePreflight(){
  const current=checkAllocation(deployments(),'baseline');
  ok(current.oldPct===100&&status()===OLD,
    'original_not_active');
  const active=view(OLD),candidate=view(NEW);
  inspectActiveGatewayVersion(active);
  inspectGatewayCandidate({active,candidate});
  const selected=getExactGatewayUploadVersion({
    versions:versions(),marker:MARKER+UPLOAD_SOURCE,active:OLD,
  });
  ok(selected===NEW,'repair_candidate_not_exact');
  ok(deploymentState(deployments()).id===current.id&&
    status()===OLD,'concurrent_gateway_change');
  return current;
}
function receiptPath(){
  const local=process.env.LOCALAPPDATA;
  ok(typeof local==='string'&&path.isAbsolute(local)&&
    !/(?:^|[\\/])(OneDrive|Dropbox|Google Drive)(?:[\\/]|$)/i.test(local),
    'local_private_path_unverified');
  const dir=path.join(local,'JILL-WEB','private-release-receipts');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  ok(!fs.lstatSync(dir).isSymbolicLink(),
    'receipt_symlink_refused');
  return path.join(dir,ONCE);
}
function reserveOnce(filepath,prior,commit){
  let fd;
  try{
    fd=fs.openSync(filepath,'wx',0o600);
    fs.writeFileSync(fd,JSON.stringify({
      operation:'WORK_CUSTOM_ORDER_GATEWAY_ZERO_ONCE',
      worker:WORKER,old_version:OLD,new_version:NEW,
      baseline_deployment:prior.id,source_commit:commit,
      reserved_at:new Date().toISOString(),retry:false,
    })+'\n','utf8');
    fs.fsyncSync(fd);
  }catch{fail('rollout_already_attempted_or_receipt_unavailable');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function probe({id=null,route='/healthz',method='GET'}={}){
  ok((route==='/healthz'&&method==='GET')||
    (route==='/jill-custom-order-account'&&method==='POST'),
    'unapproved_public_probe');
  const headers={Accept:'application/json','Cache-Control':'no-store'};
  if(id!==null)headers[HEADER]=versionOverride(id);
  let response;
  try{
    response=await fetch(HOST+route,{
      method,redirect:'manual',credentials:'omit',headers,
      signal:AbortSignal.timeout(16000),
    });
  }catch{fail('anonymous_probe_unavailable');}
  ok(response&&response.headers&&
    response.headers.get('location')===null,
    'unexpected_redirect');
  const mime=(response.headers.get('content-type')||'')
    .split(';',1)[0].trim().toLowerCase();
  ok(mime==='application/json','unexpected_content_type');
  let text;
  try{text=await response.text();}
  catch{fail('response_unreadable');}
  ok(text.length>0&&text.length<=900,'unexpected_response_size');
  let body;
  try{body=JSON.parse(text);}
  catch{fail('invalid_response_json');}
  return {status:response.status,mime,body};
}
async function baselineProbe(){
  const r=await probe();
  ok(r.status===200&&r.body?.ok===true&&
    r.body?.environment==='WORK_CUSTOM_ORDERS_QA'&&
    Object.keys(r.body).length===2,
    'worker_hostname_or_config_not_verified');
  return r;
}
function restore(){
  // Never overwrite a concurrent release. The only safe recovery state
  // is our original candidate at 0 or already-restored original.
  const s=deploymentState(deployments());
  if(s.state==='baseline'){
    ok(status()===OLD,'baseline_status_drift');
    return 'already_original_100';
  }
  ok(s.state==='zero'&&s.oldPct===100&&s.newPct===0,
    'unknown_concurrent_deployment_refuse_rollback');
  cli(deploymentArgs('restore'),{timeout:120000});
  const after=checkAllocation(deployments(),'baseline');
  ok(after.oldPct===100&&status()===OLD,
    'rollback_not_verified');
  return 'restored_original_100';
}
async function execute(){
  localCheck();
  const receipt=receiptPath();
  ok(!fs.existsSync(receipt),'approval_already_used');
  const before=remotePreflight();
  await baselineProbe(); // VERIFY exact domain BEFORE Cloudflare change.
  ok(checkAllocation(deployments(),'baseline').id===before.id&&
    status()===OLD,'baseline_changed_before_deploy');
  console.log('PASS WORK gateway preflight: exact original 100%, repaired candidate inactive, matching Worker/DO/secret bindings.');
  console.log('PASS known WORK gateway hostname and anonymous baseline health 200.');
  cli([...deploymentArgs('zero'),'--dry-run'],{timeout:60000});
  localCheck();
  ok(checkAllocation(deployments(),'baseline').id===before.id&&
    status()===OLD,'gateway_changed_after_dryrun');
  const commit=git('rev-parse','HEAD');
  // One-time approval consumed immediately BEFORE Cloudflare write,
  // even if Wrangler times out. No automatic retry under any outcome.
  reserveOnce(receipt,before,commit);
  let attempted=false,phase='deployment';
  try{
    attempted=true;
    cli(deploymentArgs('zero'),{timeout:120000});
    phase='readback';
    const zero=checkAllocation(deployments(),'zero');
    ok(zero.id!==before.id&&status()===OLD,
      'zero_deployment_receipt_unverified');
    console.log('PASS WORK gateway 100/0 allocation; deployment '+zero.id);
    phase='anonymous_smoke';
    const regular=await probe();
    const pinned=await probe({id:NEW});
    const account=await probe({id:NEW,
      route:'/jill-custom-order-account',method:'POST'});
    const after=checkAllocation(deployments(),'zero');
    ok(status()===OLD,'normal_traffic_not_original');
    const report=interpretSmoke({
      regular,pinned,account,baseline:zero,after});
    console.log('PASS anonymous WORK gateway health and no-token account denial; original still 100%, repaired 0%.');
    console.log('HOLD: pinned execution cannot be independently proven by identical-version response; no Google HMAC or order submit tested.');
    console.log('HOLD: no normal repaired-gateway traffic, secret readback, LIVE/KEEP, R2, paid resources, customer writes or payments.');
    console.log('ONE-TIME APPROVAL SPENT. Do not run deployment again.');
    return report;
  }catch(e){
    const code=String(e?.message||'');
    const safe=/^(gateway_zero_owner_|gateway_zero_policy_)[a-z0-9_]+$/.test(code)?
      code:'gateway_zero_owner_unverified';
    console.error('STOP WORK gateway zero rollout: '+safe+' at '+phase);
    if(attempted){
      console.error('A deployment MAY have committed. NEVER retry zero rollout.');
      try{console.error('SAFE ROLLBACK: '+restore()+
        '. Original gateway remains at 100%.');}
      catch{console.error('HOLD: automatic rollback refused or unverified; inspect active WORK gateway deployment read-only.');}
    }
    process.exitCode=1;
    return null;
  }
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    ok(process.argv.length===2,'extra_arguments_refused');
    await execute();
  }catch(e){
    const code=String(e?.message||'');
    console.error('STOP WORK gateway zero preflight: '+
      (/^(gateway_zero_owner_|gateway_zero_policy_|gateway_inactive_policy_)[a-z0-9_]+$/.test(code)?
        code:'gateway_zero_owner_preflight_unverified'));
    console.error('No new Customer Order submission or Worker upload. Do not retry without reviewing receipts.');
    process.exitCode=1;
  }
}
