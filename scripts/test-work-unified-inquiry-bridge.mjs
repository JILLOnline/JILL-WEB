import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyWorkUnifiedInquiryReceipt,planWorkInquiryVisibility}
 from '../services/jill-order-desk/work-unified-inquiry-bridge.mjs';

const secret='synthetic-work-unified-intake-secret-never-production';
const now=1792760400000;
const nonce='0123456789abcdefghijklmnopqrstuv';
const owner='gid://shopify/Customer/123456';
const foreign='gid://shopify/Customer/654321';
const id='jill:11111111-2222-4333-8444-555555555555';
const base={version:1,operation:'jill.work.intake.receipt.v1',
 shop:'jill-work.myshopify.com',kind:'custom_order',
 source:'google_work_qa',submission_id:id,source_revision:2,
 record_sha256:'a'.repeat(64),owner_customer_gid:owner,
 recorded_at_ms:now-1000,nonce};
function signed(record){
 const parts=['jill_unified_intake_receipt_v1',record.shop,record.kind,
  record.source,record.submission_id,String(record.source_revision),
  record.record_sha256,record.owner_customer_gid??'',
  String(record.recorded_at_ms),record.nonce];
 return {...record,signature:createHmac('sha256',secret)
  .update(parts.join('\n'),'utf8').digest('hex')};
}
const verify=(source,overrides={})=>verifyWorkUnifiedInquiryReceipt({
 source,secret,nonce,nowMs:now,...overrides
});
const good=verify(signed(base),{expectedKind:'custom_order',expectedId:id});
assert.equal(good.state,'verified_source_receipt');
assert.equal(good.can_invoice,false);
const me=planWorkInquiryVisibility({verified:good,customerAuthenticatedGid:owner});
assert.equal(me.my_jill_visible,true);
assert.equal(me.hq_visible,false);
const other=planWorkInquiryVisibility({verified:good,customerAuthenticatedGid:foreign});
assert.equal(other.my_jill_visible,false);
assert.equal(other.can_send_reply,false);
assert.equal(planWorkInquiryVisibility({verified:good,merchantAuthenticated:true}).hq_visible,true);

const contact=signed({...base,kind:'contact',source:'shopify_contact_bridge',
 submission_id:'jill:contact:11111111-2222-4333-8444-555555555555',
 owner_customer_gid:null});
const contactResult=verify(contact,{expectedKind:'contact'});
assert.equal(contactResult.state,'verified_source_receipt');
const guest=planWorkInquiryVisibility({verified:contactResult,merchantAuthenticated:true,
 customerAuthenticatedGid:owner});
assert.equal(guest.hq_visible,true);
assert.equal(guest.my_jill_visible,false,'email-only Contact Us cannot appear in My JILL');
assert.equal(guest.shopify_order_link_verified,false);
for(const field of ['shop','source','kind','owner_customer_gid','record_sha256','submission_id']){
 const altered=field==='owner_customer_gid'?foreign:
  field==='record_sha256'?'b'.repeat(64):'foreign';
 assert.equal(verify({...signed(base),[field]:altered}).state,'held',
  'Signed receipt tampering rejected: '+field);
}
assert.equal(verify({...signed(base),signature:'a'.repeat(64)}).state,'held');
assert.equal(verify({...signed(base),debug:'private'}).state,'held');
assert.equal(verify(signed(base),{nonce:'x'.repeat(32)}).state,'held');
assert.equal(verify(signed(base),{nowMs:now+120001}).state,'held');
assert.equal(verify(signed(base),{expectedKind:'contact'}).state,'held');
assert.equal(verify({...signed(base),owner_customer_gid:'user@example.invalid'}).state,'held');
assert.equal(planWorkInquiryVisibility({verified:{state:'unverified'},merchantAuthenticated:true}).hq_visible,undefined);
const bridgeSource=readFileSync('services/jill-order-desk/work-unified-inquiry-bridge.mjs','utf8');
const contactLiquid=readFileSync('theme/sections/main-contact.liquid','utf8');
const customLiquid=readFileSync('theme/sections/main-custom-order.liquid','utf8');
assert.match(contactLiquid,/{% form 'contact'/);
assert.match(contactLiquid,/contact\[email\]/);
assert.match(customLiquid,/data-verified-submit-endpoint/);
assert.doesNotMatch(bridgeSource,/sendWorkCustomerReply|draftOrderCreate|draftOrderInvoiceSend|fetch\(|localStorage|customer\.email/);
console.log('PASS WORK unified intake contract: signed source, exact customer owner, HQ visibility, guest Contact Us isolation, no commerce side effects.');
