// Offline-only real Shopify Admin GraphQL shape, Owner gate and current
// variant-price comparison. No production data, writes, HTTP route or bill.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JILL_WORK_MERCHANT_CLIENT_ID as CLIENT}
  from '../backend/jill-merchant-auth.mjs';
import {WORK_QUOTE_VARIANT_LOOKUP,projectVerifiedWorkQuoteCatalog,
  readAuthorizedWorkQuoteCatalog,reconcileWorkQuoteWithCatalog}
  from '../services/jill-order-desk/work-quote-shopify-catalog-bridge.mjs';
import {inspectWorkQuoteCommerceHandoff as inspect}
  from '../services/jill-order-desk/work-quote-commerce-handoff.mjs';

const SHOP='jill-work.myshopify.com',ID='jill:synthetic-catalog-quote-0001';
const VID='gid://shopify/ProductVariant/111',PRODUCT='gid://shopify/Product/222';
const CUSTOMER='gid://shopify/Customer/333',NOW=1792497600000;
const items=[{item_id:'item:synthetic-111',title:'Synthetic favor',
  quantity:2,variant_id:VID,attributes:[{id:'theme',label:'Theme',value:'Sirenas'}],
  personalization_groups:[],reference_ids:[],variant_allocations:[]}];
const detail={submission_id:ID,revision:2,items,request_attributes:[],
  reference_ids:[],planning:{fulfillment:'shipping',attributes:[]}};
const fees={materials:'0.00',labor:'0.00',shipping:'5.00',
  other:'0.00',discount:'0.00',tax:'0.00'};
const draft={submission_id:ID,source_revision:2,draft_revision:1,state:'ready',
  estimated_total_cents:5490,lines:[{id:'item:synthetic-111',quantity:2,unitPrice:'24.95'}],
  fees};
const handoff=inspect({submissionId:ID,detail,draft,customerGid:CUSTOMER,
  address:{address1:'1 Synthetic St',city:'Jacksonville',provinceCode:'FL',
    zip:'32218',countryCode:'US'},shippingTitle:'Standard shipping'});
assert.equal(handoff.state,'ready_for_shopify_calculation');
assert.equal(handoff.calculation_intent.lines[0].unit_price_cents,2495);
assert.match(handoff.calculation_intent.lines[0].options,/Sirenas/);

const payload={data:{
  shop:{myshopifyDomain:SHOP,currencyCode:'USD'},
  currentAppInstallation:{app:{apiKey:CLIENT}},
  nodes:[{__typename:'ProductVariant',id:VID,title:'8x8',
    sku:'FAVOR-8',price:'24.95',
    product:{id:PRODUCT,title:'Synthetic Favor',status:'ACTIVE'}}],
}};
assert.match(WORK_QUOTE_VARIANT_LOOKUP,/nodes\(ids: \$ids\)/);
assert.match(WORK_QUOTE_VARIANT_LOOKUP,/currentAppInstallation/);
assert.doesNotMatch(WORK_QUOTE_VARIANT_LOOKUP,/mutation|productUpdate|draftOrderCreate|inventoryAdjust/);
const snapshot=projectVerifiedWorkQuoteCatalog({variantIds:[VID],result:payload,nowMs:NOW});
assert.equal(snapshot.variants[0].shopify_unit_price_cents,2495);
assert.equal(snapshot.variants[0].product_id,PRODUCT);
assert.equal(snapshot.variants[0].sku,'FAVOR-8');
const ready=reconcileWorkQuoteWithCatalog({handoff,snapshot,nowMs:NOW+1000});
assert.equal(ready.state,'ready_for_native_shopify_calculation');
assert.equal(ready.calculation_intent,handoff.calculation_intent);
assert.equal(ready.native_tax_and_total_check_required,true);
assert.equal(ready.can_publish,false);
assert.equal(ready.can_invoice,false);
assert.equal(ready.can_create_order,false);

function rejection(reason,options){
  const result=reconcileWorkQuoteWithCatalog({handoff,snapshot,
    nowMs:NOW+1000,...options});
  assert.equal(result.state,'held',reason);
  assert.equal(result.reason,reason);
  assert.equal(result.calculation_intent,null);
  assert.equal(result.can_publish,false);
  assert.equal(result.can_invoice,false);
  assert.equal(result.can_create_order,false);
}
rejection('catalog_snapshot_missing_or_stale',{snapshot:null});
rejection('catalog_snapshot_missing_or_stale',{nowMs:NOW+300001});
rejection('catalog_snapshot_missing_or_stale',{nowMs:NOW-1});
rejection('catalog_snapshot_missing_or_stale',{maxAgeMs:300001});
rejection('quote_draft_not_verified',{handoff:{state:'held'}});
rejection('variant_count_changed',{snapshot:{...snapshot,variants:[]}});
rejection('shopify_variant_changed',{snapshot:{...snapshot,variants:[
  {...snapshot.variants[0],variant_id:'gid://shopify/ProductVariant/999'}]}});
rejection('shopify_product_not_active',{snapshot:{...snapshot,variants:[
  {...snapshot.variants[0],product_status:'DRAFT'}]}});
