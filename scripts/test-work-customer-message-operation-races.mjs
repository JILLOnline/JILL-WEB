import assert from 'node:assert/strict';
import {updateOwnedMessageDraft,retainOwnedMessageDrafts}
 from '../shared/customer-message-selection.mjs';
import {readFileSync} from 'node:fs';

const id='jill:11111111-2222-4333-8444-555555555555';
const foreign='jill:22222222-3333-4444-8555-666666666666';
const op1={submission_id:id,operation_id:'jill:customer:reply:11111111-2222-4333-8444-555555555555',
 expected_revision:3,text:'Please use purple'};
const op2={...op1,operation_id:'jill:customer:reply:33333333-2222-4333-8444-555555555555',
 expected_revision:4};
const initial={[id]:{text:op1.text,state:'idle',operation:null,busy:false}};
const start=updateOwnedMessageDraft(initial,id,{operation:op1,busy:true,state:'busy'},
 {expectedOperationId:null});
assert.equal(start[id].operation,op1);
assert.equal(start[id].busy,true);
assert.notEqual(start,initial);
assert.equal(initial[id].operation,null,'Do not mutate React/Preact state');
const sameStart=updateOwnedMessageDraft(start,id,
 {operation:op2,state:'busy',busy:true},{expectedOperationId:null});
assert.equal(sameStart,start,'Second simultaneous send cannot replace the first operation');
const resumed=retainOwnedMessageDrafts(start,[{submission_id:id}]);
assert.equal(resumed[id].busy,false);
assert.equal(resumed[id].state,'unconfirmed');
assert.equal(resumed[id].operation.operation_id,op1.operation_id);
const confirmed=updateOwnedMessageDraft(resumed,id,
 {operation:null,text:'',state:'sent',busy:false,staleRevision:null},
 {expectedOperationId:op1.operation_id});
assert.equal(confirmed[id].state,'sent');
assert.equal(confirmed[id].operation,null);
assert.equal(confirmed[id].text,'');
const oldFinally=updateOwnedMessageDraft(confirmed,id,{busy:false,state:'unconfirmed'},
 {expectedOperationId:op1.operation_id});
assert.equal(oldFinally,confirmed,'Late finally/catch cannot replace acknowledged state');
const loggedOut=updateOwnedMessageDraft({},id,{operation:null,state:'sent'},
 {expectedOperationId:op1.operation_id});
assert.deepEqual(loggedOut,{},'Old callback after logout cannot recreate a request');
assert.equal(updateOwnedMessageDraft(initial,foreign,{text:'foreign'},
 {expectedOperationId:null}),initial,'Foreign request cannot be inserted');
assert.equal(updateOwnedMessageDraft(initial,id,{text:'changed'},{}),initial,
 'Unguarded callback is rejected');
assert.equal(updateOwnedMessageDraft(start,id,{operation:{...op2,submission_id:foreign}},
 {expectedOperationId:op1.operation_id}),start,
 'A different request command cannot replace a pending operation');
assert.equal(updateOwnedMessageDraft(initial,id,{
 operation:{...op1,text:'different from draft'},busy:true,state:'busy'
},{expectedOperationId:null}),initial,'Command must match draft text');
assert.equal(updateOwnedMessageDraft(initial,id,{text:'x'.repeat(501)},
 {expectedOperationId:null}),initial,'Reject oversized messages');
assert.equal(updateOwnedMessageDraft(initial,id,{status:'delivered'},
 {expectedOperationId:null}),initial,'Only the draft fields may be edited');
assert.equal(updateOwnedMessageDraft(initial,id,{state:'impossible'},
 {expectedOperationId:null}),initial,'No forged draft state');
const staleOp=updateOwnedMessageDraft(start,id,{
 state:'unconfirmed',busy:false},{expectedOperationId:op2.operation_id});
assert.equal(staleOp,start,'Old or foreign operation receipt cannot affect this draft');
// A later valid operation is never cleared by a stale response from the first.
const newer={[id]:{text:op2.text,state:'busy',busy:true,operation:op2}};
const late=updateOwnedMessageDraft(newer,id,{
 operation:null,text:'',state:'sent',busy:false
},{expectedOperationId:op1.operation_id});
assert.equal(late,newer,'Delayed success for op1 cannot erase op2');
// A pending retry must be able to continue using the exact same ID.
const sameCommand=updateOwnedMessageDraft(start,id,{
 operation:op1,busy:true,state:'busy'
},{expectedOperationId:op1.operation_id});
assert.equal(sameCommand[id].operation.operation_id,op1.operation_id);
assert.equal(updateOwnedMessageDraft(initial,id,{state:'sent'},
 {expectedOperationId:null}),initial,
 'No callback can claim delivery without a matching operation');
assert.equal(updateOwnedMessageDraft(initial,id,{state:'unconfirmed'},
 {expectedOperationId:null}),initial,
 'No pending receipt can exist without an operation');
assert.equal(updateOwnedMessageDraft(initial,id,{state:'busy',busy:true},
 {expectedOperationId:null}),initial,
 'No in-flight state can exist without an operation');
assert.equal(updateOwnedMessageDraft(start,id,{text:'A different message'},
 {expectedOperationId:op1.operation_id}),start,
 'Do not edit displayed text while original receipt is pending');
const text=readFileSync('extensions/jill-account-dashboard/src/pages/RequestConversation.jsx','utf8');
const orders=readFileSync('extensions/jill-account-dashboard/src/pages/CustomOrders.jsx','utf8');
const messages=readFileSync('extensions/jill-account-dashboard/src/pages/Messages.jsx','utf8');
assert.match(orders,/updateOwnedMessageDraft\(previous,order\.submission_id,change,meta\)/);
assert.match(messages,/updateOwnedMessageDraft\(previous,order\.submission_id,change,meta\)/);
assert.match(text,/onDraftChange\(\{operation:command,busy:true,state:'busy'\},/);
assert.match(text,/expectedOperationId:command\.operation_id/g);
assert.match(text,/onDraftChange\(\{operation:null,text:'',state:'sent',staleRevision:null,busy:false\},/);
assert.doesNotMatch(text,/finally\{busyRef\.current=false;onDraftChange/);
assert.match(text,/!enabled&&!recoverable&&Boolean\(text\.trim\(\)\)/);
assert.match(text,/It has not been delivered/);
console.log('PASS My JILL operation-scoped draft mutations: stale async response denied, logout-safe, no lost ACK overwrite, no foreign request, valid same-ID receipt recovery.');
