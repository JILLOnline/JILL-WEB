import assert from 'node:assert/strict';
import {loadWorkCustomerConversationState,WORK_CUSTOM_ORDER_ACCOUNT_URL}
 from '../shared/customer-custom-orders.mjs';

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
];
for(const [orders,reason] of bad){
 await assert.rejects(()=>read(orders),reason);
}
assert.deepEqual((await read([])).orders,[]);
console.log('PASS My JILL shared account read rejects duplicate, malformed or forged public threads before either customer screen renders.');
