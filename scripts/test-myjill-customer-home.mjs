// JILL WORK My JILL customer-home source guard — no real customer data.
// Verify signed recent activity, route grouping and Shopify-native navigation.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HUB_ROUTES,canonicalRoute,extensionRoute}
 from '../extensions/jill-account-dashboard/src/hub/routes.mjs';
import {projectMyJillRecentRequests}
 from '../extensions/jill-account-dashboard/src/pages/myjill-recent-requests.mjs';

const ROOT='extensions/jill-account-dashboard/src/';
const id=n=>'jill:fixture:request:'+String(n).padStart(8,'0');
const at=n=>new Date(1792800000000+n*1000).toISOString();
const row=(n,status='reviewing')=>({
 submission_id:id(n),revision:n,status,updated_at:at(n),
 summary:{items:[{title:'Birthday piñata '+n,quantity:1}]},
 customer_email:'PRIVATE_EMAIL',owner_customer_gid:'PRIVATE_CUSTOMER_GID',
 timeline:[{note:'PRIVATE_TIMELINE'}],internal_cost:'PRIVATE_COST',
});
const source=[row(1,'received'),row(3,'reviewing'),row(2,'completed')];
const result=projectMyJillRecentRequests(source);
assert.equal(result.total,3);
assert.deepEqual(result.recent.map(x=>x.submission_id),[id(3),id(2),id(1)]);
assert.equal(result.recent[0].title,'Birthday piñata 3');
assert.equal(Object.isFrozen(result),true);
assert.equal(Object.isFrozen(result.recent),true);
assert.equal(Object.isFrozen(result.recent[0]),true);
assert.equal(JSON.stringify(result).includes('PRIVATE_'),false);
assert.equal(projectMyJillRecentRequests(source,{limit:2}).recent.length,2);
assert.equal(projectMyJillRecentRequests([]).total,0);
assert.equal(projectMyJillRecentRequests([row(1),row(2)],{limit:1}).recent.length,1);
for(const input of [
 [row(1),row(1)],
 [{...row(1),updated_at:'not-a-date'}],
 [{...row(1),status:'paid'}],
 [{...row(1),revision:0}],
 [{...row(1),submission_id:'unverified'}],
 [{...row(1),summary:{items:'not-verified'}}],
 Array(51).fill(row(1)),
]){
 assert.throws(()=>projectMyJillRecentRequests(input),
  /myjill_recent_requests_unverified/);
}
assert.throws(()=>projectMyJillRecentRequests(source,{limit:0}),
 /myjill_recent_requests_unverified/);
const hub=readFileSync(ROOT+'hub/AccountHub.jsx','utf8');
const home=readFileSync(ROOT+'pages/Overview.jsx','utf8');
const recent=readFileSync(ROOT+'pages/RecentRequests.jsx','utf8');
const canary=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
const rewards=readFileSync(ROOT+'pages/Rewards.jsx','utf8');
const coupons=readFileSync(ROOT+'pages/Coupons.jsx','utf8');
const messages=readFileSync(ROOT+'pages/Messages.jsx','utf8');
const orders=readFileSync(ROOT+'pages/CustomOrders.jsx','utf8');
assert.equal(HUB_ROUTES.length,9);
for(const route of HUB_ROUTES){
 assert.equal(canonicalRoute(route.id),route.id);
 assert.equal(extensionRoute(route.id),'extension://'+route.path);
}
for(const group of ['Your activity','Rewards & offers','Make it yours'])
 assert.ok(hub.includes(group));
assert.match(hub,/HUB_ROUTES\.map/);
assert.match(hub,/navigation\.navigate\(extensionRoute\(id\)\)/);
assert.match(hub,/currententrychange/);
assert.match(hub,/onDraftsChange=\{setConversationDrafts\}/);
assert.match(hub,/messages: <Messages requestedSubmissionId/);
assert.match(home,/import RecentRequests from '\.\/RecentRequests\.jsx'/);
assert.match(home,/<RecentRequests onNavigate=\{onNavigate\}/);
assert.match(home,/shopify:customer-account\/orders/);
assert.match(home,/shopify:customer-account\/profile/);
assert.match(home,/Not connected yet/);
assert.match(home,/Coming later/);
assert.match(home,/points===null\?'Not available'/);
assert.match(recent,/loadWorkCustomerConversationState\(\{sessionToken,signal:controller\.signal\}\)/);
assert.match(recent,/projectMyJillRecentRequests\(orders\)/);
assert.match(recent,/onNavigate\('messages',\{/);
assert.match(recent,/onNavigate\('custom-orders'\)/);
assert.doesNotMatch(recent,/onDraftsChange|sendWorkCustomerReply|metafieldsSet/);

for(const text of [hub,home,recent]){
 assert.doesNotMatch(text,/localStorage|sessionStorage|document\.cookie/);
 assert.doesNotMatch(text,/jillonlinestore\.com|jqtdgr-1y\.myshopify\.com/);
 assert.doesNotMatch(text,/shopify\.admin|Admin API|discountCodeBasicCreate|draftOrderCreate/);
}
assert.match(rewards,/RewardsCard/);
assert.match(coupons,/loadPersonalCoupons/);
assert.match(messages,/projectCustomerMessageInbox/);
assert.match(orders,/loadWorkCustomerConversationState/);
assert.ok(canary.includes("'RecentRequests.jsx'"));
assert.ok(canary.includes("'myjill-recent-requests.mjs'"));
console.log('PASS My JILL customer home: nine original routes, grouped navigation, signed account-only request activity, unknown rewards kept unknown, zero PII, original rewards/coupons/messages intact, no new writes or deployments.');
