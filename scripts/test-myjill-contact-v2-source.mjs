// My JILL Contact V2 customer UI: source-only, OFF unless all separately
// certified WORK Contact/Customer Account gates are authorized.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 WORK_CONTACT_CONVERSATION_V2_URL,WORK_CONTACT_REPLY_URL,
 projectOwnedContactConversationV2,loadOwnedContactConversationV2,
 postOwnedContactReply,
} from '../shared/customer-contact-conversation-v2.mjs';
const ID='jill:contact:11111111-2222-4333-8444-555555555555';
const OTHER='jill:contact:22222222-2222-4333-8444-666666666666';
const OP='jill:customer:contact:reply:11111111-2222-4333-8444-555555555555';
const TOKEN='signed-customer-session-token-'.repeat(4);
const base={
 version:2,operation:'jill.contact.account.conversation.result',
 ok:true,shop:'jill-work.myshopify.com',thread:{
  ticket_id:ID,status:'reviewing',revision:2,reply_enabled:true,
  read_receipt_available:false,delivery_verified:false,unread_count:null,
  messages:[
   {sequence:1,source_sequence:1,author:'jill',message:'Welcome!',
    created_at:'2026-10-24T12:00:00.000Z',staff_id:'PRIVATE_STAFF'},
   {sequence:2,source_sequence:1,author:'customer',message:'Purple please.',
    created_at:'2026-10-24T12:01:00.000Z',operation_id:'PRIVATE_OPERATION'},
  ],
 },
};
const p=projectOwnedContactConversationV2(base,ID);
assert.equal(p.messages.length,2);
assert.equal(p.messages[1].text,'Purple please.');
assert.equal(p.next_customer_reply_sequence,1);
assert.equal(p.reply_enabled,true);
assert.equal(p.delivery_verified,false);
assert.equal(p.unread_count,null);
assert.equal(Object.isFrozen(p.messages),true);
assert.equal(JSON.stringify(p).includes('PRIVATE_'),false);
let tokens=0,requests=0;
const sessionToken={get:async()=>{tokens++;return TOKEN;}};
const readRequest=async(url,opts)=>{
 requests++;
 assert.equal(url,WORK_CONTACT_CONVERSATION_V2_URL);
 assert.equal(opts.headers.Authorization,'Bearer '+TOKEN);
 assert.deepEqual(JSON.parse(opts.body),{ticket_id:ID});
 return Response.json(base);
};
const off=await loadOwnedContactConversationV2({
 sessionToken,request:readRequest,ticketId:ID,
});
assert.equal(off.state,'not_connected');
assert.equal(tokens,0);assert.equal(requests,0);
const loaded=await loadOwnedContactConversationV2({
 enabled:true,sessionToken,request:readRequest,ticketId:ID,
});
assert.equal(loaded.state,'ready');
assert.equal(loaded.messages.length,2);
assert.equal(tokens,1);assert.equal(requests,1);
for(const wrong of [
 {...base,thread:{...base.thread,ticket_id:OTHER}},
 {...base,thread:{...base.thread,delivery_verified:true}},
 {...base,thread:{...base.thread,read_receipt_available:true}},
 {...base,thread:{...base.thread,unread_count:1}},
 {...base,thread:{...base.thread,messages:[{
  ...base.thread.messages[0],sequence:2,
 }]}},
 {...base,thread:{...base.thread,messages:[{
  ...base.thread.messages[0],author:'other',
 }]}},
 {...base,thread:{...base.thread,messages:base.thread.messages.map(m=>({
  ...m,...(m.author==='customer'?{source_sequence:3}:{}),
 }))}},
]){
 assert.throws(()=>projectOwnedContactConversationV2(wrong,ID),
  /contact_conversation_v2_unverified/);
}
const command={
 ticketId:ID,operationId:OP,expectedReplySequence:1,
 message:'Please add the name.',
};
const response={
 version:1,operation:'jill.contact.customer.reply.result',
 ok:true,code:'reply_saved',ticket_id:ID,
 operation_id:OP,sequence:2,
};
const replyRequest=async(url,opts)=>{
 requests++;
 assert.equal(url,WORK_CONTACT_REPLY_URL);
 assert.equal(opts.headers.Authorization,'Bearer '+TOKEN);
 assert.deepEqual(JSON.parse(opts.body),{
  ticket_id:ID,operation_id:OP,
  expected_reply_sequence:1,message:'Please add the name.',
 });
 return Response.json(response);
};
const result=await postOwnedContactReply({
 enabled:true,sessionToken,request:replyRequest,...command,
});
assert.equal(result.state,'persisted_unconfirmed_readback');
assert.equal(result.delivered,false);
assert.equal(result.read,false);
assert.equal(result.sequence,2);
const before={tokens,requests};
assert.equal((await postOwnedContactReply({
 sessionToken,request:replyRequest,...command,
})).state,'not_connected');
assert.deepEqual({tokens,requests},before);
await assert.rejects(()=>postOwnedContactReply({
 enabled:true,sessionToken,request:async()=>Response.json({
  ...response,sequence:99,
 }),...command,
}),/contact_conversation_v2_unverified/);
const root='extensions/jill-account-dashboard/src/';
const page=readFileSync(root+'pages/ContactConversationV2.jsx','utf8');
const thread=readFileSync(root+'pages/ContactThread.jsx','utf8');
const requestsPage=readFileSync(root+'pages/ContactRequests.jsx','utf8');
const hub=readFileSync(root+'hub/AccountHub.jsx','utf8');
const canary=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
for(const token of [
 'loadOwnedContactConversationV2','postOwnedContactReply',
 'expectedReplySequence','verifiedThread:latest',
 'onDraftChange({text:\'\',operation:null,state:\'confirmed\',busy:false}',
 'Retry same reply','Check saved reply','This is not an email or read receipt',
]){
 assert.ok(page.includes(token),'Missing protected Contact UI feature '+token);
}
// The pure ticket-scoped hub ledger verifies the exact public receipt;
// the component never clears its own pending command optimistically.
assert.doesNotMatch(page,/setPending\(null\)|setText\('\'\)/);
assert.match(page,/onDraftChange\(\{text:'',operation:null,state:'confirmed',busy:false\}/);
assert.match(thread,/v2Enabled=false/);
assert.match(thread,/if\(v2Enabled===true\)return <ContactConversationV2/);
assert.match(requestsPage,/v2Enabled=\{enabled===true&&threadEnabled===true&&replyEnabled===true&&/);
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.ok(canary.includes("'ContactConversationV2.jsx'"));
assert.ok(canary.includes("'customer-contact-conversation-v2.mjs'"));
assert.doesNotMatch(page+thread+requestsPage+hub,
 /localStorage|sessionStorage|document\.cookie|draftOrderCreate|metafieldsSet/);
console.log('PASS My JILL Contact V2: OFF means zero JWT/network, signed A-only public timeline, immutable operation and readback-before-clear, no fake delivery, V1 untouched and extension unpublished.');
