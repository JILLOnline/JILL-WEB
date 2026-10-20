import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CANDIDATE,WORKER} from './work-custom-order-candidate-promotion-policy.mjs';
import {MARKER,EMPTY_POST_MARKER,EMPTY_POST_BASELINE,emptyPostBaseline,
  emptyPostVersion,inspectEmptyPostVersion,emptyPostAllocation,
  emptyPostUploadArgs,emptyPostDeployArgs}
  from './work-gateway-diagnostic-release-policy.mjs';
import {diagnosticPackage,stageDiagnosticPackage,gitBlob} from './prepare-work-gateway-diagnostic.mjs';
import {reserveDiagnosticAttempt} from './release-work-gateway-diagnostic-owner.mjs';
const ROOT=fileURLToPath(new URL('../',import.meta.url));
const fixed='ff010101-2222-4333-8444-555555555555';
const bindings=[{name:'CF_VERSION_METADATA',type:'version_metadata'},
  {name:'JILL_CUSTOM_ORDER_GATEWAY_SECRET',type:'secret_text'},
  {name:'JILL_CUSTOM_ORDER_QA_BACKEND_URL',type:'secret_text'},
  {name:'SHOPIFY_WORK_APP_SECRET',type:'secret_text'},
  {name:'RATE_LIMITER',type:'durable_object_namespace',class_name:'CustomOrderRateLimiter'}];
const meta=(id,marker)=>({id,annotations:{'workers/message':marker},resources:{bindings,
  script:{etag:id,handlers:['fetch']},script_runtime:{compatibility_date:'2026-10-12'}}});
const active=meta(CANDIDATE,'prior'),previous=meta(EMPTY_POST_BASELINE.diagnostic,MARKER);
const uploaded=meta(fixed,EMPTY_POST_MARKER);
const oldVersions=[{id:CANDIDATE,metadata:{created_on:'2026-10-18T02:30:00Z'}},
  {id:previous.id,metadata:{created_on:'2026-10-18T19:30:00Z'},annotations:previous.annotations}];
const versions=[...oldVersions,{id:fixed,metadata:{created_on:'2026-10-19T01:00:00Z'},annotations:uploaded.annotations}];
const before={deployment:EMPTY_POST_BASELINE.deployment,versions:[
  {id:CANDIDATE,percentage:100},{id:previous.id,percentage:0}]};
assert.equal(emptyPostBaseline(before),before);
assert.throws(()=>emptyPostBaseline({...before,deployment:fixed}));
assert.throws(()=>emptyPostBaseline({...before,versions:[{id:CANDIDATE,percentage:99},{id:previous.id,percentage:1}]}));
assert.equal(emptyPostVersion(oldVersions),null);
assert.equal(emptyPostVersion(versions),fixed);
assert.throws(()=>emptyPostVersion([...versions,versions.at(-1)]));
assert.throws(()=>emptyPostVersion([...oldVersions,{id:fixed,metadata:{created_on:'2026-10-19T02:00:00Z'}}]));
assert.throws(()=>emptyPostVersion(versions.map(v=>({...v,metadata:{created_on:'2026-10-19T01:00:00Z'}}))));
assert.equal(inspectEmptyPostVersion({versions,active,previous,uploaded}),fixed);
assert.throws(()=>inspectEmptyPostVersion({versions,active,previous,uploaded:{...uploaded,resources:{...uploaded.resources,
  bindings:[...bindings,{name:'JILL_WORK_CONVERSATION_ENABLED',type:'plain_text',text:'true'}]}}}));
assert.throws(()=>inspectEmptyPostVersion({versions,active,previous,uploaded:{...uploaded,
  resources:{...uploaded.resources,script_runtime:{compatibility_date:'2026-10-19'}}}}));
const after={deployment:'aabbccdd-2222-4333-8444-555555555555',versions:[{id:fixed,percentage:0},{id:CANDIDATE,percentage:100}]};
assert.equal(emptyPostAllocation(after,fixed),after);
assert.throws(()=>emptyPostAllocation(before,fixed));
assert.throws(()=>emptyPostAllocation({...after,versions:[{id:fixed,percentage:100}]},fixed));
assert.deepEqual(emptyPostDeployArgs(fixed).slice(0,4),['versions','deploy',CANDIDATE+'@100%',fixed+'@0%']);
assert.throws(()=>emptyPostDeployArgs(previous.id));
const upload=emptyPostUploadArgs();assert(upload.includes('--keep-vars'));assert(!upload.includes('--secrets-file'));
assert.equal(upload.at(-1),EMPTY_POST_MARKER);assert(upload.includes(WORKER));
const packed=diagnosticPackage();
assert.equal(packed.package_sha256,'eb8561c1f1b5a4e229db7800cc75e67aed1619e7aac15ac7bb044dea62604de3');
const changed=[];
for(const [file,content] of Object.entries(packed.files)){
  if(file==='backend/empty-http-body.mjs'){changed.push(file);continue;}
  const prior=execFileSync('git',['-C',ROOT,'show',packed.base_source+':'+file],{encoding:'utf8'});
  if(prior!==content)changed.push(file);
}
assert.deepEqual(changed.sort(),['backend/custom-order-gateway.mjs','backend/empty-http-body.mjs','services/custom-order-cloudflare/handler.mjs']);
assert(!packed.files['services/custom-order-cloudflare/handler.mjs'].includes('handleWorkCustomerReply'));
assert(!packed.files['backend/custom-order-account-read.mjs'].includes('public_timeline_v2'));
assert.throws(()=>diagnosticPackage({readReviewed:()=>''}));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'jill-diagnostic-release-test-'));
try{
  const staged=stageDiagnosticPackage(temp);assert.equal(staged.package_sha256,packed.package_sha256);
  assert.throws(()=>stageDiagnosticPackage(temp));
  for(const item of packed.inventory)
    assert.equal(gitBlob(fs.readFileSync(path.join(temp,item.path),'utf8')),item.git_blob);
  const file=path.join(temp,'new-attempt.json');
  reserveDiagnosticAttempt(file,{operation:'synthetic'});
  const original=fs.readFileSync(file,'utf8');
  assert.throws(()=>reserveDiagnosticAttempt(file,{operation:'retry'}));
  assert.equal(fs.readFileSync(file,'utf8'),original);
  assert.equal(JSON.parse(original).retry_allowed,false);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
console.log('PASS minimal historical package, exact 100/0 baseline, inherited bindings, separate one-use receipts and drift denial.');
