// My JILL WORK visual hierarchy guard — native Shopify components only.
// No synthetic PII, network reads, dynamic CSS, app publication or mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HUB_ROUTES,extensionRoute,canonicalRoute}
 from '../extensions/jill-account-dashboard/src/hub/routes.mjs';
import {customOrderStatus,CUSTOM_ORDER_STATUS}
 from '../extensions/jill-account-dashboard/src/pages/custom-order-presentation.mjs';
const path='extensions/jill-account-dashboard/src/';
const hub=readFileSync(path+'hub/AccountHub.jsx','utf8');
const home=readFileSync(path+'pages/Overview.jsx','utf8');
const recent=readFileSync(path+'pages/RecentRequests.jsx','utf8');
const messages=readFileSync(path+'pages/Messages.jsx','utf8');
const canary=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');

assert.equal(HUB_ROUTES.length,9);
assert.equal(new Set(HUB_ROUTES.map(item=>item.id)).size,9);
for(const route of HUB_ROUTES){
 assert.equal(canonicalRoute(route.id),route.id);
 assert.equal(extensionRoute(route.id),'extension://'+route.path);
}
assert.match(hub,/<s-select label="Jump to a My JILL section"/);
assert.match(hub,/value=\{activeRoute\}/);
assert.match(hub,/onChange=\{event=>onNavigate\(event\.currentTarget\.value\)\}/);
assert.match(hub,/HUB_ROUTES\.map\(item=>/);
assert.match(hub,/<s-option key=\{item\.id\} value=\{item\.id\}>/);
assert.match(hub,/onNavigate\('overview'\)/);
assert.match(hub,/onNavigate\('custom-orders'\)/);
assert.match(hub,/onNavigate\('messages'\)/);
assert.match(hub,/GROUPS\.find/);
assert.match(hub,/NAV_GROUP\[activeRoute\]/);
assert.match(hub,/const guardedScreen=accountState\?\.status==='ready'\?screen:null/);
assert.match(hub,/\{guardedScreen\}/);
assert.match(hub,/navigation\.navigate\(extensionRoute\(id\)\)/);
assert.match(hub,/'contact-requests': <ContactRequests enabled=\{false\}/);
assert.doesNotMatch(hub,/<s-button key=\{item\.id\}/,
 'Replace the old nine-button toolbar, but preserve every route');

assert.match(home,/MY JILL/);
assert.match(home,/Your celebration corner/);
assert.match(home,/Welcome back\{name\}/);
assert.match(home,/Pick up where you left off/);
assert.match(home,/A little extra for you/);
assert.match(home,/More ways to celebrate/);
const order=[
 home.indexOf('Your celebration corner'),
 home.indexOf('Pick up where you left off'),
 home.indexOf('A little extra for you'),
 home.indexOf('More ways to celebrate'),
];
assert.ok(order.every((position,index)=>position>=0&&
 (index===0||position>order[index-1])),
 'Customer visual hierarchy must read hero -> history -> rewards -> future');
assert.match(home,/points===null\?'Not available'/);
assert.match(home,/Rewards wallet is checked/);
assert.match(home,/<RecentRequests onNavigate=\{onNavigate\}/);
assert.match(home,/shopify:customer-account\/orders/);
assert.match(home,/shopify:customer-account\/profile/);
assert.match(home,/Not connected yet/);
assert.match(home,/Coming later/);
assert.match(home,/gridTemplateColumns="minmax\(0, 1fr\)"/);
assert.doesNotMatch(home,/repeat\(2,/);

assert.match(recent,/projectMyJillRecentRequests\(orders\)/);
assert.match(recent,/customOrderStatus\(item\.status\)/);
assert.match(recent,/\{status\.detail\}/);
assert.match(recent,/<s-badge tone=\{status\.tone\}>/);
assert.match(recent,/onNavigate\('custom-orders',\{/);
assert.match(recent,/onNavigate\('messages',\{/);
assert.match(recent,/loadWorkCustomerConversationState\(\{sessionToken,signal:controller\.signal\}\)/);
for(const status of Object.keys(CUSTOM_ORDER_STATUS)){
 const s=customOrderStatus(status);
 assert.equal(typeof s.detail,'string');
 assert.ok(s.detail.length>=12);
 assert.equal(typeof s.label,'string');
}
assert.match(messages,/visibleConversation\?\.messages\.map\(event=>/);
assert.match(messages,/event\.author==='customer'\?'You':'JILL'/);
assert.match(messages,/background=\{event\.author==='customer'\?'subdued':'base'\}/);
assert.match(messages,/tone=\{event\.author==='customer'\?'info':'neutral'\}/);
assert.match(messages,/RequestConversation order=\{order\}/);
assert.match(messages,/selectOwnedMessageRequest\\(visibleInbox,\\{/);
assert.match(messages,/filterOwnedMessageThreads\\(inbox,filter\\)/);
assert.match(messages,/onDraftsChange\(previous=>\s*updateOwnedMessageDraft/);

for(const src of [hub,home,recent,messages]){
 assert.doesNotMatch(src,/localStorage|sessionStorage|document\.cookie/);
 assert.doesNotMatch(src,/http:\/\/|https:\/\//);
 assert.doesNotMatch(src,/metafieldsSet|discountCodeBasicCreate|draftOrderCreate/);
 assert.doesNotMatch(src,/<style|style=\{|<img|<iframe/);
}
assert.ok(canary.includes("'Overview.jsx'"));
assert.ok(canary.includes("'RecentRequests.jsx'"));
assert.ok(canary.includes("'Messages.jsx'"));
console.log('PASS My JILL visual polish: native compact nine-route navigation, verified welcome/activity/rewards hierarchy, customer/JILL message clarity, account/session security unchanged; source only.');
