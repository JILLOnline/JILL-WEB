import assert from 'node:assert/strict';
import {projectWorkQuoteUnitPriceReview} from '../services/jill-order-desk/work-quote-unit-price-review.mjs';
const v='gid://shopify/ProductVariant/123';
const unit=(id,group,price)=>({source_item_id:'item-001',unit_id:id,
  group_id:group,variant_id:v,unit_price_cents:price,quantity:1,
  options:'JILL:unit:v1:{"secret":"PRIVATE CUSTOMER NAME"}'});
const plan={state:'review_only',requires_native_unit_adapter:true,
  unit_count:2,variant_count:1,units:[unit('p1','P1',1500),unit('p2','P2',1600)]};
const x=projectWorkQuoteUnitPriceReview({plan,itemSubtotalCents:3100});
assert.equal(x.state,'review_only');
assert.equal(x.count,2);assert.equal(x.variant_count,1);
assert.equal(x.units[0].group_id,'P1');assert.equal(x.units[1].quoted_unit_cents,1600);
assert.equal(x.quoted_items_cents,3100);
assert.equal(x.can_publish,false);assert.equal(x.can_invoice,false);
assert.equal(JSON.stringify(x).includes('PRIVATE CUSTOMER NAME'),false);
assert.equal(projectWorkQuoteUnitPriceReview({plan,itemSubtotalCents:3101}).state,'held');
assert.equal(projectWorkQuoteUnitPriceReview({plan:{...plan,units:[plan.units[0],plan.units[0]]},itemSubtotalCents:3000}).reason,'unit_identity_duplicate');
assert.equal(projectWorkQuoteUnitPriceReview({plan:{...plan,variant_count:2},itemSubtotalCents:3100}).state,'held');
assert.equal(projectWorkQuoteUnitPriceReview({plan:{...plan,units:[{...plan.units[0],variant_id:'not-shopify'},plan.units[1]]},itemSubtotalCents:3100}).state,'held');
assert.equal(projectWorkQuoteUnitPriceReview({plan:null,itemSubtotalCents:0}).state,'held');
console.log('PASS M2 P1/P2 per-unit price review, subtotal integrity and private option omission');
