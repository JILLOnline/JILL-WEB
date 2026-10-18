import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {
  baseline,uploadArgs,candidateIsLatest,inspectUploaded,
  uploadedVersionUrl,certifyProbe,MARKER,
  versionUrlForId,certifyVersionHealth,
} from './work-gateway-diagnostic-release-policy.mjs';
import {CANDIDATE,ORIGINAL,WORKER}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {DEPLOYMENT}
  from './verify-work-gateway-synthetic-readiness.mjs';

const bindings=[
  {name:'SHOPIFY_WORK_APP_SECRET',type:'secret_text'},
  {name:'JILL_CUSTOM_ORDER_GATEWAY_SECRET',type:'secret_text'},
  {name:'JILL_CUSTOM_ORDER_QA_BACKEND_URL',type:'secret_text'},
  {name:'RATE_LIMITER',type:'durable_object_namespace',
    class_name:'CustomOrderRateLimiter'},
  {name:'CF_VERSION_METADATA',type:'version_metadata'},
];
const active={id:CANDIDATE,resources:{bindings,
  script:{etag:'candidate',handlers:['fetch']},
  script_runtime:{compatibility_date:'2026-10-12'}}};
const id='f3d28a11-1111-4111-8111-111111111111';
const uploaded={...active,id,
  annotations:{'workers/message':MARKER},
  resources:{...active.resources,script:{etag:'diagnostic',handlers:['fetch']}}};
const versions=[
  {id:CANDIDATE,metadata:{created_on:'2026-10-18T02:30:00Z'}},
  {id,metadata:{created_on:'2026-10-18T20:00:00Z'},
    annotations:{'workers/message':MARKER}},
];
const deployment=[{id:DEPLOYMENT,created_on:'2026-10-18T02:33:29Z',
  versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0}]}];
assert.equal(baseline(deployment,CANDIDATE).candidate_pct,100);
assert.throws(()=>baseline(deployment,ORIGINAL));
assert.equal(candidateIsLatest(versions.slice(0,1)),true);
assert.throws(()=>candidateIsLatest(versions));
assert.equal(inspectUploaded({versions,active,uploaded}),id);
assert.throws(()=>inspectUploaded({versions,active,uploaded:{...uploaded,
  resources:{...uploaded.resources,bindings:bindings.slice(1)}}}));
assert.throws(()=>inspectUploaded({versions,active,uploaded:{...uploaded,
  annotations:{'workers/message':'different'}}}));
const args=uploadArgs();
assert.deepEqual(args.slice(0,2),['versions','upload']);
assert(args.includes('--keep-vars'));
assert(args.includes('--strict'));
assert(!args.includes('--secrets-file'));
assert(!args.includes('deploy'));
assert.equal(args.at(-1),MARKER);
const url=`https://${id.slice(0,8)}-${WORKER}.jill-work-custom-orders.workers.dev`;
assert.equal(uploadedVersionUrl('Version URL: '+url+'\n',id),url);
assert.equal(versionUrlForId(id),url);
assert.equal(certifyVersionHealth({status:200,mime:'application/json',
  body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'},
  versionHeader:id,cacheControl:'no-store',redirect:null},id),true);
assert.throws(()=>certifyVersionHealth({status:200,mime:'application/json',
  body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'},
  versionHeader:CANDIDATE,cacheControl:'no-store',redirect:null},id));
assert.throws(()=>uploadedVersionUrl('Version URL: https://example.com',id));
assert.throws(()=>uploadedVersionUrl('Version URL: '+url,id.replace(/^f/,'a')));
assert.equal(certifyProbe({status:200,cacheControl:'no-store',redirect:null,
  body:{ok:true,code:'gateway_google_signature_verified',
    order_created:false}}).google_signature_verified,true);
assert.throws(()=>certifyProbe({status:200,cacheControl:'no-store',
  redirect:null,body:{ok:true,code:'gateway_google_signature_verified',
    order_created:true}}));
const ownerSource=readFileSync(fileURLToPath(new URL(
  './probe-work-gateway-connection-owner.mjs',import.meta.url)),'utf8');
assert(!ownerSource.includes("'--secrets-file'"));
assert(!ownerSource.includes("'versions','deploy'"));
assert.match(ownerSource,/recordOnce\(file/);
const recoverySource=readFileSync(fileURLToPath(new URL(
  './recover-work-gateway-diagnostic-readonly.mjs',import.meta.url)),'utf8');
assert.match(recoverySource,/one_use_receipt_missing/);
assert.match(recoverySource,/certifyVersionHealth/);
assert(!recoverySource.includes('uploadArgs'));
assert(!recoverySource.includes('recordOnce('));
console.log('PASS WORK diagnostic inactive upload policy, version URL, binding inheritance, exact response and one-use source guards.');
