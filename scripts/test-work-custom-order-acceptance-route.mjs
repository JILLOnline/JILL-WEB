// Offline routing gate. Does NOT call Shopify, Cloudflare or Google;
// does NOT generate a real order, app-proxy signature or customer token.
import assert from 'node:assert/strict';
import {
  WORKER,SHOP,ORIGINAL,CANDIDATE,DEPLOYMENT,
  classifyWorkAcceptanceRoute,validateCandidateAcceptancePrerequisites,
} from './work-custom-order-acceptance-route-policy.mjs';
const prior='f6809b0e-c8b7-47b6-9cc9-13d071d1ecbb';
const earlier=[{id:prior,created_on:'2026-10-17T23:16:13Z',
  versions:[{version_id:ORIGINAL,percentage:100},
    {version_id:'225cdbb4-46f5-492e-801d-6726bea2703e',percentage:0}]}];
const current=[{id:DEPLOYMENT,created_on:'2026-10-18T01:50:00Z',
  versions:[{version_id:ORIGINAL,percentage:100},
    {version_id:CANDIDATE,percentage:0}]},...earlier];
const mod=versions=>[{...current[0],versions},...earlier];
let n=0;
const pass=fn=>{fn();n++};
const reject=fn=>{assert.throws(fn,/work_custom_acceptance_/);n++};
pass(()=>assert.equal(WORKER,'jill-work-custom-orders-qa'));
pass(()=>assert.equal(SHOP,'jill-work.myshopify.com'));
const route=classifyWorkAcceptanceRoute(current,{
  candidateRuntimeProven:true,
});
pass(()=>{
  assert.equal(route.normal_traffic_version,ORIGINAL);
  assert.equal(route.normal_traffic_percent,100);
  assert.equal(route.metadata_candidate,CANDIDATE);
  assert.equal(route.candidate_traffic_percent,0);
  assert.equal(route.candidate_health_execution_proven,true);
  assert.equal(route.normal_work_storefront_reaches_candidate,false);
  assert.equal(route.candidate_acceptance_authorized,false);
  assert.equal(route.any_customer_write_authorized,false);
  assert.equal(route.deployment_or_promotion_authorized,false);
  assert.equal(route.need_separate_route_or_promotion_approval,true);
  assert.ok(Object.isFrozen(route));
});
pass(()=>assert.equal(classifyWorkAcceptanceRoute({deployments:current})
  .candidate_acceptance_authorized,false));
pass(()=>assert.equal(classifyWorkAcceptanceRoute({result:{deployments:current}})
  .candidate_acceptance_authorized,false));
for(const bad of [
  [],[{}],earlier,mod([{version_id:ORIGINAL,percentage:99},
    {version_id:CANDIDATE,percentage:1}]),
  mod([{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0}]),
  mod([{version_id:ORIGINAL,percentage:100}]),
  mod([{version_id:ORIGINAL,percentage:100},
    {version_id:ORIGINAL,percentage:0}]),
  mod([{version_id:ORIGINAL,percentage:'100'},
    {version_id:CANDIDATE,percentage:0}]),
  [{...current[0],id:prior}],
  [current[0],{...earlier[0],created_on:current[0].created_on}],
])reject(()=>classifyWorkAcceptanceRoute(bad));
reject(()=>classifyWorkAcceptanceRoute(current,{candidateRuntimeProven:'true'}));
reject(()=>classifyWorkAcceptanceRoute(current,{shopifySignedCandidateRouteProven:'true'}));
for(const options of [
  {},{route},{route:{...route,candidate_acceptance_authorized:true}},
  {route:{...route,candidate_signed_shopify_ingress_proven:false}},
  {route:{...route,metadata_candidate:ORIGINAL,
    candidate_signed_shopify_ingress_proven:true}},
])reject(()=>validateCandidateAcceptancePrerequisites(options));
const allReady={
  route:classifyWorkAcceptanceRoute(current,{
    candidateRuntimeProven:true,
    shopifySignedCandidateRouteProven:true,
  }),
  shopifySignedCustomerConfirmed:true,
  isolatedGoogleQaPublished:true,
  workThemeGatewayConfirmed:true,
  customerAccountExtensionConfirmed:true,
  ownerHqReadConfirmed:true,
  oneTimeWriteApproved:true,
};
pass(()=>{
  const r=validateCandidateAcceptancePrerequisites(allReady);
  assert.equal(r.ready_for_separate_one_time_browser_action,true);
  assert.equal(r.no_automatic_submission,true);
  assert.equal(r.no_retries_after_ambiguous_outcome,true);
  assert.equal(r.target_environment,'WORK');
  assert.equal(r.guest_email_claim_forbidden,true);
  assert.equal(r.customer_identity_from_verified_shopify_only,true);
  assert.ok(Object.isFrozen(r));
});
for(const key of Object.keys(allReady).filter(x=>x!=='route'))
  reject(()=>validateCandidateAcceptancePrerequisites({...allReady,[key]:false}));
pass(()=>assert.equal(
  classifyWorkAcceptanceRoute(current,{shopifySignedCandidateRouteProven:true})
    .any_customer_write_authorized,false,
));
console.log('PASS WORK Custom Order acceptance route OFFLINE: '+n+
  ' exact original 100/candidate 0 allocation, pinned health is NOT signed Shopify ingress, isolated ownership and no premature writes.');
console.log('HOLD: Cannot certify repaired candidate via ordinary Shopify WORK submission at 0%. No traffic promotion, no real signed submission authorized.');
