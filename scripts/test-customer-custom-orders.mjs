import assert from 'node:assert/strict';
import {
 loadWorkCustomerCustomOrders,WORK_CUSTOM_ORDER_ACCOUNT_URL,
} from '../shared/customer-custom-orders.mjs';
const token='a'.repeat(55);
let requests=0,gets=0;
const sessionToken={get:async()=>{gets++;return token;}};
const order={submission_id:'jill:qa:owned-111',status:'reviewing',revision:2,
 updated_at:'2026-10-12T19:00:00.000Z',timeline:[
  {status:'received',note:'',occurred_at:'2026-10-12T18:00:00.000Z'},
  {status:'reviewing',note:'Your request is under review.',
   occurred_at:'2026-10-12T19:00:00.000Z'},
 ]};
async function fetchMock(endpoint,init) {
 requests++;
 assert.equal(endpoint,WORK_CUSTOM_ORDER_ACCOUNT_URL);
 assert.equal(init.method,'POST');
 assert.equal(init.headers.Authorization,'Bearer '+token);
 assert.equal(init.body,'');
 assert.equal(JSON.stringify(init).includes('customer_id'),false);
 assert.equal(JSON.stringify(init).includes('example@'),false);
 return new Response(JSON.stringify({
  version:1,operation:'custom_order.account.list.result',ok:true,
  orders:[{...order,internal_note:'DO NOT DISPLAY',
   timeline:order.timeline.map(ev=>({...ev,actor:'private'}))}],
 }),{status:200});
}
const loaded=await loadWorkCustomerCustomOrders({sessionToken,request:fetchMock});
assert.equal(gets,1);
assert.equal(requests,1);
assert.deepEqual(loaded,[order]);
assert.equal(JSON.stringify(loaded).includes('DO NOT DISPLAY'),false);
assert.equal(JSON.stringify(loaded).includes('actor'),false);
await assert.rejects(()=>loadWorkCustomerCustomOrders({
 sessionToken:{get:async()=>''},request:fetchMock,
}),/verify your current session/);
await assert.rejects(()=>loadWorkCustomerCustomOrders({sessionToken:null,
 request:fetchMock}),/session is unavailable/);
await assert.rejects(()=>loadWorkCustomerCustomOrders({sessionToken,
 endpoint:'https://example.com/private',request:fetchMock}),/unverified/);
const forbidden=async()=>new Response('{}',{status:401});
await assert.rejects(()=>loadWorkCustomerCustomOrders({sessionToken,
 request:forbidden}),/sign in/);
const invalid=async()=>new Response(JSON.stringify({
 version:1,operation:'wrong',ok:true,orders:[],
}),{status:200});
await assert.rejects(()=>loadWorkCustomerCustomOrders({sessionToken,
 request:invalid}),/Invalid Custom Orders response/);
const wrong=async()=>new Response(JSON.stringify({
 version:1,operation:'custom_order.account.list.result',ok:true,
 orders:[{...order,revision:9}],
}),{status:200});
await assert.rejects(()=>loadWorkCustomerCustomOrders({sessionToken,
 request:wrong}),/Invalid Custom Order history/);
assert.equal(requests,1,'Only authorized request accesses test endpoint');
console.log('WORK My JILL Custom Orders fetch uses fresh Shopify session token, fixed endpoint, public-only projection and fail-closed errors.');
