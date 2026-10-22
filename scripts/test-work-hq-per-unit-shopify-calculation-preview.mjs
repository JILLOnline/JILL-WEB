import assert from 'node:assert/strict';
import {planLocalWorkQuoteDraftSave} from '../services/jill-order-desk/work-quote-draft-plan.mjs';
import {projectVerifiedWorkQuoteDraft} from '../services/jill-order-desk/work-quote-draft-read.mjs';
import {prepareWorkQuotePerUnitCalculation as prepare,
 projectWorkQuotePerUnitCalculation as project,
 WORK_QUOTE_PER_UNIT_CALCULATE as QUERY}
 from '../services/jill-order-desk/work-quote-per-unit-calculation-preview.mjs';
import {prepareWorkQuoteCalculation as oldPrepare}
 from '../services/jill-order-desk/work-quote-calculation.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const VARIANT='gid://shopify/ProductVariant/123',CUSTOMER='gid://shopify/Customer/456';
const t=Date.parse('2026-10-21T17:00:00Z');
const address={address1:'123 Example Rd',address2:'',city:'Jacksonville',
 provinceCode:'FL',zip:'32218',countryCode:'US',firstName:'Test',lastName:'Only'};
const item={item_id:'item-custom-001',quantity:2,title:'Custom tote',
 variant_id:VARIANT,reference_ids:[],attributes:[],
 variant_allocations:[{variant_id:VARIANT,quantity:2,unit_ids:['one-p1','two-p2']}],
 personalization_groups:[
  {id:'P1',allocations:[{unit_id:'one-p1'}],
   attributes:[{id:'design',label:'Theme',value:'OCEAN_SECRET'}]},
  {id:'P2',allocations:[{unit_id:'two-p2'}],
   attributes:[{id:'design',label:'Theme',value:'SPACE_SECRET'}]},
 ]};
const detail={submission_id:ID,revision:3,items:[item],
 planning:{fulfillment:'pickup',attributes:[]},
 reference_ids:[],request_attributes:[]};
const lines=[{id:'item-custom-001',quantity:2,unitPrice:'25.00'}];
const fees={materials:'0.00',labor:'0.00',shipping:'0.00',
 other:'0.00',discount:'0.00',tax:'0.00'};
const quotePlan=planLocalWorkQuoteDraftSave({shop:SHOP,submissionId:ID,
 detail,record:{submission_id:ID,revision:3,customer_status:'reviewing'},
 lines,fees,expectedDraftRevision:0,operationId:OP,nowMs:t});
const p=quotePlan.statements[0].params;
const row={shop:p[0],submission_id:p[1],draft_revision:p[2],
 source_revision:p[3],source_sha256:p[4],quote_sha256:p[5],
 quote_json:p[6],total_cents:p[7],currency:p[8],state:p[9],
 last_operation_id:p[10],created_at_ms:p[11],updated_at_ms:p[12]};
const draft=projectVerifiedWorkQuoteDraft({row,detail,submissionId:ID});
const catalog={state:'verified_catalog_snapshot',shop:SHOP,currency:'USD',
 verified_at_ms:t,variants:[{variant_id:VARIANT,product_status:'ACTIVE',
 shopify_unit_price_cents:2500}]};
const args={submissionId:ID,detail,draft,catalog,customerGid:CUSTOMER,
 address,shippingTitle:'Local pickup',nowMs:t};
