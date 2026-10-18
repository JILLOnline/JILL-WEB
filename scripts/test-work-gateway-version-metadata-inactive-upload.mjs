// Strict OFFLINE policy certification; no Cloudflare, Shopify, Google or writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORKER,ACTIVE,PREVIOUS,DEPLOYMENT,META,MARKER,
  exactManifest,exactAllocation,inspectNewInactiveVersion,exactNewVersion,
  inactiveUploadArgs,stagedSecrets,
} from './work-gateway-version-metadata-inactive-policy.mjs';
const hex='a'.repeat(40);
const latest=[{id:DEPLOYMENT,created_on:'2026-10-17T23:16:13Z',
  versions:[{version_id:ACTIVE,percentage:100},
    {version_id:PREVIOUS,percentage:0}]}];
let n=0;
const pass=f=>{f();n++;};
const reject=f=>{assert.throws(f,/gateway_metadata_upload_|gateway_inactive_policy_|work_gateway_tail_/);n++;};
pass(()=>assert.equal(WORKER,'jill-work-custom-orders-qa'));
pass(()=>assert.equal(exactAllocation(latest).deployment_id,DEPLOYMENT));
for(const wrong of [
  [],
  [{...latest[0],id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}],
  [{...latest[0],versions:[{version_id:ACTIVE,percentage:99},{version_id:PREVIOUS,percentage:1}]}],
  [{...latest[0],versions:[{version_id:PREVIOUS,percentage:100},{version_id:ACTIVE,percentage:0}]}],
])reject(()=>exactAllocation(wrong));
const manifest=readFileSync(
  new URL('../services/custom-order-cloudflare/wrangler.toml',import.meta.url),'utf8');
