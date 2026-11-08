import assert from 'node:assert/strict';
import {loadWorkCustomerConversationState,WORK_CUSTOM_ORDER_ACCOUNT_URL,
 WorkCustomerAccountReadError}
 from '../shared/customer-custom-orders.mjs';
import {customOrderReadRecovery}
 from '../extensions/jill-account-dashboard/src/pages/custom-order-presentation.mjs';

const id='jill:11111111-2222-4333-8444-555555555555';
const now='2026-10-22T16:00:00.000Z';
const order={submission_id:id,status:'reviewing',revision:2,timeline_version:2,
 summary:{items:[{title:'Custom Piñata',quantity:1}],date_needed:'',fulfillment:'pickup'},
 updated_at:now,timeline:[
  {revision:1,kind:'status',author:'system',status:'received',
   note:'Request received',occurred_at:'2026-10-22T15:00:00.000Z'},
  {revision:2,kind:'merchant_message',author:'jill',status:'reviewing',
   note:'We are reviewing the request.',occurred_at:now},
 ]};
const token='s'.repeat(55);
const sessionToken={get:async()=>token};
const read=async orders=>loadWorkCustomerConversationState({
 sessionToken,request:async(endpoint,opts)=>{
  assert.equal(endpoint,WORK_CUSTOM_ORDER_ACCOUNT_URL);
  assert.equal(opts.headers.Authorization,'Bearer '+token);
  return new Response(JSON.stringify({version:1,
   operation:'custom_order.account.list.result',ok:true,
   orders,reply_enabled:false}),{status:200});
 }
});
const verified=await read([order]);
assert.equal(verified.orders.length,1);
assert.equal(verified.orders[0].submission_id,id);
assert.equal(verified.replyEnabled,false);
const legacy={...order,timeline_version:undefined,
 timeline:order.timeline.map(({status,note,occurred_at})=>({status,note,occurred_at}))};
assert.equal((await read([legacy])).orders.length,1);
const bad=[
 [[order,order],/duplicate_request/],
 [[{...order,submission_id:'bad'}],/unverified_message_thread/],
 [[{...order,updated_at:'invalid'}],/unverified_message_thread/],
 [[{...order,timeline:order.timeline.map((ev,i)=>i===1?{...ev,author:'customer'}:ev)}],
   /unverified_message_thread/],
 [[{...order,timeline:order.timeline.map((ev,i)=>i===1?{...ev,revision:1}:ev)}],
   /unverified_message_thread/],
 [[{...order,timeline:order.timeline.map((ev,i)=>i===1?{...ev,note:'x'.repeat(501)}:ev)}],
   /Invalid Custom Order history/],
 [[{...order,timeline:order.timeline.map((ev,i)=>i===1?{...ev,note:{private:'not text'}}:ev)}],
   /Invalid Custom Order history/],
];
for(const [orders,reason] of bad){
 await assert.rejects(()=>read(orders),reason);
}
assert.deepEqual((await read([])).orders,[]);
// Failures remain failures, with bounded recovery guidance and one fresh
// token per explicit attempt. Never trust or retain server error text.
let tokenReads=0,requests=0;
for(const [status,code,copy] of [
 [429,'rate_limited',/Wait a minute/],
 [401,'unauthenticated_account',/Sign out and sign back in/],
 [503,'service_unavailable',/temporarily unavailable/],
 [403,'read_rejected',/^$/],
]){
 await assert.rejects(()=>loadWorkCustomerConversationState({
  sessionToken:{get:async()=>{tokenReads++;return token;}},
  request:async()=>{requests++;return {ok:false,status,
   json:()=>{throw Error('Failure body must not be read or displayed.');}};},
 }),error=>{
  assert.ok(error instanceof WorkCustomerAccountReadError);
  assert.equal(error.code,code);
  assert.match(customOrderReadRecovery(error),copy);
  assert.ok(!JSON.stringify(error).includes(token));
  return true;
 });
}
assert.equal(tokenReads,4);
assert.equal(requests,4,'No automatic retry consumes more quota.');
assert.equal(customOrderReadRecovery({code:'rate_limited'}),'',
 'Unknown thrown values cannot manufacture a classified failure.');
assert.equal(customOrderReadRecovery(new Error('private diagnostic')),'');
console.log('PASS My JILL shared account read rejects duplicate, malformed or forged public threads before either customer screen renders.');
