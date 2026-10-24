import assert from 'node:assert/strict';
import {readWorkContactTicketInbox,projectVerifiedWorkContactInbox}
 from '../services/jill-order-desk/work-contact-ticket-inbox.mjs';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const row={ticket_id:id,state:'received',revision:1,
 reason:'custom',created_at_ms:1792760400000,
 updated_at_ms:1792760400000,
 private_email:'qa@example.invalid',contact_json:'PRIVATE'};
const projected=projectVerifiedWorkContactInbox([row]);
assert.equal(projected.records.length,1);
assert.equal(projected.records[0].ticket_id,id);
assert.equal(projected.records[0].kind,'contact');
assert.equal(projected.records[0].customer_reply_enabled,false);
assert.equal(projected.records[0].customer_owner_verified,false);
assert.doesNotMatch(JSON.stringify(projected),/qa@example|contact_json|PRIVATE/);
for(const record of [
 {...row,reason:'not_allowed'},
 {...row,state:'paid'},
 {...row,revision:0},
 {...row,updated_at_ms:0},
 {...row,ticket_id:'invalid'},
]){
 assert.throws(()=>projectVerifiedWorkContactInbox([record]),/invalid_contact_inbox/);
}
assert.throws(()=>projectVerifiedWorkContactInbox([row,row]),/invalid_contact_inbox/);
const request=new Request('https://hq.work.example.test/app/contacts',
 {method:'GET'});
let auth=0,reads=0;
const db={prepare:sql=>{
 reads++;
 assert.match(sql,/SELECT ticket_id,state,revision/);
 assert.doesNotMatch(sql,/SELECT \*/);
 assert.match(sql,/WHERE shop=\?/);
 return {bind:shop=>{
  assert.equal(shop,'jill-work.myshopify.com');
  return {all:async()=>({results:[row]})};
 }};
}};
const authenticate={admin:async()=>{auth++;return {session:{id:'owner'}};}};
const authorized=async({session,action})=>{
 assert.equal(session.id,'owner');
 assert.equal(action,'requests.read');
 return {allowed:true,role:'owner'};
};
const closed=await readWorkContactTicketInbox({request,db,authenticate,
 authorize:authorized});
assert.equal(closed.status,503);
assert.equal(reads,0);assert.equal(auth,0);
const ok=await readWorkContactTicketInbox({request,db,authenticate,
 authorize:authorized,enabled:true});
assert.equal(ok.status,200);
const result=await ok.json();
assert.equal(result.records.length,1);
assert.doesNotMatch(JSON.stringify(result),/qa@example|PRIVATE/);
assert.equal(reads,1);assert.equal(auth,1);
const staff=await readWorkContactTicketInbox({request,db,authenticate,
 authorize:async()=>({allowed:true,role:'staff'}),enabled:true});
assert.equal(staff.status,403);
assert.equal(reads,1,'staff never reads private contacts');
const rejected=await readWorkContactTicketInbox({request,db,authenticate,
 authorize:async()=>({allowed:false,role:'owner'}),enabled:true});
assert.equal(rejected.status,403);assert.equal(reads,1);
console.log('PASS WORK HQ Contacts: Owner-only, default OFF, bounded whitelisted ticket metadata, denied staff/guests, no PII.');
