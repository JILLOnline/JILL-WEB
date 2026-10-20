// Allowlisted diagnostic projection only. Never print/store the raw tail envelope.
import {certifyConnectedHealth} from './release-work-hq-connected-read-owner.mjs';
export const EXPECTED_HQ_VERSION='6473444f-86f8-4a83-a47a-56d1a2e19f05';
export const EXPECTED_HQ_DEPLOYMENT='1ffdde49-e556-43a6-b7bb-e10cd3a71048';
export const TAIL_STOP_PRELOAD='process.on("message",m=>{if(m==="JILL_WORK_TAIL_STOP"){if(process.listenerCount("SIGINT"))process.emit("SIGINT");else process.exit(0);if(process.connected)process.disconnect();}});';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PHASES=new Set(['inbox','shopify_auth','work_owner','google_feed']);
const OUTCOMES=new Set(['ok','exception','exceededCpu','exceededMemory','canceled','responseStreamDisconnected','scriptNotFound','unknown']);
const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
const PROBE_KEY='jill_work_hq_tail_probe';
export function verifyNavigationTailBaseline(state){
 if(state?.deployment!==EXPECTED_HQ_DEPLOYMENT||state.versions?.length!==2||
  !state.versions.some(x=>x.id===EXPECTED_HQ_VERSION&&x.percentage===100)||
  !state.versions.some(x=>x.id==='dbc6341f-de7f-41de-8e97-6bf971201eeb'&&x.percentage===0))
  throw Error('work_hq_tail_baseline_changed');
}
function routeKind(raw,probeNonce){
 try{const u=new URL(raw);if(u.origin!==ORIGIN)return 'other';
  if(u.pathname==='/healthz'&&UUID.test(probeNonce||'')&&
   [probeNonce,'REDACTED'].includes(u.searchParams.get(PROBE_KEY)))return 'diagnostic_probe';
  if(['/app','/app/','/app.data'].includes(u.pathname))return 'home';
  if(['/app/requests','/app/requests.data'].includes(u.pathname))return 'inbox';
  if(u.pathname.startsWith('/app/requests/'))return 'detail';
  if(u.pathname.startsWith('/auth/'))return 'session_bootstrap';
 }catch{}return 'other';
}
function errorKind(value){
 const message=typeof value?.message==='string'?value.message:'';
 if(/cannot perform I\/O on behalf of a different request/i.test(message))return 'cross_request_io';
 if(/never generate a response|hanging promise|unresolved promise/i.test(message))return 'unresolved_response';
 if(/CPU time|CPU limit/i.test(message))return 'cpu_limit';
 if(/timeout|timed out/i.test(message))return 'timeout';
 return 'other';
}
export function projectNavigationTail(raw,{probeNonce}={}){
 if(!raw||typeof raw!=='object'||
  (raw.scriptName!=null&&raw.scriptName!=='jill-order-desk-canary-work'))return null;
 const phases=[];
 for(const log of (Array.isArray(raw.logs)?raw.logs:[]).slice(0,200)){
  const message=log?.message;
  if(!Array.isArray(message)||message[0]!=='JILL_WORK_INBOX_PHASE'||typeof message[1]!=='string')continue;
  let p;try{p=JSON.parse(message[1]);}catch{continue;}
  if(!UUID.test(p?.trace||'')||!PHASES.has(p.phase)||!['begin','end'].includes(p.event))continue;
  const phase={trace:p.trace,phase:p.phase,event:p.event};
  if(Number.isFinite(p.duration_ms)&&p.duration_ms>=0&&p.duration_ms<=3600000)
   phase.duration_ms=Math.round(p.duration_ms);
  phases.push(phase);
 }
 const route=routeKind(raw.event?.request?.url,probeNonce);
 // A null/missing provider name never broadens origin authority. The CLI is
 // explicitly subscribed to this Worker; accept unnamed HTTP events only for
 // its exact fixed origin. Never infer an exact runtime from a missing UUID.
 if(raw.scriptName==null&&route==='other')return null;
 if(route==='other'&&!phases.length)return null;
 const version=UUID.test(raw.scriptVersion?.id||'')?raw.scriptVersion.id:null;
 const status=raw.event?.response?.status;
 return {route,runtime_version:version,exact_version_verified:version===EXPECTED_HQ_VERSION,
  ...(route==='diagnostic_probe'?{probe_correlation:new URL(raw.event.request.url).searchParams.get(PROBE_KEY)===probeNonce?'exact_nonce':'redacted_marker'}:{}),
  outcome:OUTCOMES.has(raw.outcome)?raw.outcome:'unknown',
  status:Number.isInteger(status)&&status>=100&&status<=599?status:null,
  phases,exceptions:(Array.isArray(raw.exceptions)?raw.exceptions:[]).slice(0,5).map(errorKind)};
}
// Wrangler --format json prints formatted JSON. Parse objects across arbitrary
// stream boundaries, with bounded memory. Banners and malformed objects vanish.
export function navigationTailParser(onRecord,{probeNonce,onMetric=()=>{}}={}){
 let buffer='',depth=0,inString=false,escaped=false,discard=false;
 return chunk=>{for(const c of String(chunk)){
  if(!depth){if(c!=='{')continue;depth=1;buffer='{';continue;}
  if(!discard){buffer+=c;if(buffer.length>2*1024*1024){buffer='';discard=true;}}
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;}
  else if(c==='"')inString=true;
  else if(c==='{')depth++;
  else if(c==='}'&&!--depth){
   if(!discard){let raw;try{raw=JSON.parse(buffer);}catch{onMetric('invalid_json');}
    if(raw&&typeof raw==='object'){
     onMetric('json_objects');
     onMetric(raw.scriptName==null?'worker_name_missing':raw.scriptName==='jill-order-desk-canary-work'?'worker_name_expected':'worker_name_other');
     const safe=projectNavigationTail(raw,{probeNonce});
     if(safe){onMetric('projected');onRecord(safe);}else onMetric('filtered');
    }
   }else onMetric('oversized_json');
   buffer='';discard=false;inString=false;escaped=false;
  }
 }};
}

