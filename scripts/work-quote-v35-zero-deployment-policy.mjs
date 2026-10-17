// JILL WORK-only approved 100% v34 / 0% v35 deployment contract.
// This module is PURE: no credentials, Wrangler, network, or filesystem I/O.
// 0% is a deployment configuration change and allows version overrides.
export const WORKER='jill-order-desk-canary-work';
export const ACTIVE='4973b74d-d479-41da-897c-e36129303279';
export const CANDIDATE='dbc6341f-de7f-41de-8e97-6bf971201eeb';
export const FALLBACK='204d66c3-3296-430d-8288-39c354876600';
export const SOURCE='4e4acfcc56e8b3ecb558fc7e10c80301f1cc0d9b';
export const ORIGIN='https://jill-order-desk-canary-work.jill-work-custom-orders.workers.dev';
export const APPROVAL='DEPLOY WORK V35 AT ZERO PERCENT';
export const OVERRIDE='Cloudflare-Workers-Version-Overrides';
const uuid=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const stop=code=>{throw Error('quote_v35_zero_'+code);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const ensure=(ok,code)=>{if(!ok)stop(code);};
export function splitTrafficArgs({mode='zero'}={}){
  ensure(mode==='zero'||mode==='restore','unsupported_deployment_mode');
  const specs=mode==='zero'?[ACTIVE+'@100%',CANDIDATE+'@0%']:
    [ACTIVE+'@100%'];
  return Object.freeze(['versions','deploy',...specs,'--name',WORKER,
    '--config','./wrangler.canary.jsonc',
    '--yes','--message',mode==='zero'?
      'JILL HQ WORK v35 ZERO percent QA only; v34 remains 100 percent':
      'JILL HQ WORK v34 rollback to 100 percent; remove v35 override']);
}
export function parseScopedDeployments(data){
  const arr=Array.isArray(data)?data:
    Array.isArray(data?.deployments)?data.deployments:
    Array.isArray(data?.result?.deployments)?data.result.deployments:null;
  ensure(arr&&arr.length>0&&arr.length<=30,'deployment_list_unverifiable');
  const validated=arr.map(d=>{
    ensure(obj(d)&&uuid.test(d.id||'')&&
      typeof d.created_on==='string'&&
      Number.isFinite(Date.parse(d.created_on))&&
      Array.isArray(d.versions)&&d.versions.length>=1&&
      d.versions.length<=2,'deployment_shape_changed');
    let total=0;
    const percentages=new Map();
    for(const v of d.versions){
      ensure(obj(v)&&uuid.test(v.version_id||'')&&
        typeof v.percentage==='number'&&
        Number.isFinite(v.percentage)&&
        v.percentage>=0&&v.percentage<=100&&
        !percentages.has(v.version_id),
      'version_percentage_unverifiable');
      total+=v.percentage;
      percentages.set(v.version_id,v.percentage);
    }
    ensure(total===100,'traffic_total_unverifiable');
    return {id:d.id,createdOn:Date.parse(d.created_on),percentages};
  });
  validated.sort((a,b)=>b.createdOn-a.createdOn);
  ensure(validated.length===1||
    validated[0].createdOn>validated[1].createdOn,
  'latest_deployment_ambiguous');
  return validated[0];
}
export function inspectDeploymentState(data,expected='baseline'){
  const latest=parseScopedDeployments(data);
  const v=latest.percentages;
  ensure(expected==='baseline'||expected==='zero'||expected==='known',
    'unknown_expected_allocation');
  const baseline=v.size===1&&v.get(ACTIVE)===100;
  const zero=v.size===2&&v.get(ACTIVE)===100&&
    v.get(CANDIDATE)===0;
  const known=[...v.keys()].every(id=>
    id===ACTIVE||id===CANDIDATE)&&
    (v.has(ACTIVE)||v.has(CANDIDATE))&&
    ![...v.values()].some(x=>x<0||x>100);
  if(expected==='baseline')ensure(baseline,
    'baseline_allocation_mismatch');
  if(expected==='zero')ensure(zero,'zero_allocation_mismatch');
  if(expected==='known')ensure(known,'unknown_concurrent_allocation');
  return Object.freeze({
    id:latest.id,
    state:baseline?'baseline':zero?'zero':'unexpected_known',
    active_pct:v.get(ACTIVE),
    candidate_pct:v.get(CANDIDATE)??null,
    can_recover_to_v34:known,
  });
}
export function makeVersionOverride(version=CANDIDATE){
  ensure(version===CANDIDATE||version===ACTIVE,
    'unknown_override_version');
  // RFC 8941 Dictionary: name=quoted version-id.
  return WORKER+'="'+version+'"';
}
// The OWNER observed canonical v34 in October 2026: GET /healthz
// returned 200 JSON, while the quote path returned 410 HTML.
// v34 predates this quote route. Its 410 MUST NOT be interpreted as
// proof of a Shopify Owner auth gate or as a valid v35 response.
export function verifiedLegacyV34Baseline({health,quote}={}){
  ensure(health?.status===200&&
    health.mime==='application/json'&&
    health.redirect===null&&health.json?.ok===true&&
    health.json?.database_ready===true&&
    health.json?.environment==='JILL_ORDER_DESK_WORK',
    'v34_health_not_verified');
  const legacyGone=quote?.status===410&&
    quote.mime==='text/html'&&quote.redirect===null&&
    quote.json===null;
  const explicitOff=quote?.status===503&&
    quote.mime==='application/json'&&quote.redirect===null&&
    quote.json?.ok===false&&
    quote.json?.error==='quote_drafts_not_enabled'&&
    Object.keys(quote.json).length===2;
  ensure(legacyGone||explicitOff,'v34_route_response_changed');
  return Object.freeze({v34_available_health:true,
    v34_quote_route_unavailable:true,
    v34_quote_authentication_gate_proven:explicitOff,
    legacy_v34_410_html:legacyGone});
}
export function anonymousSmokeContract({baseline,candidate,after}={}){
  // Validated against the independently observed real v34 route state.
  const legacy=verifiedLegacyV34Baseline(baseline);
  // An anonymous v35 request must reach Shopify Owner authentication
  // only after WORK-only feature readiness checks. A redirect/403 can
  // be valid; never claim 200 or normal quote access is safe.
  ensure((candidate?.status===302&&
    typeof candidate.redirect==='string'&&
    (candidate.redirect.startsWith('/auth/')||
      candidate.redirect.startsWith(ORIGIN+'/auth/')||
      candidate.redirect.startsWith('https://jill-work.myshopify.com/'))) ||
    (candidate?.status===403&&candidate.json?.ok===false&&
      candidate.json?.code==='access_denied'),
    'v35_owner_denial_not_proven');
  ensure(after?.state==='zero'&&after.active_pct===100&&
    after.candidate_pct===0,'traffic_changed_during_smoke');
  return Object.freeze({v34_route_unavailable:legacy.v34_quote_route_unavailable,
    v34_quote_authentication_gate_proven:
      legacy.v34_quote_authentication_gate_proven,
    legacy_v34_410_html:legacy.legacy_v34_410_html,
    v35_anonymous_owner_denied:true,
    ordinary_traffic_to_v35:false,
    authenticated_browser_qa_complete:false});
}
