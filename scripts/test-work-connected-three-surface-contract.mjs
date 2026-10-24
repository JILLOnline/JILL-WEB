// JILL WORK three-surface JOIN acceptance — synthetic, source-only.
// Run ONLY in the ephemeral HQ+My JILL+visual rehearsal merge.
// Proves connected response shapes and fail-closed visibility, NOT actual
// Shopify JWT, Google owner claims, D1 writes or a deployed extension.
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyWorkUnifiedInquiryReceipt,planWorkInquiryVisibility}
 from '../services/jill-order-desk/work-unified-inquiry-bridge.mjs';
import {projectVerifiedContactThread}
 from '../backend/work-contact-thread-read.mjs';
import {projectOwnedContactThread}
 from '../shared/customer-contact-thread.mjs';
import {projectVerifiedContactTicketList,loadWorkCustomerContactTickets}
 from '../shared/customer-contact-tickets.mjs';
import {onlyPublicCustomOrderProjection}
 from '../backend/custom-order-account-read.mjs';
import {projectCustomerMessageInbox,summarizeMerchantPublicThread}
 from '../shared/custom-order-message-inbox.mjs';
import {projectWorkQuoteOwnerBinding}
 from '../services/jill-order-desk/work-quote-shopify-customer-bridge.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:contact:11111111-2222-4333-8444-555555555555';
const REQUEST='jill:22222222-3333-4444-8555-666666666666';
const A='gid://shopify/Customer/111';
const B='gid://shopify/Customer/222';
const now=1792800001000;
const nowIso=new Date(now).toISOString();
const secret='synthetic-unified-inquiry-secret-that-is-never-deployed';
const nonce='A'.repeat(32);
const receipt=(owner_customer_gid=A)=>{
 const source={
  version:1,operation:'jill.work.intake.receipt.v1',
  shop:SHOP,kind:'contact',source:'shopify_contact_bridge',
  submission_id:ID,source_revision:2,
  record_sha256:'a'.repeat(64),owner_customer_gid,
  recorded_at_ms:now-1000,nonce,signature:'',
 };
 const canonical=['jill_unified_intake_receipt_v1',SHOP,
  source.kind,source.source,ID,'2',source.record_sha256,
  owner_customer_gid??'',String(source.recorded_at_ms),nonce].join('\n');
 source.signature=createHmac('sha256',secret).update(canonical).digest('hex');
 return source;
};
// Positive visibility MUST come from this module's receipt verification,
// never a browser-entered owner GID/email or raw receipt look-alike.
const forged={...receipt(),signature:'0'.repeat(64)};
assert.equal(verifyWorkUnifiedInquiryReceipt({
 source:forged,secret,nonce,nowMs:now,
}).state,'held');
const verified=verifyWorkUnifiedInquiryReceipt({
 source:receipt(),secret,nonce,nowMs:now,expectedKind:'contact',expectedId:ID,
});
assert.equal(verified.state,'verified_source_receipt');
assert.equal(planWorkInquiryVisibility({
 verified,merchantAuthenticated:true,
}).hq_visible,true);
const own=planWorkInquiryVisibility({
 verified,customerAuthenticatedGid:A,
});
assert.equal(own.my_jill_visible,true);
assert.equal(own.customer_reply_enabled,false);
assert.equal(own.can_publish_quote,false);
const other=planWorkInquiryVisibility({
 verified,customerAuthenticatedGid:B,
});
assert.equal(other.my_jill_visible,false);
assert.equal(other.hq_visible,false);
assert.equal(planWorkInquiryVisibility({
 verified:structuredClone(verified),merchantAuthenticated:true,
}).state,'held','Copying a proof is not authentication');
const guest=verifyWorkUnifiedInquiryReceipt({
 source:receipt(null),secret,nonce,nowMs:now,
});
assert.equal(planWorkInquiryVisibility({
 verified:guest,merchantAuthenticated:true,
}).hq_visible,true);
assert.equal(planWorkInquiryVisibility({
 verified:guest,customerAuthenticatedGid:A,
}).my_jill_visible,false,'Guest email is never an account claim');

// One canonical Contact thread: HQ server removes private fields, My JILL
// client accepts only bounded, expected public ticket ID and ordered events.
const ticket={ticket_id:ID,owner_customer_gid:A,state:'reviewing',
 revision:2,updated_at_ms:now};
const rows=[{sequence:1,body_text:'Your request is being reviewed.',
 created_at_ms:now-1000,actor_staff_id:'PRIVATE_STAFF_123',
 operation_id:'PRIVATE_OPERATION',customer_email:'PRIVATE_EMAIL'}];
