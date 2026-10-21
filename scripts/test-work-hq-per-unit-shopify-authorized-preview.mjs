import assert from 'node:assert/strict';
import {planLocalWorkQuoteDraftSave} from '../services/jill-order-desk/work-quote-draft-plan.mjs';
import {projectVerifiedWorkQuoteDraft} from '../services/jill-order-desk/work-quote-draft-read.mjs';
import {calculateAuthorizedWorkPerUnitQuote as calculate}
 from '../services/jill-order-desk/work-quote-per-unit-authorized-preview.mjs';
import {WORK_QUOTE_SHOP_QUERY}
 from '../services/jill-order-desk/work-quote-calculation.mjs';
import {WORK_QUOTE_PER_UNIT_CALCULATE}
 from '../services/jill-order-desk/work-quote-per-unit-calculation-preview.mjs';

const SHOP='jill-work.myshopify.com',APP='f8e1ebdbae84490dc8ea5b133637e6c0';
const ID='jill:22222222-3333-4444-8555-666666666666';
const OP='jill:hq:quote:11111111-2222-4333-8444-555555555555';
const VARIANT='gid://shopify/ProductVariant/123';
const CUSTOMER='gid://shopify/Customer/456';
const nowMs=Date.parse('2026-10-21T17:00:00Z');
const detail={submission_id:ID,revision:3,
 planning:{fulfillment:'pickup',attributes:[]},request_attributes:[],
 reference_ids:[],items:[{item_id:'item-custom-001',quantity:2,
 variant_id:VARIANT,reference_ids:[],attributes:[],
 variant_allocations:[{variant_id:VARIANT,quantity:2,unit_ids:['P1-1','P2-2']}],
 personalization_groups:[
 {id:'P1',allocations:[{unit_id:'P1-1'}],attributes:[{id:'theme',value:'OceanSecret'}]},
 {id:'P2',allocations:[{unit_id:'P2-2'}],attributes:[{id:'theme',value:'SkySecret'}]},
 ]}]};
const plan=planLocalWorkQuoteDraftSave({shop:SHOP,submissionId:ID,
 detail,record:{submission_id:ID,revision:3,customer_status:'reviewing'},
 lines:[{id:'item-custom-001',quantity:2,unitPrice:'25.00'}],
 fees:{materials:'0.00',labor:'0.00',shipping:'0.00',
 other:'0.00',discount:'0.00',tax:'0.00'},
 expectedDraftRevision:0,operationId:OP,nowMs});
const p=plan.statements[0].params;
const row={shop:p[0],submission_id:p[1],draft_revision:p[2],
 source_revision:p[3],source_sha256:p[4],quote_sha256:p[5],
 quote_json:p[6],total_cents:p[7],currency:p[8],state:p[9],
 last_operation_id:p[10],created_at_ms:p[11],updated_at_ms:p[12]};
const draft=projectVerifiedWorkQuoteDraft({row,detail,submissionId:ID});
const address={address1:'123 Synthetic Ave',city:'Jacksonville',
 provinceCode:'FL',zip:'32218',countryCode:'US',address2:'',
 firstName:'Synthetic',lastName:'Customer'};
const bundle={submissionId:ID,detail,draft,customerGid:CUSTOMER,address,
 shippingTitle:'Pickup'};
const money=x=>({shopMoney:{amount:(x/100).toFixed(2),currencyCode:'USD'},
 presentmentMoney:{amount:(x/100).toFixed(2),currencyCode:'USD'}});
const shopResponse={data:{shop:{myshopifyDomain:SHOP,currencyCode:'USD'},
 currentAppInstallation:{app:{apiKey:APP}}}};
let actor={owner:true,scopes:'write_draft_orders,read_draft_orders,read_customers,read_products'};
let calls={auth:0,bundle:0,catalog:0,shop:0,calculate:0};
let alter=null;
const db={prepare(sql){return{bind(){return{first:async()=>
 sql.includes('FROM jill_merchant_authority')?
 {shop:SHOP,environment:'WORK',app_client_id:APP,owner_staff_id:'123'}:null};}}}};
