import assert from 'node:assert/strict';
import {projectVerifiedWorkMerchantRequestDetail as project}
  from '../services/jill-order-desk/merchant-request-detail.mjs';

const source={
  version:1,operation:'custom_order.submit',
  submission_id:'jill:4590f589-3470-4954-a0f9-910587010f22',
  submitted_at:'2026-10-15T19:00:00.000Z',
  customer:{name:'JILL WORK QA',email:'test@example.invalid',phone:'',
    preferred_contact:'email'},
  planning:{date_needed:'2026-11-03',fulfillment:'shipping',
    address:{city:'Jacksonville',state:'FL',postal_code:'32218',country_code:'US'},
    attributes:[{id:'event_type',label:'Occasion',value:'Birthday'}]},
  items:[{
    item_id:'item-1',product_id:'shopify-product:123',
    variant_id:'shopify-variant:456',
    variant_allocations:[{variant_id:'456',title:'Pink',quantity:2,
      unit_ids:['unit-1','unit-2']}],
    title:'Custom piñata',collection_ids:['pinatas'],
    quantity:2,
    attributes:[{id:'size',label:'Size',value:'18 inches'},
      {id:'pull_string',value:true}],
    personalization_groups:[
      {id:'P1',allocations:[{unit_id:'unit-1'}],
       attributes:[{id:'name',value:'Ava'},{id:'number',value:5}]},
      {id:'P2',allocations:[{unit_id:'unit-2'}],
       attributes:[{id:'name',value:'Mia'},{id:'number',value:6}]},
    ],
    reference_ids:['opaque-ref-1'],
  }],
  request_attributes:[{id:'need_proof',value:true}],
  reference_ids:['opaque-request-reference'],
  marketing_consent:{granted:false},
};
const params={rawPayload:JSON.stringify(source),
  submissionId:source.submission_id,revision:3,ownerAuthorized:true};
const result=project(params);
assert.equal(result.version,1);
assert.equal(result.revision,3);
assert.equal(result.items.length,1);
assert.equal(result.items[0].quantity,2);
assert.equal(result.items[0].personalization_groups[0].id,'P1');
assert.equal(result.items[0].personalization_groups[1].attributes[0].value,'Mia');
assert.deepEqual([...result.items[0].variant_allocations[0].unit_ids],
  ['unit-1','unit-2']);
assert.equal(result.planning.address.postal_code,'32218');
assert.equal(result.customer.email,'test@example.invalid');
assert.equal(result.attachment_state,'unresolved');
assert.ok(!Object.hasOwn(result,'raw_payload'));
assert.ok(!Object.hasOwn(result,'marketing_consent'));
assert.ok(!Object.hasOwn(result,'invoice'));
assert.ok(!Object.hasOwn(result.items[0],'unit_price'));
assert.ok(!Object.hasOwn(result.items[0],'media_url'));
assert.ok(Object.isFrozen(result));
assert.ok(Object.isFrozen(result.items[0].personalization_groups[0]));
assert.throws(()=>project({...params,ownerAuthorized:false}),/invalid_verified/);
assert.throws(()=>project({...params,submissionId:'jill:OTHER-111'}),/invalid_verified/);
assert.throws(()=>project({...params,revision:0}),/invalid_verified/);
assert.throws(()=>project({...params,rawPayload:'{'}),/invalid_verified/);
assert.throws(()=>project({...params,rawPayload:'X'.repeat(256*1024+1)}),/invalid_verified/);
const corrupt=mutator=>{
  const d=structuredClone(source);mutator(d);
  return JSON.stringify(d);
};
for(const change of [
  d=>d.items[0].item_id='',
  d=>d.items[0].quantity=0,
  d=>d.items[0].variant_allocations[0].unit_ids=['unit-1'],
  d=>d.items.push(structuredClone(d.items[0])),
  d=>d.items[0].reference_ids=['same','same'],
  d=>d.items[0].personalization_groups[0].attributes[0].value={admin:true},
  d=>d.items[0].attributes[0].value=Infinity,
  d=>d.planning.fulfillment='unverified',
  d=>d.submission_id='jill:other-request',
  d=>d.items=[],
])assert.throws(()=>project({...params,rawPayload:corrupt(change)}),
  /invalid_verified/,String(change));
console.log('PASS WORK detail projection: exact original item, variant allocations, per-unit personalization and opaque media references; strict Owner gate, identity and bounds, no inferred price or raw payload leaks.');
