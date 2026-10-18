// JILL WORK Custom Order: pure promotion policy. SOURCE ONLY.
// Not a permission to change Cloudflare traffic. WORK-only eventual target:
// candidate@100%, original@0%, no new versions/secrets/paid services.
import {
  WORKER,SHOP,ORIGINAL,CANDIDATE,
  DEPLOYMENT as CURRENT_DEPLOYMENT,
  classifyWorkAcceptanceRoute,
} from './work-custom-order-acceptance-route-policy.mjs';
export {WORKER,SHOP,ORIGINAL,CANDIDATE,CURRENT_DEPLOYMENT};
const ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const stop=x=>{throw Error('work_custom_promotion_'+x);};
const ok=(v,x)=>{if(!v)stop(x);};
export const HOST='https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev';
export const VERSION_HEADER='x-jill-work-gateway-version';
export const VERSION_PARAMETER='jill_work_version_probe';
export function promotionArgs(){
  return Object.freeze(['versions','deploy',CANDIDATE+'@100%',
    ORIGINAL+'@0%','--name',WORKER,'--config','./wrangler.toml',
    '--yes','--message',
    'JILL WORK reviewed gateway metadata candidate 100pct; original retained 0pct']);
}
export function verifiedBaseline(allocation){
  const state=classifyWorkAcceptanceRoute(allocation,{
    candidateRuntimeProven:true,
    shopifySignedCandidateRouteProven:false,
  });
  ok(state.deployment===CURRENT_DEPLOYMENT&&
    state.normal_traffic_version===ORIGINAL&&
    state.candidate_traffic_percent===0,'baseline_invalid');
  return state;
}
function latest(data){
  const deployments=Array.isArray(data)?data:
    Array.isArray(data?.deployments)?data.deployments:
    Array.isArray(data?.result?.deployments)?
      data.result.deployments:null;
  ok(deployments&&deployments.length>0&&deployments.length<=30,
    'deployment_list_invalid');
  const all=deployments.map(d=>{
    ok(ID.test(d?.id||'')&&
      Number.isFinite(Date.parse(d?.created_on||''))&&
      Array.isArray(d?.versions)&&d.versions.length>=1&&
      d.versions.length<=2,'deployment_record_invalid');
    const shares=new Map();
    for(const item of d.versions){
      ok(ID.test(item?.version_id||'')&&
        typeof item?.percentage==='number'&&
        Number.isFinite(item.percentage)&&item.percentage>=0&&
        item.percentage<=100&&!shares.has(item.version_id),
        'deployment_percentage_invalid');
      shares.set(item.version_id,item.percentage);
    }
    ok([...shares.values()].reduce((a,b)=>a+b,0)===100,
      'traffic_total_invalid');
    return {id:d.id,when:Date.parse(d.created_on),shares};
  }).sort((a,b)=>b.when-a.when);
  ok(all.length===1||all[0].when>all[1].when,
    'latest_ambiguous');
  return all[0];
}
export function certifiedPromotion(deployments){
  const newest=latest(deployments);
  ok(newest.id!==CURRENT_DEPLOYMENT&&
    newest.shares.size===2&&
    newest.shares.get(CANDIDATE)===100&&
    newest.shares.get(ORIGINAL)===0,
    'candidate_100_original_0_not_confirmed');
  return Object.freeze({
    new_deployment_id:newest.id,
    candidate_version:CANDIDATE,
    candidate_pct:100,
    original_version:ORIGINAL,
    original_pct:0,
    customer_order_submitted:false,
    paid_resources_enabled:false,
  });
}
export function certifyUnpinnedRuntime({status,mime,body,versionHeader,
  redirect,cacheControl}={}){
  ok(status===200&&mime==='application/json'&&
    body&&typeof body==='object'&&!Array.isArray(body)&&
    Object.keys(body).length===2&&body.ok===true&&
    body.environment==='WORK_CUSTOM_ORDERS_QA',
    'health_invalid');
  ok(versionHeader===CANDIDATE&&redirect===null&&
    cacheControl==='no-store','runtime_candidate_not_proven');
  return Object.freeze({
    normal_work_gateway_runtime:CANDIDATE,
    proven_without_override:true,
    google_receipt_signed:false,
    shopify_proxy_acceptance_tested:false,
    my_jill_authenticated_tested:false,
  });
}
