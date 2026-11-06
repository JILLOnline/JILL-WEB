import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {auditWorkMyJillMessagingSource,inspectWorkMyJillMessagingSource}
 from './audit-work-myjill-message-extension-source.mjs';
const root='extensions/jill-account-dashboard/';
const read=p=>readFileSync(p,'utf8');
const original={
 extension:read(root+'shopify.extension.toml'),
 customerReader:read('shared/customer-custom-orders.mjs'),
 worker:read('services/custom-order-cloudflare/handler.mjs'),
 reply:read('backend/custom-order-conversation.mjs'),
 hub:read(root+'src/hub/AccountHub.jsx'),
 orders:read(root+'src/pages/CustomOrders.jsx'),
 messages:read(root+'src/pages/Messages.jsx'),
};
const r=auditWorkMyJillMessagingSource();
assert.equal(r.status,'WORK_MY_JILL_MESSAGING_SOURCE_WIRED');
assert.equal(r.deployed_customer_extension_verified,false);
assert.equal(r.remote_work_gateway_verified,false);
assert.equal(r.google_qa_published_source_verified,false);
assert.equal(r.sending_authorized,false);
assert.equal(r.shopify_publish_authorized,false);
const mutate=(field,fn,code)=>assert.throws(
 ()=>inspectWorkMyJillMessagingSource({...original,[field]:fn(original[field])}),
 new RegExp(code));
mutate('extension',s=>s.replace('network_access = true','network_access = false'),
 'capability_network_access');
mutate('extension',s=>s+'\nnetwork_access = true\n','capability_network_access');
mutate('extension',s=>s.replace('api_access = true','api_access = false'),
 'capability_api_access');
mutate('extension',s=>s.replace('customer-account.page.render','checkout.block.render'),
 'page_render');
mutate('customerReader',s=>s.replace('jill-work-custom-orders-qa.','jill-live-custom-orders-qa.'),
 'reader_host');
mutate('customerReader',s=>s.replace("new URL('/jill-custom-order-reply',WORK_CUSTOM_ORDER_ACCOUNT_URL)",
 "new URL('/jill-custom-order-reply','https://foreign.example.invalid')"),
 'reply_same_gateway');
mutate('worker',s=>s.replace("enabled:env.JILL_WORK_CONVERSATION_ENABLED==='true'",
 "enabled:true"),'worker_write_flag');
mutate('reply',s=>s.replace("if(enabled!==true)return failure(503,'conversation_not_connected');",
 "// gate bypassed"),'writer_fail_closed');
mutate('messages',s=>s.replace('selectOwnedMessageRequest(list',
 'selectOwnedMessageRequest([{submission_id:requestedSubmissionId}]'),
 'customer_owned_selection');
mutate('hub',s=>s+"\\n// localStorage\\n",'persistent_customer_drafts');
assert.throws(()=>inspectWorkMyJillMessagingSource({
 ...original,endpoint:'https://example.invalid/account'}),/wrong_work_gateway/);
console.log('PASS WORK My JILL extension message source wiring: signed-owned list, network grant, exact WORK-only gateway, OFF writer guard, no deployment; negative bypasses denied.');
