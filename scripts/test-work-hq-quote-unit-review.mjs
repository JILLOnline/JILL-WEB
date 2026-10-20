// Synthetic signed-source-shaped unit review. The original Customer Order
// doesn't carry approved per-unit Shopify prices or authenticated media.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inspectWorkQuoteUnitReview as review}
  from '../services/jill-order-desk/work-quote-unit-review.mjs';

const item={
  item_id:'item:synthetic-111',quantity:3,
  variant_id:'shopify-variant:111',title:'Synthetic Tote',
  variant_allocations:[
    {variant_id:'111',title:'8x8',quantity:2,unit_ids:['unit-1','unit-2']},
    {variant_id:'222',title:'8x11',quantity:1,unit_ids:['unit-3']},
  ],
  personalization_groups:[
    {id:'P1',allocations:[{unit_id:'unit-1'},{unit_id:'unit-3'}],
      attributes:[{id:'name',value:'Lucía',label:'Name'},
        {id:'color',value:['pink','purple'],label:'Colors'}]},
    {id:'P2',allocations:[{unit_id:'unit-2'}],
      attributes:[{id:'name',value:'Mía',label:'Name'}]},
  ],
  reference_ids:['opaque:synthetic-1'],
};
const safe=review(item);
assert.equal(safe.state,'ready_for_merchant_review');
assert.deepEqual(safe.groups.map(g=>g.id),['P1','P2']);
assert.deepEqual(safe.groups[0].unit_ids,['unit-1','unit-3']);
assert.deepEqual(safe.groups[1].unit_ids,['unit-2']);
assert.equal(safe.groups[0].attributes[0].value,'Lucía');
assert.equal(safe.groups[1].attributes[0].value,'Mía');
assert.equal(safe.variants[0].variant_id,'111');
assert.equal(safe.variants[0].quantity,2);
assert.equal(safe.reference_count,1);
assert.deepEqual(safe.unassigned_unit_ids,[]);
assert.equal(safe.commerce_ready,false);
assert.equal(safe.customer_approved,false);
assert.equal(Object.isFrozen(safe.groups[0].attributes[0]),true);
const missing=review({...item,personalization_groups:[item.personalization_groups[0]]});
assert.equal(missing.state,'review_unassigned_units');
assert.deepEqual(missing.unassigned_unit_ids,['unit-2']);
function held(reason,change){
 const v=review(change);
 assert.equal(v.state,'held',reason);
 assert.equal(v.reason,reason);
 assert.equal(v.commerce_ready,false);
 assert.equal(v.customer_approved,false);
}
held('verified_item_required',{...item,quantity:0});
held('missing_unit_allocations',{...item,variant_allocations:[]});
held('unit_quantity_mismatch',{...item,quantity:4});
held('duplicate_or_invalid_unit',{...item,variant_allocations:[
  {...item.variant_allocations[0],unit_ids:['unit-1','unit-1']},
  item.variant_allocations[1]]});
held('unverified_variant_allocations',{...item,variant_allocations:[
  item.variant_allocations[0],{...item.variant_allocations[0]}]});
held('invalid_or_duplicate_personalized_unit',{...item,
  personalization_groups:[item.personalization_groups[0],
    {...item.personalization_groups[1],allocations:[{unit_id:'unit-1'}]}]});
held('invalid_or_duplicate_personalized_unit',{...item,
  personalization_groups:[{...item.personalization_groups[0],
    allocations:[{unit_id:'unknown'}]},item.personalization_groups[1]]});
held('unverified_personalization_group',{...item,
  personalization_groups:[item.personalization_groups[0],
    {...item.personalization_groups[1],id:'P1'}]});
held('unverified_personalization_attribute',{...item,
  personalization_groups:[{...item.personalization_groups[0],
    attributes:[{id:'name',value:{private:true}}]},item.personalization_groups[1]]});
held('unit_review_limit',{...item,reference_ids:Array.from({length:21},(_,i)=>'ref:'+i)});
const none=review({item_id:'item:no-units',quantity:1,
  variant_allocations:[],personalization_groups:[],reference_ids:[]});
assert.equal(none.state,'ready_for_merchant_review');
assert.equal(none.commerce_ready,false);
const ui=readFileSync(
  'services/jill-order-desk/app-home/app/components/WorkQuoteWorksheet.tsx','utf8');
const css=readFileSync(
  'services/jill-order-desk/app-home/app/styles/quote-worksheet.css','utf8');
assert.match(ui,/inspectWorkQuoteUnitReview/);
assert.match(ui,/<WorkQuoteUnitReview item=\{item\}\/>/);
assert.match(ui,/group\.unit_ids\.join\(", "\)/);
assert.match(ui,/variant\.unit_ids\.join\(", "\)/);
assert.match(ui,/No per-unit pricing or Shopify invoice is authorized/);
assert.match(ui,/reference_count>0/);
assert.match(css,/\.jill-quote__unit-review/);
assert.doesNotMatch(ui,/draftOrderCreate|draftOrderInvoiceSend|fetch\(/);
assert.doesNotMatch(css,/position:\s*fixed|overflow-y:\s*(auto|scroll)|!important/);
console.log('PASS WORK HQ P1/P2 exact unit-to-variant coverage, group references, duplicate/unassigned guards, merchant-only disclosure; no commerce authority. OFFLINE.');
