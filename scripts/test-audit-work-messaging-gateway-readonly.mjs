import assert from 'node:assert/strict';
import {auditWorkMessagingGateway} from './audit-work-messaging-gateway-readonly.mjs';
import {WORK_ACCOUNT_GATEWAY} from './audit-work-custom-order-account-runtime.mjs';
const paths=['/healthz','/jill-custom-order-reply','/jill-custom-order-reply','/jill-custom-order-reply','/jill-custom-order-reply'];
const methods=['GET','OPTIONS','POST','POST','GET'];
const statuses=[200,204,401,401,405];
function response(i,kind='valid'){
 const headers={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'private, no-store, max-age=0',
  'x-content-type-options':'nosniff',
  'access-control-allow-origin':'*',
  'access-control-allow-headers':'Authorization, Content-Type',
 };
 if(kind==='cors'&&i===1)delete headers['access-control-allow-origin'];
 const payload=i===0?{ok:true,environment:'WORK_CUSTOM_ORDERS_QA'}:
 {version:1,operation:'custom_order.account.reply.result',ok:false,
  error:{code:i===4?'method_not_allowed':'unauthenticated_account'}};
 if(kind==='forged'&&i===2)payload.ok=true;
 return new Response(i===1?null:JSON.stringify(payload),{status:statuses[i],headers});
}
function adapter(kind='valid'){
 let i=0;
 return async(url,opts)=>{
  assert.equal(url,WORK_ACCOUNT_GATEWAY+paths[i]);
  assert.equal(opts.method,methods[i]);
  assert.equal(opts.redirect,'error');
  assert.ok(opts.signal);
  assert.equal(opts.body,undefined);
  assert.equal(opts.headers.Authorization,i===3?'Bearer invalid-work-audit':undefined);
  const r=response(i,kind);i++;return r;
 };
}
const result=await auditWorkMessagingGateway({request:adapter()});
assert.equal(result.checks.length,5);
assert.equal(result.checks.every(x=>x.passed),true);
assert.equal(result.customer_authenticated,false);
assert.equal(result.google_qa_published_verified,false);
assert.equal(result.activation_authorized,false);
await assert.rejects(()=>auditWorkMessagingGateway({request:adapter('cors')}),/cors_origin/);
await assert.rejects(()=>auditWorkMessagingGateway({request:adapter('forged')}),/reply_not_denied/);
await assert.rejects(()=>auditWorkMessagingGateway({request:async()=>new Response(null,{status:503})}),/wrong_status/);
await assert.rejects(()=>auditWorkMessagingGateway({timeoutMs:0}),/invalid_timeout/);
console.log('PASS WORK anonymous messaging gateway contract: health, CORS, absent/forged auth rejection, GET denied, no customer writes.');