rejection('catalog_price_review_required',{snapshot:{...snapshot,variants:[
  {...snapshot.variants[0],shopify_unit_price_cents:2595}]}});
rejection('catalog_price_unverified',{snapshot:{...snapshot,variants:[
  {...snapshot.variants[0],shopify_unit_price_cents:-2}]}});
for(const mutation of [
  p=>p.data.shop.myshopifyDomain='live.myshopify.com',
  p=>p.data.shop.currencyCode='CAD',
  p=>p.data.currentAppInstallation.app.apiKey='other-app',
  p=>p.data.nodes[0].id='gid://shopify/ProductVariant/999',
  p=>p.data.nodes[0].__typename='Product',
  p=>p.data.nodes[0].price='24.951',
  p=>p.data.nodes[0].product.id='gid://shopify/Product/0',
  p=>p.data.nodes[0].product.status='UNKNOWN',
  p=>p.data.nodes[0].sku='x'.repeat(256),
  p=>p.data.nodes.push({...p.data.nodes[0]}),
]){
  const changed=structuredClone(payload);mutation(changed);
  assert.throws(()=>projectVerifiedWorkQuoteCatalog({
    variantIds:[VID],result:changed,nowMs:NOW}),/quote_catalog_unverified/);
}
for(const ids of [[],[VID,VID],['not-a-gid'],Array(21).fill(VID)]){
  assert.throws(()=>projectVerifiedWorkQuoteCatalog({
    variantIds:ids,result:payload,nowMs:NOW}),/quote_catalog_unverified/);
}
const scopes='read_products,read_inventory,read_locations';
const session={shop:SHOP,isOnline:true,expires:new Date(Date.now()+600000),
  onlineAccessInfo:{associated_user:{id:123,account_owner:true},
    associated_user_scope:scopes}};
const authority={shop:SHOP,environment:'WORK',app_client_id:CLIENT,
  owner_staff_id:'123',policy_version:1};
const db={prepare:sql=>({bind:()=>({first:async()=>
  sql.includes('jill_merchant_authority')?authority:null})})};
let calls=0,authed=0;
const admin={graphql:async (query,{variables,tries,signal})=>{
  calls++;assert.equal(query,WORK_QUOTE_VARIANT_LOOKUP);
  assert.deepEqual(variables,{ids:[VID]});
  assert.equal(tries,1);assert.ok(signal);
  return {ok:true,json:async()=>payload};
}};
const args={request:new Request('https://work.example/app/requests/111'),
  authenticate:{admin:async()=>{authed++;return{session,admin};}},
  db,enabled:true,variantIds:[VID],now:()=>NOW};
assert.equal((await readAuthorizedWorkQuoteCatalog({...args,enabled:false})).state,'not_enabled');
assert.equal(authed,0);
assert.equal((await readAuthorizedWorkQuoteCatalog({...args,variantIds:[VID,VID]})).state,'invalid_variant_ids');
assert.equal(authed,0);
const result=await readAuthorizedWorkQuoteCatalog(args);
assert.equal(result.state,'verified');
assert.equal(result.snapshot.verified_at_ms,NOW);
assert.equal(calls,1);
for(const bad of [
  {...session,shop:'live.myshopify.com'},
  {...session,isOnline:false},
  {...session,onlineAccessInfo:{...session.onlineAccessInfo,
    associated_user_scope:'read_inventory,read_locations'}},
  {...session,onlineAccessInfo:{...session.onlineAccessInfo,
    associated_user:{id:999,account_owner:false}}},
]){
  const denied=await readAuthorizedWorkQuoteCatalog({...args,
    authenticate:{admin:async()=>({session:bad,admin})}});
  assert.equal(denied.state,'access_denied');assert.equal(calls,1);
}
const denied=await readAuthorizedWorkQuoteCatalog({...args,
  db:{prepare(){throw Error('PRIVATE DB FAILURE')}}});
assert.equal(denied.state,'access_denied');assert.equal(calls,1);
const outage=await readAuthorizedWorkQuoteCatalog({...args,
  authenticate:{admin:async()=>({session,admin:{graphql:async()=>{
    throw Error('PRIVATE SHOPIFY FAILURE');
  }}})}});
assert.deepEqual(outage,{state:'catalog_unavailable',snapshot:null});
await assert.rejects(()=>readAuthorizedWorkQuoteCatalog({...args,
  authenticate:{admin:async()=>{throw new Response('Needs login',{status:401})}}}),
  value=>value instanceof Response&&value.status===401);
const src=readFileSync('services/jill-order-desk/work-quote-shopify-catalog-bridge.mjs','utf8');
assert.match(src,/readWorkMerchantPermission/);
assert.match(src,/action:'catalog.read'/);
assert.doesNotMatch(src,/draftOrderCreate|draftOrderInvoiceSend|inventoryAdjust|productUpdate|db\.batch|fetch\(/);
console.log('PASS WORK quote/catalog exact variant match, source app/shop/currency, Owner scopes, stale/changed-price hold; never auto-overrides or approves invoices. OFFLINE.');
