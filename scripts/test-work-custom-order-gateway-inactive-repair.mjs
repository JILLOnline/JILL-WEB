// Offline-only Work gateway inactive version repair policy tests.
// No real local secret, Google, Cloudflare, Shopify, or Worker upload.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKER,MARKER,GATEWAY_KEY,BACKEND_KEY,SHOPIFY_KEY,LIMITER,
  inspectActiveGatewayVersion,inspectGatewayCandidate,
  inspectGatewayDeployment,getExactGatewayUploadVersion,
  gatewayConfigExactlyKnown,uploadArguments,stagedSecrets,
} from './work-custom-order-gateway-inactive-repair-policy.mjs';
import {JILL_HQ_WORK_QA_GOOGLE_URL}
  from '../services/jill-order-desk/work-google-merchant-read.mjs';
const activeId='11111111-2222-4333-8444-555555555555';
const candidateId='bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const sourceSha='a'.repeat(40);
const ref=(name,type,extra={})=>({name,type,...extra});
const bindings=[
  ref(SHOPIFY_KEY,'secret_text'),
  ref(GATEWAY_KEY,'secret_text'),
  ref(BACKEND_KEY,'secret_text'),
  ref(LIMITER,'durable_object_namespace',
    {class_name:'CustomOrderRateLimiter',script_name:WORKER}),
];
const runtime={compatibility_date:'2026-10-12',
  flags:[],main:'worker.mjs'};
const version=(id,bs=bindings,etag='source')=>({
  id,resources:{
    bindings:bs,script:{etag,handlers:['fetch']},
    script_runtime:runtime,
  },
});
const active=version(activeId);
const candidate=version(candidateId,bindings,'candidate');
const deployedId='99999999-9999-4999-8999-999999999999';
const deployment=[{id:deployedId,created_on:'2026-10-17T21:00:00Z',
  versions:[{version_id:activeId,percentage:100}]}];
const marker=MARKER+sourceSha;
const versions=[{...active,metadata:{created_on:'2026-10-17T17:00:00Z'}},
  {...candidate,metadata:{created_on:'2026-10-17T22:00:00Z'},
    annotations:{'workers/message':marker}}];
let n=0;
const pass=f=>{f();n++;};
const deny=f=>{assert.throws(f,/gateway_inactive_policy_/);n++;};
pass(()=>{
  assert.equal(inspectActiveGatewayVersion(active).id,activeId);
  const report=inspectGatewayCandidate({active,candidate});
  assert.equal(report.active,activeId);
  assert.equal(report.candidate,candidateId);
  assert.equal(report.candidateSecretValuesReadable,false);
  assert.equal(report.ordinaryTrafficChanged,false);
  assert.equal(report.limiterPreserved,true);
});
for(const modified of [
  version(activeId,bindings),
  version(candidateId,bindings.filter(x=>x.name!==SHOPIFY_KEY)),
  version(candidateId,bindings.filter(x=>x.name!==GATEWAY_KEY)),
  version(candidateId,bindings.filter(x=>x.name!==BACKEND_KEY)),
  version(candidateId,bindings.filter(x=>x.name!==LIMITER)),
  version(candidateId,[...bindings,ref('UNEXPECTED_PAID_RESOURCE','r2_bucket')]),
  version(candidateId,[...bindings,bindings[0]]),
  version(candidateId,bindings.map(x=>x.name===SHOPIFY_KEY?
    ref(SHOPIFY_KEY,'plain_text',{text:'wrong'}):x)),
  version(candidateId,bindings.map(x=>x.name===BACKEND_KEY?
    ref(BACKEND_KEY,'plain_text',{text:'wrong'}):x)),
  version(candidateId,bindings.map(x=>x.name===LIMITER?
    {...x,class_name:'NewPaidDurableObject'}:x)),
  {...candidate,resources:{...candidate.resources,
    script:{etag:'changed',handlers:['fetch','scheduled']}}},
  {...candidate,resources:{...candidate.resources,
    script_runtime:{...runtime,compatibility_date:'2026-10-17'}}},
])deny(()=>inspectGatewayCandidate({active,candidate:modified}));
pass(()=>assert.equal(inspectGatewayDeployment(deployment).active,
  activeId));
