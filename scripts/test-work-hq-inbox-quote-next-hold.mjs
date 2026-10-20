import assert from 'node:assert/strict';
import {inspectWorkQuoteUnitLinePlan,decodeReviewOnlyWorkUnitOptions}
  from '../services/jill-order-desk/work-quote-unit-line-plan.mjs';
import {reconcileOwnerRequestThread,compareOwnedAndMerchantThreads}
  from '../shared/work-conversation-inbox-policy.mjs';

const id='jill:11111111-2222-4333-8444-555555555555';
const at='2026-10-20T18:00:00Z';
const item={item_id:'pinata-1',quantity:2,
  variant_id:'gid://shopify/ProductVariant/102',
  variant_allocations:[{variant_id:'gid://shopify/ProductVariant/102',
    quantity:2,unit_ids:['P1','P2']}],
  reference_ids:[],attributes:[{id:'theme',label:'Theme',value:'Ocean'}],
  personalization_groups:[
    {id:'G1',allocations:[{unit_id:'P1'}],attributes:[
      {id:'name',label:'Name',value:'Jacob'}]},
    {id:'G2',allocations:[{unit_id:'P2'}],attributes:[
      {id:'name',label:'Name',value:'Ian'}]},
  ],
};
const detail={submission_id:id,revision:2,items:[item]};
const lines=[{id:'pinata-1',quantity:2,unitPrice:'70.00'}];
const check=inspectWorkQuoteUnitLinePlan({detail,lines});
assert.equal(check.state,'review_only');
assert.equal(check.unit_count,2);
assert.equal(check.variant_count,1);
assert.equal(check.can_publish,false);
assert.equal(check.can_invoice,false);
assert.equal(check.can_create_order,false);
assert.deepEqual(check.units.map(x=>x.group_id),['G1','G2']);
assert.deepEqual(check.units.map(x=>x.unit_id),['P1','P2']);
assert.deepEqual(check.units.map(x=>x.unit_price_cents),[7000,7000]);
assert.deepEqual(check.units.map(x=>decodeReviewOnlyWorkUnitOptions(x.options)
  .personalization[0][2]),['Jacob','Ian']);
assert.equal(check.units[0].variant_id,check.units[1].variant_id,
  'Duplicate variants remain visible; no unsafe native variant Map');
assert.equal(inspectWorkQuoteUnitLinePlan({detail:{...detail,items:[{
  ...item,variant_allocations:[],
}]},lines}).reason,'missing_original_unit_ids');
assert.equal(inspectWorkQuoteUnitLinePlan({detail:{...detail,items:[{
  ...item,reference_ids:['private-1'],
}]},lines}).reason,'unit_or_private_media_unverified');
assert.equal(inspectWorkQuoteUnitLinePlan({detail:{...detail,items:[{
  ...item,variant_allocations:[{...item.variant_allocations[0],variant_id:'456'}]
}]},lines}).reason,'variant_allocations_invalid');
assert.equal(inspectWorkQuoteUnitLinePlan({detail:{...detail,items:[{
  ...item,personalization_groups:[{...item.personalization_groups[0]},
    {...item.personalization_groups[1],allocations:[{unit_id:'P1'}]}]
}]},lines}).reason,'personalization_assignment_conflict');
assert.equal(inspectWorkQuoteUnitLinePlan({detail:{...detail,items:[{
  ...item,personalization_groups:[item.personalization_groups[0]]
}]},lines}).reason,'personalization_units_unassigned');
assert.equal(inspectWorkQuoteUnitLinePlan({detail,lines:[{...lines[0],unitPrice:'-1.00'}]}).reason,
 'verified_price_required');
assert.throws(()=>decodeReviewOnlyWorkUnitOptions('JILL:unit:v1:{}'),/invalid_work_unit_options/);
assert.throws(()=>decodeReviewOnlyWorkUnitOptions(check.units[0].options+' '),/invalid_work_unit_options/);

const base={submission_id:id,revision:3,status:'reviewing',timeline_version:2,
  updated_at:at,timeline:[
    {revision:1,kind:'status',author:'system',status:'received',
      note:'Request received',occurred_at:'2026-10-20T16:00:00Z'},
    {revision:2,kind:'merchant_message',author:'jill',status:'reviewing',
      note:'What color?',occurred_at:'2026-10-20T17:00:00Z'},
    {revision:3,kind:'customer_reply',author:'customer',status:'reviewing',
      note:'Purple',occurred_at:at},
  ]};
const record={submission_id:id,revision:3};
const sync=reconcileOwnerRequestThread({authorizedRequest:record,thread:base});
assert.equal(sync.state,'verified');
assert.equal(sync.conversation.messages.length,2);
assert.equal(sync.unread_count,null);
assert.equal(sync.delivery_verified,false);
assert.equal(compareOwnedAndMerchantThreads({merchant:base,customer:structuredClone(base)}).identical,true);
const stale=reconcileOwnerRequestThread({authorizedRequest:{...record,revision:4},thread:base});
assert.equal(stale.state,'thread_snapshot_stale');
assert.equal(stale.conversation,null);
assert.equal(reconcileOwnerRequestThread({authorizedRequest:record,
  thread:{...base,submission_id:'jill:22222222-3333-4444-8555-666666666666'}}).state,
  'thread_identity_mismatch');
assert.equal(reconcileOwnerRequestThread({authorizedRequest:record,
  thread:{...base,timeline:base.timeline.map(e=>e.kind==='customer_reply'?
    {...e,author:'jill'}:e)}}).state,'thread_unverified');
assert.equal(compareOwnedAndMerchantThreads({merchant:base,
  customer:{...base,revision:4}}).state,'revision_not_synchronized');
assert.equal(compareOwnedAndMerchantThreads({merchant:base,
  customer:{...base,timeline:base.timeline.map(e=>e.kind==='customer_reply'?
    {...e,note:'RED'}:e)}}).state,'public_thread_mismatch');
console.log('PASS: Two-unit P1/P2 quote retains reversible options and holds invoice; HQ/My JILL common public thread, stale and cross-request denials; no unread or delivery claims.');
