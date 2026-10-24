import assert from 'node:assert/strict';
import {
 projectUnifiedWorkOwnerQueue,readUnifiedWorkOwnerQueue,
} from '../services/jill-order-desk/work-unified-owner-queue.mjs';
import {projectWorkMerchantInbox} from
 '../services/jill-order-desk/merchant-inbox-read.mjs';
import {projectVerifiedWorkContactInbox} from
 '../services/jill-order-desk/work-contact-ticket-inbox.mjs';

const A='jill:11111111-2222-4333-8444-555555555555';
const B='jill:22222222-3333-4444-8555-666666666666';
const T='jill:contact:33333333-4444-4333-8444-777777777777';
const shop='jill-work.myshopify.com';
const at='2026-10-24T12:00:00.000Z';
const later='2026-10-24T12:02:00.000Z';
const rawOrder=(id=A,updated=at)=>({
 submission_id:id,revision:1,customer_status:'received',
 internal_status:'new',submitted_at:at,updated_at:updated,
 date_needed:'2026-11-03',fulfillment:'pickup',item_count:1,
 customer_email:'PRIVATE_EMAIL',owner_customer_gid:'PRIVATE_GID',
 internal_notes:'PRIVATE_COSTS',
});
const signedList=orders=>({
 version:1,operation:'custom_order.merchant.list.result',
 ok:true,shop,complete:true,records:orders,
});
const requestModel=(rows=[rawOrder()])=>projectWorkMerchantInbox(signedList(rows));
const contactRow={
 ticket_id:T,reason:'custom',state:'reviewing',
 revision:2,created_at_ms:Date.parse(at),updated_at_ms:Date.parse(later),
 customer_email:'PRIVATE_EMAIL',
 owner_customer_gid:'PRIVATE_GID',
 contact_json:'PRIVATE_MESSAGE',
};
const verifiedContacts=rows=>({
 state:'verified',code:'ready',kind:'contact',shop,
 ...projectVerifiedWorkContactInbox(rows),
});
const requests=requestModel([rawOrder(A),rawOrder(B,later)]);
const contacts=verifiedContacts([contactRow]);
const combined=projectUnifiedWorkOwnerQueue({
 requestModel:requests,contactModel:contacts,contactEnabled:true,
});
assert.equal(combined.state,'ready');
assert.equal(combined.records.length,3);
assert.deepEqual(combined.records.map(x=>x.kind),
 ['custom_order','contact','custom_order'],
 'Stable tie-breaker; request/contact ordering remains deterministic');
assert.equal(combined.records[0].id,B);
assert.equal(combined.records[1].id,T);
assert.equal(combined.records[1].status,'reviewing');
assert.equal(combined.records[1].can_send_message,false);
assert.equal(combined.records[1].unread_count,null);
assert.equal(combined.contact_connected,true);
assert.equal(combined.custom_orders_connected,true);
assert.equal(combined.can_create_order,false);
assert.equal(combined.can_invoice,false);
assert.equal(combined.can_publish_quote,false);
assert.equal(combined.delivery_receipts_available,false);
assert.equal(combined.has_unverified_pages,false);
assert.equal(Object.isFrozen(combined.records),true);
assert.equal(Object.isFrozen(combined.records[0]),true);
const rendered=JSON.stringify(combined);
for(const secret of ['PRIVATE_EMAIL','PRIVATE_GID','PRIVATE_COSTS',
 'PRIVATE_MESSAGE','contact_json','customer_email','owner_customer_gid']){
 assert.equal(rendered.includes(secret),false,
  'Owner list must never expose private detail: '+secret);
}
assert.equal(combined.records[1].href,
 '/app/contacts/'+encodeURIComponent(T));
assert.equal(combined.records[0].href,
 '/app/requests/'+encodeURIComponent(B));
const disconnected=projectUnifiedWorkOwnerQueue({requestModel:requests});
assert.equal(disconnected.state,'partial');
assert.equal(disconnected.records.length,2);
assert.equal(disconnected.contact_state,'not_connected');
assert.equal(disconnected.contact_connected,false);
assert.equal(disconnected.unread_count,null);

