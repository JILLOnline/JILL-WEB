import assert from 'node:assert/strict';
import {
  WORK_ACCOUNT_GATEWAY,
  auditWorkCustomOrderAccountRuntime,
} from './audit-work-custom-order-account-runtime.mjs';

let count = 0;
const methods = ['GET','OPTIONS','POST','POST'];
const paths = ['/healthz','/jill-custom-order-account',
  '/jill-custom-order-account','/jill-custom-order-account'];
const statuses = [200,204,401,400];

async function mockRequest(url, options) {
  const i = count++;
  assert.ok(i < methods.length);
  assert.equal(url,WORK_ACCOUNT_GATEWAY + paths[i]);
  assert.equal(options.method,methods[i]);
  assert.equal(options.redirect,'error');
  assert.ok(options.signal);
  assert.equal(options.headers.Authorization,undefined);
  assert.equal(options.headers.authorization,undefined);
  if (i === 2) {
    assert.equal(options.headers['Content-Length'],'0');
    assert.equal(options.body,undefined);
  }
  if (i === 3) assert.equal(options.body,'{}');
  const headers = {
    'content-type':'application/json',
    'cache-control':'private, no-store, max-age=0',
    'access-control-allow-origin':'*',
    'access-control-allow-headers':'Authorization, Content-Type',
  };
  const body = i === 0 ? {ok:true,environment:'WORK_CUSTOM_ORDERS_QA'}
    : {version:1,operation:'custom_order.account.list.result',ok:false,
       error:{code:i === 2 ? 'unauthenticated_account' : 'invalid_request'}};
  return new Response(i === 1 ? null : JSON.stringify(body),
    {status:statuses[i],headers});
}
const result = await auditWorkCustomOrderAccountRuntime({request:mockRequest});
assert.equal(count,4);
assert.deepEqual(result.map(v=>v.status),statuses);
assert.equal(result.every(v=>v.passed),true);

await assert.rejects(()=>auditWorkCustomOrderAccountRuntime({
  request:async()=>new Response('{}',{status:200}),
}),/expected JSON response|wrong shop\/environment|invalid JSON|WORK health/);
await assert.rejects(()=>auditWorkCustomOrderAccountRuntime({
  request:async()=>new Response('{}',{status:401}),
}),/expected HTTP 200/);
await assert.rejects(()=>auditWorkCustomOrderAccountRuntime({timeoutMs:0}),
  /Invalid audit timeout/);
console.log('WORK-only public gateway audit verifies pinned host, no authorization, safe method contract, CORS, and fail-closed negative checks.');
