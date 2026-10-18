// OFFLINE ONLY: no Cloudflare deployments, Google requests, Shopify
// submissions, email, secret reads or paid infrastructure.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKER,ORIGINAL,CANDIDATE,CURRENT_DEPLOYMENT,
  HOST,VERSION_HEADER,VERSION_PARAMETER,
  promotionArgs,verifiedBaseline,certifiedPromotion,certifyUnpinnedRuntime,
} from './work-custom-order-candidate-promotion-policy.mjs';
const prior=[{
  id:CURRENT_DEPLOYMENT,created_on:'2026-10-18T01:50:00Z',
  versions:[{version_id:ORIGINAL,percentage:100},
    {version_id:CANDIDATE,percentage:0}],
}];
const afterId='01234567-89ab-4abc-8def-0123456789ab';
const switched=[{
  id:afterId,created_on:'2026-10-18T02:50:00Z',
  versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0}],
},...prior];
let n=0;
const pass=f=>{f();n++;};
const reject=f=>{assert.throws(f,/work_custom_promotion_|work_custom_acceptance_/);n++;};
pass(()=>assert.equal(verifiedBaseline(prior).candidate_traffic_percent,0));
pass(()=>{
  const args=promotionArgs();
  assert.deepEqual(args.slice(0,4),[
    'versions','deploy',CANDIDATE+'@100%',ORIGINAL+'@0%',
  ]);
  assert.equal(args[5],WORKER);
  assert.ok(args.includes('--yes'));
  assert.ok(!args.includes('upload'));
  assert.ok(Object.isFrozen(args));
});
pass(()=>{
  const r=certifiedPromotion(switched);
  assert.equal(r.new_deployment_id,afterId);
  assert.equal(r.candidate_pct,100);
  assert.equal(r.original_pct,0);
  assert.equal(r.customer_order_submitted,false);
  assert.equal(r.paid_resources_enabled,false);
  assert.ok(Object.isFrozen(r));
});
pass(()=>assert.equal(certifiedPromotion({deployments:switched}).candidate_pct,100));
pass(()=>assert.equal(certifiedPromotion({result:{deployments:switched}}).candidate_pct,100));
for(const bad of [
  null,[],prior,[{}],
  [{...switched[0],id:CURRENT_DEPLOYMENT}],
  [{...switched[0],versions:[{version_id:ORIGINAL,percentage:100},
    {version_id:CANDIDATE,percentage:0}]},...prior],
  [{...switched[0],versions:[{version_id:CANDIDATE,percentage:99},
    {version_id:ORIGINAL,percentage:1}]},...prior],
  [{...switched[0],versions:[{version_id:CANDIDATE,percentage:100}]},...prior],
  [{...switched[0],versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0},
    {version_id:'33333333-3333-4333-8333-333333333333',percentage:0}]},...prior],
  [{...switched[0],versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:CANDIDATE,percentage:0}]},...prior],
  [{...switched[0],versions:[{version_id:CANDIDATE,percentage:'100'},
    {version_id:ORIGINAL,percentage:0}]},...prior],
  [switched[0],{...prior[0],created_on:switched[0].created_on}],
  [{...switched[0],created_on:'invalid'},...prior],
])reject(()=>certifiedPromotion(bad));
const response={
  status:200,mime:'application/json',
  body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'},
  versionHeader:CANDIDATE,redirect:null,cacheControl:'no-store',
};
pass(()=>{
  const a=certifyUnpinnedRuntime(response);
  assert.equal(a.normal_work_gateway_runtime,CANDIDATE);
  assert.equal(a.proven_without_override,true);
  assert.equal(a.shopify_proxy_acceptance_tested,false);
  assert.equal(a.google_receipt_signed,false);
  assert.ok(Object.isFrozen(a));
});
for(const changed of [
  {status:503},{status:302},{mime:'text/html'},
  {body:{ok:false,environment:'WORK_CUSTOM_ORDERS_QA'}},
  {body:{ok:true,environment:'LIVE'}},
  {body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA',token:'bad'}},
  {versionHeader:null},{versionHeader:ORIGINAL},
  {redirect:'https://jillonlinestore.com'},
  {cacheControl:'public'},{cacheControl:null},
])reject(()=>certifyUnpinnedRuntime({...response,...changed}));
const source=readFileSync(
  new URL('./promote-work-custom-order-candidate-owner.mjs',import.meta.url),'utf8');
for(const marker of [
  "process.platform==='win32'",
  "git('status','--porcelain','--untracked-files=no')",
  "git('diff','--name-only',SOURCE_COMMIT,'HEAD'",
  'exactManifest(',
  'verifiedBaseline(',
  'exactNewVersion(',
  'inspectNewInactiveVersion(',
  "cli([...promotionArgs(),'--dry-run'])",
  "fs.openSync(file,'wx'",
  "consumeOnce(receipt,head)",
  'cli(promotionArgs(),{timeout:120000})',
  'certifiedPromotion(json(commands.deployments))',
  'await unpinnedHealth()',
  "current()===CANDIDATE",
  "method:'GET'",
  "redirect:'manual'",
  "credentials:'omit'",
  "randomUUID()",
  'ONE-TIME PROMOTION APPROVAL SPENT',
  'DO NOT RETRY',
  'No automatic rollback',
]){assert.ok(source.includes(marker),'Source safety marker missing: '+marker);n++;}
for(const disallowed of [
  /['"]versions['"],['"]upload['"]/,
  /['"]secret['"],['"]put['"]/,
  /method:['"]POST['"]/,
  /['"]d1['"],['"]execute['"]/,
  /['"]r2['"],/,
  /restore\(\)/,
  /console\.log\(\s*secret/,
]){assert.doesNotMatch(source,disallowed);n++;}
assert.equal(HOST,'https://jill-work-custom-orders-qa.jill-work-custom-orders.workers.dev');
assert.equal(VERSION_HEADER,'x-jill-work-gateway-version');
assert.equal(VERSION_PARAMETER,'jill_work_version_probe');
assert.equal(WORKER,'jill-work-custom-orders-qa');
console.log('PASS WORK candidate promotion OFFLINE: '+n+
  ' exact prior allocation, candidate 100/original 0, runtime id/no override, one-use no-retry, no customer writes.');
console.log('HOLD: Source-only. New explicit Owner approval required for any WORK traffic promotion.');
