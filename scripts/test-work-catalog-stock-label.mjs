import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {describeWorkCatalogProductInventory as present}
 from '../services/jill-order-desk/work-catalog-stock-label.mjs';

const missing=present(null);
assert.equal(missing.label,'Quantity unknown');
assert.match(missing.detail,/Check variant tracking/);
assert.deepEqual(present(undefined),missing);
const zero=present(0);
assert.equal(zero.label,'Shopify reports 0');
assert.match(zero.detail,/not proof.*out of stock/);
assert.match(zero.detail,/tracking may be off/);
const finite=present(21);
assert.equal(finite.label,'Shopify reports 21');
assert.match(finite.detail,/not verified available stock/);
assert.equal(present(-2).label,'Shopify reports -2');
for(const v of ['0',NaN,Infinity,0.5,{},Number.MAX_SAFE_INTEGER+1]){
  assert.throws(()=>present(v),/invalid_shopify_product_inventory/);
}
assert.equal(Object.isFrozen(zero),true);
const path='services/jill-order-desk/app-home/app/routes/app.catalog.tsx';
const ui=readFileSync(path,'utf8');
assert.match(ui,/describeWorkCatalogProductInventory\(product\.total_inventory\)/);
assert.match(ui,/Shopify product inventory report/);
assert.match(ui,/stock\.label/);
assert.match(ui,/stock\.detail/);
assert.match(ui,/Not tracked \/ quantity unknown/);
assert.match(ui,/href=\{product\.admin_url\}/);
assert.match(ui,/handleWorkCatalogRead/);
assert.doesNotMatch(ui,/draftOrderCreate|metafieldsSet|inventoryAdjustQuantities|localStorage/);
console.log('PASS WORK HQ catalog inventory truth: unknown/zero/positive do not imply tracked or available; Owner Shopify reader and links unchanged.');
