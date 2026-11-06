import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WORK_CONTACT_THREAD_URL,loadOwnedContactThread,
 projectOwnedContactThread} from '../shared/customer-contact-thread.mjs';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const token='signed-customer-session-'.repeat(4);
const base={version:1,operation:'jill.contact.account.thread.result',ok:true,
 shop:'jill-work.myshopify.com',thread:{
  ticket_id:id,status:'waiting_customer',revision:3,
  reply_enabled:false,read_receipt_available:false,
  messages:[{sequence:1,author:'jill',message:'Your request is being reviewed.',
   created_at:'2026-10-23T17:00:00.000Z',
   actor_staff_id:'PRIVATE',operation_id:'PRIVATE'}],
 }};
const safe=projectOwnedContactThread(base,id);
assert.equal(safe.messages[0].text,'Your request is being reviewed.');
assert.equal(safe.messages[0].actor_staff_id,undefined);
assert.equal(safe.reply_enabled,false);
assert.equal(safe.read_receipt_available,false);
let gets=0,requests=0;
const sessionToken={get:async()=>{gets++;return token;}};
const request=async(url,opts)=>{
 requests++;
 assert.equal(url,WORK_CONTACT_THREAD_URL);
 assert.equal(opts.headers.Authorization,'Bearer '+token);
 assert.deepEqual(JSON.parse(opts.body),{ticket_id:id});
 return Response.json(base);
};
const off=await loadOwnedContactThread({
 sessionToken,request,ticketId:id,
});
assert.equal(off.state,'not_connected');
assert.equal(gets,0);assert.equal(requests,0);
const loaded=await loadOwnedContactThread({
 enabled:true,sessionToken,request,ticketId:id,
});
assert.equal(loaded.state,'ready');
assert.equal(loaded.messages.length,1);
assert.equal(gets,1);assert.equal(requests,1);
for(const altered of [
 {...base,thread:{...base.thread,ticket_id:'jill:contact:22222222-2222-4333-8444-555555555555'}},
 {...base,thread:{...base.thread,reply_enabled:true}},
 {...base,thread:{...base.thread,read_receipt_available:true}},
 {...base,thread:{...base.thread,messages:[{...base.thread.messages[0],author:'customer'}]}},
 {...base,thread:{...base.thread,messages:[{...base.thread.messages[0],sequence:3}]}},
 {...base,thread:{...base.thread,messages:[{...base.thread.messages[0],message:'x'.repeat(1001)}]}},
]){
 assert.throws(()=>projectOwnedContactThread(altered,id),/contact_thread_unverified/);
}
const abort=new AbortController();abort.abort();
await assert.rejects(()=>loadOwnedContactThread({
 enabled:true,sessionToken,request,ticketId:id,signal:abort.signal,
}),/AbortError/);
assert.equal(gets,1);
const page=readFileSync('extensions/jill-account-dashboard/src/pages/ContactRequests.jsx','utf8');
const thread=readFileSync('extensions/jill-account-dashboard/src/pages/ContactThread.jsx','utf8');
const hub=readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const canary=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
assert.match(page,/import ContactThread from '\.\/ContactThread\.jsx'/);
assert.match(page,/enabled=\{enabled===true&&threadEnabled===true\}/);
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.match(thread,/No verified messages recorded yet/);
assert.match(thread,/No other customer's/);
assert.match(thread,/controller\.abort\(\)/);
assert.match(canary,/'ContactThread\.jsx'/);
assert.match(canary,/'customer-contact-thread\.mjs'/);
assert.doesNotMatch(page+thread,/localStorage|sessionStorage|document\.cookie|draftOrderCreate|shopify\.order/);
console.log('PASS My JILL Contact conversation: hard OFF, signed exact ticket, bounded history, forged receipt refusal, no customer reply/read/delivery claims.');
