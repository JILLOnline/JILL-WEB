// JILL WORK-only Cloudflare gateway 100/0 regression — OFFLINE fixtures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKER,OLD,NEW,UPLOAD_SOURCE,HOST,HEADER,
  versionOverride,deploymentArgs,deploymentState,checkAllocation,
  interpretSmoke,
} from './work-custom-order-gateway-zero-policy.mjs';
let cases=0;
const pass=fn=>{fn();cases++};
const deny=fn=>{assert.throws(fn,/gateway_zero_policy_/);cases++};
const DEP='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const BACK='bbbbbbbb-1111-4222-8333-cccccccccccc';
const wrap=(shares,created_on='2026-10-17T22:00:00Z')=>[{
  id:DEP,created_on,
  versions:shares.map(([version_id,percentage])=>({version_id,percentage})),
}];
const normal=wrap([[OLD,100]]);
const zero=wrap([[OLD,100],[NEW,0]]);
const bad=wrap([[OLD,75],[NEW,25]]);
pass(()=>{
  assert.equal(WORKER,'jill-work-custom-orders-qa');
  assert.equal(OLD,'408bdf7c-eb20-4b6e-97dd-3d3b293c6120');
  assert.equal(NEW,'225cdbb4-46f5-492e-801d-6726bea2703e');
  assert.equal(UPLOAD_SOURCE,'2263c1ecf131127961ebc2612274ebb830caceee');
  assert.equal(HEADER,'Cloudflare-Workers-Version-Overrides');
  assert.equal(HOST,'https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev');
});
pass(()=>assert.deepEqual(deploymentArgs().slice(0,4),
  ['versions','deploy',OLD+'@100%',NEW+'@0%']));
pass(()=>{
  const cmd=deploymentArgs('restore');
  assert.deepEqual(cmd.slice(0,3),['versions','deploy',OLD+'@100%']);
  assert.ok(!cmd.includes(NEW+'@0%'));
});
deny(()=>deploymentArgs('promote'));
pass(()=>assert.equal(versionOverride(),WORKER+'="'+NEW+'"'));
pass(()=>assert.equal(versionOverride(OLD),WORKER+'="'+OLD+'"'));
deny(()=>versionOverride('not-approved'));
pass(()=>{
  const r=checkAllocation(normal,'baseline');
  assert.equal(r.state,'baseline');
  assert.equal(r.newPct,null);
  assert.equal(r.oldPct,100);
});
pass(()=>{
  const r=checkAllocation({deployments:zero},'zero');
  assert.equal(r.state,'zero');
  assert.equal(r.oldPct,100);
  assert.equal(r.newPct,0);
  assert.equal(r.canRestore,true);
});
pass(()=>assert.equal(checkAllocation({result:{deployments:zero}},'zero').state,'zero'));
deny(()=>checkAllocation(zero,'baseline'));
deny(()=>checkAllocation(normal,'zero'));
deny(()=>checkAllocation(bad,'zero'));
deny(()=>checkAllocation(normal,'promote'));
for(const wrong of [
  null,[],{},[{}],
  [{...normal[0],id:'unknown-id'}],
  [{...normal[0],created_on:'never'}],
  [{...normal[0],versions:[]}],
  [{...normal[0],versions:[{version_id:OLD,percentage:101}]}],
  [{...normal[0],versions:[{version_id:OLD,percentage:'100'}]}],
  [{...normal[0],versions:[{version_id:OLD,percentage:NaN}]}],
  [{...normal[0],versions:[{version_id:OLD,percentage:90}]}],
  [{...normal[0],versions:[{version_id:OLD,percentage:100},
    {version_id:OLD,percentage:0}]}],
  [...normal,{...normal[0],id:BACK}],
])deny(()=>deploymentState(wrong));
pass(()=>{
  const r=deploymentState(bad);
  assert.equal(r.state,'unexpected');
  assert.equal(r.canRestore,false);
});
pass(()=>{
  const r=deploymentState(wrap([[NEW,100]]));
  assert.equal(r.canRestore,false);
  assert.equal(r.state,'unexpected');
});
const health={status:200,mime:'application/json',body:{
  ok:true,environment:'WORK_CUSTOM_ORDERS_QA',
}};
const account={status:401,mime:'application/json',body:{
  version:1,operation:'custom_order.account.list.result',
  ok:false,error:{code:'unauthenticated_account'},
}};
const zeroState=checkAllocation(zero,'zero');
pass(()=>{
  const result=interpretSmoke({
    regular:health,pinned:health,account,baseline:zeroState,after:zeroState,
  });
  assert.equal(result.allocation_100_0,true);
  assert.equal(result.regular_health_good,true);
  assert.equal(result.pinned_health_good,true);
  assert.equal(result.account_denial_verified,true);
  assert.equal(result.pinned_execution_proven,false);
  assert.equal(result.google_signature_verified,false);
  assert.equal(result.customer_submission_performed,false);
  assert.equal(result.paid_resources_enabled,false);
});
for(const h of [
  {...health,status:404},
  {...health,status:503},
  {...health,mime:'text/html'},
  {...health,body:{...health.body,environment:'LIVE'}},
  {...health,body:{...health.body,exposedSecret:'anything'}},
])deny(()=>interpretSmoke({
  regular:h,pinned:health,account,baseline:zeroState,after:zeroState,
}));
for(const a of [
  {...account,status:200},
  {...account,status:403},
  {...account,status:503},
  {...account,body:{...account.body,error:{code:'wrong_token'}}},
  {...account,body:{...account.body,orders:[]}},
  {...account,body:{...account.body,ok:true}},
  {...account,mime:'text/html'},
])deny(()=>interpretSmoke({
  regular:health,pinned:health,account:a,
  baseline:zeroState,after:zeroState,
}));
deny(()=>interpretSmoke({
  regular:health,pinned:health,account,baseline:zeroState,
  after:{...zeroState,id:BACK},
}));
deny(()=>interpretSmoke({
  regular:health,pinned:health,account,baseline:zeroState,
  after:deploymentState(bad),
}));
const source=readFileSync(new URL(
  './deploy-work-custom-order-gateway-zero-owner.mjs',import.meta.url),'utf8');
