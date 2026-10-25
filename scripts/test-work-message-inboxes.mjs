// WORK-only HQ + My JILL inbox contract: one existing canonical public thread.
// Synthetic records, no Google/Shopify/D1/network/Cloudflare operations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectCustomerMessageInbox,summarizeMerchantPublicThread}
  from '../shared/custom-order-message-inbox.mjs';
import {onlyPublicCustomOrderProjection}
  from '../backend/custom-order-account-read.mjs';
const id='jill:11111111-2222-4333-8444-555555555555';
const second='jill:22222222-3333-4444-8555-666666666666';
const status='received',at='2026-10-20T12:00:00.000Z';
const publicV2={timeline_version:2,submission_id:id,revision:4,status,
 updated_at:'2026-10-20T14:00:00.000Z',summary:{items:[{title:'Synthetic Tote',quantity:1}],
 date_needed:'2026-11-03',fulfillment:'pickup'},timeline:[
 {revision:1,kind:'status',author:'system',status,note:'Request received',occurred_at:at},
 {revision:2,kind:'merchant_message',author:'jill',status,note:'Hi! Which color?',occurred_at:'2026-10-20T13:00:00.000Z'},
 {revision:4,kind:'customer_reply',author:'customer',status,note:'Purple, please',occurred_at:'2026-10-20T14:00:00.000Z'},
 ]};
const safe=onlyPublicCustomOrderProjection([{
 ...publicV2,internal_note:'PRIVATE INTERNAL COST',
 customer_email:'not-for-public@example.invalid',
}])[0];
const mine=projectCustomerMessageInbox([safe]);
assert.equal(mine.length,1);
assert.equal(mine[0].submission_id,id);
assert.equal(mine[0].last_message.author,'customer');
assert.equal(mine[0].last_message.note,'Purple, please');
assert.equal(mine[0].unread_count,null);
assert.equal(mine[0].read_receipt_verified,false);
assert.equal(mine[0].delivery_verified,false);
assert.equal(JSON.stringify(mine).includes('PRIVATE INTERNAL COST'),false);
assert.equal(JSON.stringify(mine).includes('not-for-public@'),false);
assert.deepEqual(summarizeMerchantPublicThread(safe,id),mine[0],
  'Both inboxes project the SAME canonical public v2 event, no duplicate store');
assert.throws(()=>summarizeMerchantPublicThread(safe,second),
  /unverified_message_thread/);
const noMsg={...safe,submission_id:second,revision:1,updated_at:at,
  timeline:[{revision:1,kind:'status',author:'system',
    status,note:'Request received',occurred_at:at}]};
const two=projectCustomerMessageInbox([noMsg,safe]);
assert.deepEqual(two.map(x=>x.submission_id),[id,second],
  'Sort by verified public message/activity, not fabricated unread counts');
assert.equal(two[1].last_message,null);
assert.throws(()=>projectCustomerMessageInbox([safe,safe]),/duplicate_request/);
assert.throws(()=>projectCustomerMessageInbox(Array.from({length:21},()=>safe)),
  /unverified_message_inbox/);
assert.throws(()=>projectCustomerMessageInbox([{...safe,
  timeline:[{...safe.timeline[0],note:'X'.repeat(501)}]}]),
  /unverified_message_thread/);
assert.throws(()=>projectCustomerMessageInbox([{...safe,
  timeline:[{...safe.timeline[0],revision:0}]}]),
  /unverified_message_thread/);
assert.throws(()=>projectCustomerMessageInbox([{...safe,
  timeline:safe.timeline.map(event=>
    event.kind==='merchant_message'?{...event,author:'system'}:event)}]),
  /unverified_message_thread/);
assert.throws(()=>projectCustomerMessageInbox([{...safe,
  timeline:safe.timeline.map(event=>
    event.kind==='customer_reply'?{...event,author:'jill'}:event)}]),
  /unverified_message_thread/);
const legacy={submission_id:second,revision:1,status,updated_at:at,
  summary:{items:[],date_needed:'',fulfillment:''},
  timeline:[{status,note:'Request received',occurred_at:at}]};
const old=projectCustomerMessageInbox(
  onlyPublicCustomOrderProjection([legacy]));
