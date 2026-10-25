import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadWorkCustomerContactTickets,projectVerifiedContactTicketList,
 WORK_CONTACT_ACCOUNT_URL} from '../shared/customer-contact-tickets.mjs';

const id='jill:contact:11111111-2222-4333-8444-555555555555';
const ticket={ticket_id:id,revision:1,reason:'shipping',status:'received',
 created_at:'2026-10-23T12:00:00.000Z',
 updated_at:'2026-10-23T12:00:00.000Z',
 thread_version:1,reply_enabled:false};
const response=(tickets,more={})=>new Response(JSON.stringify({
 version:1,operation:'jill.contact.account.list.result',ok:true,
 shop:'jill-work.myshopify.com',tickets,...more,
}),{status:200});
const token='signed-shopify-session-test-'.repeat(4);
let tokenReads=0,networkReads=0;
const sessionToken={get:async()=>{tokenReads++;return token;}};
const request=async(url,opts)=>{
 networkReads++;
 assert.equal(url,WORK_CONTACT_ACCOUNT_URL);
 assert.equal(opts.method,'POST');
 assert.equal(opts.body,'');
 assert.equal(opts.headers.Authorization,'Bearer '+token);
 assert.equal(opts.headers['Content-Type'],'application/json');
 return response([{...ticket,email:'private@example.invalid',
  phone:'555-1234',owner_customer_gid:'gid://shopify/Customer/123'}]);
};
const disabled=await loadWorkCustomerContactTickets({sessionToken,request});
assert.equal(disabled.state,'not_connected');
assert.deepEqual(disabled.tickets,[]);
assert.equal(tokenReads,0);
assert.equal(networkReads,0);
const connected=await loadWorkCustomerContactTickets({
 enabled:true,sessionToken,request,
});
assert.equal(connected.state,'ready');
assert.equal(networkReads,1);
assert.equal(tokenReads,1);
assert.deepEqual(connected.tickets,[ticket]);
assert.equal(JSON.stringify(connected).includes('private@'),false);
assert.equal(connected.tickets[0].reply_enabled,false);
assert.equal(connected.tickets[0].owner_customer_gid,undefined);

for(const tickets of [
 [ticket,ticket],
 [{...ticket,ticket_id:'invalid'}],
 [{...ticket,reply_enabled:true}],
 [{...ticket,reason:'unknown'}],
 [{...ticket,status:'delivered'}],
 [{...ticket,updated_at:'2026-10-22T10:00:00.000Z'}],
 Array(21).fill(ticket),
]){
 assert.throws(()=>projectVerifiedContactTicketList({
  version:1,operation:'jill.contact.account.list.result',
  ok:true,shop:'jill-work.myshopify.com',tickets,
 }),/contact_account_unverified/);
}
assert.deepEqual(projectVerifiedContactTicketList({
 version:1,operation:'jill.contact.account.list.result',
 ok:true,shop:'jill-work.myshopify.com',tickets:[],
}),[]);
const aborted=new AbortController();
aborted.abort();
await assert.rejects(()=>loadWorkCustomerContactTickets({
 enabled:true,sessionToken,request,signal:aborted.signal,
}),/AbortError/);
assert.equal(tokenReads,1);
await assert.rejects(()=>loadWorkCustomerContactTickets({
 enabled:true,sessionToken:{get:async()=>''},request,
}),/contact_account_unverified/);
assert.equal(networkReads,1);
await assert.rejects(()=>loadWorkCustomerContactTickets({
 enabled:true,sessionToken,request:async()=>response([{...ticket,reply_enabled:true}]),
}),/contact_account_unverified/);
const source=readFileSync('shared/customer-contact-tickets.mjs','utf8');
assert.doesNotMatch(source,/localStorage|sessionStorage|customer\.email|document\.cookie|draftOrderCreate/);
console.log('PASS My JILL future Contact Us: default OFF, fixed signed WORK endpoint, bounded records, no guessed ownership, no fake replies.');
