import assert from 'node:assert/strict';
import {compareWorkQuoteUnitCatalogPrices} from '../services/jill-order-desk/work-quote-catalog-comparison.mjs';
const id='jill:request-00000001',v='gid://shopify/ProductVariant/99';
const review={state:'review_only',units:[
 {source_item_id:'item1',unit_id:'u1',group_id:'P1',variant_id:v,quoted_unit_cents:1900,options:'PRIVATE'},
 {source_item_id:'item1',unit_id:'u2',group_id:'P2',variant_id:v,quoted_unit_cents:1950,options:'PRIVATE'},
]};
const snapshot={state:'verified_catalog_snapshot',review_only:true,can_publish:false,
 submission_id:id,source_revision:5,currency:'USD',verified_at_ms:2000000,
 variants:[{variant_id:v,product_status:'ACTIVE',shopify_unit_price_cents:1900}]};
const run=(s=snapshot,r=review)=>compareWorkQuoteUnitCatalogPrices({
 review:r,snapshot:s,submissionId:id,sourceRevision:5,nowMs:2000001});
const x=run();
assert.equal(x.state,'review_only');assert.equal(x.difference_count,1);
assert.equal(x.inactive_count,0);
assert.deepEqual(x.rows.map(t=>t.status),['price_equal','price_difference']);
assert.equal(x.can_publish,false);
assert.equal(JSON.stringify(x).includes('PRIVATE'),false);
assert.equal(run({...snapshot,source_revision:6}).state,'held');
assert.equal(run({...snapshot,submission_id:'foreign-0000001'}).state,'held');
assert.equal(run({...snapshot,verified_at_ms:1400000}).state,'held');
assert.equal(run({...snapshot,variants:[{...snapshot.variants[0],product_status:'DRAFT'}]}).inactive_count,2);
assert.equal(run({...snapshot,variants:[snapshot.variants[0],snapshot.variants[0]]}).state,'held');
assert.equal(run(snapshot,{...review,units:[review.units[0],review.units[0]]}).reason,'duplicate_physical_unit');
assert.equal(run({...snapshot,variants:[{...snapshot.variants[0],variant_id:'gid://shopify/ProductVariant/300'}]}).state,'held');
assert.equal(run({...snapshot,variants:[{...snapshot.variants[0],shopify_unit_price_cents:-1}]}).state,'held');
console.log('PASS M2 exact P1/P2 vs fresh Shopify catalog price review; no customer options or commerce authority');
