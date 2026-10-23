import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {claimWorkCustomerContactTicket,WORK_CONTACT_CLAIM_URL}
 from '../shared/customer-contact-claim.mjs';

const id='jill:contact:11111111-2222-4333-8444-555555555555';
const secret='A'.repeat(43),token='signed-qa-session-'.repeat(5);
let gets=0,calls=0;
const sessionToken={get:async()=>{gets++;return token;}};
const request=async(url,init)=>{
 calls++;
 assert.equal(url,WORK_CONTACT_CLAIM_URL);
 assert.equal(init.method,'POST');
 assert.equal(init.headers.Authorization,'Bearer '+token);
 assert.deepEqual(JSON.parse(init.body),{ticket_id:id,claim_token:secret});
 return Response.json({version:1,operation:'jill.contact.account.claim.result',
  ok:true,code:'claimed',ticket_id:id,owner_customer_gid:'SECRET'},
 {status:200});
};
await assert.rejects(()=>claimWorkCustomerContactTicket({
 sessionToken,request,ticketId:id,claimCode:secret,
}),/contact_claim_not_connected/);
assert.equal(gets,0);assert.equal(calls,0);
const good=await claimWorkCustomerContactTicket({
 enabled:true,sessionToken,request,ticketId:id,claimCode:secret});
assert.deepEqual(good,{state:'claimed',ticket_id:id});
assert.equal(JSON.stringify(good).includes('SECRET'),false);
assert.equal(JSON.stringify(good).includes(secret),false);
assert.equal(gets,1);assert.equal(calls,1);
const fail=async(response,error)=>assert.rejects(()=>
 claimWorkCustomerContactTicket({
  enabled:true,sessionToken,ticketId:id,claimCode:secret,
  request:async()=>response,
 }),new RegExp(error));
await fail(new Response('{}',{status:409}),'contact_claim_unverified');
await fail(new Response('{}',{status:503}),'contact_claim_unconfirmed');
await fail(Response.json({version:1,operation:'jill.contact.account.claim.result',
 ok:true,code:'claimed',ticket_id:'jill:contact:22222222-2222-4333-8444-555555555555'}),
 'contact_claim_unconfirmed');
await assert.rejects(()=>claimWorkCustomerContactTicket({
 enabled:true,sessionToken,request,ticketId:id,claimCode:'short',
}),/contact_claim_invalid/);
const oldGets=gets;
const controller=new AbortController();controller.abort();
await assert.rejects(()=>claimWorkCustomerContactTicket({
 enabled:true,sessionToken,request,ticketId:id,claimCode:secret,
 signal:controller.signal,
}),/AbortError/);
assert.equal(gets,oldGets);
const source=readFileSync('shared/customer-contact-claim.mjs','utf8');
assert.doesNotMatch(source,/customer\.email|localStorage|sessionStorage|orderCreate|draftOrderCreate/);
assert.match(source,/if\(enabled!==true\)fail\('contact_claim_not_connected'\)/);
console.log('PASS My JILL contact claim client: default OFF, exact JWT path, private 256-bit code, receipt-bound ID, guest isolation, no secret in result.');
