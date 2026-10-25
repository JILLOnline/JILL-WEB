// My JILL: a useful customer journey must never invent quote approval,
// payment, shipping commitments, refunds, unread status or delivery dates.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CUSTOM_ORDER_STATUS,CUSTOM_ORDER_NEXT_STEP,
 customOrderStatus,customOrderNextStep}
 from '../extensions/jill-account-dashboard/src/pages/custom-order-presentation.mjs';

const statuses=['received','reviewing','awaiting_approval','in_production',
 'ready_pickup','on_hold','cancelled','completed'];
assert.deepEqual(Object.keys(CUSTOM_ORDER_NEXT_STEP),statuses);
assert.equal(Object.isFrozen(CUSTOM_ORDER_NEXT_STEP),true);
for(const status of statuses){
 const next=customOrderNextStep(status);
 const current=customOrderStatus(status);
 assert.equal(Object.isFrozen(next),true);
 assert.ok(typeof next.heading==='string'&&next.heading.length>=12,status);
 assert.ok(typeof next.text==='string'&&next.text.length>=50,status);
 assert.ok(typeof current.detail==='string');
 assert.doesNotMatch(next.text,/guaranteed by|will arrive on|paid in full|refund issued|approval completed/i);
}
assert.match(customOrderNextStep('awaiting_approval').text,/approval and payment are not available/);
assert.match(customOrderNextStep('ready_pickup').text,/confirm arrangements.*before traveling/);
assert.match(customOrderNextStep('in_production').text,/no completion date is guaranteed/);
assert.match(customOrderNextStep('cancelled').text,/does not establish any refund/);
assert.match(customOrderNextStep('on_hold').text,/timeline and conversation/);
const unknown=customOrderNextStep('__proto__');
assert.match(unknown.heading,/unavailable/);
assert.doesNotMatch(unknown.text,/approved|delivered|issued|ready for pickup/i);
assert.equal(customOrderNextStep('paid').heading,unknown.heading);
const root='extensions/jill-account-dashboard/src/pages/';
const home=readFileSync(root+'RecentRequests.jsx','utf8');
const orders=readFileSync(root+'CustomOrders.jsx','utf8');
const inbox=readFileSync(root+'Messages.jsx','utf8');
assert.match(home,/const nextStep=customOrderNextStep\(item.status\)/);
assert.match(home,/\{nextStep.heading\}/);
assert.match(home,/\{nextStep.text\}/);
assert.match(home,/loadWorkCustomerConversationState\(\{sessionToken,signal:controller.signal\}\)/);
assert.match(orders,/const nextStep=customOrderNextStep\(order.status\)/);
assert.match(orders,/\{nextStep.heading\}/);
assert.match(orders,/\{nextStep.text\}/);
assert.match(orders,/projectMyJillOrderActivity\(orders\)/);
assert.match(inbox,/customOrderNextStep\(order.status\).heading/);
assert.match(inbox,/customOrderNextStep\(order.status\).text/);
assert.match(inbox,/selectOwnedMessageRequest\(inbox,\{/);
assert.match(inbox,/RequestConversation order=\{order\}/);
for(const src of [home,orders,inbox]){
 assert.doesNotMatch(src,/metafieldsSet|discountCodeBasicCreate|draftOrderCreate/);
 assert.doesNotMatch(src,/localStorage|sessionStorage|document\.cookie/);
}
console.log('PASS My JILL experience: eight status-specific customer next steps, no invented approval/shipping/refunds, safe unknown fallback and unchanged account-only readers.');