for(const bad of [
 {...contacts,shop:'another-shop.myshopify.com'},
 {...contacts,has_more:true},
 {...contacts,code:'not_connected'},
 {...contacts,records:[contacts.records[0],contacts.records[0]]},
 {...contacts,records:[{...contacts.records[0],status:'paid'}]},
 {...contacts,records:[{...contacts.records[0],ticket_id:A}]},
 {...contacts,records:[{...contacts.records[0],customer_reply_enabled:true}]},
 {...contacts,records:[{...contacts.records[0],updated_at_ms:-1}]},
 {...contacts,records:[{...contacts.records[0],revision:101}]},
]){
 assert.throws(()=>projectUnifiedWorkOwnerQueue({
  requestModel:requests,contactModel:bad,contactEnabled:true,
 }),/work_unified_owner_queue_unverified/);
}
for(const bad of [
 {...requests,source:'unknown'},
 {...requests,requestsConnected:false},
 {...requests,readOnly:false},
 {...requests,invoiceEnabled:true},
 {...requests,records:[requests.records[0],requests.records[0]]},
 {...requests,records:[{...requests.records[0],
  item_count:0}]},
 {...requests,records:[{...requests.records[0],
  updated_at:'nonsense'}]},
]){
 assert.throws(()=>projectUnifiedWorkOwnerQueue({
  requestModel:bad,contactModel:contacts,contactEnabled:true,
 }),/work_unified_owner_queue_unverified/);
}
let requestReads=0,contactReads=0;
const browser=new Request('https://hq.example.invalid/app/queue',{method:'GET'});
const readRequests=async()=>{
 requestReads++;
 return {status:200,model:requests};
};
const readContacts=async()=>{
 contactReads++;
 return Response.json(contacts);
};
const off=await readUnifiedWorkOwnerQueue({
 request:browser,readRequests,readContacts,
});
assert.equal(off.state,'not_connected');
assert.equal(requestReads,0);
assert.equal(contactReads,0);
const unconnected=await readUnifiedWorkOwnerQueue({
 enabled:true,request:browser,readRequests,readContacts,
});
assert.equal(unconnected.state,'partial');
assert.equal(unconnected.contact_state,'not_connected');
assert.equal(requestReads,1);
assert.equal(contactReads,0,'No contact reads until explicitly enabled');
const ready=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,
 request:browser,readRequests,readContacts,
});
assert.equal(ready.state,'ready');
assert.equal(requestReads,2);
assert.equal(contactReads,1);
const method=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,
 request:new Request('https://hq.example.invalid/app/queue',{method:'POST'}),
 readRequests,readContacts,
});
assert.equal(method.state,'held');
assert.equal(requestReads,2);
assert.equal(contactReads,1);
const noAuth=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,request:browser,
 readRequests:async()=>({status:403,model:{state:'access_denied'}}),
 readContacts,
});
assert.equal(noAuth.state,'held');
assert.equal(noAuth.records.length,0);
assert.equal(contactReads,1,'Do not touch Contact data after Owner denial');
const invalidContact=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,request:browser,
 readRequests,readContacts:async()=>Response.json(
 {...contacts,has_more:true}),
});
assert.equal(invalidContact.state,'held');
assert.equal(invalidContact.records.length,0,
 'Never present a partial cross-source feed as complete');
const disconnectedContact=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,request:browser,
 readRequests,readContacts:async()=>Response.json({
 state:'held',code:'not_connected',
 },{status:503}),
});
assert.equal(disconnectedContact.state,'held');
assert.equal(disconnectedContact.contact_state,'unverified');
assert.equal(disconnectedContact.records.length,0);
const huge=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,request:browser,
 readRequests,readContacts:async()=>new Response('x'.repeat(26000)),
});
assert.equal(huge.state,'held');
const failRequests=await readUnifiedWorkOwnerQueue({
 enabled:true,contactEnabled:true,request:browser,
 readRequests:async()=>{throw Error('synthetic Google source failed');},
 readContacts,
});
assert.equal(failRequests.state,'held');
const safe=JSON.stringify(failRequests);
assert.equal(safe.includes('synthetic Google source failed'),false,
 'Error details never cross the view boundary');
console.log('PASS unified WORK owner queue: exact whitelisted read records, no PII, deterministic sort, safe contact OFF/partial state, strict dual-source Owner gate, source failure HOLD, no network/write or activation.');
