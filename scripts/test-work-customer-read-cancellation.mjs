import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 loadWorkCustomerConversationState,loadWorkCustomerCustomOrders,
 WORK_CUSTOM_ORDER_ACCOUNT_URL,
} from '../shared/customer-custom-orders.mjs';

const fakeJwt='x'.repeat(55);
const sessionToken={get:async()=>fakeJwt};
const v1={version:1,operation:'custom_order.account.list.result',
 ok:true,orders:[],reply_enabled:false};

const closed=new AbortController();
closed.abort();
let touched=0;
await assert.rejects(()=>loadWorkCustomerConversationState({
 sessionToken:{get:async()=>{touched++;return fakeJwt;}},
 signal:closed.signal,request:async()=>{touched++;return new Response('{}');},
}),/AbortError/);
assert.equal(touched,0,'A canceled read must not fetch a customer token or visit network');

let resolveToken;
const tokenDeferred=new Promise(resolve=>{resolveToken=resolve;});
const pendingToken=new AbortController();
let hitNetwork=0;
const tokenTask=loadWorkCustomerConversationState({
 sessionToken:{get:()=>tokenDeferred},
 signal:pendingToken.signal,
 request:async()=>{hitNetwork++;return new Response('{}');},
});
pendingToken.abort();
resolveToken(fakeJwt);
await assert.rejects(tokenTask,/AbortError/);
assert.equal(hitNetwork,0,'No network may start after cancellation during Shopify token acquisition');

const networkAbort=new AbortController();
let sawRequestSignal=false;
const networkTask=loadWorkCustomerConversationState({
 sessionToken,signal:networkAbort.signal,
 request:async(endpoint,init)=>{
  assert.equal(endpoint,WORK_CUSTOM_ORDER_ACCOUNT_URL);
  assert.equal(init.method,'POST');
  assert.equal(init.body,'');
  assert.equal(init.headers.Authorization,'Bearer '+fakeJwt);
  assert.ok(init.signal);
  assert.notEqual(init.signal,networkAbort.signal,'20-second timeout must remain composed');
  sawRequestSignal=true;
  return new Promise((resolve,reject)=>{
   if(init.signal.aborted)return reject(init.signal.reason);
   init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true});
  });
 },
});
await Promise.resolve();
networkAbort.abort();
await assert.rejects(networkTask,/AbortError/);
assert.equal(sawRequestSignal,true,'In-flight network read receives the composed abort signal');

let resolveResponse;
const slowJson=new Promise(resolve=>{resolveResponse=resolve;});
const jsonAbort=new AbortController();
let beganJson=false;
const jsonTask=loadWorkCustomerConversationState({
 sessionToken,signal:jsonAbort.signal,
 request:async()=>({ok:true,json:async()=>{
  beganJson=true;
  return slowJson;
 }}),
});
await Promise.resolve();
await Promise.resolve();
assert.equal(beganJson,true);
jsonAbort.abort();
resolveResponse(v1);
await assert.rejects(jsonTask,/AbortError/,
 'A delayed response body must not be rendered after the screen is gone');

await assert.rejects(()=>loadWorkCustomerConversationState({
 sessionToken,signal:{aborted:false},
}),/Invalid account verification cancellation signal/);

const successful=new AbortController();
let validSignal=false;
const state=await loadWorkCustomerConversationState({
 sessionToken,signal:successful.signal,
 request:async(_,init)=>{
  validSignal=Boolean(init.signal&&!init.signal.aborted);
  return new Response(JSON.stringify(v1),{status:200});
 },
});
assert.deepEqual(state.orders,[]);
assert.equal(state.replyEnabled,false);
assert.equal(validSignal,true);
const array=await loadWorkCustomerCustomOrders({
 sessionToken,signal:successful.signal,
 request:async()=>new Response(JSON.stringify(v1),{status:200}),
});
assert.deepEqual(array,[],'Existing Custom Order array reader stays compatible');

const orders=readFileSync('extensions/jill-account-dashboard/src/pages/CustomOrders.jsx','utf8');
const messages=readFileSync('extensions/jill-account-dashboard/src/pages/Messages.jsx','utf8');
for(const source of [orders,messages]){
 assert.match(source,/const controller=new AbortController\(\)/);
 assert.match(source,/loadWorkCustomerConversationState\(\{sessionToken,signal:controller\.signal\}\)/);
 assert.match(source,/return \(\)=>\{active=false;controller\.abort\(\);\}/);
 assert.match(source,/if\(!active\)|if\(active\)/);
}
console.log('PASS My JILL cancellation: abort on account-screen exit/refetch, token acquisition and late JSON response; no stale customer data or new requests.');
