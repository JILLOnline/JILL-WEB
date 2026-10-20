// NEW zero-byte diagnostic release. It never opens or resets the spent
// 20261018 upload/deployment receipts. Owner auth is used only on the PC.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {CANDIDATE,WORKER,HOST} from './work-custom-order-candidate-promotion-policy.mjs';
import {SOURCE,EMPTY_POST_MARKER,EMPTY_POST_BASELINE,
  emptyPostBaseline,emptyPostVersion,inspectEmptyPostVersion,
  emptyPostAllocation,emptyPostUploadArgs,emptyPostDeployArgs,
  inspectUploaded,certifyVersionHealth,certifyProbe}
  from './work-gateway-diagnostic-release-policy.mjs';
import {currentAllocation,edgeClockInterval} from './collect-work-runtime-readonly.mjs';
import {OVERRIDE_HEADER,overrideValue} from './work-gateway-diagnostic-zero-policy.mjs';
import {stageDiagnosticPackage} from './prepare-work-gateway-diagnostic.mjs';
import {ownerKey,verifyGoogle,receiptPath} from './probe-work-gateway-connection-owner.mjs';
import {gatewayDiagnosticSignature} from '../backend/custom-order-gateway.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const CLI=path.join(ROOT,'services/custom-order-cloudflare/node_modules/wrangler/bin/wrangler.js');
const fail=code=>{throw Error('work_gateway_empty_post_'+code);};
const check=(v,code)=>{if(!v)fail(code);};
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',timeout:15000,windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();}
function sourceGuard(){
  check(process.platform==='win32','owner_windows_required');
  check(git('branch','--show-current')==='jill/rewards-work'&&
    git('status','--porcelain','--untracked-files=no')===''&&
    git('rev-parse','HEAD')===git('rev-parse','origin/jill/rewards-work'),
    'source_not_clean_and_synced');
  execFileSync('git',['-C',ROOT,'merge-base','--is-ancestor',SOURCE,'HEAD'],{stdio:'ignore',timeout:15000});
  check(fs.existsSync(CLI),'local_wrangler_missing');return git('rev-parse','HEAD');
}
export function reserveDiagnosticAttempt(file,data){
  let fd;
  try{fd=fs.openSync(file,'wx',0o600);fs.writeFileSync(fd,JSON.stringify({
    ...data,reserved_at:new Date().toISOString(),retry_allowed:false})+'\n');fs.fsyncSync(fd);}
  catch{fail('attempt_already_reserved_or_receipt_failed');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
function receipts(){
  const dir=path.dirname(receiptPath());
  return {upload:path.join(dir,'work-gateway-zero-byte-v1-upload-once-20261019.json'),
    deploy:path.join(dir,'work-gateway-zero-byte-v1-deployment-once-20261019.json')};
}
function command(app,args){
  const r=spawnSync(process.execPath,[CLI,...args],{cwd:app,
    windowsHide:true,shell:false,encoding:'utf8',timeout:120000,maxBuffer:6*1024*1024,
    env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false',
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false'}});
  check(!r.error&&!r.signal&&r.status===0,'cloudflare_command_unverified');return r.stdout;
}
function json(app,args){try{return JSON.parse(command(app,args));}catch{fail('cloudflare_read_unverified');}}
function readers(app){
  const flags=['--name',WORKER,'--config','./wrangler.toml','--json'];
  const versions=()=>json(app,['versions','list',...flags]);
  const allocation=()=>currentAllocation(json(app,['deployments','list',...flags]));
  const view=id=>json(app,['versions','view',id,...flags]);
  const state=()=>{
    const before=allocation(),history=versions(),id=emptyPostVersion(history);
    const active=view(CANDIDATE),previous=view(EMPTY_POST_BASELINE.diagnostic);
    if(id===null){emptyPostBaseline(before);inspectUploaded({versions:history,active,uploaded:previous});}
    else{
      inspectEmptyPostVersion({versions:history,active,previous,uploaded:view(id)});
      if(before.deployment===EMPTY_POST_BASELINE.deployment)emptyPostBaseline(before);
      else emptyPostAllocation(before,id);
    }
    check(JSON.stringify(before)===JSON.stringify(allocation()),'allocation_changed_during_read');
    return {allocation:before,id};
  };
  return {state,allocation,versions,view};
}
async function health(id){
  const url=new URL('/healthz',HOST);url.searchParams.set('jill_work_version_probe',randomUUID());
  const start=Date.now();
  const response=await fetch(url,{headers:{Accept:'application/json','Cache-Control':'no-store',
    ...(id===CANDIDATE?{}:{[OVERRIDE_HEADER]:overrideValue(id)})},
    redirect:'manual',signal:AbortSignal.timeout(10000)});
  const end=Date.now(),raw=await response.text();check(raw.length<=512,'health_oversized');
  certifyVersionHealth({status:response.status,mime:(response.headers.get('content-type')||'').split(';')[0],
    body:JSON.parse(raw),versionHeader:response.headers.get('x-jill-work-gateway-version'),
    cacheControl:response.headers.get('cache-control'),redirect:response.headers.get('location')},id);
  const clock=edgeClockInterval({start,end,date:response.headers.get('date')});
  check(!clock.outside_challenge_window,'owner_edge_clock_skew');return clock;
}
async function signedProbe(secret,id){
  const timestamp=String(Date.now()),nonce=randomUUID();
  const response=await fetch(HOST+'/jill-work-gateway-diagnostic',{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(25000),
    headers:{[OVERRIDE_HEADER]:overrideValue(id),'x-jill-qa-diagnostic-ts':timestamp,
      'x-jill-qa-diagnostic-nonce':nonce,'x-jill-qa-diagnostic-signature':
        gatewayDiagnosticSignature({secret,timestamp,nonce})},
  });
  check(response.headers.get('x-jill-work-gateway-version')===id,'probe_runtime_identity_unverified');
  const raw=await response.text();check(raw.length<=1024,'probe_oversized');const body=JSON.parse(raw);
  if(response.status===403&&body?.code==='diagnostic_denied')fail('challenge_unverified_not_secret_comparison');
  if(response.status===429)fail('existing_gateway_quota_denied');
  if(response.status===503)fail('google_connection_unverified');
  return certifyProbe({status:response.status,body,cacheControl:response.headers.get('cache-control'),
    redirect:response.headers.get('location')});
}
async function execute(mode){
  const runner=sourceGuard(),files=receipts();
  if(mode==='--release-once')check(!fs.existsSync(files.upload)&&!fs.existsSync(files.deploy),
    'attempt_spent_inspect_only');
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-gateway-diagnostic-'));
  let phase='source_package',attempted=false;
  try{
    const staged=stageDiagnosticPackage(temp),r=readers(staged.app);
    phase='existing_runtime_read';const before=r.state();
    const clocks={active:await health(CANDIDATE)};
    if(before.allocation.versions.some(v=>v.id===EMPTY_POST_BASELINE.diagnostic))
      clocks.previous_diagnostic=await health(EMPTY_POST_BASELINE.diagnostic);
    if(before.id&&before.allocation.versions.some(v=>v.id===before.id))
      clocks.new_diagnostic=await health(before.id);
    if(mode==='--inspect'){
      console.log(JSON.stringify({environment:'WORK',mode:'read_only',runner,
        package_sha256:staged.package_sha256,base_source:staged.base_source,
        allocation:before.allocation,new_diagnostic:before.id,clocks,
        attempts:{upload_reserved:fs.existsSync(files.upload),deployment_reserved:fs.existsSync(files.deploy)},
        old_receipts_untouched:true,signed_post_performed:false},null,2));return;
    }
    check(before.id===null,'already_uploaded_inspect_only');emptyPostBaseline(before.allocation);
    phase='isolated_google_preflight';const secret=ownerKey();await verifyGoogle(secret);
    // verifyGoogle audits BOTH immutable /exec and HEAD before its signed
    // nonexistent receipt read. No Google source/property/deployment changes.
    phase='compile_dry_run';command(staged.app,[...emptyPostUploadArgs(),'--dry-run']);
    check(sourceGuard()===runner&&r.state().id===null,'source_or_remote_changed');
    phase='inactive_upload';reserveDiagnosticAttempt(files.upload,{operation:'WORK_ZERO_BYTE_V1_UPLOAD_ONCE',
      runner,package_sha256:staged.package_sha256,marker:EMPTY_POST_MARKER,prior:before.allocation});
    attempted=true;command(staged.app,emptyPostUploadArgs());
    phase='upload_readback';const uploaded=r.state();check(uploaded.id!==null,'uploaded_version_unverified');
    emptyPostBaseline(uploaded.allocation);
    phase='deployment_dry_run';command(staged.app,[...emptyPostDeployArgs(uploaded.id),'--dry-run']);
    check(sourceGuard()===runner&&r.state().id===uploaded.id,'source_or_remote_changed');
    emptyPostBaseline(r.allocation());
    phase='attach_new_diagnostic_zero';reserveDiagnosticAttempt(files.deploy,{
      operation:'WORK_ZERO_BYTE_V1_DEPLOYMENT_ONCE',runner,package_sha256:staged.package_sha256,
      prior:before.allocation,active:CANDIDATE,diagnostic:uploaded.id});
    command(staged.app,emptyPostDeployArgs(uploaded.id));
    phase='deployment_readback';const attached=r.state();emptyPostAllocation(attached.allocation,uploaded.id);
    phase='pinned_health';const clock=await health(uploaded.id);await health(CANDIDATE);
    phase='signed_empty_post';const proof=await signedProbe(secret,uploaded.id);
    phase='final_readback';const after=r.state();
    check(after.id===uploaded.id&&JSON.stringify(after.allocation)===JSON.stringify(attached.allocation),
      'allocation_changed_during_probe');
    console.log(JSON.stringify({environment:'WORK',runner,package_sha256:staged.package_sha256,
      previous:before.allocation,current:after.allocation,pinned_response_version:uploaded.id,clock,...proof,
      ordinary_traffic_unchanged:true,old_receipts_untouched:true,
      new_upload_and_deployment_receipts_spent:true,secret_changes:false},null,2));
  }catch(error){
    const m=String(error?.message||'');const safe=/^(?:work_gateway_|gateway_inactive_policy_)[a-z0-9_]+$/.test(m)?m:'work_gateway_empty_post_unverified';
    console.error('STOP '+safe+' at '+phase+'.');
    console.error(attempted?'A new version or deployment MAY exist. Do not retry; run the read-only inspect command.':
      'No new upload or deployment requested.');process.exitCode=1;
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try{
    check(process.argv.length===3&&['--inspect','--release-once'].includes(process.argv[2]),'explicit_mode_required');
    await execute(process.argv[2]);
  }catch{console.error('STOP work_gateway_empty_post_owner_preflight_unverified. No retry or secret change.');process.exitCode=1;}
}
