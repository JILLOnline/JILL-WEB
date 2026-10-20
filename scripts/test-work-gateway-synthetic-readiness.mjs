// Offline fixture only: exact WORK gateway allocation, runtime attribution,
// version metadata and binding guards for the HQ synthetic QA preflight.
import assert from 'node:assert/strict';
import {verifyGatewayEvidence,DEPLOYMENT}
  from './verify-work-gateway-synthetic-readiness.mjs';
import {CANDIDATE,ORIGINAL}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {MARKER}
  from './work-gateway-version-metadata-inactive-policy.mjs';

const binding=(name,type,extra={})=>({name,type,...extra});
const version={id:CANDIDATE,annotations:{
  'workers/message':MARKER+'a4a9840ce83e04dd85f7f2e306cdcdd037b56d6a',
},resources:{script:{etag:'known',handlers:['fetch']},bindings:[
  binding('SHOPIFY_WORK_APP_SECRET','secret_text'),
  binding('JILL_CUSTOM_ORDER_GATEWAY_SECRET','secret_text'),
  binding('JILL_CUSTOM_ORDER_QA_BACKEND_URL','secret_text'),
  binding('RATE_LIMITER','durable_object_namespace',{
    class_name:'CustomOrderRateLimiter'}),
  binding('CF_VERSION_METADATA','version_metadata'),
]}};
const deployment={id:DEPLOYMENT,created_on:'2026-10-18T02:33:29Z',
  versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0}]};
const health={status:200,mime:'application/json',
  body:{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'},
  versionHeader:CANDIDATE,redirect:null,cacheControl:'no-store'};
const good={before:[deployment],active:CANDIDATE,version,health,
  after:[deployment],activeAfter:CANDIDATE};
const verified=verifyGatewayEvidence(good);
assert.equal(verified.unpinned_runtime_proven,true);
assert.equal(verified.shopify_signed_post_proven,false);
let rejected=0;
for(const changed of [
  {before:[{...deployment,versions:[
    {version_id:ORIGINAL,percentage:100},
    {version_id:CANDIDATE,percentage:0}]}]},
  {before:[{...deployment,id:'11111111-1111-4111-8111-111111111111'}]},
  {active:ORIGINAL},
  {version:{...version,annotations:{}}},
  {version:{...version,resources:{...version.resources,bindings:
    version.resources.bindings.slice(0,4)}}},
  {version:{...version,resources:{...version.resources,bindings:[
    ...version.resources.bindings.slice(0,4),
    binding('CF_VERSION_METADATA','plain_text')]}}},
  {health:{...health,versionHeader:ORIGINAL}},
  {health:{...health,status:503}},
  {after:[{...deployment,id:'22222222-2222-4222-8222-222222222222'}]},
  {activeAfter:ORIGINAL},
]){
  assert.throws(()=>verifyGatewayEvidence({...good,...changed}));
  rejected++;
}
console.log('PASS WORK gateway synthetic readiness OFFLINE: exact active deployment, version metadata and unpinned runtime; '+rejected+' drift cases rejected.');
