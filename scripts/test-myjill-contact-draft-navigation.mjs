import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {retainOwnedContactDrafts,updateOwnedContactDraft}
 from '../shared/customer-contact-draft-ledger.mjs';
const ID='jill:contact:11111111-2222-4333-8444-555555555555';
const FOREIGN='jill:contact:22222222-2222-4333-8444-666666666666';
const OP='jill:customer:contact:reply:11111111-2222-4333-8444-555555555555';
const OTHER_OP='jill:customer:contact:reply:33333333-2222-4333-8444-555555555555';
const ticket=id=>({ticket_id:id,revision:1,status:'reviewing'});
const cmd={ticketId:ID,operationId:OP,expectedReplySequence:2,
 message:'Please make it purple.'};
const input=retainOwnedContactDrafts({},[ticket(ID),ticket(FOREIGN)]);
assert.deepEqual(Object.keys(input),[ID,FOREIGN]);
assert.equal(Object.isFrozen(input),true);
const typed=updateOwnedContactDraft(input,ID,{text:cmd.message,state:'idle'},
 {expectedOperationId:null});
assert.equal(typed[ID].text,cmd.message);
assert.equal(input[ID].text,'');
const started=updateOwnedContactDraft(typed,ID,{
 text:cmd.message,operation:cmd,state:'busy',busy:true,
},{expectedOperationId:null});
assert.equal(started[ID].operation.operationId,OP);
assert.equal(started[ID].state,'busy');
assert.equal(started[ID].busy,true);
assert.equal(updateOwnedContactDraft(started,ID,{
 text:'new text',state:'idle',
},{expectedOperationId:OP}),started,
 'Cannot edit a pending send');
assert.equal(updateOwnedContactDraft(started,ID,{
 operation:{...cmd,operationId:OTHER_OP},state:'busy',
},{expectedOperationId:OP}),started,
 'Cannot replace the operation on a pending send');
assert.equal(updateOwnedContactDraft(started,FOREIGN,{
 operation:cmd,state:'busy',text:cmd.message,busy:true,
},{expectedOperationId:null}),started,
 'Cannot apply Customer A ticket operation to Customer B ticket');
const resumed=retainOwnedContactDrafts(started,[ticket(ID),ticket(FOREIGN)]);
assert.equal(resumed[ID].state,'unconfirmed');
assert.equal(resumed[ID].busy,false);
assert.equal(resumed[ID].operation.operationId,OP);
assert.equal(resumed[ID].text,cmd.message);
const finish={text:'',operation:null,state:'confirmed',busy:false};
const expectedOperationId=OP;
const latest={state:'ready',ticket_id:ID,messages:[
 {author:'jill',source_sequence:1,text:'We received your request.'},
 {author:'customer',source_sequence:3,text:cmd.message},
]};
for(const invalid of [
 null,
 {...latest,state:'loading'},
 {...latest,ticket_id:FOREIGN},
 {...latest,messages:[]},
 {...latest,messages:[{author:'jill',source_sequence:3,text:cmd.message}]},
 {...latest,messages:[{author:'customer',source_sequence:3,text:'Changed'}]},
 {...latest,messages:[{author:'customer',source_sequence:4,text:cmd.message}]},
 {...latest,messages:latest.messages.concat(latest.messages[1])},
]){
 assert.equal(updateOwnedContactDraft(resumed,ID,finish,{
  expectedOperationId,verifiedThread:invalid,
 }),resumed,'No proof, no editor clearing');
}
const confirmed=updateOwnedContactDraft(resumed,ID,finish,{
 expectedOperationId,verifiedThread:latest,
});
assert.equal(confirmed[ID].state,'confirmed');
assert.equal(confirmed[ID].operation,null);
assert.equal(confirmed[ID].text,'');
assert.equal(confirmed[FOREIGN].state,'idle');
assert.equal(updateOwnedContactDraft(confirmed,ID,{
 state:'unconfirmed',busy:false,
},{expectedOperationId:OP}),confirmed,
 'Old finally cannot resurrect a cleared operation');
assert.equal(updateOwnedContactDraft(confirmed,ID,finish,{
 expectedOperationId:OP,verifiedThread:latest,
}),confirmed);
const dropped=retainOwnedContactDrafts(started,[ticket(FOREIGN)]);
assert.deepEqual(Object.keys(dropped),[FOREIGN]);
assert.equal(updateOwnedContactDraft(dropped,ID,{
 text:'late signed-out update',
},{expectedOperationId:OP}),dropped,
 'Old async callbacks cannot revive a foreign or removed ticket');
const failed=retainOwnedContactDrafts(started,[
 ticket(ID),ticket(ID),
]);
assert.equal(Object.keys(failed).length,0,'Malformed/duplicate signed lists fail closed');
assert.equal(Object.keys(retainOwnedContactDrafts(started,'invalid')).length,0);
assert.equal(Object.keys(retainOwnedContactDrafts(started,[])).length,0);
const source='extensions/jill-account-dashboard/src/';
const hub=readFileSync(source+'hub/AccountHub.jsx','utf8');
const contact=readFileSync(source+'pages/ContactRequests.jsx','utf8');
const v2=readFileSync(source+'pages/ContactConversationV2.jsx','utf8');
const thread=readFileSync(source+'pages/ContactThread.jsx','utf8');
const canary=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
assert.match(hub,/contactDrafts,setContactDrafts/);
assert.match(hub,/drafts=\{contactDrafts\} onDraftsChange=\{setContactDrafts\}/);
assert.match(contact,/retainOwnedContactDrafts\(previous,result\.tickets\)/);
assert.match(contact,/onDraftsChange\(\{\}\)/);
assert.match(contact,/updateOwnedContactDraft\(previous,ticket\.ticket_id,change,meta\)/);
assert.match(contact,/Object\.hasOwn\(drafts,ticket\.ticket_id\)/);
assert.match(contact,/Reply needs verification/);
assert.match(contact,/Unsent reply in this session/);
assert.match(thread,/draft=\{draft\} onDraftChange=\{onDraftChange\}/);
assert.match(v2,/const activePending=draft\.operation\?\.ticketId===ticketId/);
assert.match(v2,/onDraftChange\(\{text:'',operation:null,state:'confirmed',busy:false\}/);
assert.match(v2,/expectedOperationId:command\.operationId,verifiedThread:latest/);
assert.match(v2,/liveTicket\.current=null/);
assert.match(v2,/Retry same reply/);
assert.match(v2,/Check saved reply/);
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.ok(canary.includes("'customer-contact-draft-ledger.mjs'"));
for(const content of [hub,contact,v2,thread]){
 assert.doesNotMatch(content,/localStorage|sessionStorage|document\.cookie/);
}
console.log('PASS My JILL Contact V2 hub ledger: typed drafts survive navigation after signed re-verification, immutable receipt replay, exact fresh readback before clear, stale callback and foreign ticket denial, default OFF and no browser storage.');
