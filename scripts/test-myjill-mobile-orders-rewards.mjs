// My JILL — source-only compact Custom Orders and Rewards UX acceptance.
// No customer auth inference, provider traffic, reward redemption or writes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MYJILL_ORDER_FILTERS,projectMyJillOrderActivity,
 selectMyJillOrderIds,searchVerifiedMyJillOrders}
 from '../extensions/jill-account-dashboard/src/pages/myjill-order-activity.mjs';
import {customOrderRequestedQuantity}
 from '../extensions/jill-account-dashboard/src/pages/custom-order-presentation.mjs';

const ROOT='extensions/jill-account-dashboard/src/';
const id=n=>'jill:fixture:request:'+String(n).padStart(8,'0');
const timestamp=n=>new Date(1792800000000+n*1000).toISOString();
const row=(n,status,ms=n)=>({
 submission_id:id(n),revision:n,status,updated_at:timestamp(ms),
 customer_gid:'PRIVATE_OWNER',customer_email:'PRIVATE_EMAIL',
 private_notes:'PRIVATE_NOTES',amount_paid:'PRIVATE_AMOUNT',
});
const orders=[
 row(1,'received'),row(2,'reviewing'),row(3,'awaiting_approval'),
 row(4,'in_production'),row(5,'ready_pickup'),row(6,'on_hold'),
 row(7,'completed'),row(8,'cancelled'),
];
assert.equal(customOrderRequestedQuantity({items:[{quantity:1},{quantity:4}]}),5);
assert.equal(customOrderRequestedQuantity({items:[{quantity:999}]}),999);
assert.equal(customOrderRequestedQuantity({items:[]}),null);
assert.equal(customOrderRequestedQuantity({items:[{quantity:0}]}),null);
assert.equal(customOrderRequestedQuantity({items:[{quantity:'2'}]}),null);
assert.equal(customOrderRequestedQuantity({items:[{quantity:1.5}]}),null);
assert.equal(customOrderRequestedQuantity({items:[{quantity:1000}]}),null);
assert.equal(customOrderRequestedQuantity(null),null);
assert.equal(customOrderRequestedQuantity({items:Array(21).fill({quantity:1})}),null);
const summary=projectMyJillOrderActivity(orders);
assert.equal(summary.total,8);
assert.equal(summary.active,6);
assert.equal(summary.finished,2);
assert.equal(summary.awaiting_approval,1);
assert.equal(summary.ready_pickup,1);
assert.deepEqual(summary.all_ids,orders.slice().reverse().map(x=>x.submission_id));
assert.deepEqual(summary.active_ids,orders.slice(0,6).reverse().map(x=>x.submission_id));
assert.deepEqual(summary.finished_ids,[id(8),id(7)]);
assert.deepEqual(selectMyJillOrderIds(summary,'active'),summary.active_ids);
assert.deepEqual(selectMyJillOrderIds(summary,'finished'),summary.finished_ids);
assert.deepEqual(selectMyJillOrderIds(summary,'all'),summary.all_ids);
assert.deepEqual(selectMyJillOrderIds(summary,'malformed'),[]);
assert.equal(Object.isFrozen(summary),true);
assert.equal(Object.isFrozen(summary.all_ids),true);
assert.equal(JSON.stringify(summary).includes('PRIVATE_'),false);
const signedOrders=orders.map((entry,i)=>({
 ...entry,summary:{items:[{title:i===0?'Sesame Street Pinata':
   i===1?'DTF Hoodie':'Paint your tote'}]},
}));
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'all','SESAME'),[id(1)]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'active','hoodie'),[id(2)]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'finished','tote'),
 [id(8),id(7)]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'active','tote'),
 [id(6),id(5),id(4),id(3)]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'all','#'+id(3).slice(-8)),[id(3)]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'finished','hoodie'),[]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'all','   '),summary.all_ids);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'all','PRIVATE_EMAIL'),[]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders.slice(1),'all','tote'),[]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,[...signedOrders.slice(0,7),
 {...signedOrders[7],submission_id:'jill:foreign:99999999'}],'all','tote'),[]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'weird','tote'),[]);
assert.deepEqual(searchVerifiedMyJillOrders(summary,signedOrders,'all','x'.repeat(81)),[]);
assert.equal(Object.isFrozen(searchVerifiedMyJillOrders(summary,signedOrders,'all','tote')),true);
// A previously selected product filter can hide a later Home deep-link.
// After *signed ownership verification*, clearing both UI filters restores it.
const target=id(7);
assert.equal(searchVerifiedMyJillOrders(summary,signedOrders,'active','hoodie')
 .includes(target),false);
assert.equal(searchVerifiedMyJillOrders(summary,signedOrders,'all','')
 .includes(target),true);
const unowned='jill:foreign:99999999';
assert.equal(summary.all_ids.includes(unowned),false);
assert.equal(searchVerifiedMyJillOrders(summary,signedOrders,'all','')
 .includes(unowned),false);
assert.equal(projectMyJillOrderActivity([]).total,0);
const ties=projectMyJillOrderActivity([
 row(1,'received',5),row(2,'completed',5),
]);
assert.deepEqual(ties.all_ids,[id(1),id(2)],
 'Equal timestamps must use canonical stable IDs');
for(const invalid of [
 null,{},Array(21).fill(row(1,'received')),
 [row(1,'received'),row(1,'received')],
 [row(1,'paid')],[row(1,'delivered')],
 [{...row(1,'received'),revision:0}],
 [{...row(1,'received'),updated_at:'bad-date'}],
 [{...row(1,'received'),submission_id:'not-id'}],
]){
 assert.throws(()=>projectMyJillOrderActivity(invalid),
 /myjill_order_activity_unverified/);
}

