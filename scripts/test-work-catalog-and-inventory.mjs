import assert from 'node:assert/strict';
import {handleWorkCatalogRead} from '../services/jill-order-desk/work-catalog-read.mjs';
import {currentAllocation,edgeClockInterval} from './collect-work-runtime-readonly.mjs';
const SHOP='jill-work.myshopify.com';
const authority={shop:SHOP,environment:'WORK',app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',owner_staff_id:'123',policy_version:1};
let current=authority;
const db={prepare:sql=>({bind(){return this;},first:async()=>sql.includes('jill_merchant_authority')?current:null})};
let session={shop:SHOP,isOnline:true,expires:new Date(Date.now()+600000),
  onlineAccessInfo:{associated_user:{id:'123',account_owner:true},associated_user_scope:'read_products'}};
let reads=0,fail=false;
const authenticate={admin:async()=>({session,admin:{graphql:async(_query,{variables})=>{
  reads++;assert.equal(variables.after,null);
  return Response.json(fail?{errors:[{message:'private Shopify error'}]}:{data:{shop:{myshopifyDomain:SHOP,currencyCode:"USD"},products:{
    nodes:[{id:'gid://shopify/Product/111',title:'Synthetic tote',status:'ACTIVE',
      variants:{nodes:[{id:'gid://shopify/ProductVariant/222',title:'Blue',price:'10.00',inventoryPolicy:'DENY'}],pageInfo:{hasNextPage:false}}}],
    pageInfo:{hasNextPage:false,endCursor:null}}}});
}}})};
const request=new Request('https://local/app/catalog');
const run=async(enabled=true)=>handleWorkCatalogRead({request,authenticate,db,enabled});
assert.equal((await run(false)).status,200);assert.equal(reads,0);
const valid=await run();assert.equal(valid.status,200);
assert.equal((await valid.json()).records[0].admin_url,'https://admin.shopify.com/store/jill-work/products/111');
fail=true;const unavailable=await run();assert.equal(unavailable.status,503);
assert(!JSON.stringify(await unavailable.json()).includes('private Shopify error'));
session={...session,onlineAccessInfo:{...session.onlineAccessInfo,associated_user_scope:'read_orders'}};
const before=reads;assert.equal((await run()).status,403);assert.equal(reads,before);
session={...session,shop:'foreign.myshopify.com'};assert.equal((await run()).status,403);
current=null;assert.equal((await run()).status,403);
// Each feed checks the existing online identity and independent permission intersection.
current=authority;
session={shop:SHOP,isOnline:true,expires:new Date(Date.now()+600000),
  onlineAccessInfo:{associated_user:{id:'123',account_owner:true},
    associated_user_scope:'read_products,read_inventory,read_locations'}};
let payload,variablesSeen;
const feeds={admin:async()=>({session,admin:{graphql:async(_q,{variables})=>{
  reads++;variablesSeen=variables;return Response.json(payload);
}}})};
const call=(suffix='',enabled=true)=>handleWorkCatalogRead({
  request:new Request('https://local/app/catalog'+suffix),authenticate:feeds,db,enabled});
const ready=(key,nodes,pageInfo={hasNextPage:false,endCursor:null})=>({data:{
  shop:{myshopifyDomain:SHOP,currencyCode:'USD'},[key]:{nodes,pageInfo}}});
payload=ready('collections',[{id:'gid://shopify/Collection/111',title:'Party'}],
  {hasNextPage:true,endCursor:'next-page'});
let res=await call('?view=collections&after=previous-page');
assert.equal(res.status,200);assert.equal(variablesSeen.after,'previous-page');
let body=await res.json();assert.equal(body.next_cursor,'next-page');
assert.equal(body.records[0].admin_url,'https://admin.shopify.com/store/jill-work/collections/111');
payload=ready('locations',[{id:'gid://shopify/Location/111',name:'Shop',isActive:false}]);
body=await (await call('?view=locations')).json();assert.equal(body.records[0].active,false);
const variant={id:'gid://shopify/ProductVariant/111',title:'Small',product:{id:'gid://shopify/Product/111',title:'Tote'},
  inventoryItem:{id:'gid://shopify/InventoryItem/111',tracked:false,inventoryLevels:{
    nodes:[{location:{id:'gid://shopify/Location/111',name:'Shop'},quantities:[{name:'available',quantity:0}]}],
    pageInfo:{hasNextPage:false,endCursor:null}}}};
payload=ready('productVariants',[variant]);
res=await call('?view=inventory');body=await res.json();
assert.match(res.headers.get('cache-control'),/no-store/);
assert.equal(body.records[0].stock_state,'not_tracked');
assert.equal(body.records[0].locations[0].available,null,'Untracked zero is not zero stock');
assert.equal(body.capacity_state,'not_measured');
variant.inventoryItem.tracked=true;variant.inventoryItem.inventoryLevels.nodes[0].quantities[0].quantity=-2;
payload=ready('productVariants',[variant]);
assert.equal((await (await call('?view=inventory')).json()).records[0].locations[0].available,-2);
variant.inventoryItem.inventoryLevels.pageInfo={hasNextPage:true,endCursor:'next-location'};
payload=ready('productVariants',[variant]);
assert.equal((await (await call('?view=inventory')).json()).records[0].locations_truncated,true);
variant.inventoryItem.inventoryLevels.pageInfo={hasNextPage:true};
payload=ready('productVariants',[variant]);
assert.equal((await call('?view=inventory')).status,503,'Malformed pagination is unavailable');
payload=ready('collections',[{id:'gid://shopify/Collection/111',title:'Party'}]);
payload.data.shop.myshopifyDomain='foreign.myshopify.com';
assert.equal((await call('?view=collections')).status,503,'Shop identity is verified in the upstream response');
for(const suffix of ['?view=unknown','?view=inventory&view=products','?after=a&after=b','?view=collections&unknown=x'])
  assert.equal((await call(suffix)).status,400);
for(const scopes of ['read_products','read_inventory,read_locations','read_products,read_inventory']){
  session.onlineAccessInfo.associated_user_scope=scopes;
  const n=reads;assert.equal((await call('?view=inventory')).status,403);assert.equal(reads,n);
}
session.onlineAccessInfo.associated_user_scope='read_products,read_inventory,read_locations';
current=null;let n=reads;assert.equal((await call('?view=inventory')).status,403);assert.equal(reads,n);
current=authority;session.expires=new Date(Date.now()-1);
n=reads;assert.equal((await call('?view=locations')).status,403);assert.equal(reads,n);
const a='11111111-2222-4333-8444-555555555555',b='21111111-2222-4333-8444-555555555555';
const version='31111111-2222-4333-8444-555555555555';
assert.equal(currentAllocation([{id:a,created_on:'2026-10-18T00:00:00Z',versions:[{version_id:version,percentage:100}]},
  {id:b,created_on:'2026-10-19T00:00:00Z',versions:[{version_id:version,percentage:100}]}]).deployment,b);
assert.throws(()=>currentAllocation([{id:a,created_on:'2026-10-19',versions:[{version_id:version,percentage:1}]}]));
assert.equal(edgeClockInterval({start:Date.parse('2026-10-19T00:00:00Z'),end:Date.parse('2026-10-19T00:00:01Z'),date:'Mon, 19 Oct 2026 00:00:00 GMT'}).outside_challenge_window,false);
assert.equal(edgeClockInterval({start:Date.parse('2026-10-19T00:02:00Z'),end:Date.parse('2026-10-19T00:02:01Z'),date:'Mon, 19 Oct 2026 00:00:00 GMT'}).outside_challenge_window,true);
console.log('PASS WORK catalog owner/product-scope denial before upstream reads, source outage/no fake zero, pagination and safe allocation/edge-clock classification.');
