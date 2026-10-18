// One sanitized read-only Cloudflare Tail proof: exact inactive repaired
// gateway v35 equivalent (candidate 0%). NO deployment, logs persisted,
// customer/order data, JWT, receipt, POST, R2 or paid Logpush.
// Wrangler "tail --version-id" is filtered by Cloudflare server-side.
import {execFileSync,spawn,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {
  ACTIVE,CANDIDATE,DEPLOYMENT,HOST,OVERRIDE,
  candidateTailArguments,pinnedHealthUrl,versionOverrideHeader,
  verifiedTailHealthEvent,inspectGatewayZeroAllocation,
  classifyTailSessionExit,
} from './work-custom-order-gateway-version-tail-policy.mjs';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.toml',NAME='jill-work-custom-orders-qa';
const err=x=>{throw Error('work_gateway_tail_'+x);};
function git(...args){
  try{return execFileSync('git',['-C',ROOT,...args],{
    windowsHide:true,encoding:'utf8',timeout:15000,maxBuffer:4096,
  }).trim();}catch{err('git_unverifiable');}
}
function checkOwner(){
  if(process.platform!=='win32')err('owner_windows_only');
  if(git('branch','--show-current')!=='jill/rewards-work'||
    git('status','--porcelain','--untracked-files=no')!==''||
    git('rev-parse','HEAD')!==
      git('rev-parse','refs/remotes/origin/jill/rewards-work'))
    err('work_source_not_synced');
  if(!fs.existsSync(CLI))err('wrangler_missing');
}
function cli(args){
  const r=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,encoding:'utf8',shell:false,windowsHide:true,
    timeout:35000,maxBuffer:3*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  if(r.error||r.signal||r.status!==0)err('cloudflare_read_unavailable');
  return r.stdout;
}
function allocation(){
  let result;
  try{result=JSON.parse(cli(['deployments','list',
    '--name',NAME,'--config',CONFIG,'--json']));}
  catch{err('deployment_json_invalid');}
  return inspectGatewayZeroAllocation(result);
}
function status(){
  try{return currentWorkerVersion(cli(['deployments','status',
    '--name',NAME,'--config',CONFIG]));}
  catch{err('active_version_unverified');}
}
export function safeHealthResponse(statusCode,contentType,payload){
  if(statusCode!==200||
    !String(contentType||'').toLowerCase().startsWith('application/json')||
    typeof payload!=='string'||payload.length>512)err('health_not_work');
  let body;
  try{body=JSON.parse(payload);}catch{err('health_json_invalid');}
  if(body?.ok!==true||body?.environment!=='WORK_CUSTOM_ORDERS_QA'||
    Object.keys(body).length!==2)err('health_payload_not_work');
  return true;
}
function waitForTailAndProbe({url,sinceMs,untilMs}){
  return new Promise(async(resolve,reject)=>{
    let settled=false,ready=false,matched=false,responseVerified=false;
    const finish=(error,result)=>{
      if(settled)return;
      settled=true;
      clearTimeout(deadline);clearTimeout(startDeadline);
      child.kill();
      if(error)reject(error);else resolve(result);
    };
    let stdout='',stderr='',lineCount=0;
    const child=spawn(process.execPath,
      [CLI,...candidateTailArguments()],{
        cwd:APP,shell:false,windowsHide:true,
        env:{...process.env,WRANGLER_SEND_METRICS:'false'},
        stdio:['ignore','pipe','pipe'],
      });
    child.on('error',()=>finish(Error('work_gateway_tail_session_unavailable')));
    child.on('exit',()=>{if(!settled)finish(Error('work_gateway_tail_ended_'+classifyTailSessionExit(stderr)));});
    const startDeadline=setTimeout(()=>finish(
      Error('work_gateway_tail_not_ready')),30000);
    const deadline=setTimeout(()=>finish(
      Error('work_gateway_tail_no_correlated_event')),62000);
    const handleLine=line=>{
      if(line.length>16000||++lineCount>200) {
        finish(Error('work_gateway_tail_private_stream_limit'));return;
      }
      // Never print, save or export any log lines. JSON may include
      // auth headers, response metadata and third-party requests.
      let event;
      try{event=JSON.parse(line);}catch{return;}
      if(verifiedTailHealthEvent(event,{url,sinceMs,untilMs})){
        matched=true;
        if(responseVerified)finish(null,true);
      }
    };
    const chunked=(stream,isStderr)=>stream.on('data',chunk=>{
      const raw=String(chunk);
      if(/Connected(?:!| to|\b)|Streaming logs from/i.test(raw))
        ready=true;
      // Wrangler ready text and JSON may share stdout; parse only JSON
      // event lines and discard the rest in memory as soon as possible.
      if(isStderr){
        stderr=(stderr+raw).slice(-16000);
        if(/Connected(?:!| to|\b)|Streaming logs from/i.test(stderr))
          ready=true;
        return;
      }
      stdout+=raw;
      if(stdout.length>64000){
        finish(Error('work_gateway_tail_private_stream_limit'));return;
      }
      while(stdout.includes('\n')){
        const index=stdout.indexOf('\n');
        const line=stdout.slice(0,index).trim();
        stdout=stdout.slice(index+1);
        if(line.startsWith('{'))handleLine(line);
        if(settled)return;
      }
    });
    chunked(child.stdout,false);
    chunked(child.stderr,true);
    try{
      const untilReady=Date.now()+25000;
      while(!ready&&!settled&&Date.now()<untilReady)
        await new Promise(r=>setTimeout(r,200));
      if(settled)return;
      if(!ready){finish(Error('work_gateway_tail_not_ready'));return;}
      const res=await fetch(url,{
        method:'GET',redirect:'manual',credentials:'omit',
        headers:{
          Accept:'application/json',
          [OVERRIDE]:versionOverrideHeader(),
          'Cache-Control':'no-store',
        },signal:AbortSignal.timeout(15000),
      });
      if(res.headers.get('location')!==null){
        finish(Error('work_gateway_tail_unexpected_redirect'));return;
      }
      let body;
      try{body=await res.text();}
      catch{finish(Error('work_gateway_tail_health_unreadable'));return;}
      safeHealthResponse(res.status,
        res.headers.get('content-type'),body);
      responseVerified=true;
      // Both a successful HTTP response AND Cloudflare candidate-tail
      // correlation must occur before a PASS can be emitted.
      if(matched)finish(null,true);
    }catch{
      finish(Error('work_gateway_tail_probe_failed'));
    }
  });
}
async function main(){
  checkOwner();
  const initial=allocation();
  if(initial.deployment_id!==DEPLOYMENT||status()!==ACTIVE)
    err('unexpected_active_worker_state');
  const uuid=randomUUID();
  const url=pinnedHealthUrl(uuid);
  const since=Date.now();
  await waitForTailAndProbe({url,sinceMs:since,untilMs:since+85000});
  const final=allocation();
  if(final.deployment_id!==initial.deployment_id||status()!==ACTIVE)
    err('deployment_changed_during_tail');
  console.log('PASS WORK gateway: Cloudflare version-filtered tail correlated one anonymous pinned /healthz GET to candidate '+CANDIDATE+'.');
  console.log('PASS current gateway deployment '+DEPLOYMENT+
    ': original 100%, repaired candidate 0%.');
  console.log('HOLD: this proves pinned code execution only, NOT Google signing secret value or working Custom Order submission.');
  console.log('READ ONLY: no log content exported, customer data, POST, payment, R2, Worker upload, traffic switch, or paid Logpush.');
}
const invoked=process.argv[1]&&
  pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(invoked){
  try{
    if(process.argv.length!==2)err('unsupported_args');
    await main();
  }catch(e){
    const m=String(e?.message||'');
    console.error('HOLD WORK gateway version-tail proof: '+
      (/^work_gateway_tail_[a-z0-9_]+$/.test(m)?m:
        'work_gateway_tail_unverified'));
    console.error('No deployment retry, secret change or Custom Order submission authorized.');
    process.exitCode=1;
  }
}
