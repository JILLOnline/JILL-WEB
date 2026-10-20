// One-use WORK 100% existing candidate / 0% already uploaded diagnostic.
// Needed because this Worker implements a Durable Object and Cloudflare
// does not issue Version URLs for it. No upload, secret or order write.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {WORKER,CANDIDATE,HOST}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {inspectUploaded,MARKER,certifyVersionHealth}
  from './work-gateway-diagnostic-release-policy.mjs';
import {deployArgs,newAllocation,healthUrl,overrideValue,OVERRIDE_HEADER}
  from './work-gateway-diagnostic-zero-policy.mjs';
import {sourceGuard,json,commands,version,allocation,receiptPath,
  ownerKey,verifyGoogle,probe}
  from './probe-work-gateway-connection-owner.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const APP=fileURLToPath(new URL('../services/custom-order-cloudflare/',import.meta.url));
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const stop=code=>{throw Error('work_gateway_diagnostic_zero_'+code);};
const check=(value,code)=>{if(!value)stop(code);};
function cli(args,{timeout=60000}={}){
  const result=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,windowsHide:true,shell:false,encoding:'utf8',timeout,
    maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  check(!result.error&&!result.signal&&result.status===0,
    'cloudflare_command_failed');
  return String(result.stdout||'');
}
function currentVersion(){
  return currentWorkerVersion(cli(commands.status));
}
function markerVersion(){
  const versions=json(commands.versions);
  const entries=Array.isArray(versions)?versions:
    Array.isArray(versions?.versions)?versions.versions:
      Array.isArray(versions?.result)?versions.result:null;
  check(entries&&entries.filter(v=>v?.annotations?.['workers/message']===MARKER)
    .length===1,'uploaded_version_not_unique');
  const id=entries.find(v=>v.annotations?.['workers/message']===MARKER).id;
  check(inspectUploaded({versions,active:version(CANDIDATE),
    uploaded:version(id)})===id,'uploaded_version_unverified');
  return id;
}
function baseline(){
  const state=allocation();
  check(currentVersion()===CANDIDATE,'active_runtime_changed');
  return state;
}
function receiptFile(){
  // Reuse the verified local, non-synced private receipt directory.
  return path.join(path.dirname(receiptPath()),
    'work-gateway-diagnostic-zero-once-20261018.json');
}
function recordOnce(file,commit,priorId,id){
  let fd;
  try{
    fd=fs.openSync(file,'wx',0o600);
    fs.writeFileSync(fd,JSON.stringify({
      operation:'WORK_GATEWAY_DIAGNOSTIC_ZERO_ONCE',runner:commit,
      previous_deployment:priorId,active:CANDIDATE,diagnostic:id,
      reserved_at:new Date().toISOString(),retry_allowed:false,
    })+'\n');
    fs.fsyncSync(fd);
  }catch{stop('deployment_already_attempted_or_receipt_failed');}
  finally{if(fd!==undefined)fs.closeSync(fd);}
}
async function health({override=null}={}){
  const headers={Accept:'application/json','Cache-Control':'no-store'};
  if(override)headers[OVERRIDE_HEADER]=overrideValue(override);
  let response;
  try{response=await fetch(healthUrl(randomUUID()),{
    method:'GET',redirect:'manual',credentials:'omit',headers,
    signal:AbortSignal.timeout(15000),
  });}catch{stop('health_unreachable');}
  let body;
  try{
    const raw=await response.text();
    check(raw.length>0&&raw.length<=512,'health_response_size_invalid');
    body=JSON.parse(raw);
  }catch{stop('health_response_unreadable');}
  certifyVersionHealth({status:response.status,
    mime:(response.headers.get('content-type')||'')
      .split(';',1)[0].trim().toLowerCase(),
    body,versionHeader:response.headers.get('x-jill-work-gateway-version'),
    cacheControl:response.headers.get('cache-control'),
    redirect:response.headers.get('location')},override||CANDIDATE);
}
async function execute(){
  const commit=sourceGuard();
  const receipt=receiptFile();
  check(!fs.existsSync(receipt),'deployment_already_attempted');
  const before=baseline();
  const id=markerVersion();
  await health();
  const secret=ownerKey();
  await verifyGoogle(secret);
  cli([...deployArgs(id),'--dry-run']);
  check(sourceGuard()===commit,'source_changed_before_deployment');
  check(baseline().new_deployment_id===before.new_deployment_id&&
    markerVersion()===id&&!fs.existsSync(receipt),
    'preflight_changed_before_deployment');
  console.log('PASS existing WORK 100/0, inactive diagnostic bindings, active health, Google QA key and deployment dry run.');
  let attempted=false,phase='deployment';
  try{
    recordOnce(receipt,commit,before.new_deployment_id,id);
    attempted=true;
    cli(deployArgs(id),{timeout:120000});
    phase='deployment_readback';
    const newId=newAllocation(json(commands.deployments),
      before.new_deployment_id,id);
    check(currentVersion()===CANDIDATE,'active_runtime_changed');
    phase='version_override_health';
    await health({override:id});
    check(newAllocation(json(commands.deployments),
      before.new_deployment_id,id)===newId&&
      currentVersion()===CANDIDATE,'deployment_changed_during_probe');
    phase='signed_connection_probe';
    await probe(HOST,secret,{headers:{[OVERRIDE_HEADER]:overrideValue(id)}});
    check(newAllocation(json(commands.deployments),
      before.new_deployment_id,id)===newId&&
      currentVersion()===CANDIDATE&&markerVersion()===id,
      'deployment_changed_after_probe');
    console.log('PASS WORK diagnostic '+id+' signed Google QA nonexistent-receipt check.');
    console.log('PASS existing candidate remains 100%; diagnostic 0%. No order, upload or secret change.');
    console.log('ONE-USE DEPLOYMENT RECEIPT SPENT. DO NOT RUN AGAIN.');
  }catch(error){
    const msg=String(error?.message||'');
    const safe=/^(work_gateway_diagnostic_zero_|work_gateway_diagnostic_|work_custom_promotion_|gateway_inactive_policy_)[a-z0-9_]+$/.test(msg)?
      msg:'work_gateway_diagnostic_zero_unverified';
    console.error('STOP '+safe+' at '+phase+'.');
    if(attempted)console.error('Deployment MAY have committed. Do not retry; inspect deployments read-only.');
    process.exitCode=1;
  }
}
const called=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(called){
  try{
    check(process.argv.length===2,'arguments_not_allowed');
    await execute();
  }catch(error){
    const msg=String(error?.message||'');
    console.error('STOP '+(/^(work_gateway_diagnostic_zero_|work_gateway_diagnostic_|work_custom_promotion_|gateway_inactive_policy_)[a-z0-9_]+$/.test(msg)?
      msg:'work_gateway_diagnostic_zero_preflight_unverified'));
    console.error('No retry, Custom Order submission, or secret change.');
    process.exitCode=1;
  }
}
