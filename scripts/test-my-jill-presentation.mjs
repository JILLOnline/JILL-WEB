import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  CUSTOM_ORDER_STATUS,customOrderStatus,customOrderTitle,customOrderShortId,
  customOrderDateTime,customOrderDateOnly,customOrderFulfillment,
} from '../extensions/jill-account-dashboard/src/pages/custom-order-presentation.mjs';
import {requestShortId} from '../services/jill-order-desk/inbox-display.mjs';

// Presentation tests: no authenticated identity, backend requests or
// customer data mutations. Only already-public, validated order projections.
assert.deepEqual(Object.keys(CUSTOM_ORDER_STATUS),[
  'received','reviewing','awaiting_approval','in_production',
  'ready_pickup','on_hold','cancelled','completed',
]);
for (const [key,value] of Object.entries(CUSTOM_ORDER_STATUS)) {
  assert.ok(value.label && value.detail && value.tone,key);
  assert.notEqual(customOrderStatus(key).label,'Status unavailable',key);
}
assert.equal(customOrderStatus('received').label,'Received');
assert.equal(customOrderStatus('reviewing').label,'In review');
assert.equal(customOrderStatus('ready_pickup').tone,'success');
assert.equal(customOrderStatus('cancelled').tone,'critical');
assert.equal(customOrderStatus('unknown').label,'Status unavailable',
  'Unknown backend statuses must never be fabricated as complete.');
assert.equal(customOrderTitle({items:[]}), 'Personalized Custom Order');
assert.equal(customOrderTitle(undefined), 'Personalized Custom Order');
assert.equal(customOrderTitle({items:[{title:'Pinata',quantity:1}]}),'Pinata');
assert.equal(customOrderTitle({items:[{title:'Pinata',quantity:1},
  {title:'Stickers',quantity:2}]}),'Pinata + 1 more item');
assert.equal(customOrderTitle({items:[{title:'Pinata',quantity:1},
  {title:'Stickers',quantity:2},{title:'Banner',quantity:1}]}),
  'Pinata + 2 more items');
const ownedWorkRequest='jill:92b32355-900e-47ba-8946-ccd93190a3b7';
assert.equal(customOrderShortId(ownedWorkRequest),'#3190A3B7');
assert.equal(customOrderShortId(ownedWorkRequest),
  '#'+requestShortId(ownedWorkRequest),
  'My JILL and Owner HQ must show the SAME reference for an owned request.');
const syntheticWorkRequest='jill:qa:owned-111';
assert.equal(customOrderShortId(syntheticWorkRequest),
  '#'+requestShortId(syntheticWorkRequest),
  'QA request labels must stay consistent across merchant and customer views.');
assert.equal(customOrderShortId(''), 'JILL request');
assert.equal(customOrderDateOnly('2026-10-30'),'Oct 30, 2026');
assert.equal(customOrderDateOnly('2026-02-30'),'Date unavailable');
assert.equal(customOrderDateOnly('not-a-date'),'Date unavailable');
assert.equal(customOrderDateTime('bad'),'Date unavailable');
assert.match(customOrderDateTime('2026-10-13T21:13:57.364Z'),/Oct 13, 2026/);
assert.equal(customOrderFulfillment('pickup'),'Jacksonville pickup');
assert.equal(customOrderFulfillment('shipping'),'Shipping');
assert.equal(customOrderFulfillment(''),'Not selected');

const root='extensions/jill-account-dashboard/src/';
const screen=readFileSync(root+'pages/CustomOrders.jsx','utf8');
const hub=readFileSync(root+'hub/AccountHub.jsx','utf8');
const overview=readFileSync(root+'pages/Overview.jsx','utf8');
for (const expected of [
  'loadWorkCustomerCustomOrders({sessionToken})','customOrderStatus(order.status)',
  'order.timeline.map','order.summary','Refresh updates','Tracking history',
  'No requests to show yet','signed-in account','Try again',
]) assert.ok(screen.includes(expected),'Missing visual/identity contract: '+expected);
assert.match(screen,/current\.tone/);
assert.match(screen,/summary\.date_needed/);
assert.match(screen,/summary\.items\.map/);
assert.match(screen,/order\.submission_id/);
assert.match(hub,/HUB_ROUTES\.map/);
assert.match(hub,/navigation\.navigate\(extensionRoute\(id\)\)/);
assert.match(overview,/Custom Orders/);
for(const [path,source] of [['CustomOrders',screen],['AccountHub',hub]]) {
  assert.doesNotMatch(source,/style=|<style\b|!important|MutationObserver/,
    path+': no storefront CSS or observer patches inside Shopify extension.');
  assert.doesNotMatch(source,/owner_gid|customer_id\s*=|metafieldsSet|discountCodeBasicCreate/,
    path+': identity and privileged writes remain in verified services.');
  assert.doesNotMatch(source,/jillonlinestore\.com|jqtdgr-1y\.myshopify\.com/,
    path+': no LIVE storefront target in WORK UI.');
}
console.log('My JILL WORK polish: public status labels, dates, privacy boundary, honest pending pages, and Shopify-native layout verified.');
