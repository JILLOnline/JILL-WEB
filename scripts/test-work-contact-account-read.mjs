import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {handleWorkContactAccountRead,projectVerifiedCustomerContactTickets}
 from '../backend/work-contact-account-read.mjs';
import {handleCloudflareCustomOrderWork}
 from '../services/custom-order-cloudflare/handler.mjs';

const secret='shopify-work-test-secret-not-a-real-key-of-length-42';
const now=1791800000000;
const shop='jill-work.myshopify.com';
const A='gid://shopify/Customer/111',B='gid://shopify/Customer/222';
const ticket='jill:contact:11111111-2222-4333-8444-555555555555';
const row={ticket_id:ticket,state:'received',revision:1,reason:'custom',
 created_at_ms:now-10000,updated_at_ms:now-9000,
 owner_customer_gid:A,
 email:'NEVER_EXPOSE@example.invalid',contact_json:'PRIVATE'};
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function jwt(customer=A){
 const t=Math.floor(now/1000);
 const claims={aud:'f8e1ebdbae84490dc8ea5b133637e6c0',
 dest:shop,sub:customer,iat:t-60,nbf:t-60,exp:t+180,
 jti:'qa-contact-customer-session-1'};
 const part=enc({alg:'HS256',typ:'JWT'})+'.'+enc(claims);
 return part+'.'+createHmac('sha256',secret).update(part).digest('base64url');
}
const path='https://qa.workers.dev/jill-contact-account';
const req=(token=jwt(),body='')=>new Request(path,{
 method:'POST',headers:{authorization:'Bearer '+token},body,
});
let queries=0,authorized=0;
const db={prepare:sql=>{
 queries++;
 assert.match(sql,/WHERE shop=\? AND owner_customer_gid=\?/);
 assert.match(sql,/LIMIT 21/);
 assert.doesNotMatch(sql,/SELECT \*/);
 return {bind:(queriedShop,owner)=>{
  assert.equal(queriedShop,shop);
  return {all:async()=>({results:owner===A?[row]:[]})};
 }};
}};
const opts={enabled:true,shopifyAppSecret:secret,db,now:()=>now,
 rateLimit:async({shop:one,customer})=>{
  authorized++;
  assert.equal(one,shop);
  assert.ok([A,B].includes(customer));
  return true;
 }};
const off=await handleWorkContactAccountRead({request:req(),...opts,enabled:false});
assert.equal(off.status,503);assert.equal(queries,0);assert.equal(authorized,0);
const own=await handleWorkContactAccountRead({request:req(),...opts});
assert.equal(own.status,200);
const body=await own.json();
assert.equal(body.version,1);
assert.equal(body.operation,'jill.contact.account.list.result');
assert.equal(body.tickets[0].ticket_id,ticket);
assert.equal(body.tickets[0].reply_enabled,false);
assert.equal(body.tickets[0].thread_version,1);
assert.equal(JSON.stringify(body).includes('NEVER_EXPOSE'),false);
assert.equal(JSON.stringify(body).includes('owner_customer_gid'),false);
const other=await handleWorkContactAccountRead({
 request:req(jwt(B)),...opts});
assert.equal(other.status,200);
assert.deepEqual((await other.json()).tickets,[]);
const reads=queries;
const cross=await handleWorkContactAccountRead({
 request:req(),...opts,db:{prepare:()=>({bind:()=>({
 all:async()=>({results:[{...row,owner_customer_gid:B}]})
 })})}});
assert.equal(cross.status,503,
 'even a faulty D1 row filter cannot return Customer B ticket to A');
for(const bad of [
 req(jwt('gid://shopify/Customer/333?email=qa@example.invalid')),
 req(jwt(A).slice(0,-1)+'z'),
 req(jwt(A),'{"customer_gid":"gid://shopify/Customer/222"}'),
 new Request(path,{method:'POST'}),
]){
 const response=await handleWorkContactAccountRead({request:bad,...opts});
 assert.ok([400,401].includes(response.status));
}
assert.equal(queries,reads);
assert.throws(()=>projectVerifiedCustomerContactTickets(
 [{...row,owner_customer_gid:B}],A),/contact_account_unverified/);
const workerOff=await handleCloudflareCustomOrderWork(req(),{
 SHOPIFY_WORK_APP_SECRET:secret,RATE_LIMITER:{
  getByName:()=>({allow:async()=>true})},
 JILL_ORDER_DESK_WORK_DB:db,
});
assert.equal(workerOff.status,503);
assert.equal(queries,reads);
console.log('PASS My JILL Contact account: JWT GID scoped D1 read; customer A/B privacy, body/filter/forged owner denial; Worker hard OFF.');