for(const wrong of [
  null,[],[{}],
  [{...deployment[0],versions:[]}],
  [{...deployment[0],versions:[{
    version_id:activeId,percentage:99},{version_id:candidateId,
    percentage:1}]}],
  [{...deployment[0],versions:[{
    version_id:activeId,percentage:99}]}],
  [{...deployment[0],versions:[{
    version_id:activeId,percentage:0}]}],
  [...deployment,{...deployment[0],id:candidateId}],
])deny(()=>inspectGatewayDeployment(wrong));
pass(()=>{
  const result=getExactGatewayUploadVersion({
    versions,marker,active:activeId});
  assert.equal(result,candidateId);
});
for(const wrong of [
  versions.filter(v=>v.id!==candidateId),
  [...versions,{...versions[1],id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'}],
  [...versions,{id:'bbbbbbbb-1111-4222-8333-cccccccccccc',
    metadata:{created_on:'2026-10-17T23:00:00Z'}}],
  versions.map(v=>v.id===candidateId?
    {...v,annotations:{'workers/message':'wrong'}}:v),
])deny(()=>getExactGatewayUploadVersion({
  versions:wrong,marker,active:activeId}));
const currentToml=readFileSync(
  new URL('../services/custom-order-cloudflare/wrangler.toml',
    import.meta.url),'utf8');
// Preserve the literal original manifest for the SPENT one-time upload.
// New metadata source must be REJECTED by that old authorization path.
const historicalToml=[
  'name = "jill-work-custom-orders-qa"',
  'main = "worker.mjs"',
  'compatibility_date = "2026-10-12"',
  'workers_dev = true',
  '',
  '[[durable_objects.bindings]]',
  'name = "RATE_LIMITER"',
  'class_name = "CustomOrderRateLimiter"',
  '',
  '[[migrations]]',
  'tag = "v1"',
  'new_sqlite_classes = ["CustomOrderRateLimiter"]',
  '',
].join('\n');
pass(()=>assert.equal(gatewayConfigExactlyKnown(historicalToml),true));
pass(()=>assert.equal(gatewayConfigExactlyKnown(
  historicalToml.replace(/\n/g,'\r\n')),true));
deny(()=>gatewayConfigExactlyKnown(currentToml));
pass(()=>assert.match(currentToml,/\[version_metadata\]\s*\nbinding = "CF_VERSION_METADATA"/));
deny(()=>gatewayConfigExactlyKnown(historicalToml.replace(
  'jill-work-custom-orders-qa','jill-custom-order-live')));
deny(()=>gatewayConfigExactlyKnown(historicalToml.replace(
  'new_sqlite_classes','new_classes')));
deny(()=>gatewayConfigExactlyKnown(historicalToml+'\n'));
const secret='verified-work-only-secret-32-characters-long';
pass(()=>{
  const obj=stagedSecrets({secret});
  assert.deepEqual(Object.keys(obj).sort(),
    [GATEWAY_KEY,BACKEND_KEY].sort());
  assert.equal(obj[GATEWAY_KEY],secret);
  assert.equal(obj[BACKEND_KEY],JILL_HQ_WORK_QA_GOOGLE_URL);
  assert.equal(obj[SHOPIFY_KEY],undefined);
  assert.equal(Object.isFrozen(obj),true);
});
for(const wrong of [
  {secret:'short'},
  {secret},
  {secret,endpoint:'https://script.google.com/macros/s/OTHER/exec'},
  {secret,endpoint:'https://jillonlinestore.com'},
]){
  if(wrong.secret===secret&&!wrong.endpoint)continue;
  deny(()=>stagedSecrets(wrong));
}
pass(()=>{
  const args=uploadArguments({file:'C:\\Private\\temp-secret.json',
    commit:sourceSha});
  assert.equal(args[0],'versions');
  assert.equal(args[1],'upload');
  assert.ok(args.includes('--strict'));
  assert.ok(args.includes('--keep-vars'));
  assert.ok(args.includes('--secrets-file'));
  assert.ok(args.includes(MARKER+sourceSha));
  assert.equal(args.includes('deploy'),false);
  assert.equal(args.includes('secret'),false);
  assert.ok(Object.isFrozen(args));
});
deny(()=>uploadArguments({file:'env.txt',commit:sourceSha}));
deny(()=>uploadArguments({file:'file.json',commit:'not-git'}));
const operator=readFileSync(new URL(
  './upload-work-custom-order-gateway-repair-inactive.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "process.platform==='win32'",
  "readVerifiedWorkGatewayKey",
  "checkIsolatedQaGatewaySecret",
  "auditWorkQaReadOnly",
  "inspectGatewayCandidate",
  "gatewayConfigExactlyKnown",
  "uploadArguments({file,commit})",
  "cli([...args,'--dry-run']",
  "reserveOnce(path.join(receipts,RECEIPT)",
  "fs.writeFileSync(file,JSON.stringify(stagedSecrets({secret}))",
  "fs.rmSync(tempdir,{recursive:true,force:true})",
  "approval_already_used",
  "matching_candidate_already_exists",
  "gateway_code_changed_unapproved",
  "backend/shopify-work-app-proxy-auth.mjs",
  "gateway_deployment_changed_after_readback",
  "getExactGatewayUploadVersion",
  "DO NOT RETRY",
  "NO traffic switch",
]){
  assert.ok(operator.includes(marker),
    'Missing Owner inactive-only safety gate: '+marker);n++;
}
for(const unsafe of [
  /\bcli\(\[['"]deploy['"]/,
  /\bcli\(\[['"]versions['"],['"]deploy['"]/,
  /\bcli\(\[['"]secret['"],['"]put['"]/,
  /\bcli\(\[['"]d1['"],['"]execute['"]/,
  /\bcli\(\[['"]r2['"]/,
  /console\.log\(\s*secret/,
  /ScriptApp\.newTrigger/,
]){
  assert.doesNotMatch(operator,unsafe);n++;
}
console.log('PASS WORK gateway inactive repair OFFLINE: '+n+
  ' manifest, separate WORK secrets, deployed version parity, no new DO/paid binding, active unchanged and no-retry guards.');
console.log('HOLD: CI never reads real keys or runs Wrangler upload; Owner Windows performs single approved inactive upload.');
