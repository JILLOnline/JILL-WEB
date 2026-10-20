// WORK-only: prove that attribution originates from Cloudflare runtime metadata.
// Node/offline only. No Worker deployment, Cloudflare connection or order write.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handleCloudflareCustomOrderWork} from '../services/custom-order-cloudflare/handler.mjs';

const base='https://gateway.example.invalid/healthz';
const uuid='01234567-89ab-4cde-8123-456789abcdef';
const actual='aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const other='11111111-2222-4333-8444-555555555555';
let healthPings=0;
const fakeLimiter={getByName(name){
  assert.equal(name,'jill-work-custom-orders-global');
  return {ping:async()=>{healthPings++;return true;},allow:async()=>true};
}};
const env={
  SHOPIFY_WORK_APP_SECRET:'mock-work-shopify-secret-32-chars-plus',
  JILL_CUSTOM_ORDER_GATEWAY_SECRET:'mock-google-signing-secret-32-chars-plus',
  JILL_CUSTOM_ORDER_QA_BACKEND_URL:
    'https://script.google.com/macros/s/AKfycbyctJvU9IDA_lspwBmYP5XYS5ZHPkrcw4RUaWDFz-a2M41Fc2gGn6ux2PxYCWNNF30V/exec',
  RATE_LIMITER:fakeLimiter,
  CF_VERSION_METADATA:{id:actual},
};
const call=(url,e=env,init={})=>
  handleCloudflareCustomOrderWork(new Request(url,init),e);
const body={ok:true,environment:'WORK_CUSTOM_ORDERS_QA'};
const header='x-jill-work-gateway-version';

const ordinary=await call(base);
assert.equal(ordinary.status,200);
assert.deepEqual(await ordinary.json(),body);
assert.equal(ordinary.headers.get(header),null,'normal health must not reveal version');
assert.equal(ordinary.headers.get('cache-control'),'no-store');

const pinned=await call(base+'?jill_work_version_probe='+uuid,env,{
  headers:{'Cloudflare-Workers-Version-Overrides':'jill-work-custom-orders-qa="'+other+'"'},
});
assert.equal(pinned.status,200);
assert.deepEqual(await pinned.json(),body);
assert.equal(pinned.headers.get(header),actual,
  'server runtime binding, NEVER caller override header, controls attribution');

const normalWithoutMetadata=await call(base,{...env,CF_VERSION_METADATA:undefined});
assert.equal(normalWithoutMetadata.status,200,
  'older ordinary health behavior must remain compatible');
assert.equal(normalWithoutMetadata.headers.get(header),null);
const probeWithoutMetadata=await call(base+'?jill_work_version_probe='+uuid,{
  ...env,CF_VERSION_METADATA:undefined,
});
assert.equal(probeWithoutMetadata.status,503,'missing metadata must HOLD');
assert.deepEqual(await probeWithoutMetadata.json(),{ok:false});
assert.equal(probeWithoutMetadata.headers.get(header),null);
const invalidMetadata=await call(base+'?jill_work_version_probe='+uuid,{
  ...env,CF_VERSION_METADATA:{id:'not-a-version'},
});
assert.equal(invalidMetadata.status,503);
assert.equal(invalidMetadata.headers.get(header),null);

for(const url of [
  base+'?jill_work_version_probe=',
  base+'?jill_work_version_probe=not-a-uuid',
  base+'?jill_work_version_probe='+uuid+'&jill_work_version_probe='+uuid,
  base+'?jill_work_version_probe='+uuid+'&extraneous=1',
]){
  const response=await call(url);
  assert.equal(response.status,503,url);
  assert.equal(response.headers.get(header),null,url);
}
const ignored=await call(base+'?unexpected=1');
assert.equal(ignored.status,200);
assert.equal(ignored.headers.get(header),null);

const unavailable=await call(base+'?jill_work_version_probe='+uuid,{
  ...env,RATE_LIMITER:{getByName:()=>({ping:async()=>false})},
});
assert.equal(unavailable.status,503);
assert.equal(unavailable.headers.get(header),null);
const postHealth=await call(base+'?jill_work_version_probe='+uuid,env,{method:'POST'});
assert.equal(postHealth.status,404,'version probe is never a POST route');
const anonymousAccount=await call('https://gateway.example.invalid/jill-custom-order-account',
  env,{method:'POST'});
assert.equal(anonymousAccount.status,401,'account security unchanged');

const toml=readFileSync(new URL(
  '../services/custom-order-cloudflare/wrangler.toml',import.meta.url),'utf8');
assert.match(toml,/\[version_metadata\]\s*\nbinding = "CF_VERSION_METADATA"/);
assert.match(toml,/name = "jill-work-custom-orders-qa"/);
assert.match(toml,/class_name = "CustomOrderRateLimiter"/);
assert.equal(healthPings>0,true);
console.log('PASS WORK gateway version metadata OFFLINE: health version attribution from runtime binding, normal response unchanged, missing binding fail-closed, forged override rejected as evidence, anonymous account denied.');
console.log('HOLD: no Cloudflare upload/deployment, no new version ID, no candidate execution or Google HMAC proven.');