for(const expected of [
  "process.platform==='win32'",
  "inspectGatewayCandidate({active,candidate})",
  "getExactGatewayUploadVersion",
  "gateway_code_changed_since_upload",
  "gatewayConfigExactlyKnown",
  "status()===OLD",
  "await baselineProbe();",
  "checkAllocation(deployments(),'baseline')",
  "checkAllocation(deployments(),'zero')",
  "cli([...deploymentArgs('zero'),'--dry-run']",
  "reserveOnce(receipt,before,commit)",
  "cli(deploymentArgs('zero')",
  "cli(deploymentArgs('restore')",
  "s.state==='zero'",
  "method==='POST'",
  "credentials:'omit'",
  "redirect:'manual'",
  "route:'/jill-custom-order-account',method:'POST'",
  "interpretSmoke({",
  "pinned execution cannot be independently proven",
  "ONE-TIME APPROVAL SPENT",
  "NEVER retry zero rollout",
]){
  assert.ok(source.includes(expected),'Missing approved WORK gateway gate: '+expected);
  cases++;
}
for(const unsafe of [
  /cli\(\[['"]versions['"],['"]upload['"]/,
  /cli\(\[['"]deploy['"]/,
  /cli\(\[['"]secret['"],['"]put['"]/,
  /cli\(\[['"]d1['"],['"]execute['"]/,
  /cli\(\[['"]r2['"]/,
  /raw_payload/,
  /jill_order_gateway_sig/,
  /backendFetch/,
  /Shopify Admin request/,
]){
  assert.doesNotMatch(source,unsafe);
  cases++;
}
console.log('PASS WORK Custom Order gateway 0% controlled rollout OFFLINE: '+
  cases+' allocation, capped anonymous health and no-token account denial, one-use rollback and no write paths.');
console.log('HOLD: no remote Cloudflare deployment in CI; HTTP cannot independently prove override selected identical-code candidate.');
