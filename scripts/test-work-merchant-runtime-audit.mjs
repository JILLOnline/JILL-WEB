import assert from 'node:assert/strict';
import {
  WORK_MERCHANT_HOST,auditWorkMerchantRuntime,
} from './audit-work-merchant-runtime.mjs';

const paths=['/healthz','/','/admin','/api/merchant'];
let calls=0;
const responseHeaders={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0',
};
async function mock(url,init) {
  const i=calls++;
  assert.equal(url,WORK_MERCHANT_HOST+paths[i]);
  assert.equal(init.method,'GET');
  assert.equal(init.redirect,'error');
  assert.equal(init.body,undefined);
  assert.equal(init.headers,undefined);
  assert.ok(init.signal);
  const health=i===0;
  return new Response(JSON.stringify(health?{
    ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:true,admin_ready:false,
  }:{
    ok:false,error:'merchant_host_not_configured',
  }),{status:health?200:503,headers:responseHeaders});
}
const results=await auditWorkMerchantRuntime({request:mock});
assert.equal(calls,4);
assert.deepEqual(results.map(x=>x.status),[200,503,503,503]);
assert.ok(results.every(x=>x.passed));

await assert.rejects(()=>auditWorkMerchantRuntime({
  request:async()=>new Response(JSON.stringify({
    ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:false,admin_ready:false,
  }),{status:200,headers:responseHeaders}),
}),/schema not ready/);
await assert.rejects(()=>auditWorkMerchantRuntime({
  request:async()=>new Response(JSON.stringify({
    ok:true,environment:'JILL_ORDER_DESK_WORK',
    database_ready:true,admin_ready:true,
  }),{status:200,headers:responseHeaders}),
}),/Admin incorrectly enabled/);
await assert.rejects(()=>auditWorkMerchantRuntime({
  request:async()=>new Response('{}',{status:503,headers:responseHeaders}),
}),/expected HTTP 200/);
await assert.rejects(()=>auditWorkMerchantRuntime({timeoutMs:0}),
  /Invalid audit timeout/);
console.log('Merchant WORK remote audit: exact host, D1 schema health, no credentials, and denied merchant routes verified.');