const page=readFileSync(ROOT+'pages/CustomOrders.jsx','utf8');
const home=readFileSync(ROOT+'pages/Overview.jsx','utf8');
const recent=readFileSync(ROOT+'pages/RecentRequests.jsx','utf8');
const hub=readFileSync(ROOT+'hub/AccountHub.jsx','utf8');
const rewards=readFileSync(ROOT+'pages/Rewards.jsx','utf8');
const canonical=readFileSync(ROOT+'rewards/RewardsCard.jsx','utf8');
const canary=readFileSync('scripts/prepare-account-hub-canary.mjs','utf8');
for(const filter of MYJILL_ORDER_FILTERS){
 assert.ok(page.includes('MYJILL_ORDER_FILTERS'));
 assert.ok(['all','active','finished'].includes(filter.id));
}
assert.match(page,/projectMyJillOrderActivity\(orders\)/);
assert.match(page,/searchVerifiedMyJillOrders\(state\.activity,state\.orders,filter,searchQuery\)/);
assert.match(page,/<s-text-field label="Find a Custom Order"/);
assert.match(page,/maxLength=\{80\}/);
assert.match(page,/onInput=\{event=>setSearchQuery\(event\.currentTarget\.value\)\}/);
assert.match(page,/Clear search/);
assert.match(page,/No verified Custom Orders match your search or filter/);
assert.match(page,/visibleOrders\.map\(\(order\)=>/);
assert.match(page,/View tracking & details/);
assert.match(page,/customOrderRequestedQuantity\(summary\)/);
assert.match(page,/\{summary\.items\.length\} \{summary\.items\.length===1\?'item type':'item types'\}/);
assert.match(page,/Qty \{requestedQuantity\}/);
assert.match(page,/Needed by \{customOrderDateOnly\(summary\.date_needed\)\}/);
assert.match(page,/customOrderFulfillment\(summary\.fulfillment\)/);
assert.match(page,/requestedQuantity!==null/);
assert.match(page,/\(requestedQuantity!==null\|\|summary\.date_needed\|\|summary\.fulfillment\)/);
assert.match(page,/\{summary\.date_needed&&\s*<s-text color="subdued">/);
assert.match(page,/\{summary\.fulfillment&&\s*<s-text color="subdued">/);
assert.match(page,/\{requestedQuantity!==null&&\s*<s-text color="subdued">/);
assert.match(page,/Hide tracking & details/);
assert.match(page,/expandedIds\[order\.submission_id\] &&/);
assert.match(page,/RequestConversation order=\{order\}/);
assert.match(page,/onNavigate\('messages',\{/);
assert.match(page,/Message delivery needs verification/);
assert.match(page,/awaiting approval/);
assert.match(page,/marked ready for pickup/);
assert.match(page,/Counts reflect confirmed request statuses/);
assert.match(page,/orders\.some\(order=>order\.submission_id===requestedSubmissionId\)/);
assert.match(page,/if\(ownedTarget\)\{\s*setFilter\('all'\);\s*setSearchQuery\(''\);\s*\}/);
assert.match(page,/orders\.some\(order=>order\.submission_id===requestedSubmissionId\)/);
assert.match(page,/setExpandedIds\(ownedTarget\?\{\[ownedTarget\]:true\}:\{\}\)/);
assert.match(page,/\[attempt,requestedSubmissionId\]/);
assert.match(recent,/onNavigate\('custom-orders',\{/);
assert.match(hub,/customOrderTarget,setCustomOrderTarget/);
assert.match(hub,/requestedSubmissionId=\{customOrderTarget\}/);
assert.match(hub,/setCustomOrderTarget\(id==='custom-orders'/);
assert.match(page,/setState\(\{status:'error',orders:\[\],activity:null,replyEnabled:false\}\)/);
assert.match(page,/retainOwnedMessageDrafts\(previous,orders\)/);
assert.match(page,/updateOwnedMessageDraft\(previous,order\.submission_id,change,meta\)/);
assert.match(home,/gridTemplateColumns="minmax\(0, 1fr\)"/);
assert.match(page,/gridTemplateColumns="minmax\(0, 1fr\)"/);
assert.doesNotMatch(home+page,/gridTemplateColumns="repeat\(2,/);
assert.match(rewards,/Your JILL Rewards/);
assert.match(rewards,/How your rewards work/);
assert.match(rewards,/onNavigate\('coupons'\)/);
assert.match(rewards,/onNavigate\('custom-orders'\)/);
assert.match(rewards,/RewardsCard customer=\{customer\}/);
assert.match(canonical,/buildRewardJourney/);
assert.match(canonical,/rewardRequestOutcome/);
assert.match(canonical,/REWARD_COUPON_POLICY/);
assert.doesNotMatch(rewards,/requestReward\(|discountCodeBasicCreate|metafieldsSet/);
assert.doesNotMatch(page+rewards+home+hub,
/localStorage|sessionStorage|document\.cookie|logged_in_customer_id/);
assert.ok(canary.includes("'custom-order-presentation.mjs'"));
assert.ok(canary.includes("'myjill-order-activity.mjs'"));
console.log('PASS: Mobile-first My JILL verified quantity/date/fulfillment, orders and rewards: canonical status-only counts, stable filters, signed exact request targeting, expandable histories, one-column cards and untouched Rewards redemption.');
