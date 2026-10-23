import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {projectVerifiedWorkContactDetail,readWorkContactTicketDetail}
 from '../services/jill-order-desk/work-contact-ticket-detail.mjs';
const shop='jill-work.myshopify.com';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const details=Object.fromEntries(['order_number','product_name',
 'business_name','business_link','website_area','device','reference_images']
 .map(k=>[k,'']));
details.order_number='JILL-123';
const contact={ticket_id:id,name:'QA Contact',email:'contact@example.invalid',
 phone:'',reason:'existing',message:'Where is my order?',
 preferred_contact:'Email',reviewed:true,details};
const json=JSON.stringify(contact);
const digest=createHash('sha256').update(
 'jill_work_contact_ticket_v1\n'+json).digest('hex');
const row={shop,ticket_id:id,source:'shopify_contact_bridge',
 body_sha256:digest,contact_json:json,
 state:'received',revision:1,owner_customer_gid:null,
 created_at_ms:1792760400000,updated_at_ms:1792760400000};
const projected=projectVerifiedWorkContactDetail({row,ticketId:id});
assert.equal(projected.message,contact.message);
assert.equal(projected.details.order_number,'JILL-123');
assert.equal(projected.customer_reply_enabled,false);
assert.equal(projected.can_invoice,false);
assert.equal(projectVerifiedWorkContactDetail({row:{...row,owner_customer_gid:
 'gid://shopify/Customer/111'},ticketId:id}).owner_customer_verified,true);
for(const altered of [
 {...row,body_sha256:'b'.repeat(64)},
 {...row,owner_customer_gid:'gid://shopify/Customer/not-a-number'},
 {...row,contact_json:JSON.stringify({...contact,email:'bad'})},
 {...row,state:'paid'},
 {...row,revision:101},
 {...row,shop:'other.myshopify.com'},
]){
 assert.throws(()=>projectVerifiedWorkContactDetail({row:altered,ticketId:id}),
 /contact_detail_unverified/);
}
const request=new Request('https://work.example.invalid/app/contacts/'+id,
 {method:'GET'});
let dbCalls=0,authCalls=0;
const db={prepare:sql=>{
 dbCalls++;
 assert.match(sql,/WHERE shop=\? AND ticket_id=\?/);
 return {bind:(a,b)=>{
  assert.equal(a,shop);assert.equal(b,id);
  return {first:async()=>row};
 }};
}};
const authenticate={admin:async()=>{authCalls++;return {session:{id:'owner'}};}};
const allow=async({action})=>{
 assert.equal(action,'requests.read');
 return {allowed:true,role:'owner'};
};
const disabled=await readWorkContactTicketDetail({
 request,ticketId:id,db,authenticate,authorize:allow});
assert.equal(disabled.status,503);
assert.equal(dbCalls,0);assert.equal(authCalls,0);
const permitted=await readWorkContactTicketDetail({
 request,ticketId:id,db,authenticate,authorize:allow,enabled:true});
assert.equal(permitted.status,200);
assert.equal((await permitted.json()).detail.email,'contact@example.invalid');
assert.equal(dbCalls,1);
const denied=await readWorkContactTicketDetail({
 request,ticketId:id,db,authenticate,
 authorize:async()=>({allowed:true,role:'staff'}),enabled:true});
assert.equal(denied.status,403);
assert.equal(dbCalls,1,'unauthorized staff must never read contact message');
console.log('PASS HQ Contact detail: exact WORK Owner, SHA-256 sealed private record, reject claimed customers/invalid source, OFF zero reads.');
