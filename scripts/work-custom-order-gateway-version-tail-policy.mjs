// Strict, pure WORK-only candidate execution proof (no HTTP or Cloudflare).
// Tail is SERVER filtered by --version-id; random health URL correlates
// the actual anonymous request to a corresponding version-tail event.
export const WORKER='jill-work-custom-orders-qa';
export const ACTIVE='408bdf7c-eb20-4b6e-97dd-3d3b293c6120';
export const CANDIDATE='225cdbb4-46f5-492e-801d-6726bea2703e';
export const DEPLOYMENT='f6809b0e-c8b7-47b6-9cc9-13d071d1ecbb';
export const HOST='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev';
export const OVERRIDE='Cloudflare-Workers-Version-Overrides';
const bad=code=>{throw Error('work_gateway_tail_'+code);};
export function candidateTailArguments(){
  return Object.freeze(['tail',WORKER,'--config','./wrangler.toml',
    '--version-id',CANDIDATE,'--method','GET','--format','json',
    '--sampling-rate','1']);
}
export function pinnedHealthUrl(uuid){
  if(typeof uuid!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(uuid))
    bad('probe_uuid_invalid');
  return HOST+'/healthz?jill_work_tail_probe='+uuid;
}
export function versionOverrideHeader(){
  return WORKER+'="'+CANDIDATE+'"';
}
export function verifiedTailHealthEvent(value,{url,sinceMs,untilMs}={}){
  if(!value||typeof value!=='object'||Array.isArray(value)||
    typeof url!=='string'||!url.startsWith(HOST+'/healthz?jill_work_tail_probe=')||
    !Number.isFinite(sinceMs)||!Number.isFinite(untilMs)||
    untilMs<sinceMs) return false;
  const event=value.event;
  if(!event||typeof event!=='object'||Array.isArray(event))return false;
  const req=event.request;
  if(req?.method!=='GET'||req.url!==url||value.outcome!=='ok')return false;
  const when=value.eventTimestamp;
  return Number.isSafeInteger(when)&&when>=sinceMs-15000&&
    when<=untilMs+30000;
}
export function inspectGatewayZeroAllocation(versions){
  const arr=Array.isArray(versions)?versions:
    Array.isArray(versions?.deployments)?versions.deployments:
    Array.isArray(versions?.result?.deployments)?
      versions.result.deployments:null;
  if(!arr||arr.length<1||arr.length>30)bad('deployments_unverifiable');
  const sorted=arr.map(x=>{
    if(typeof x?.created_on!=='string'||!Number.isFinite(Date.parse(x.created_on))||
      typeof x?.id!=='string'||!Array.isArray(x?.versions)||
      x.versions.length<1||x.versions.length>2)
      bad('deployment_shape_drift');
    return {...x,when:Date.parse(x.created_on)};
  }).sort((a,b)=>b.when-a.when);
  const top=sorted[0];
  if(top.id!==DEPLOYMENT||sorted.length>1&&sorted[1].when===top.when)
    bad('deployment_changed');
  const map=new Map(top.versions.map(v=>[v.version_id,v.percentage]));
  if(map.size!==2||map.get(ACTIVE)!==100||map.get(CANDIDATE)!==0)
    bad('not_original_100_candidate_zero');
  return Object.freeze({deployment_id:DEPLOYMENT,active_pct:100,
    candidate_pct:0});
}


// Classify Wrangler CLI termination without ever exposing raw stderr,
// which may include access tokens, URLs, user data or account metadata.
// The absence of a recognizable CLI error MUST remain a HOLD.
export function classifyTailSessionExit(stderr) {
  const diagnostic=typeof stderr==='string'?stderr.slice(-16000):'';
  if(/(?:authentication|unauthorized|not logged in|login required|invalid api token|expired api token|error code:\s*10000)/i.test(diagnostic))
    return 'authentication';
  if(/(?:forbidden|permission denied|insufficient permission|access denied|error code:\s*10013|\b403\b)/i.test(diagnostic))
    return 'permission';
  if(/(?:too many requests|rate.limit|\b429\b)/i.test(diagnostic))
    return 'rate_limited';
  if(/(?:version|worker|script)[^\r\n]{0,80}(?:not found|does not exist|unknown)|\b404\b/i.test(diagnostic))
    return 'target_missing';
  if(/(?:websocket|web socket|connect(?:ion)? (?:refused|closed|reset|failed)|econnreset|econnrefused|etimedout|network error|fetch failed|tls|certificate)/i.test(diagnostic))
    return 'transport';
  if(/(?:unknown argument|unrecognized option|unsupported option|invalid option)/i.test(diagnostic))
    return 'unsupported_cli_option';
  return 'unclassified';
}