const x=prepare(args);
assert.equal(x.state,'ready_for_offline_shopify_projection',x.reason);
assert.equal(x.units.length,2);
assert.equal(x.units[0].variant_id,x.units[1].variant_id);
assert.notEqual(x.units[0].uuid,x.units[1].uuid);
assert.deepEqual(x.variables.input.lineItems.map(q=>q.quantity),[1,1]);
assert.deepEqual(x.variables.input.lineItems.map(q=>q.priceOverride.amount),['25.00','25.00']);
assert.match(x.variables.input.lineItems[0].customAttributes[0].value,/OCEAN_SECRET/);
assert.match(x.variables.input.lineItems[1].customAttributes[0].value,/SPACE_SECRET/);
assert.equal(prepare(args).units[0].uuid,x.units[0].uuid);
assert.match(QUERY,/lineItems \{ uuid/);
assert.equal(x.can_publish,false);
const bag=n=>({shopMoney:{amount:(n/100).toFixed(2),currencyCode:'USD'},
 presentmentMoney:{amount:(n/100).toFixed(2),currencyCode:'USD'}});
const raw=x.units.map(u=>({uuid:u.uuid,variant:{id:u.variant_id},quantity:1,
 custom:false,customAttributes:[{key:'JILL personalization',value:u.options}],
 originalTotalSet:bag(u.unit_price_cents)}));
const calculation={
 data:{draftOrderCalculate:{userErrors:[],calculatedDraftOrder:{
 currencyCode:'USD',presentmentCurrencyCode:'USD',customer:{id:CUSTOMER},
 taxesIncluded:false,acceptAutomaticDiscounts:false,discountCodes:[],warnings:[],
 lineItems:[raw[1],raw[0]],totalShippingPriceSet:bag(0),
 totalTaxSet:bag(175),totalDiscountsSet:bag(0),totalPriceSet:bag(5175),
 }}},
};
const result=project({prepared:x,result:calculation,nowMs:t+200});
assert.equal(result.state,'offline_calculation_reconciled',result.reason);
assert.equal(result.calculation.line_count,2);
assert.deepEqual(result.calculation.rows.map(q=>q.group_id),['P1','P2']);
assert.equal(result.calculation.total_cents,5175);
assert.equal(result.calculation.tax_cents,175);
assert.equal(result.can_publish,false);
for(const secret of ['OCEAN_SECRET','SPACE_SECRET','123 Example Rd',
 'JILL personalization','customer_email']){
 assert.equal(JSON.stringify(result).includes(secret),false,secret);
}
const cloned=()=>structuredClone(calculation);
const rejects=(mutate,reason)=>{
 const r=cloned();mutate(r.data.draftOrderCalculate.calculatedDraftOrder);
 const v=project({prepared:x,result:r,nowMs:t+200});
 assert.equal(v.state,'held',v.reason);
 if(reason)assert.equal(v.reason,reason);
};
rejects(c=>c.lineItems.pop(),'calculated_state_unverified');
rejects(c=>c.lineItems[0].uuid=c.lineItems[1].uuid,'shopify_uuid_missing_or_duplicate');
rejects(c=>c.lineItems[0].uuid='altered-uuid','unit_or_personalization_changed');
rejects(c=>c.lineItems[0].variant.id='gid://shopify/ProductVariant/999','unit_or_personalization_changed');
rejects(c=>c.lineItems[0].customAttributes=[],'unit_or_personalization_changed');
rejects(c=>c.lineItems[0].customAttributes[0].value='different','unit_or_personalization_changed');
rejects(c=>c.lineItems[0].quantity=2,'unit_or_personalization_changed');
rejects(c=>c.lineItems[0].originalTotalSet=bag(2600),'unit_price_changed');
rejects(c=>c.totalPriceSet=bag(5100),'calculated_totals_changed');
rejects(c=>c.totalDiscountsSet=bag(100),'calculated_totals_changed');
rejects(c=>c.totalShippingPriceSet=bag(200),'calculated_totals_changed');
rejects(c=>c.currencyCode='CAD','calculated_state_unverified');
rejects(c=>c.warnings.push({__typename:'Warning'}),'calculated_state_unverified');
rejects(c=>c.customer.id='gid://shopify/Customer/999','calculated_state_unverified');
assert.equal(project({prepared:x,result:calculation,nowMs:t+31000}).state,'held');
assert.equal(prepare({...args,submissionId:'foreign-00000001'}).state,'held');
assert.equal(prepare({...args,detail:{...detail,revision:4}}).state,'held');
assert.equal(prepare({...args,catalog:{...catalog,verified_at_ms:t-300001}}).state,'held');
assert.equal(prepare({...args,catalog:{...catalog,variants:[{...catalog.variants[0],
 shopify_unit_price_cents:2900}]}}).reason,'catalog_price_review_required');
assert.equal(prepare({...args,detail:{...detail,items:[{...item,reference_ids:['private-file']}]} }).state,'held');
assert.equal(prepare({...args,fees:{...fees,tax:'2.00'}}).state,'ready_for_offline_shopify_projection');
// No fees are accepted from ad hoc callers: the D1 verified saved row is authoritative.
assert.equal(prepare({...args,customerGid:'gid://shopify/Customer/0'}).state,'held');
assert.throws(()=>oldPrepare({customer_gid:CUSTOMER,fulfillment:'pickup',
 address,shipping:{title:'Pickup',amount_cents:0},reward:null,
 lines:[{variant_id:VARIANT,quantity:1,unit_price_cents:2500,options:''},
 {variant_id:VARIANT,quantity:1,unit_price_cents:2500,options:''}]}),/duplicate_variant/);
console.log('PASS M2 repeated variant per-unit UUID/attributes/price, actual saved draft+catalog; 20+ fail-closed synthetic cases');
