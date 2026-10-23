import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync('backend/google-apps-script/JILL_WORK_HQ_OWNER_BINDING_QA_SOURCE.gs','utf8');
const client=readFileSync('services/jill-order-desk/work-google-owner-binding.mjs','utf8');
const bridge=readFileSync('services/jill-order-desk/work-quote-shopify-customer-bridge.mjs','utf8');
for(const value of [
 'merchant_owner_binding_request_v1','work_quote_owner_binding_v1',
 'jill-work.myshopify.com','jill_hq_read_nonce','raw_payload_sha256'
]) {
 assert.ok(source.includes(value),'server missing shared contract token: '+value);
 assert.ok(client.includes(value)||bridge.includes(value),'client missing contract token: '+value);
}
assert.match(source,/JILL_WORK_OWNER_BINDING_QA_ENABLED/);
assert.match(source,/replayKey/);
assert.match(source,/props\.setProperty\(replayKey,/);
assert.match(source,/jillCustomOrderOwnerHash_\(raw\)/);
assert.match(source,/revision!==Number\(p\.source_revision\)/);
assert.doesNotMatch(source,/\bdoPost\s*\(|\bappendRow\s*\(|\bdraftOrderCreate\s*\(/);
assert.match(bridge,/full_delivery_address_verified:false/);
assert.match(bridge,/shipping_terms_verified:false/);
console.log('PASS offline WORK owner proof shared contract and no commerce-side effects.');
