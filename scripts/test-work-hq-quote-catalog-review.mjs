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
// Integrated authorized read with the real D1 permission evaluator and
// the actual Shopify ProductVariant projection. No external calls or writes.
const SHOP='jill-work.myshopify.com',APP='f8e1ebdbae84490dc8ea5b133637e6c0';
const session=(owner=true,scopes='read_products')=>({
 shop:SHOP,isOnline:true,
 onlineAccessInfo:{associated_user:{id:123,account_owner:owner},
  associated_user_scope:scopes},
});
const authority={shop:SHOP,environment:'WORK',app_client_id:APP,
 owner_staff_id:'123',policy_version:1};
const db={prepare(sql){return{bind(){return{first:async()=>
 sql.includes('FROM jill_merchant_authority')?authority:null};}}}};
const list={version:1,operation:'custom_order.merchant.list.result',ok:true,
 shop:SHOP,complete:true,records:[{submission_id:reqId,revision:3,
 customer_status:'received',internal_status:'needs_quote',
 submitted_at:'2026-10-20T01:00:00.000Z',
 updated_at:'2026-10-20T01:10:00.000Z',
 date_needed:'2026-10-30',fulfillment:'pickup',item_count:1}]};
const graphResult={data:{shop:{myshopifyDomain:SHOP,currencyCode:'USD'},
 currentAppInstallation:{app:{apiKey:APP}},
 nodes:[{__typename:'ProductVariant',id:v1,title:'Default',price:'25.00',
  sku:null,product:{id:'gid://shopify/Product/500',title:'Tote',status:'ACTIVE'}}]}};
const sdk=(owner=true,scopes='read_products')=>({admin:async()=>({
 session:session(owner,scopes),
 admin:{graphql:async()=>
  new Response(JSON.stringify(graphResult),{status:200,
    headers:{'content-type':'application/json'}})},
})});
let listReads=0,detailReads=0;
const params={request:new Request(url),enabled:true,db,authenticate:sdk(),
 readFreshList:async()=>{listReads++;return list;},
 readExactDetail:async()=>{detailReads++;return detail;}};
result=await handleWorkQuoteCatalogReview(params);
assert.equal(result.status,200);
const authorized=await result.json();
assert.equal(authorized.state,'verified_catalog_snapshot');
assert.equal(authorized.submission_id,reqId);
assert.equal(authorized.variants.length,1);
assert.equal(authorized.variants[0].variant_id,v1);
assert.equal(authorized.variants[0].shopify_unit_price_cents,2500);
assert.equal(authorized.can_publish,false);
assert.equal(authorized.review_only,true);
assert.equal(listReads,1);assert.equal(detailReads,1);
assert.equal(JSON.stringify(authorized).includes('25.00'),false);
const denied=await handleWorkQuoteCatalogReview({...params,
 authenticate:sdk(false)});
assert.equal(denied.status,403);
assert.equal(listReads,1);assert.equal(detailReads,1);
const deniedCatalog=await handleWorkQuoteCatalogReview({...params,
 authenticate:sdk(true,'read_orders')});
assert.equal(deniedCatalog.status,403);
const beforeDetailReads=detailReads;
const stale=await handleWorkQuoteCatalogReview({...params,
 readFreshList:async()=>({...list,records:[{...list.records[0],revision:4}]})});
assert.equal(stale.status,409);
assert.equal(detailReads,beforeDetailReads+1);

console.log('PASS M2 signed-source variant mapping, 2-unit P1/P2 dedup and OFF/no-lookup boundaries');
