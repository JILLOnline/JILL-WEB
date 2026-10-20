// OFFLINE bridge between EXISTING verified draft/Owner source and native
// Shopify calculation. Synthetic data only. NO SDK or DB/network calls.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectWorkQuoteCommerceHandoff as inspect}
  from '../services/jill-order-desk/work-quote-commerce-handoff.mjs';
import {prepareWorkQuoteCalculation}
  from '../services/jill-order-desk/work-quote-calculation.mjs';
import {mapSimpleWorkItemPersonalization,decodeSimpleWorkItemPersonalization}
  from '../services/jill-order-desk/work-quote-personalization-map.mjs';

const ID='jill:synthetic-request-00000001';
const baseItem={item_id:'item:synthetic-1',title:'Synthetic favor kit',
  variant_id:'gid://shopify/ProductVariant/111',
  quantity:2,attributes:[],variant_allocations:[],
  personalization_groups:[],reference_ids:[]};
const detail={submission_id:ID,revision:3,items:[baseItem],
  planning:{fulfillment:'shipping',attributes:[]},
  request_attributes:[],reference_ids:[]};
const fees={materials:'0.00',labor:'0.00',shipping:'5.00',
  other:'0.00',discount:'0.00',tax:'0.00'};
const draft={state:'ready',submission_id:ID,source_revision:3,
  draft_revision:1,estimated_total_cents:5200,
  lines:[{id:baseItem.item_id,quantity:2,unitPrice:'23.50'}],fees};
const addr={address1:'1 Synthetic Avenue',address2:'',
  city:'Jacksonville',provinceCode:'FL',zip:'32218',countryCode:'US',
  firstName:'Synthetic',lastName:'Customer'};
const args={submissionId:ID,detail,draft,
  customerGid:'gid://shopify/Customer/111',address:addr,
  shippingTitle:'Approved standard shipping'};
const get=changes=>inspect({...args,...changes});
const allowed=get({});
assert.equal(allowed.state,'ready_for_shopify_calculation');
assert.equal(allowed.reason,null);
assert.equal(allowed.needs_native_tax_and_total_verification,true);
assert.equal(allowed.can_publish,false);
assert.equal(allowed.can_invoice,false);
assert.equal(allowed.can_create_order,false);
assert.equal(allowed.calculation_intent.lines[0].unit_price_cents,2350);
assert.equal(allowed.calculation_intent.lines[0].quantity,2);
assert.equal(allowed.calculation_intent.shipping.amount_cents,500);
assert.deepEqual(allowed.calculation_intent.address,addr);
assert.equal(allowed.calculation_intent.reward,null);
assert.equal(prepareWorkQuoteCalculation(allowed.calculation_intent)
  .variables.input.lineItems[0].priceOverride.amount,'23.50');
const clone=obj=>structuredClone(obj);
function held(reason,changes){
  const output=get(changes);
  assert.equal(output.state,'held',reason);
  assert.equal(output.reason,reason);
  assert.equal(output.calculation_intent,null);
  for(const k of ['can_publish','can_invoice','can_create_order'])
    assert.equal(output[k],false);
  assert.deepEqual(Object.keys(output).sort(),
    ['state','reason','calculation_intent','can_publish',
      'can_invoice','can_create_order'].sort());
}
held('canonical_source_unverified',{submissionId:'jill:different-id'});
held('canonical_source_unverified',{detail:{...detail,submission_id:'wrong-id'}});
held('verified_draft_unavailable_or_stale',{draft:{...draft,source_revision:2}});
held('verified_draft_unavailable_or_stale',{draft:{...draft,estimated_total_cents:0}});
held('verified_draft_unavailable_or_stale',{draft:{...draft,state:'unknown'}});
held('shopify_customer_unverified',{customerGid:'customer@example.invalid'});
held('fulfillment_unverified',{detail:{...detail,planning:{...detail.planning,fulfillment:'deliver'}}});
held('native_line_limit',{detail:{...detail,items:Array.from({length:21},(_,i)=>({
  ...baseItem,item_id:'item:syn-'+i,variant_id:'gid://shopify/ProductVariant/'+(i+111),
}))}});
held('variant_or_personalization_requires_review',{detail:{...detail,items:[
  {...baseItem,variant_id:'not-a-Shopify-variant'}]}});
const itemWide=[{id:'theme',label:'Party theme',value:'Océano y sirenas'},
  {id:'name',label:'Name',value:'Lucía'},
  {id:'pull_string',label:'Pull-string?',value:true},
  {id:'colors',label:'Colors',value:['red','purple']}];
const originalWithOptions={...baseItem,attributes:itemWide};
const customization=get({detail:{...detail,items:[originalWithOptions]}});
assert.equal(customization.state,'ready_for_shopify_calculation');
const options=customization.calculation_intent.lines[0].options;
assert.match(options,/^JILL:v1:/);
assert.deepEqual(decodeSimpleWorkItemPersonalization(options),itemWide);
const native=prepareWorkQuoteCalculation(customization.calculation_intent);
assert.deepEqual(native.variables.input.lineItems[0].customAttributes,
  [{key:'JILL personalization',value:options}]);