pass(()=>assert.equal(exactManifest(manifest),true));
pass(()=>assert.equal(exactManifest(manifest.replace(/\n/g,'\r\n')),true));
for(const bad of [
  manifest.replace('workers_dev = true','workers_dev = false'),
  manifest.replace('CF_VERSION_METADATA','ANOTHER_BINDING'),
  manifest.replace('new_sqlite_classes','new_classes'),
  manifest+'\n',
  manifest+'\n[[r2_buckets]]\n',
])reject(()=>exactManifest(bad));
const binding=(name,type,extra={})=>({name,type,...extra});
const baseline=[
  binding('SHOPIFY_WORK_APP_SECRET','secret_text'),
  binding('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
  binding('JILL_CUSTOM_ORDER_QA_BACKEND_URL','secret_text'),
  binding('RATE_LIMITER','durable_object_namespace',
    {class_name:'CustomOrderRateLimiter',script_name:WORKER}),
];
const runtime={compatibility_date:'2026-10-12',flags:[],main:'worker.mjs'};
const version=(id,bs=baseline,etag='one')=>({
  id,resources:{bindings:bs,script:{etag,handlers:['fetch']},
    script_runtime:runtime},
});
const original=version(ACTIVE),previous=version(PREVIOUS,baseline,'two');
const uuid='bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';
const extra=binding(META,'version_metadata');
const candidate=version(uuid,[...baseline,extra],'three');
pass(()=>{
  const out=inspectNewInactiveVersion({original,previous,candidate});
  assert.equal(out.new_inactive_version,uuid);
  assert.equal(out.normal_traffic_changed,false);
  assert.equal(out.extra_binding,META);
  assert.equal(out.secret_values_readable,false);
});
for(const altered of [
  {...candidate,id:ACTIVE},
  version(uuid,baseline),
  version(uuid,[...baseline,extra,binding('PAID_R2','r2_bucket')]),
  version(uuid,[...baseline,extra,extra]),
  version(uuid,[...baseline.filter(x=>x.name!=='SHOPIFY_WORK_APP_SECRET'),extra]),
  version(uuid,[...baseline.map(x=>x.name==='SHOPIFY_WORK_APP_SECRET'?
    binding(x.name,'plain_text',{text:'unsafe'}):x),extra]),
  version(uuid,[...baseline.filter(x=>x.name!=='RATE_LIMITER'),
    binding('RATE_LIMITER','durable_object_namespace',
      {class_name:'ChangedClass',script_name:WORKER}),extra]),
  version(uuid,[...baseline,binding(META,'plain_text')]),
  {...candidate,resources:{...candidate.resources,
    script_runtime:{...runtime,compatibility_date:'2026-10-18'}}},
  {...candidate,resources:{...candidate.resources,
    script:{etag:'three',handlers:['fetch','scheduled']}}},
])reject(()=>inspectNewInactiveVersion({original,previous,candidate:altered}));
const list=[{id:ACTIVE,metadata:{created_on:'2026-10-17T20:00:00Z'}},
  {id:PREVIOUS,metadata:{created_on:'2026-10-17T21:00:00Z'}},
  {id:uuid,metadata:{created_on:'2026-10-17T23:00:00Z'},
    annotations:{'workers/message':MARKER+hex}}];
pass(()=>assert.equal(exactNewVersion({versions:list,commit:hex}),uuid));
for(const wrong of [
  list.slice(0,2),
  [...list,{...list[2]}],
  [...list,{id:'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    metadata:{created_on:'2026-10-18T00:00:00Z'}}],
  list.map(x=>x.id===uuid?{...x,annotations:{'workers/message':'unknown'}}:x),
])reject(()=>exactNewVersion({versions:wrong,commit:hex}));
pass(()=>{
  const a=inactiveUploadArgs({file:'C:\\Private\\secrets.json',commit:hex});
  assert.deepEqual(a.slice(0,2),['versions','upload']);
  for(const v of ['--strict','--keep-vars','--secrets-file',MARKER+hex])
    assert.ok(a.includes(v));
  assert.ok(!a.includes('deploy'));
  assert.ok(Object.isFrozen(a));
});
reject(()=>inactiveUploadArgs({file:'secret.txt',commit:hex}));
reject(()=>inactiveUploadArgs({file:'secret.json',commit:'wrong'}));
pass(()=>{
  const stage=stagedSecrets({secret:'synthetic-work-secret-only-32-characters'});
  assert.deepEqual(Object.keys(stage).sort(),[
    'JILL_CUSTOM_ORDER_GATEWAY_SECRET','JILL_CUSTOM_ORDER_QA_BACKEND_URL',
  ].sort());
  assert.equal(stage.SHOPIFY_WORK_APP_SECRET,undefined);
});
const code=readFileSync(new URL(
  './upload-work-gateway-version-metadata-inactive-owner.mjs',
  import.meta.url),'utf8');
for(const marker of [
  "process.platform==='win32'",
  "'jill/rewards-work'",
  "'refs/remotes/origin/jill/rewards-work'",
  'PINNED_FILES',
  "git('hash-object',file)",
  'exactManifest(',
  'exactAllocation(',
  'inspectGatewayCandidate(',
  'inspectNewInactiveVersion(',
  'readVerifiedWorkGatewayKey',
  'checkIsolatedQaGatewaySecret',
  'auditWorkQaReadOnly',
  "inactiveUploadArgs({file:secretsFile,commit})",
  "cli([...command,'--dry-run']",
  'reserveOnce(receipt,commit)',
  "fs.openSync(file,'wx'",
  'exactNewVersion(',
  'baseline()',
  'fs.rmSync(temp',
  'DO NOT RETRY',
]){
  assert.ok(code.includes(marker),'Required upload boundary missing: '+marker);
  n++;
}
for(const forbidden of [
  /['"]deploy['"],['"]--name['"]/,
  /['"]versions['"],['"]deploy['"]/,
  /['"]secret['"],['"]put['"]/,
  /['"]d1['"],['"]execute['"]/,
  /['"]r2['"],/,
  /['"]POST['"]/,
  /console\.log\(\s*secret\b/,
  /console\.error\([^)]*stderr\b/,
  /process\.argv\[2\]/,
]){
  assert.doesNotMatch(code,forbidden);
  n++;
}
console.log('PASS WORK metadata candidate inactive upload OFFLINE: '+n+
  ' exact split, reviewed manifest, secret/DO preservation, one-use receipt, no activation or write path.');
console.log('HOLD: actual Cloudflare upload requires separate explicit Owner approval.');
