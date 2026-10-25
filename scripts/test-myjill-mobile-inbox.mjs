import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectOwnedMessageRequest}
 from '../shared/customer-message-selection.mjs';
import {projectCustomerMessageInbox}
 from '../shared/custom-order-message-inbox.mjs';

const A='jill:qa:owned-11111111',B='jill:qa:owned-22222222';
const event=(n)=>({status:'received',note:'Synthetic',
 occurred_at:'2026-10-24T12:00:00.000Z',revision:n,
 kind:'status',author:'system'});
const order=(id)=>({
 submission_id:id,status:'received',revision:1,
 updated_at:'2026-10-24T12:00:00.000Z',timeline_version:2,
 timeline:[event(1)],
});
const list=projectCustomerMessageInbox([order(A),order(B)]);
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
assert.match(page,/selectOwnedMessageRequest\(inbox,\{/);
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
console.log('PASS My JILL mobile Messages: single-column signed selector, foreign hint refusal, exact owned tracking, original receipt-safe composer and no new source writes.');
