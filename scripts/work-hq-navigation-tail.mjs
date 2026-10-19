// Allowlisted diagnostic projection only. Never print/store the raw tail envelope.
export const EXPECTED_HQ_VERSION='6473444f-86f8-4a83-a47a-56d1a2e19f05';
export const EXPECTED_HQ_DEPLOYMENT='1ffdde49-e556-43a6-b7bb-e10cd3a71048';
export const TAIL_STOP_PRELOAD='process.on("message",m=>{if(m==="JILL_WORK_TAIL_STOP"){if(process.listenerCount("SIGINT"))process.emit("SIGINT");else process.exit(0);if(process.connected)process.disconnect();}});';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const PHASES=new Set(['inbox','shopify_auth','work_owner','google_feed']);
const OUTCOMES=new Set(['ok','exception','exceededCpu','exceededMemory','canceled','unknown']);
const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
export function verifyNavigationTailBaseline(state){
 if(state?.deployment!==EXPECTED_HQ_DEPLOYMENT||state.versions?.length!==2||
  !state.versions.some(x=>x.id===EXPECTED_HQ_VERSION&&x.percentage===100)||
  !state.versions.some(x=>x.id==='dbc6341f-de7f-41de-8e97-6bf971201eeb'&&x.percentage===0))
  throw Error('work_hq_tail_baseline_changed');
}
function routeKind(raw){
 try{const u=new URL(raw);if(u.origin!==ORIGIN)return 'other';
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
export function projectNavigationTail(raw){
 if(!raw||typeof raw!=='object'||raw.scriptName!=='jill-order-desk-canary-work')return null;
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
 const route=routeKind(raw.event?.request?.url);
 if(route==='other'&&!phases.length)return null;
 const version=UUID.test(raw.scriptVersion?.id||'')?raw.scriptVersion.id:null;
 const status=raw.event?.response?.status;
 return {route,runtime_version:version,exact_version_verified:version===EXPECTED_HQ_VERSION,
  outcome:OUTCOMES.has(raw.outcome)?raw.outcome:'unknown',
  status:Number.isInteger(status)&&status>=100&&status<=599?status:null,
  phases,exceptions:(Array.isArray(raw.exceptions)?raw.exceptions:[]).slice(0,5).map(errorKind)};
}
// Wrangler --format json prints formatted JSON. Parse objects across arbitrary
// stream boundaries, with bounded memory. Banners and malformed objects vanish.
export function navigationTailParser(onRecord){
 let buffer='',depth=0,inString=false,escaped=false,discard=false;
 return chunk=>{for(const c of String(chunk)){
  if(!depth){if(c!=='{')continue;depth=1;buffer='{';continue;}
  if(!discard){buffer+=c;if(buffer.length>2*1024*1024){buffer='';discard=true;}}
  if(inString){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')inString=false;}
  else if(c==='"')inString=true;
  else if(c==='{')depth++;
  else if(c==='}'&&!--depth){
   if(!discard){let raw;try{raw=JSON.parse(buffer);}catch{}
    const safe=projectNavigationTail(raw);if(safe)onRecord(safe);}
   buffer='';discard=false;inString=false;escaped=false;
  }
 }};
}
