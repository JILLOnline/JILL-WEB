import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {verifyWorkContactMessageReadback}
 from '../services/jill-order-desk/work-contact-message-readback-policy.mjs';

const ticketId='jill:contact:11111111-2222-4333-8444-555555555555';
const other='jill:contact:22222222-2222-4333-8444-555555555555';
const command={
 operation_id:'jill:work:contact:msg:11111111-2222-4333-8444-555555555555',
 message:'Your custom request is under review.',
};
const ack={ok:true,kind:'contact',code:'persisted_for_customer_account',
 ticket_id:ticketId,operation_id:command.operation_id,sequence:2};
const message={sequence:2,author:'jill',message:command.message,
 created_at:'2026-10-24T14:00:00.000Z'};
const refreshedThread={ticket_id:ticketId,messages:[{
 sequence:1,author:'jill',message:'We received your request.',
 created_at:'2026-10-24T13:00:00.000Z'},message]};
const verdict=(more={})=>verifyWorkContactMessageReadback({
 ticketId,command,ack,refreshedThread,...more,
});
const passed=verdict();
assert.equal(passed.state,'verified_public_thread_readback');
assert.equal(passed.clear_editor,true);
assert.equal(passed.message_saved_for_account_verified,true);
assert.equal(passed.customer_read,false);
assert.equal(passed.customer_delivered,false);
assert.equal(passed.sequence,2);
assert.equal(verdict({ack:{...ack,code:'already_persisted'}}).clear_editor,true,
 'Idempotent server acknowledgment still needs the same independent readback');
const altered=[
 {ack:{...ack,ok:false}},
 {ack:{...ack,kind:'other'}},
 {ack:{...ack,sequence:0}},
 {ack:{...ack,sequence:3}},
 {ack:{...ack,code:'unconfirmed'}},
 {ack:{...ack,ticket_id:other}},
 {ack:{...ack,operation_id:'jill:work:contact:msg:99999999-2222-4333-8444-555555555555'}},
 {ticketId:other},
 {command:{...command,operation_id:'forged'}},
 {command:{...command,message:'Unexpected old message'}},
 {refreshedThread:{ticket_id:other,messages:[message]}},
 {refreshedThread:{ticket_id:ticketId,messages:[]}},
 {refreshedThread:{ticket_id:ticketId,messages:[
  {...message,author:'customer'}]}},
 {refreshedThread:{ticket_id:ticketId,messages:[
  {...message,message:'Altered content'}]}},
 {refreshedThread:{ticket_id:ticketId,messages:[
  {...message,created_at:'garbled'}]}},
 {refreshedThread:{ticket_id:ticketId,messages:[message,message]}},
 {refreshedThread:null},
];
for(const change of altered){
 const result=verdict(change);
 assert.equal(result.state,'held',JSON.stringify(change));
 assert.equal(result.clear_editor,false);
 assert.equal(result.customer_read,false);
 assert.equal(result.customer_delivered,false);
}
const page=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.contacts.$ticketId.tsx','utf8');
for(const required of [
 'verifyWorkContactMessageReadback',
 'useRevalidator',
 'pendingReceipt',
 'readbackWasLoading',
 'revalidator.revalidate()',
 'verdict.state!=="verified_public_thread_readback"',
 'messageOp.current=null;',
 'Message save acknowledged.',
 'Verify saved message',
 'No email, push notification',
]){
 assert.ok(page.includes(required),'Owner page source missing '+required);
}
assert.ok(page.indexOf('verdict.state!=="verified_public_thread_readback"')<
 page.indexOf('messageOp.current=null;'),
 'Verified independent readback must come before clearing the original command');
assert.equal((page.match(/messageOp\.current=null;/g)||[]).length,1,
 'Do not clear unconfirmed pending reply elsewhere');
assert.equal((page.match(/setMessageDraft\(" \?"\);/g)||[]).length,0);
assert.ok(page.includes('setMessageDraft("");'),
 'Clear the original editor only after verified readback');
assert.ok(!page.includes('Message saved for the verified customer account.\n          This is not an email'),
 'Old optimistic save-success label should be replaced');
console.log('PASS: HQ Contact editor clears only after verified same-ticket sequence/text readback; stale, wrong-account, forged, author mismatch or receipt mismatch stays held; no customer delivery/read claim.');
