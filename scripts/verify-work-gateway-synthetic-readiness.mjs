// Read-only proof that ordinary WORK form traffic reaches the reviewed
// gateway candidate. No order POST, secret read, deployment or log stream.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {currentWorkerVersion} from './deploy-work-hq-inbox-shell.mjs';
import {inspectWorkGatewayBindings}
  from './inspect-work-custom-order-gateway-bindings.mjs';
import {inspectActiveGatewayVersion}
  from './work-custom-order-gateway-inactive-repair-policy.mjs';
import {exactManifest,MARKER}
  from './work-gateway-version-metadata-inactive-policy.mjs';
import {
  WORKER,CANDIDATE,HOST,VERSION_HEADER,VERSION_PARAMETER,
  certifiedPromotion,certifyUnpinnedRuntime,
} from './work-custom-order-candidate-promotion-policy.mjs';

const APP=fileURLToPath(new URL('../services/custom-order-cloudflare/',import.meta.url));
const CLI=path.join(APP,'node_modules/wrangler/bin/wrangler.js');
const CONFIG='./wrangler.toml';
const UPLOAD='a4a9840ce83e04dd85f7f2e306cdcdd037b56d6a';
// The Owner's latest independently observed WORK gateway deployment.
export const DEPLOYMENT='88e7616d-5d3f-4eed-b112-960b034717af';
const stop=x=>{throw Error('work_gateway_synthetic_'+x);};
const check=(condition,reason)=>{if(!condition)stop(reason);};
function command(args){
  check(fs.existsSync(CLI),'wrangler_missing');
  const r=spawnSync(process.execPath,[CLI,...args],{
    cwd:APP,shell:false,windowsHide:true,encoding:'utf8',
    timeout:45000,maxBuffer:6*1024*1024,
    env:{...process.env,WRANGLER_SEND_METRICS:'false'},
  });
  check(!r.error&&!r.signal&&r.status===0,'cloudflare_read_unavailable');
  return String(r.stdout||'');
}
function json(args){
  try{return JSON.parse(command(args));}
  catch{stop('cloudflare_json_invalid');}
}
function deployments(){
  return json(['deployments','list','--name',WORKER,
    '--config',CONFIG,'--json']);
}
function status(){
  try{return currentWorkerVersion(command(['deployments','status',
    '--name',WORKER,'--config',CONFIG]));}
  catch{stop('active_version_unverified');}
}
export function verifyGatewayEvidence({before,active,version,health,after,
  activeAfter}={}){
  const first=certifiedPromotion(before);
  check(first.new_deployment_id===DEPLOYMENT&&active===CANDIDATE,
    'deployment_changed');
  check(version?.id===CANDIDATE&&
    version?.annotations?.['workers/message']===MARKER+UPLOAD,
    'candidate_source_unverified');
  inspectActiveGatewayVersion(version);
  inspectWorkGatewayBindings(version);
  const bindings=version.resources.bindings;
  check(bindings.length===5&&
    ['SHOPIFY_WORK_APP_SECRET','JILL_CUSTOM_ORDER_GATEWAY_SECRET',
      'JILL_CUSTOM_ORDER_QA_BACKEND_URL','RATE_LIMITER',
      'CF_VERSION_METADATA'].every(name=>
      bindings.some(b=>b.name===name))&&
    bindings.some(b=>b.name==='CF_VERSION_METADATA'&&
      b.type==='version_metadata'),
    'binding_set_changed');
  certifyUnpinnedRuntime(health);
  const last=certifiedPromotion(after);
  check(last.new_deployment_id===DEPLOYMENT&&activeAfter===CANDIDATE,
    'deployment_changed_during_check');
  return Object.freeze({deployment:DEPLOYMENT,version:CANDIDATE,
    unpinned_runtime_proven:true,shopify_signed_post_proven:false,
    google_hmac_proven:false});
}
async function health(){
  let res;
  try{res=await fetch(HOST+'/healthz?'+VERSION_PARAMETER+'='+randomUUID(),{
    method:'GET',redirect:'manual',credentials:'omit',
    headers:{Accept:'application/json','Cache-Control':'no-store'},
    signal:AbortSignal.timeout(15000),
  });}catch{stop('health_unavailable');}
  let body;
  try{
    const raw=await res.text();
    check(raw.length>0&&raw.length<=512,'health_size_invalid');
    body=JSON.parse(raw);
  }catch{stop('health_json_invalid');}
  return {
    status:res.status,
    mime:(res.headers.get('content-type')||'').split(';',1)[0].trim().toLowerCase(),
    body,versionHeader:res.headers.get(VERSION_HEADER),
    redirect:res.headers.get('location'),
    cacheControl:res.headers.get('cache-control'),
  };
}
export async function auditGatewayForSynthetic(){
  check(process.platform==='win32','owner_windows_only');
  exactManifest(fs.readFileSync(path.join(APP,'wrangler.toml'),'utf8'));
  const before=deployments();
  const active=status();
  const version=json(['versions','view',CANDIDATE,'--name',WORKER,
    '--config',CONFIG,'--json']);
  const response=await health();
  return verifyGatewayEvidence({before,active,version,health:response,
    after:deployments(),activeAfter:status()});
}