assert.equal(native.variables.input.lineItems[0].priceOverride.amount,'23.50');
assert.equal(mapSimpleWorkItemPersonalization({
  ...baseItem,attributes:[]}).options,'');
const enc=mapSimpleWorkItemPersonalization(originalWithOptions);
assert.equal(enc.options,options);
for(const changed of [
  [{id:'a',label:'',value:'X'},{id:'a',label:'',value:'Y'}],
  [{id:'a',label:'',value:{untrusted:'x'}}],
  [{id:'a',label:'',value:'a'.repeat(501)}],
  [{id:'a',label:'X'+String.fromCharCode(10)+'Y',value:'foo'}],
  [{id:'a',label:'',value:['a',...Array(12).fill('b')]}],
  [{id:'a',label:'',value:1.5}],
]){
  assert.equal(mapSimpleWorkItemPersonalization({
    ...baseItem,attributes:changed}).state,'held');
}
for(const bad of ['JILL:v1:[]','JILL:v1:[["a","",1.2]]',
  'JILL:v1:[["a","",true],["a","",false]]','JILL:v1:malformed']){
  assert.throws(()=>decodeSimpleWorkItemPersonalization(bad));
}
held('unverified_item_personalization',{detail:{...detail,items:[
  {...baseItem,attributes:[{id:'a',label:'',value:{opaque:'X'}}]}]}});
held('personalization_exceeds_native_limit',{detail:{...detail,items:[
  {...baseItem,attributes:[{id:'a',label:'Options',value:'x'.repeat(200)},
    {id:'b',label:'Options',value:'y'.repeat(200)},
    {id:'c',label:'Options',value:'z'.repeat(200)}]}]}});
held('per_unit_or_reference_mapping_required',{detail:{...detail,items:[
  {...baseItem,personalization_groups:[{id:'P1',attributes:[]}]}]}});
held('per_unit_or_reference_mapping_required',{detail:{...detail,items:[
  {...baseItem,reference_ids:['ref:1']}]}});
held('unmapped_order_instructions',{detail:{...detail,
  request_attributes:[{id:'notes',value:'Gift wrap'}]}});
held('unmapped_order_instructions',{detail:{...detail,
  planning:{...detail.planning,attributes:[{id:'event',value:'Under sea'}]}}});
held('variant_allocations_require_review',{detail:{...detail,items:[
  {...baseItem,variant_allocations:[{variant_id:baseItem.variant_id,
    quantity:1}]}]}});
held('custom_fee_lines_not_mapped',{draft:{...draft,
  fees:{...fees,materials:'2.00'},estimated_total_cents:5400}});
held('manual_tax_must_be_recalculated',{draft:{...draft,
  fees:{...fees,tax:'1.00'},estimated_total_cents:5300}});
held('discount_authorization_required',{draft:{...draft,
  fees:{...fees,discount:'1.00'},estimated_total_cents:5100}});
held('shipping_service_not_approved',{shippingTitle:''});
held('full_address_required',{address:null});
held('native_quote_input_unverified',{address:{...addr,countryCode:'???'}});
const pickupDetail={...detail,planning:{...detail.planning,fulfillment:'pickup'}};
held('pickup_shipping_inconsistent',{detail:pickupDetail});
const pickupDraft={...draft,fees:{...fees,shipping:'0.00'},estimated_total_cents:4700};
const pickup=get({detail:pickupDetail,draft:pickupDraft,shippingTitle:'Store pickup'});
assert.equal(pickup.state,'ready_for_shopify_calculation');
assert.equal(pickup.calculation_intent.shipping.amount_cents,0);
// Ensure the bridge has no network calls, database writes, invoices,
// mutations, authentication bypasses, or printing of customer/private data.
const src=readFileSync('services/jill-order-desk/work-quote-commerce-handoff.mjs','utf8');
for(const forbidden of [/fetch\(/,/graphql\(/,/draftOrderCreate/,/draftOrderInvoiceSend/,
  /db\.prepare/,/console\./,/localStorage/,/sessionStorage/,/process\.env/])
  assert.doesNotMatch(src,forbidden);
assert.match(src,/hydrateVerifiedWorkQuoteWorksheet/);
assert.match(src,/mapSimpleWorkItemPersonalization/);
assert.match(src,/prepareWorkQuoteCalculation/);
assert.doesNotMatch(src,/customer\.email|return new Response/);
console.log('PASS WORK quote handoff: lossless bounded item-wide customizations to native Shopify customAttribute, verified draft prices; complex P1/P2, references, fees/tax/discount/address held; no invoice/create/network.');
