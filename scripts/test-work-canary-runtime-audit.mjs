import assert from 'node:assert/strict';
import {auditWorkCanary,WORK_CANARY_HOST} from './audit-work-canary-runtime.mjs';
const urls=['/healthz','/','/app','/auth/login','/app/setup-owner'];
const heads={'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0'};
let count=0;
const request=async(url,init)=>{
  assert.equal(url,WORK_CANARY_HOST+urls[count++]);
  assert.equal(init.method,'GET');
  assert.equal(init.redirect,'error');
  assert.equal(init.body,undefined);
  assert.equal(init.headers,undefined);
  assert.ok(init.signal);
  const healthy=count===1;
  return new Response(JSON.stringify(healthy?{
    ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:true,admin_ready:false,
  }:{ok:false,error:'shopify_auth_not_configured'}),{
    status:healthy?200:503,headers:heads,
  });
};
assert.deepEqual((await auditWorkCanary({request})).map(x=>x.status),
  [200,503,503,503,503]);
assert.equal(count,5);

for(const [status,payload,regexp] of [
  [503,{ok:false,error:'merchant_storage_unavailable'},/expected 200/],
  [200,{ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:false,admin_ready:false},/D1 not ready/],
  [200,{ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:true,admin_ready:true},/Admin enabled unexpectedly/],
]){
  await assert.rejects(()=>auditWorkCanary({
    request:async()=>new Response(JSON.stringify(payload),{
      status,headers:heads,
    }),
  }),regexp);
}
await assert.rejects(()=>auditWorkCanary({timeoutMs:0}),/Invalid timeout/);
console.log('WORK canary audit contract: exact hostname, five GET-only checks, schema health and Shopify/Owner fail-closed responses passed.');
