import assert from 'node:assert/strict';
import {deriveVerifiedWorkQuoteVariantIds,workQuoteCatalogReviewReady,
 handleWorkQuoteCatalogReview} from '../services/jill-order-desk/work-quote-catalog-review.mjs';
const reqId='jill:source-00000001';
const v1='gid://shopify/ProductVariant/11',v2='gid://shopify/ProductVariant/22';
const item={item_id:'i1',quantity:2,variant_id:'',
 variant_allocations:[{variant_id:v1,quantity:1,unit_ids:['u1']},
 {variant_id:v1,quantity:1,unit_ids:['u2']}]};
const detail={submission_id:reqId,revision:3,items:[item]};
let plan=deriveVerifiedWorkQuoteVariantIds({detail,submissionId:reqId,revision:3});
assert.equal(plan.state,'ready');assert.deepEqual(plan.variant_ids,[v1]);
assert.equal(plan.unit_count,2);assert.equal(plan.can_publish,false);
const wrong=deriveVerifiedWorkQuoteVariantIds({detail,submissionId:'foreign-request-0001',revision:3});
assert.equal(wrong.state,'held');
assert.equal(deriveVerifiedWorkQuoteVariantIds({detail,submissionId:reqId,revision:4}).state,'held');
assert.equal(deriveVerifiedWorkQuoteVariantIds({detail:{...detail,items:[{...item,
 variant_allocations:[{...item.variant_allocations[0],quantity:2,unit_ids:['u1','u1']}]}]},
 submissionId:reqId,revision:3}).reason,'unverified_unit_id');
assert.equal(deriveVerifiedWorkQuoteVariantIds({detail:{...detail,items:[{...item,
 variant_allocations:[{variant_id:v2,quantity:1,unit_ids:['u1']}]}]},
 submissionId:reqId,revision:3}).reason,'unit_quantity_mismatch');
assert.equal(deriveVerifiedWorkQuoteVariantIds({detail:{...detail,items:[{...item,
 variant_allocations:[],variant_id:'not-a-shopify-variant'}]},
 submissionId:reqId,revision:3}).state,'held');
assert.equal(workQuoteCatalogReviewReady({}),false);
let calls=0;const deniedReader={admin:()=>{calls++;throw Error('must not call');}};
const url='https://jill-work.example/app/requests/quote-catalog?submission_id='+encodeURIComponent(reqId);
let result=await handleWorkQuoteCatalogReview({request:new Request(url),authenticate:deniedReader});
assert.equal(result.status,503);assert.equal(calls,0);
result=await handleWorkQuoteCatalogReview({request:new Request(url+'&variant_id='+encodeURIComponent(v1)),
 enabled:true,authenticate:deniedReader,db:{prepare(){}},readFreshList(){},readExactDetail(){}});
assert.equal(result.status,400);assert.equal(calls,0);
result=await handleWorkQuoteCatalogReview({request:new Request(url,{method:'POST'}),enabled:true});
assert.equal(result.status,405);assert.equal(calls,0);
// Positive canonical-variant derivation, including a second distinct variant.
const next=deriveVerifiedWorkQuoteVariantIds({detail:{...detail,items:[item,
 {item_id:'i2',quantity:1,variant_id:v2,variant_allocations:[]}]},
 submissionId:reqId,revision:3});
assert.deepEqual(next.variant_ids,[v1,v2]);
console.log('PASS M2 signed-source variant mapping, 2-unit P1/P2 dedup and OFF/no-lookup boundaries');