assert.equal(old[0].timeline_version,1);
assert.equal(old[0].last_message,null);
assert.equal(old[0].unread_count,null);
const root='services/jill-order-desk/app-home/app/';
const nav=readFileSync(root+'routes/app.tsx','utf8');
const routes=readFileSync(root+'routes.ts','utf8');
const hq=readFileSync(root+'routes/app.messages.tsx','utf8');
const hqCss=readFileSync(root+'styles/hq-messages.css','utf8');
const thread=readFileSync(root+'routes/app.requests.thread.tsx','utf8');
const hub=readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const registry=readFileSync('extensions/jill-account-dashboard/src/hub/routes.mjs','utf8');
const customer=readFileSync('extensions/jill-account-dashboard/src/pages/Messages.jsx','utf8');
const shortcut=readFileSync('extensions/jill-account-dashboard/src/pages/Overview.jsx','utf8');
const reply=readFileSync('extensions/jill-account-dashboard/src/pages/RequestConversation.jsx','utf8');
assert.match(routes,/route\("messages","routes\/app\.messages\.tsx"\)/);
assert.match(nav,/<NavLink to="\/app\/messages">Messages<\/NavLink>/);
assert.match(hq,/loadVerifiedMerchantInbox\(args\)/);
assert.match(hq,/const \[query,setQuery\]=useState\(""/);
assert.match(hq,/const \[status,setStatus\]=useState\("all"/);
assert.match(hq,/item\.submission_id\.toLocaleLowerCase\(\)\.includes\(q\)/);
assert.match(hq,/filtered\.length\} of \{records\.length\} verified request threads/);
assert.match(hq,/Refresh conversation/);
assert.match(hq,/threadRead\.load\("\/app\/requests\/thread\?"/);
assert.match(hq,/JILL_WORK_CONVERSATION_ENABLED==="true"/);
assert.match(hq,/summarizeMerchantPublicThread/);
assert.match(hq,/WorkRequestQuickActions/);
assert.match(hq,/\/app\/requests\/thread\?/);
assert.match(hq,/threadRead\.data\.thread\?\.submission_id===record\.submission_id/);
assert.match(thread,/handleWorkRequestThread/);
assert.match(thread,/enabled:env\.JILL_WORK_CONVERSATION_ENABLED==="true"/);
assert.match(hub,/messages: <Messages requestedSubmissionId=\{messageRequestTarget\}/);
assert.match(registry,/id:'messages',label:'Messages',path:'messages'/);
assert.match(shortcut,/onNavigate\('messages'\)/);
assert.match(customer,/loadWorkCustomerConversationState\(\{sessionToken,signal:controller\.signal\}\)/);
assert.match(customer,/replyEnabled=\{state\.replyEnabled\}/);
assert.match(customer,/projectCustomerMessageInbox\(orders\)/);
assert.match(customer,/onDraftsChange\(\{\}\);setSelected\(null\)/);
assert.match(customer,/retainOwnedMessageDrafts\(previous,orders\)/);
assert.match(hub,/const \[conversationDrafts,setConversationDrafts\]=useState\(\{\}\)/);
assert.match(customer,/RequestConversation order=\{order\}/);
assert.match(customer,/Unread counts are not available/);
assert.match(reply,/sendWorkCustomerReply/);
assert.match(hqCss,/@media\(max-width:760px\)/);
assert.match(hqCss,/\.jill-messages__filters/);
assert.match(hqCss,/\.jill-messages__conversation-tools/);
assert.doesNotMatch(hqCss,/height:\s*100vh|overflow-y:\s*(auto|scroll)|!important|@import|url\(/);
for(const code of [hq,customer,hub]){
  assert.doesNotMatch(code,/localStorage|sessionStorage|shopify\.customer\.id|customer\.email|owner_gid|document\.cookie|new WebSocket/);
  assert.doesNotMatch(code,/draftOrderCreate|draftOrderInvoiceSend|fetch\(/);
}
console.log('PASS WORK dual inbox: public verified thread, HQ search/status/refetch, rejection of forged actor, Owner and My JILL isolation, no fake unread/delivery, legacy/receipt recovery, no deployment.');
