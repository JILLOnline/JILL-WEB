import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectOwnedMessageRequest,retainOwnedMessageDrafts,recoverOwnedMessageDraft}
 from '../shared/customer-message-selection.mjs';
const A='jill:11111111-2222-4333-8444-555555555555';
const B='jill:22222222-3333-4444-8555-666666666666';
const foreign='jill:33333333-4444-4555-8666-777777777777';
const inbox=[{submission_id:A},{submission_id:B}];
assert.equal(selectOwnedMessageRequest(inbox,{requestedId:B}),B);
assert.equal(selectOwnedMessageRequest(inbox,{requestedId:foreign}),A);
assert.equal(selectOwnedMessageRequest(inbox,{requestedId:foreign,previousId:B}),B);
assert.equal(selectOwnedMessageRequest(inbox,{requestedId:A,previousId:B}),A);
assert.equal(selectOwnedMessageRequest(inbox,{requestedId:'https://bad',previousId:foreign}),A);
assert.equal(selectOwnedMessageRequest([],{requestedId:A}),null);
assert.equal(selectOwnedMessageRequest(null,{requestedId:A}),null);
assert.equal(selectOwnedMessageRequest([inbox[0],inbox[0]]),null);
assert.equal(selectOwnedMessageRequest([{submission_id:'invalid'}]),null);
assert.equal(selectOwnedMessageRequest(Array(21).fill(inbox[0])),null);
const pending={state:'busy',busy:true,text:'Please use purple',
 operation:{operation_id:'jill:customer:reply:11111111-2222-4333-8444-555555555555',
  expected_revision:3,submission_id:A,text:'Please use purple'}};
const drafts={[A]:pending,[foreign]:{text:'PRIVATE OTHER ACCOUNT'}};
const same=retainOwnedMessageDrafts(drafts,inbox);
assert.equal(same[A].state,'unconfirmed','In-flight operation becomes receipt-check only on return');
assert.equal(same[A].busy,false,'Old busy flag must not deadlock the composer');
assert.equal(same[A].text,pending.text,'Customer text is retained across tabs');
assert.equal(same[A].operation.operation_id,pending.operation.operation_id);
assert.equal(same[foreign],undefined);
assert.equal(same[B].text,undefined);
assert.deepEqual(retainOwnedMessageDrafts(drafts,[inbox[1]]),{[B]:{}},
 'Customer change MUST remove previous account in-memory drafts');
assert.deepEqual(retainOwnedMessageDrafts(drafts,[]),{});
assert.deepEqual(retainOwnedMessageDrafts(drafts,[inbox[0],inbox[0]]),{});
assert.deepEqual(retainOwnedMessageDrafts(drafts,null),{});

const malformed={
 ...pending,operation:{...pending.operation,submission_id:foreign},
};
const wrong=retainOwnedMessageDrafts({[A]:malformed},inbox);
assert.equal(wrong[A].operation,null,'A foreign command must never be reused');
assert.equal(wrong[A].state,'idle','A foreign command cannot unlock Check delivery');
assert.equal(wrong[A].text,pending.text,'Keep original customer draft text');
const edited={...pending,text:'different message'};
assert.equal(retainOwnedMessageDrafts({[A]:edited},inbox)[A].operation,null,
 'Mismatched displayed text cannot reuse an old operation ID');
const crashed={...pending,operation:null};
assert.equal(retainOwnedMessageDrafts({[A]:crashed},inbox)[A].state,'idle',
 'A missing command cannot be treated as a pending receipt');
const unconfirmed={...pending,state:'unconfirmed',busy:false};
assert.equal(recoverOwnedMessageDraft(unconfirmed,A).operation,unconfirmed.operation,
 'Preserve original stable op ID when delivery was uncertain');
assert.equal(recoverOwnedMessageDraft({...pending,operation:{...pending.operation,
 operation_id:'fake-operation-id'}},A).operation,null,
 'Never accept a malformed receipt operation');
const missingReceipt={...pending,state:'missing',busy:false};
assert.equal(recoverOwnedMessageDraft(missingReceipt,A).state,'missing',
 'A genuinely missing receipt may retry the same operation only');

const hub=readFileSync('extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
const orders=readFileSync('extensions/jill-account-dashboard/src/pages/CustomOrders.jsx','utf8');
const messages=readFileSync('extensions/jill-account-dashboard/src/pages/Messages.jsx','utf8');
assert.match(hub,/setMessageRequestTarget\(id==='messages'/);
assert.match(hub,/messages: <Messages requestedSubmissionId=\{messageRequestTarget\}/);
assert.match(hub,/drafts=\{conversationDrafts\} onDraftsChange=\{setConversationDrafts\}/);
assert.match(orders,/loadWorkCustomerConversationState\(\{sessionToken,signal:controller\.signal\}\)/);
assert.match(orders,/replyEnabled=\{state\.replyEnabled\}/);
assert.match(orders,/onNavigate\('messages',\{submissionId:order\.submission_id\}\)/);
assert.match(orders,/retainOwnedMessageDrafts\(previous,orders\)/);
assert.match(orders,/onDraftsChange\(\{\}\)/);
assert.match(messages,/selectOwnedMessageRequest\(list/);
assert.match(messages,/projectCustomerMessageInbox\(orders\)/);
assert.match(messages,/retainOwnedMessageDrafts\(previous,orders\)/);
assert.match(messages,/onDraftsChange\(\{\}\);setSelected\(null\)/);
assert.match(messages,/Secure conversations are not yet available/i);
assert.match(messages,/Status history only/);
const composer=readFileSync('extensions/jill-account-dashboard/src/pages/RequestConversation.jsx','utf8');
assert.match(composer,/mode==='receipt'\?recoverable:enabled/);
assert.match(composer,/operation_id:'jill:customer:reply:'\+crypto.randomUUID\(\)/);
assert.match(composer,/\{\.\.\.command,mode\}/);
assert.doesNotMatch(hub+orders+messages,/localStorage|sessionStorage|document\.cookie|customer\.email|owner_gid/);
console.log('PASS My JILL: signed-owned request→Messages, single shared uncertain-operation draft ID across screens, auth refresh prunes foreign drafts, truthful legacy status only.');