// Independent unsigned GET plus a WORK health-marker event tests tail liveness.
// Cloudflare redacts UUID-shaped URL substrings. A redacted marker verifies
// stream liveness, not the identity of one unique request. Never unredact logs.
export async function readNavigationTailProbe(nonce,{fetcher=fetch}={}){
 if(!UUID.test(nonce||''))throw Error('work_hq_tail_probe_nonce_invalid');
 const url=new URL('/healthz',ORIGIN);url.searchParams.set(PROBE_KEY,nonce);
 const response=await fetcher(url,{method:'GET',redirect:'manual',cache:'no-store',
  headers:{Accept:'application/json','Cache-Control':'no-store'},signal:AbortSignal.timeout(3000)});
 // Bound the body before parsing, including streamed/untrusted replies.
 const reader=response.body?.getReader();let text='',bytes=0;
 if(reader)try{const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;
  bytes+=value.byteLength;if(bytes>=1024)throw Error('work_hq_tail_probe_body_invalid');text+=decoder.decode(value,{stream:true});
 }text+=decoder.decode();}finally{await reader.cancel().catch(()=>{});}
 let body;try{body=JSON.parse(text);}catch{throw Error('work_hq_tail_probe_body_invalid');}
 return certifyConnectedHealth({status:response.status,location:response.headers.get('location'),
  mime:(response.headers.get('content-type')||'').split(';')[0],body,
  cache_control:response.headers.get('cache-control'),runtime_version:response.headers.get('x-jill-work-hq-version')},EXPECTED_HQ_VERSION);
}

// No credentials or HTTP authority here: the Owner runner owns the exact
// Worker subscription and supplies only the already-bound health GET adapter.
export async function observeNavigationTail({child,probe,probeNonce,onReady=()=>{},
 captureMs=75000,connectAttempts=5,connectWaitMs=2000,stopWaitMs=10000}={}){
 const records=[],metrics={json_objects:0,invalid_json:0,oversized_json:0,
  worker_name_missing:0,worker_name_expected:0,worker_name_other:0,projected:0,filtered:0};
 const timers=new Set();
 const wait=ms=>new Promise(resolve=>{const timer=setTimeout(()=>{timers.delete(timer);resolve();},ms);timers.add(timer);});
 let dropped=0,stderr='',closed=false,interrupted=false,stopRequested=false,forced=false;
 let resolveClose,resolveInterrupt,probeEventSeen=false,probeVerified=false,probeAttempts=0,probeVersionMismatch=false,probeCorrelation=null;
 const ended=new Promise(resolve=>resolveClose=resolve);
 const interrupt=new Promise(resolve=>resolveInterrupt=resolve);
 child.once('error',error=>{closed=true;resolveClose({error});});
 child.once('close',(status,signal)=>{closed=true;resolveClose({status,signal});});
 const parse=navigationTailParser(record=>{
  if(record.route==='diagnostic_probe'){
   probeEventSeen=true;
   if(probeCorrelation!=='exact_nonce')probeCorrelation=record.probe_correlation;
   if(record.runtime_version&&record.runtime_version!==EXPECTED_HQ_VERSION)probeVersionMismatch=true;
  }
  if(records.length<400)records.push(record);else dropped++;
 },{probeNonce,onMetric:name=>{metrics[name]++;}});
 child.stdout.on('data',parse);
 child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-8192);});
 const onInterrupt=()=>{interrupted=true;resolveInterrupt();};
 process.on('SIGINT',onInterrupt);process.on('SIGTERM',onInterrupt);
 try{
  for(;probeAttempts<connectAttempts&&!closed&&!interrupted;){
   probeAttempts++;
   try{const health=await probe(probeNonce);probeVerified=health?.exact_version_verified===true&&health.runtime_version===EXPECTED_HQ_VERSION;}catch{probeVerified=false;}
   if(probeVerified&&probeEventSeen)break;
   await Promise.race([wait(connectWaitMs),ended,interrupt]);
   if(probeVerified&&probeEventSeen)break;
  }
  const ready=probeVerified&&probeEventSeen&&!probeVersionMismatch&&!closed&&!interrupted;
  if(ready){onReady();await Promise.race([wait(captureMs),ended,interrupt]);}
  if(!closed){
   stopRequested=true;
   if(child.connected)child.send('JILL_WORK_TAIL_STOP',()=>{});
   await Promise.race([ended,wait(stopWaitMs)]);
   if(!closed){forced=true;child.kill();await Promise.race([ended,wait(1000)]);}
  }
  const result=closed?await ended:{status:null,signal:null};
  return {ready,probe_verified:probeVerified,probe_event_seen:probeEventSeen,probe_attempts:probeAttempts,probe_version_mismatch:probeVersionMismatch,probe_correlation:probeCorrelation,
   records,metrics,dropped,stopRequested,forced,result,stderr,interrupted};
 }finally{
  // Also close a subscription if the caller's readiness callback fails.
  if(!closed&&!stopRequested){
   stopRequested=true;if(child.connected)child.send('JILL_WORK_TAIL_STOP',()=>{});
   await Promise.race([ended,wait(stopWaitMs)]);
   if(!closed)child.kill();
  }
  for(const timer of timers)clearTimeout(timer);
  process.removeListener('SIGINT',onInterrupt);process.removeListener('SIGTERM',onInterrupt);
 }
}
