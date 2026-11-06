import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectOwnedMessageRequest,filterOwnedMessageThreads,MYJILL_MESSAGE_FILTERS}
 from '../shared/customer-message-selection.mjs';
import {projectCustomerMessageInbox}
 from '../shared/custom-order-message-inbox.mjs';

const A='jill:qa:owned-11111111',B='jill:qa:owned-22222222';
const event=(n)=>({status:'received',note:'Synthetic',
 occurred_at:'2026-10-24T12:00:00.000Z',revision:n,
 kind:'status',author:'system'});
const order=(id,status='received')=>({
 submission_id:id,status,revision:1,
 updated_at:'2026-10-24T12:00:00.000Z',timeline_version:2,
 timeline:[event(1)],
});
const list=projectCustomerMessageInbox([order(A),order(B)]);
assert.deepEqual(MYJILL_MESSAGE_FILTERS.map(x=>x.id),['all','active','finished']);
const mixed=projectCustomerMessageInbox([
 order(A,'received'),order(B,'completed'),
]);
assert.deepEqual(filterOwnedMessageThreads(mixed,'active').map(x=>x.submission_id),[A]);
// A notification/Recent Requests deep link must be able to open a finished
// owned thread even after the user previously viewed the Active folder.
assert.equal(selectOwnedMessageRequest(filterOwnedMessageThreads(mixed,'active'),
 {requestedId:B}),A,'An active-only filter intentionally excludes finished B');
assert.equal(selectOwnedMessageRequest(filterOwnedMessageThreads(mixed,'all'),
 {requestedId:B}),B,'Clearing the filter restores the verified deep link');

assert.deepEqual(filterOwnedMessageThreads(mixed,'finished').map(x=>x.submission_id),[B]);
assert.equal(filterOwnedMessageThreads(mixed,'all').length,2);
assert.equal(filterOwnedMessageThreads(mixed,'weird').length,0);
assert.equal(filterOwnedMessageThreads(mixed,'finished').length,1);
assert.equal(Object.isFrozen(filterOwnedMessageThreads(mixed,'active')),true);
assert.deepEqual(filterOwnedMessageThreads([
 {...mixed[0],status:'paid'},mixed[1],
],'all'),[],'Do not invent paid/unread/unknown status classification');
assert.deepEqual(filterOwnedMessageThreads([
 {...mixed[0],submission_id:'__proto__'},
],'all'),[],'Malformed/foreign IDs are never exposed');
assert.equal(selectOwnedMessageRequest(filterOwnedMessageThreads(mixed,'active'),
 {requestedId:B,previousId:A}),A,'Foreign-to-filter selection cannot leak another thread');

assert.equal(selectOwnedMessageRequest(list,{requestedId:B}),B);
assert.equal(selectOwnedMessageRequest(list,{
 requestedId:'gid://shopify/Customer/456',previousId:A,
}),A,'Arbitrary selection must not change a verified conversation');
assert.equal(selectOwnedMessageRequest(list,{
 requestedId:'__proto__',previousId:'not-owned',
}),A,'Invalid hint falls back to first owned request');
assert.equal(selectOwnedMessageRequest([],{requestedId:A}),null);
const root='extensions/jill-account-dashboard/src/';
const page=readFileSync(root+'pages/Messages.jsx','utf8');
const hub=readFileSync(root+'hub/AccountHub.jsx','utf8');
const orders=readFileSync(root+'pages/CustomOrders.jsx','utf8');
assert.match(page,/gridTemplateColumns="minmax\(0, 1fr\)"/);
assert.doesNotMatch(page,/gridTemplateColumns="minmax\(0, 1fr\) minmax\(0, 1\.6fr\)"/);
assert.match(page,/<s-select label="Choose a verified conversation"/);
assert.match(page,/selectOwnedMessageRequest\(visibleInbox,\{/);
assert.match(page,/filterOwnedMessageThreads\(inbox,filter\)/);
assert.match(page,/<s-select label="Show conversations"/);
assert.match(page,/if\(requestedSubmissionId!==null\)setFilter\('all'\)/);
assert.match(page,/\[attempt,requestedSubmissionId\]/);
assert.match(page,/MYJILL_MESSAGE_FILTERS\.map/);
assert.match(page,/No verified conversations match this filter/);
assert.match(page,/previousId:selected/);
assert.match(page,/<s-option key=\{item\.submission_id\}/);
assert.match(page,/Status history only/);
assert.match(page,/Track this request/);
assert.match(page,/submissionId:order\.submission_id/);
assert.match(page,/projectCustomerMessageInbox\(orders\)/);
assert.match(page,/retainOwnedMessageDrafts\(previous,orders\)/);
assert.match(page,/onDraftsChange\(\{\}\);setSelected\(null\)/);
assert.match(page,/RequestConversation order=\{order\}/);
assert.match(page,/updateOwnedMessageDraft\(previous,order\.submission_id,change,meta\)/);
assert.match(hub,/requestedSubmissionId=\{customOrderTarget\}/);
assert.match(orders,/orders\.some\(order=>order\.submission_id===requestedSubmissionId\)/);
assert.doesNotMatch(page,/localStorage|sessionStorage|document\.cookie|metafieldsSet/);
console.log('PASS My JILL mobile Messages: active/finished signed filters, foreign hint refusal, exact owned tracking, original receipt-safe composer and no new source writes.');