const admin={async graphql(query,params){
 let body;
 if(query===WORK_QUOTE_SHOP_QUERY){
  calls.shop++;body=shopResponse;
 }else if(query===WORK_QUOTE_PER_UNIT_CALCULATE){
  calls.calculate++;
  const inputs=params.variables.input.lineItems;
  const lines=inputs.map(l=>({uuid:l.uuid,variant:{id:l.variantId},
   quantity:l.quantity,custom:false,customAttributes:l.customAttributes,
   originalTotalSet:money(2500)}));
  if(alter)alter(lines);
  body={data:{draftOrderCalculate:{userErrors:[],calculatedDraftOrder:{
   currencyCode:'USD',presentmentCurrencyCode:'USD',
   customer:{id:CUSTOMER},taxesIncluded:false,
   acceptAutomaticDiscounts:false,discountCodes:[],warnings:[],
   lineItems:lines,totalShippingPriceSet:money(0),
   totalTaxSet:money(0),totalDiscountsSet:money(0),totalPriceSet:money(5000),
  }}}};
 }else throw Error('unexpected Shopify query');
 return new Response(JSON.stringify(body),{status:200});
}};
const authenticate={admin:async()=>{calls.auth++;return{
 session:{shop:SHOP,isOnline:true,onlineAccessInfo:{
  associated_user:{id:123,account_owner:actor.owner},
  associated_user_scope:actor.scopes}},
 admin,
}}};
const catalog={state:'verified',snapshot:{
 state:'verified_catalog_snapshot',shop:SHOP,currency:'USD',
 verified_at_ms:nowMs,variants:[{variant_id:VARIANT,product_status:'ACTIVE',
 shopify_unit_price_cents:2500}]}};
const loadVerifiedBundle=async()=>{calls.bundle++;return bundle;};
const readCatalog=async args=>{calls.catalog++;
 assert.deepEqual(args.variantIds,[VARIANT]);
 return catalog;
};
const opts={request:new Request('https://jill-work.example/app/requests/quote-preview'),
 authenticate,db,loadVerifiedBundle,readCatalog,now:()=>nowMs+10};
let result=await calculate(opts);
assert.equal(result.state,'not_enabled');
assert.deepEqual(calls,{auth:0,bundle:0,catalog:0,shop:0,calculate:0});
result=await calculate({...opts,enabled:true});
assert.equal(result.state,'offline_calculation_reconciled',result.reason);
assert.equal(result.source,'owner_sdk_calculation_review_only');
assert.equal(result.calculation.line_count,2);
assert.deepEqual(result.calculation.rows.map(r=>r.group_id),['P1','P2']);
assert.equal(result.can_publish,false);
assert.equal(calls.calculate,1);
assert.equal(calls.bundle,1);
assert.equal(calls.catalog,1);
for(const secret of ['OceanSecret','SkySecret','123 Synthetic Ave',
 'JILL personalization']){
 assert.equal(JSON.stringify(result).includes(secret),false);
}
actor.owner=false;
const before={...calls};
result=await calculate({...opts,enabled:true});
assert.equal(result.state,'access_denied');
assert.equal(calls.bundle,before.bundle);
assert.equal(calls.shop,before.shop);
actor.owner=true;actor.scopes='read_products';
result=await calculate({...opts,enabled:true});
assert.equal(result.state,'access_denied');
assert.equal(calls.bundle,before.bundle);
actor.scopes='write_draft_orders,read_draft_orders,read_customers,read_products';
alter=lines=>lines.pop();
result=await calculate({...opts,enabled:true});
assert.equal(result.state,'calculation_readback_unverified');
assert.equal(result.can_publish,false);
alter=null;
result=await calculate({...opts,enabled:true,
 loadVerifiedBundle:async()=>({...bundle,detail:{...detail,revision:4}})});
assert.equal(result.state,'quote_unit_input_held');
result=await calculate({...opts,enabled:true,
 readCatalog:async()=>({state:'not_enabled'})});
assert.equal(result.state,'catalog_not_verified');
result=await calculate({...opts,enabled:true,
 loadVerifiedBundle:async()=>{throw Error('signed source unavailable')}});
assert.equal(result.state,'calculation_unavailable');
console.log('PASS M2 Owner-authenticated source-only per-unit Shopify calculation boundary, offline grant, SKU and P1/P2 parity/denials');
