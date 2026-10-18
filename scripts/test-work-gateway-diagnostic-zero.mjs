import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CANDIDATE,ORIGINAL,WORKER,HOST}
  from './work-custom-order-candidate-promotion-policy.mjs';
import {DEPLOYMENT} from './verify-work-gateway-synthetic-readiness.mjs';
import {deployArgs,overrideValue,newAllocation,healthUrl,OVERRIDE_HEADER}
  from './work-gateway-diagnostic-zero-policy.mjs';
import {probe} from './probe-work-gateway-connection-owner.mjs';
const uploaded='f3d28a11-1111-4111-8111-111111111111';
const newId='aab18a11-1111-4111-8111-111111111111';
const previous={id:DEPLOYMENT,created_on:'2026-10-18T02:33:29Z',
  versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0}]};
const next={id:newId,created_on:'2026-10-18T20:33:29Z',
  versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:uploaded,percentage:0}]};
assert.deepEqual(deployArgs(uploaded).slice(0,4),
  ['versions','deploy',CANDIDATE+'@100%',uploaded+'@0%']);
assert(!deployArgs(uploaded).includes(ORIGINAL+'@0%'));
assert.equal(overrideValue(uploaded),WORKER+'="'+uploaded+'"');
assert.equal(OVERRIDE_HEADER,'Cloudflare-Workers-Version-Overrides');
assert.equal(healthUrl(uploaded),HOST+'/healthz?jill_work_version_probe='+uploaded);
assert.equal(newAllocation([next,previous],DEPLOYMENT,uploaded),newId);
for(const bad of [
  [{...next,versions:[{version_id:CANDIDATE,percentage:99},
    {version_id:uploaded,percentage:1}]},previous],
  [{...next,versions:[{version_id:ORIGINAL,percentage:100},
    {version_id:uploaded,percentage:0}]},previous],
  [{...next,versions:[{version_id:CANDIDATE,percentage:100},
    {version_id:ORIGINAL,percentage:0}]},previous],
  [{...next,created_on:previous.created_on},previous],
  [next,{...previous,versions:[{version_id:ORIGINAL,percentage:100}]}],
])assert.throws(()=>newAllocation(bad,DEPLOYMENT,uploaded));
assert.throws(()=>deployArgs(CANDIDATE));
assert.throws(()=>overrideValue(ORIGINAL));
const priorFetch=globalThis.fetch;
let captured;
try{
  globalThis.fetch=async (url,options)=>{
    captured={url,options};
    return new Response(JSON.stringify({ok:true,
      code:'gateway_google_signature_verified',order_created:false}),{
      status:200,headers:{'cache-control':'no-store'}});
  };
  await probe(HOST,'local-test-secret-0123456789-abcdefgh',{
    headers:{[OVERRIDE_HEADER]:overrideValue(uploaded)}});
}finally{globalThis.fetch=priorFetch;}
assert.equal(captured.url,HOST+'/jill-work-gateway-diagnostic');
assert.equal(captured.options.method,'POST');
assert.equal(captured.options.headers[OVERRIDE_HEADER],overrideValue(uploaded));
assert.match(captured.options.headers['x-jill-qa-diagnostic-signature'],/^[a-f0-9]{64}$/);
const script=readFileSync(new URL(
  './deploy-work-gateway-diagnostic-zero-owner.mjs',import.meta.url),'utf8');
for(const evidence of [
  'sourceGuard()', 'markerVersion()', 'await health()',
  'verifyGoogle(secret)', "'--dry-run'", 'recordOnce(receipt,commit',
  'newAllocation(json(commands.deployments)', 'await health({override:id})',
  'await probe(HOST,secret,{headers:{[OVERRIDE_HEADER]:overrideValue(id)}})',
  "fs.openSync(file,'wx'", 'No retry',
])assert(script.includes(evidence),evidence);
for(const forbidden of [
  /['"]versions['"],['"]upload['"]/, /['"]secret['"],['"]put['"]/, 
  /['"]d1['"],['"]execute['"]/, /['"]r2['"],/,
])assert.doesNotMatch(script,forbidden);
console.log('PASS WORK diagnostic 100/0 release exact allocation, runtime override and one-use guard.');