const hqThread=projectVerifiedContactThread({
 ticket,messages:rows,expectedId:ID,customerGid:A,
});
assert.equal(hqThread.messages.length,1);
assert.equal(hqThread.reply_enabled,false);
assert.equal(hqThread.read_receipt_available,false);
assert.equal(JSON.stringify(hqThread).includes('PRIVATE_'),false);
const response={
 version:1,operation:'jill.contact.account.thread.result',
 ok:true,shop:SHOP,thread:hqThread,
};
const myThread=projectOwnedContactThread(response,ID);
assert.equal(myThread.messages[0].text,rows[0].body_text);
assert.equal(myThread.messages[0].author,'jill');
assert.equal(myThread.reply_enabled,false);
assert.equal(myThread.read_receipt_available,false);
assert.throws(()=>projectVerifiedContactThread({
 ticket,messages:rows,expectedId:ID,customerGid:B,
}),/contact_thread_unverified/);
assert.throws(()=>projectOwnedContactThread(response,
 'jill:contact:22222222-3333-4444-8555-666666666666'),
 /contact_thread_unverified/);
assert.throws(()=>projectOwnedContactThread({
 ...response,thread:{...hqThread,messages:[{
  ...hqThread.messages[0],sequence:2,
 }]},
},ID),/contact_thread_unverified/);

const safeList=projectVerifiedContactTicketList({
 version:1,operation:'jill.contact.account.list.result',
 ok:true,shop:SHOP,tickets:[{
  ticket_id:ID,revision:2,reason:'custom',status:'reviewing',
  created_at:new Date(now-3000).toISOString(),updated_at:nowIso,
  thread_version:1,reply_enabled:false,customer_email:'SECRET',
 }],
});
assert.equal(safeList.length,1);
assert.equal(JSON.stringify(safeList).includes('SECRET'),false);
// The disconnected My JILL client performs zero network/token reads.
let network=0,tokens=0;
const off=await loadWorkCustomerContactTickets({
 sessionToken:{get:async()=>{tokens++;return 'signed_jwt';}},
 request:async()=>{network++;throw Error('must_not_call');},
});
assert.equal(off.state,'not_connected');
assert.equal(network,0);
assert.equal(tokens,0);

// Existing Custom Orders must remain one canonical timeline in My JILL
// and merchant inbox (NOT a second message database).
const publicOrder=onlyPublicCustomOrderProjection([{
 timeline_version:2,submission_id:REQUEST,revision:3,status:'reviewing',
 updated_at:nowIso,
 summary:{items:[{title:'Synthetic piñata',quantity:1}],
   date_needed:'2026-11-03',fulfillment:'pickup'},
 timeline:[
  {revision:1,kind:'status',author:'system',status:'received',
   note:'Request received',occurred_at:new Date(now-3000).toISOString()},
  {revision:2,kind:'merchant_message',author:'jill',status:'reviewing',
   note:'Which color?',occurred_at:new Date(now-2000).toISOString()},
  {revision:3,kind:'customer_reply',author:'customer',status:'reviewing',
   note:'Purple',occurred_at:nowIso},
 ],
 internal_note:'SECRET_INTERNAL_PRODUCTION_COST',
}])[0];
const customerInbox=projectCustomerMessageInbox([publicOrder])[0];
const ownerInbox=summarizeMerchantPublicThread(publicOrder,REQUEST);
assert.deepEqual(customerInbox,ownerInbox);
assert.equal(ownerInbox.last_message.author,'customer');
assert.equal(JSON.stringify(ownerInbox).includes('SECRET'),false);
assert.equal(ownerInbox.delivery_verified,false);
assert.equal(ownerInbox.unread_count,null);

// No guessed customer association may become a priced/published order.
const unverifiedQuoteOwner=projectWorkQuoteOwnerBinding({
 source:{owner_customer_gid:A,email:'somebody@example.invalid'},
 submissionId:REQUEST,sourceRevision:3,nowMs:now,
});
assert.equal(unverifiedQuoteOwner.state,'held');
assert.equal(unverifiedQuoteOwner.can_publish,false);
assert.equal(unverifiedQuoteOwner.can_create_order,false);
assert.equal(unverifiedQuoteOwner.can_invoice,false);

// Three-branch result includes the accepted visual layers but no
// authorization to enable messages, Contact, save drafts or commerce.
const app=readFileSync(
 'services/jill-order-desk/app-home/app/routes/app.tsx','utf8');
const css=readFileSync(
 'services/jill-order-desk/app-home/app/styles/hq-visual-polish.css','utf8');
const quote=readFileSync(
 'services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx','utf8');
const contact=readFileSync(
 'extensions/jill-account-dashboard/src/hub/AccountHub.jsx','utf8');
assert.match(app,/import "\.\.\/styles\/hq-visual-polish\.css"/);
assert.match(css,/\.jill-quote__advanced/);
assert.match(quote,/className="jill-quote__advanced"/);
assert.match(quote,/Entries are lost on refresh/);
assert.match(contact,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.doesNotMatch(app+quote+contact,/localStorage|sessionStorage/);
console.log('PASS: Three-lane synthetic HQ/My JILL/Shopify contracts agree on canonical request timelines, contact claim isolation, verified visibility, no private metadata, hard-OFF features and visual source — no deployments or provider calls.');
