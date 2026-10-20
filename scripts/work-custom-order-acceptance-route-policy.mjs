// JILL WORK Custom Order acceptance routing policy — pure/source-only.
// A pinned anonymous health response proves the candidate can execute,
// but it cannot prove that Shopify's server-side signed app-proxy
// forwards Cloudflare-Workers-Version-Overrides. Never equate the two.
export const WORKER='jill-work-custom-orders-qa';
export const SHOP='jill-work.myshopify.com';
export const ORIGINAL='408bdf7c-eb20-4b6e-97dd-3d3b293c6120';
export const CANDIDATE='9322193f-5e87-4479-88c9-39229dddb5f2';
export const DEPLOYMENT='4962f2cc-a27b-41db-ae3c-ae3fdcadf7d3';
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const fail=code=>{throw Error('work_custom_acceptance_'+code);};
function check(predicate,code){if(!predicate)fail(code);}
function latestDeployment(input){
  const items=Array.isArray(input)?input:
    Array.isArray(input?.deployments)?input.deployments:
    Array.isArray(input?.result?.deployments)?input.result.deployments:null;
  check(items&&items.length>=1&&items.length<=30,'deployment_list_unverified');
  const arr=items.map(d=>{
    check(UUID.test(d?.id||'')&&Number.isFinite(Date.parse(d?.created_on||''))&&
      Array.isArray(d.versions)&&d.versions.length>=1&&d.versions.length<=2,
      'deployment_shape_unverified');
    const shares=new Map();
    for(const v of d.versions){
      check(UUID.test(v?.version_id||'')&&
        typeof v?.percentage==='number'&&
        Number.isFinite(v.percentage)&&v.percentage>=0&&v.percentage<=100&&
        !shares.has(v.version_id),'allocation_invalid');
      shares.set(v.version_id,v.percentage);
    }
    check([...shares.values()].reduce((a,b)=>a+b,0)===100,
      'allocation_sum_invalid');
    return {id:d.id,when:Date.parse(d.created_on),shares};
  }).sort((a,b)=>b.when-a.when);
  check(arr.length===1||arr[0].when>arr[1].when,
    'latest_deployment_ambiguous');
  return arr[0];
}
export function classifyWorkAcceptanceRoute(deployments,{
  candidateRuntimeProven=false,shopifySignedCandidateRouteProven=false,
}={}){
  const current=latestDeployment(deployments);
  check(current.id===DEPLOYMENT&&current.shares.size===2&&
    current.shares.get(ORIGINAL)===100&&
    current.shares.get(CANDIDATE)===0,
    'deployed_100_original_0_candidate_not_verified');
  check(typeof candidateRuntimeProven==='boolean'&&
    typeof shopifySignedCandidateRouteProven==='boolean',
    'invalid_evidence_flags');
  // The Shopify app proxy originates at Shopify, not the shopper's
  // Chrome tab. An anonymous pinned /healthz cannot attest Shopify's hop.
  const maySubmitToProveCandidate=shopifySignedCandidateRouteProven;
  return Object.freeze({
    shop:SHOP,worker:WORKER,deployment:DEPLOYMENT,
    normal_traffic_version:ORIGINAL,normal_traffic_percent:100,
    metadata_candidate:CANDIDATE,candidate_traffic_percent:0,
    candidate_health_execution_proven:candidateRuntimeProven,
    candidate_signed_shopify_ingress_proven:shopifySignedCandidateRouteProven,
    normal_work_storefront_reaches_candidate:false,
    candidate_acceptance_authorized:maySubmitToProveCandidate,
    any_customer_write_authorized:false,
    deployment_or_promotion_authorized:false,
    need_separate_route_or_promotion_approval:!maySubmitToProveCandidate,
  });
}
export function validateCandidateAcceptancePrerequisites({
  route,shopifySignedCustomerConfirmed=false,
  isolatedGoogleQaPublished=false,workThemeGatewayConfirmed=false,
  customerAccountExtensionConfirmed=false,ownerHqReadConfirmed=false,
  oneTimeWriteApproved=false,
}={}){
  check(route&&typeof route==='object'&&
    route.metadata_candidate===CANDIDATE&&
    route.candidate_signed_shopify_ingress_proven===true,
    'candidate_shopify_routing_not_proven');
  for(const [label,value] of Object.entries({
    shopifySignedCustomerConfirmed,isolatedGoogleQaPublished,
    workThemeGatewayConfirmed,customerAccountExtensionConfirmed,
    ownerHqReadConfirmed,oneTimeWriteApproved,
  }))check(value===true,label+'_not_verified');
  // Approval attestation alone is not a script to send requests;
  // future submission must use real signed Shopify WORK storefront.
  return Object.freeze({
    ready_for_separate_one_time_browser_action:true,
    no_automatic_submission:true,
    no_retries_after_ambiguous_outcome:true,
    customer_identity_from_verified_shopify_only:true,
    guest_email_claim_forbidden:true,
    target_environment:'WORK',
  });
}
