import assert from 'node:assert/strict';
import {projectVerifiedWorkContactInbox}
 from '../services/jill-order-desk/work-contact-ticket-inbox.mjs';
import {projectVerifiedCustomerContactTickets}
 from '../backend/work-contact-account-read.mjs';

const shopCustomer='gid://shopify/Customer/111';
const id='jill:contact:11111111-2222-4333-8444-555555555555';
const raw={ticket_id:id,state:'waiting_customer',revision:2,
 reason:'product',created_at_ms:1792800000000,updated_at_ms:1792800001000,
 owner_customer_gid:shopCustomer,
 name:'HIDDEN',email:'private@example.invalid',
 contact_json:'{"private":true}',last_status_operation_id:'NEVER_EXPOSE',
 status_actor_staff_id:'111'};
const hq=projectVerifiedWorkContactInbox([raw]).records[0];
const mine=projectVerifiedCustomerContactTickets([raw],shopCustomer)[0];
assert.equal(hq.status,'waiting_customer');
assert.equal(mine.status,'waiting_customer');
assert.equal(hq.revision,mine.revision);
assert.equal(hq.ticket_id,mine.ticket_id);
assert.equal(mine.reply_enabled,false);
assert.equal(mine.thread_version,1);
assert.equal(hq.customer_reply_enabled,false);
assert.ok(mine.updated_at.startsWith('2026-'));
assert.equal(JSON.stringify(hq).includes('private@'),false);
assert.equal(JSON.stringify(mine).includes('private@'),false);
assert.equal(JSON.stringify(mine).includes('NEVER_EXPOSE'),false);
assert.throws(()=>projectVerifiedCustomerContactTickets([raw],
 'gid://shopify/Customer/222'),/contact_account_unverified/);
console.log('PASS signed Contact Us status handoff: one D1 revision produces same HQ and My JILL status, no forged delivery, no cross-customer access.');
