import assert from 'node:assert/strict';
import {inspectWorkQuotePreflight} from '../services/jill-order-desk/work-quote-preflight-view.mjs';
import {verifiedMerchantMessageAcknowledgment} from '../shared/work-merchant-message-receipt.mjs';
import {projectVerifiedConversation} from '../shared/custom-order-conversation-view.mjs';

const id='jill:11111111-2222-4333-8444-555555555555';
const op='jill:hq:message:11111111-2222-4333-8444-555555555555';
const detail={submission_id:id,revision:3,items:[{
  item_id:'item-01',variant_id:'gid://shopify/ProductVariant/123',quantity:1,
  variant_allocations:[],personalization_groups:[],reference_ids:[],attributes:[],
}],planning:{fulfillment:'pickup',attributes:[]},reference_ids:[],request_attributes:[]};
const worksheet={state:'ready',estimatedTotalCents:2500,feesCents:{
  materials:0,labor:0,other:0,tax:0,discount:0,shipping:0,
}};
const summary=inspectWorkQuotePreflight({submissionId:id,detail,sourceRevision:3,worksheet});
assert.equal(summary.can_publish,false);
assert.equal(summary.can_invoice,false);
assert.equal(summary.can_create_order,false);
assert.equal(summary.checks.find(x=>x.id==='source').status,'clear');
assert.equal(summary.checks.find(x=>x.id==='variants').status,'verify');
const bad=inspectWorkQuotePreflight({submissionId:id,detail:{...detail,items:[{
  ...detail.items[0],variant_id:'456',personalization_groups:[{id:'P1'}],reference_ids:['asset-1'],
}]},sourceRevision:3,worksheet:{...worksheet,feesCents:{...worksheet.feesCents,labor:250}}});
for(const x of ['variants','personalization','charges'])
  assert.equal(bad.checks.find(s=>s.id===x).status,'hold');
assert.equal(inspectWorkQuotePreflight({submissionId:id,detail,sourceRevision:4,
  worksheet}).checks[0].status,'hold');
assert.equal(verifiedMerchantMessageAcknowledgment({result:{ok:true,
  operation_id:op,revision:4},previousRevision:3})?.revision,4);
for(const result of [{ok:false,operation_id:op,revision:4},
  {ok:true,operation_id:'jill:hq:status:'+op.split(':').at(-1),revision:4},
  {ok:true,operation_id:op,revision:3},
  {ok:true,operation_id:op,revision:101}])
  assert.equal(verifiedMerchantMessageAcknowledgment({result,previousRevision:3}),null);
const publicThread={submission_id:id,revision:4,status:'received',
  updated_at:'2026-10-20T14:30:00Z',timeline_version:2,timeline:[
    {revision:1,kind:'status',author:'system',note:'Received',occurred_at:'2026-10-20T12:00:00Z'},
    {revision:2,kind:'merchant_message',author:'jill',note:'Hello',occurred_at:'2026-10-20T13:00:00Z'},
    {revision:4,kind:'customer_reply',author:'customer',note:'Thanks!',occurred_at:'2026-10-20T14:00:00Z'},
  ]};
const projection=projectVerifiedConversation(publicThread);
assert.deepEqual(projection.messages.map(x=>x.author),['jill','customer']);
assert.equal(projection.last_message.note,'Thanks!');
assert.equal(projection.unread_count,null);
assert.equal(projection.delivery_verified,false);
assert.equal(JSON.stringify(projection).includes('Received'),false);
assert.throws(()=>projectVerifiedConversation({...publicThread,
 timeline:publicThread.timeline.map(e=>e.kind==='customer_reply'?{...e,author:'jill'}:e)}),
 /unverified_message_thread/);
const legacy=projectVerifiedConversation({submission_id:id,revision:1,
 updated_at:'2026-10-20T12:00:00Z',timeline:[{note:'Received'}]});
assert.equal(legacy.state,'legacy_status_only');
assert.equal(legacy.messages.length,0);
console.log('PASS WORK source-only quote readiness, strict message acknowledgment, shared HQ/My JILL timeline and no commerce or delivery claims.');
import {projectOwnedWorkQuotePreview} from '../shared/work-owned-quote-preview.mjs';
const hash='a'.repeat(64);
const readyOwned=projectOwnedWorkQuotePreview({state:'available',quote:{
  revision:1,hash,currency:'USD',expires_at_ms:1793000000000,
  fulfillment:'pickup',address:{address1:'PRIVATE CUSTOMER ADDRESS'},
  lines:[{variant_id:'gid://shopify/ProductVariant/123',quantity:2,
    subtotal_cents:5000,options:'JILL:v1:[]'}],totals:{items_cents:5000,
    shipping_cents:0,tax_cents:350,discount_cents:0,total_cents:5350},
}});
assert.equal(readyOwned.can_accept,false);
assert.equal(readyOwned.quote.totals.total_cents,5350);
assert.equal(JSON.stringify(readyOwned).includes('PRIVATE CUSTOMER ADDRESS'),false);
assert.equal(projectOwnedWorkQuotePreview({state:'no_quote',quote:null}).quote,null);
assert.throws(()=>projectOwnedWorkQuotePreview({state:'available',quote:{
  ...{revision:1,hash,currency:'USD',expires_at_ms:1793000000000,fulfillment:'pickup',
    lines:[{variant_id:'gid://shopify/ProductVariant/123',quantity:2,subtotal_cents:5000,options:''}],
    totals:{items_cents:5000,shipping_cents:0,tax_cents:350,discount_cents:0,total_cents:5000}},
}}),/unverified_owned_quote/);
console.log('PASS My JILL future read-only quote preview: exact USD totals, no PII, never executable approval.');
