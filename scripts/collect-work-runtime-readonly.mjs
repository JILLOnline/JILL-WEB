// Fresh WORK inventory. GETs and Wrangler read commands only. Never consumes
// a deployment receipt or uploads, deploys, migrates, rotates or submits.
import {execFileSync} from 'node:child_process';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {MARKER,inspectUploaded,certifyVersionHealth,EMPTY_POST_MARKER,
  EMPTY_POST_BASELINE,inspectEmptyPostVersion,emptyPostAllocation}
  from './work-gateway-diagnostic-release-policy.mjs';
import {CANDIDATE,HOST,WORKER}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {OVERRIDE_HEADER,overrideValue}
  from './work-gateway-diagnostic-zero-policy.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const APP=path.join(ROOT,'services/custom-order-cloudflare');
const HQ=path.join(ROOT,'services/jill-order-desk/app-home');
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=code=>{throw Error(code);};
function git(...args){return execFileSync('git',['-C',ROOT,...args],{
  encoding:'utf8',timeout:15000,stdio:['ignore','pipe','pipe']}).trim();}
function cloud(args,{hq=false}={}){
  const cwd=hq?HQ:APP,cli=path.join(cwd,'node_modules/wrangler/bin/wrangler.js');
  if(!existsSync(cli))fail('local_wrangler_missing');
  try{return JSON.parse(execFileSync(process.execPath,[cli,...args],{
    cwd,encoding:'utf8',timeout:45000,maxBuffer:8*1024*1024,
    stdio:['ignore','pipe','pipe'],
    env:{...process.env,CI:'true',WRANGLER_SEND_METRICS:'false'},
  }));}catch{fail('authenticated_cloudflare_read_unavailable');}
}
function array(value,key){
  const result=Array.isArray(value)?value:value?.[key]||value?.result?.[key]||value?.result;
  if(!Array.isArray(result)||result.length<1||result.length>100)fail('invalid_metadata');
  return result;
}
export function currentAllocation(value){
  const entries=array(value,'deployments');
  for(const d of entries)if(!UUID.test(d?.id||'')||
    !Number.isFinite(Date.parse(d?.created_on))||!Array.isArray(d.versions))
    fail('invalid_deployments');
  const ordered=[...entries].sort((a,b)=>Date.parse(b.created_on)-Date.parse(a.created_on));
  if(ordered.length>1&&ordered[0].created_on===ordered[1].created_on)
    fail('ambiguous_current_deployment');
  const latest=ordered[0];
  if(latest.versions.length<1||latest.versions.length>2||
    latest.versions.some(x=>!UUID.test(x.version_id)||
      !Number.isFinite(x.percentage)||x.percentage<0||x.percentage>100)||
    latest.versions.reduce((n,x)=>n+x.percentage,0)!==100)
    fail('invalid_allocation');
  return {deployment:latest.id,created_at:latest.created_on,
    versions:latest.versions.map(x=>({id:x.version_id,percentage:x.percentage}))};
}
export function edgeClockInterval({start,end,date}){
  const server=Date.parse(date);
  if(!Number.isFinite(server)||!Number.isFinite(start)||end<start)
    fail('clock_unavailable');
  // HTTP Date has one-second precision and is an EDGE clock observation,
  // not a signed proof of the Worker isolate's Date.now().
  return {rtt_ms:end-start,offset_min_ms:server-end,
    offset_max_ms:server+999-start,
    outside_challenge_window:server-end>60000||server+999-start< -60000,
    source:'http_date_edge_not_worker_clock'};
}
async function health(origin,{version=null}={}){
  const url=new URL('/healthz',origin);
  url.searchParams.set('jill_work_version_probe',randomUUID());
  const headers={Accept:'application/json','Cache-Control':'no-store'};
  if(version)headers[OVERRIDE_HEADER]=overrideValue(version);
  const start=Date.now();
  try {
    const response=await fetch(url,{headers,redirect:'manual',
      signal:AbortSignal.timeout(15000)});
    const end=Date.now(),raw=await response.text();
    if(raw.length>1024)fail('oversized_health');
    const body=JSON.parse(raw);
    const observed=response.headers.get('x-jill-work-gateway-version');
    let verified=false;
    if(version){certifyVersionHealth({status:response.status,
      mime:(response.headers.get('content-type')||'').split(';')[0],body,
      versionHeader:observed,cacheControl:response.headers.get('cache-control'),
      redirect:response.headers.get('location')},version);verified=true;}
    return {status:response.status,healthy:body.ok===true,
      runtime_version:UUID.test(observed||'')?observed:null,
      exact_version_verified:verified,clock:edgeClockInterval({
        start,end,date:response.headers.get('date')})};
  }catch{return {error:'public_health_or_clock_unverified'};}
}
function bindings(metadata){
  if(!Array.isArray(metadata?.resources?.bindings))fail('bindings_unavailable');
  return metadata.resources.bindings.map(b=>({name:b.name,type:b.type,
    ...(/^JILL_WORK_[A-Z_]+_ENABLED$/.test(b.name)&&b.type==='plain_text'?
      {enabled:b.text==='true'}:{})}));
}
export async function collectWorkRuntime({owner=false}={}){
  const report={captured_at:new Date().toISOString(),environment:'WORK',
    source:{branch:git('branch','--show-current'),commit:git('rev-parse','HEAD'),
      tracked_clean:git('status','--porcelain','--untracked-files=no')===''},
    app:{client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',
      identity_evidence:'source_configuration_only',
      shop:'jill-work.myshopify.com',active_version:'unverified',
      effective_scopes:'unverified',plan:'unverified',staff_permissions:'unverified',
      extensions:['coupons','dashboard','home'].map(name=>{
        const text=readFileSync(path.join(ROOT,
          'extensions/jill-account-'+name+'/shopify.extension.toml'),'utf8');
        return {handle:'jill-account-'+name,uid:text.match(/uid\s*=\s*"([^"]+)"/)?.[1],
          api_version:text.match(/api_version\s*=\s*"([^"]+)"/)?.[1]};
      })},gateway:{},hq:{},qa:{published_revision:'unverified'},
    budget:{new_billable_services_enabled:false,usage:'unverified',
      private_media_activation:'held'},blockers:[]};
  report.gateway.unpinned_health=await health(HOST);
  // Three independent edge timings expose skew and variable RTT without a
  // challenge, secret or speculative signed call to the old diagnostic.
  report.gateway.clock_samples=[];
  for(let i=0;i<2;i++)report.gateway.clock_samples.push(await health(HOST));
  report.hq.public_health=await health(
    'https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev');
  if(!owner){report.blockers.push('owner_authenticated_runtime_metadata_required');return report;}
  if(report.source.branch!=='jill/rewards-work'||!report.source.tracked_clean||
     git('rev-parse','origin/jill/rewards-work')!==report.source.commit)
    fail('work_checkout_not_clean_and_synced');
  try {
    const read=args=>cloud([...args,'--name',WORKER,'--config','./wrangler.toml','--json']);
    const deployments=()=>currentAllocation(read(['deployments','list']));
    const before=deployments();report.gateway.allocation=before;
    const versions=read(['versions','list']);
    const matches=array(versions,'versions').filter(x=>
      [MARKER,EMPTY_POST_MARKER].includes(x.annotations?.['workers/message'])&&
      before.versions.some(v=>v.id===x.id&&v.percentage===0));
    if(matches.length!==1)fail('diagnostic_marker_not_unique');
    const id=matches[0].id;
    if(!UUID.test(id)||!before.versions.some(x=>x.id===id&&x.percentage===0)||
       !before.versions.some(x=>x.id===CANDIDATE&&x.percentage===100))
      fail('current_diagnostic_allocation_changed');
    const active=read(['versions','view',CANDIDATE]);
    const diagnostic=read(['versions','view',id]);
    if(diagnostic.annotations?.['workers/message']===EMPTY_POST_MARKER){
      inspectEmptyPostVersion({versions,active,previous:read(['versions','view',EMPTY_POST_BASELINE.diagnostic]),uploaded:diagnostic});
      emptyPostAllocation(before,id);
    }else inspectUploaded({versions,active,uploaded:diagnostic});
    report.gateway.diagnostic={id,marker_verified:true,bindings:bindings(diagnostic)};
    report.gateway.pinned_health=await health(HOST,{version:id});
    if(report.gateway.pinned_health.exact_version_verified!==true)
      fail('diagnostic_pinned_health_unverified');
    const after=deployments();report.gateway.post_read_allocation=after;
    if(JSON.stringify(before)!==JSON.stringify(after))fail('allocation_changed_during_inventory');
    report.gateway.ordinary_traffic_unchanged=true;
  }catch(error){report.blockers.push(/^[a-z_]+$/.test(error.message)?
    error.message:'gateway_metadata_unverified');}
  try {
    const args=['--name','jill-order-desk-canary-work','--config','./wrangler.canary.jsonc','--json'];
    const state=currentAllocation(cloud(['deployments','list',...args],{hq:true}));
    report.hq.allocation=state;
    report.hq.versions=[];
    for(const v of state.versions) {
      const meta=cloud(['versions','view',v.id,...args],{hq:true});
      report.hq.versions.push({id:v.id,percentage:v.percentage,bindings:bindings(meta)});
    }
  }catch{report.blockers.push('hq_authenticated_metadata_unverified');}
  return report;
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
  try {
    if(process.argv.length>3||(process.argv[2]&&process.argv[2]!=='--owner'))fail('invalid_arguments');
    console.log(JSON.stringify(await collectWorkRuntime({owner:process.argv[2]==='--owner'}),null,2));
  }catch{console.error('STOP work_runtime_inventory_unverified. No deployment or receipt was changed.');process.exitCode=1;}
}
