import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JILL_WORK_MERCHANT_CLIENT_ID}
 from '../backend/jill-merchant-auth.mjs';
import {projectVerifiedWorkQuoteCatalog}
 from '../services/jill-order-desk/work-quote-shopify-catalog-bridge.mjs';
import {inspectWorkQuoteCatalogPreflight as preflight}
 from '../services/jill-order-desk/work-quote-catalog-preflight.mjs';

const ID='jill:synthetic-preflight-001';
const VID='gid://shopify/ProductVariant/111';
const item={item_id:'item:synthetic-111',title:'Synthetic customizable favor',
 quantity:2,variant_id:VID,attributes:[],
 personalization_groups:[],reference_ids:[],variant_allocations:[]};
const detail={submission_id:ID,revision:3,items:[item],
 request_attributes:[],reference_ids:[],
 planning:{fulfillment:'shipping',attributes:[]}};
const fees={materials:'0.00',labor:'0.00',shipping:'5.00',
 other:'0.00',discount:'0.00',tax:'0.00'};
const draft={state:'ready',submission_id:ID,source_revision:3,
 draft_revision:1,estimated_total_cents:5200,
 lines:[{id:item.item_id,quantity:2,unitPrice:'23.50'}],fees};
const address={address1:'1 Synthetic Road',city:'Jacksonville',
 provinceCode:'FL',zip:'32218',countryCode:'US'};
const secretCustomer='gid://shopify/Customer/111',NOW=1792497600000;
const result={data:{
 shop:{myshopifyDomain:'jill-work.myshopify.com',currencyCode:'USD'},
 currentAppInstallation:{app:{apiKey:JILL_WORK_MERCHANT_CLIENT_ID}},
 nodes:[{__typename:'ProductVariant',id:VID,title:'Synthetic size',
  sku:'FAVOR-TEST',price:'23.50',product:{
   id:'gid://shopify/Product/222',title:'Synthetic favor',status:'ACTIVE',
  }}],
}};
const makeSnapshot=(overrides={})=>projectVerifiedWorkQuoteCatalog({
 variantIds:[VID],result:{...result,...overrides},nowMs:NOW,
});
const catalogSnapshot=makeSnapshot();
const args={enabled:true,submissionId:ID,detail,draft,
 customerGid:secretCustomer,address,shippingTitle:'Standard shipping',
 catalogSnapshot,nowMs:NOW+1000};
const original=structuredClone(args);
function noWrites(value){
 for(const key of ['can_publish','can_invoice','can_create_order',
  'can_send_email','can_charge_customer'])
  assert.equal(value[key],false,key);
 assert.equal(value.native_shopify_calculation_performed,false);
 assert.equal(value.source_only,true);
 assert.equal(JSON.stringify(value).includes(secretCustomer),false);
 assert.equal(JSON.stringify(value).includes('Synthetic Road'),false);
 assert.equal(JSON.stringify(value).includes('23.50'),false);
 assert.equal(JSON.stringify(value).includes('Standard shipping'),false);
}
const disabled=preflight({...args,enabled:false});
assert.equal(disabled.state,'held');
assert.equal(disabled.stage,'disabled');
assert.equal(disabled.reason,'owner_quote_preflight_disabled');
noWrites(disabled);
noWrites(preflight());
const ready=preflight(args);
assert.equal(ready.state,'ready_for_native_shopify_calculation');
assert.equal(ready.next_action,'request_fresh_shopify_calculation');
assert.equal(ready.verified_line_count,1);
assert.equal(ready.catalog_verified_at_ms,NOW);
assert.equal(ready.shopify_totals_verified,false);
assert.equal(ready.customer_approval_recorded,false);
noWrites(ready);
assert.deepEqual(args,original,'Do not mutate detail/draft/identity inputs');
const check=(changes,stage,reason,nextAction)=>{
 const actual=preflight({...args,...changes});
 assert.equal(actual.state,'held',reason);
 assert.equal(actual.stage,stage);
 assert.equal(actual.reason,reason);
 assert.equal(actual.next_action,nextAction);
 assert.equal(actual.verified_line_count,undefined);
 noWrites(actual);
};
check({draft:{...draft,source_revision:2}},
 'saved_quote','verified_draft_unavailable_or_stale','reload_saved_quote');
check({detail:{...detail,submission_id:'jill:foreign'}},
 'saved_quote','canonical_source_unverified','verify_original_request');
check({customerGid:'customer@example.test'},
 'saved_quote','shopify_customer_unverified','verify_shopify_customer');
check({detail:{...detail,request_attributes:[{id:'instructions',value:'Gift wrap'}]}},
 'saved_quote','unmapped_order_instructions','map_customization_terms');
check({detail:{...detail,items:[{...item,personalization_groups:[{
 id:'P1',attributes:[]}]}]}},
 'saved_quote','per_unit_or_reference_mapping_required','map_per_unit_personalization');
check({draft:{...draft,fees:{...fees,tax:'1.00'},
 estimated_total_cents:5300}},
 'saved_quote','manual_tax_must_be_recalculated','recalculate_tax_natively');
check({catalogSnapshot:null},
 'shopify_catalog','catalog_snapshot_missing_or_stale','refresh_shopify_catalog');
check({nowMs:NOW+300001},
 'shopify_catalog','catalog_snapshot_missing_or_stale','refresh_shopify_catalog');
check({catalogSnapshot:{...catalogSnapshot,variants:[
 {...catalogSnapshot.variants[0],shopify_unit_price_cents:2450}]}},
 'shopify_catalog','catalog_price_review_required','compare_shopify_price');
check({catalogSnapshot:{...catalogSnapshot,variants:[
 {...catalogSnapshot.variants[0],product_status:'DRAFT'}]}},
 'shopify_catalog','shopify_product_not_active','review_catalog_product');
check({catalogSnapshot:{...catalogSnapshot,variants:[
 {...catalogSnapshot.variants[0],variant_id:'gid://shopify/ProductVariant/999'}]}},
 'shopify_catalog','shopify_variant_changed','review_variant_allocations');
const src=readFileSync(
 'services/jill-order-desk/work-quote-catalog-preflight.mjs','utf8');
assert.match(src,/inspectWorkQuoteCommerceHandoff/);
assert.match(src,/reconcileWorkQuoteWithCatalog/);
for(const forbidden of [
 /fetch\s*\(/,/graphql\s*\(/,/draftOrderCreate/,/draftOrderInvoiceSend/,
 /db\.prepare\s*\(/,/localStorage/,/sessionStorage/,
 /process\.env/,/createOrder/,/response\.json\s*\(/,
]){
 assert.doesNotMatch(src,forbidden,'Preflight must remain pure');
}
console.log('PASS quote + verified catalog source preflight: exact USD/variant/source readiness; stale data, P1/P2, tax, price-drift holds; zero Shopify IO/invoices/PII.');
