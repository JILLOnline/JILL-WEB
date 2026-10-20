// OFFLINE Shopify WORK Catalog integration: authentic Owner/shop, a
// bounded Admin GraphQL title query, exact variants/stock and zero mutations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  WORK_CATALOG_QUERY,WORK_COLLECTIONS_QUERY,
  WORK_INVENTORY_QUERY,WORK_LOCATIONS_QUERY,
  workCatalogProductSearch,handleWorkCatalogRead,
} from '../services/jill-order-desk/work-catalog-read.mjs';
import {JILL_WORK_MERCHANT_CLIENT_ID as CLIENT}
  from '../backend/jill-merchant-auth.mjs';

const SHOP='jill-work.myshopify.com',now=Date.now();
const scopes='read_products,read_inventory,read_locations';
const session={shop:SHOP,isOnline:true,scope:scopes,expires:new Date(now+600000),
  onlineAccessInfo:{associated_user:{id:123,account_owner:true},
    associated_user_scope:scopes}};
const authority={shop:SHOP,environment:'WORK',app_client_id:CLIENT,
  owner_staff_id:'123',policy_version:1};
const db={prepare:sql=>({bind:()=>({first:async()=>
  sql.includes('jill_merchant_authority')?authority:null})})};
const prod={id:'gid://shopify/Product/111',title:'Synthetic Custom Tote',
  handle:'synthetic-custom-tote',status:'ACTIVE',vendor:'JILL',
  productType:'Kids activities',totalInventory:14,
  variants:{nodes:[{id:'gid://shopify/ProductVariant/221',
    title:'8x8',price:'14.95',sku:'KIT-8',inventoryPolicy:'DENY'}],
    pageInfo:{hasNextPage:true,endCursor:'VARIANT_AFTER'}}};
const page=(connection,nodes,hasMore=false)=>({data:{
  shop:{myshopifyDomain:SHOP,currencyCode:'USD'},
  [connection]:{nodes,pageInfo:{hasNextPage:hasMore,endCursor:hasMore?'NEXT_CURSOR':null}},
}});
let reads=0,lastQuery='',lastVariables=null,reply=page('products',[prod],true);
const authenticate={admin:async request=>{
  assert.equal(request.method,'GET');
  return {session,admin:{graphql:async(query,options)=>{
    reads++;lastQuery=query;lastVariables=options.variables;
    assert.equal(options.tries,1);
    assert.ok(options.signal);
    return {ok:true,json:async()=>reply};
  }}};
}};
const run=async (query='',enabled=true)=>
  handleWorkCatalogRead({request:new Request(
    'https://jill-order-desk-canary-work.example/app/catalog'+query),
    authenticate,db,enabled,now:()=>now});
assert.equal(workCatalogProductSearch(' custom tote '),'title:"custom tote"');
assert.equal(workCatalogProductSearch('Tote Niño & Mamá'),'title:"Tote Niño & Mamá"');
for(const bad of ['', 'a','x'.repeat(65),'title:shirt','kit*',
  'tote OR status:ACTIVE','shirt"','shirt\\size','foo\nbar','hello<script>']){
  assert.throws(()=>workCatalogProductSearch(bad),/catalog_search_invalid/);
}
assert.match(WORK_CATALOG_QUERY,/products\(first: 20, after: \$after, query: \$search, sortKey: ID\)/);
assert.match(WORK_CATALOG_QUERY,/handle vendor productType totalInventory/);
assert.match(WORK_CATALOG_QUERY,/id title price sku inventoryPolicy/);
for(const query of [WORK_CATALOG_QUERY,WORK_COLLECTIONS_QUERY,
  WORK_INVENTORY_QUERY,WORK_LOCATIONS_QUERY]){
  assert.doesNotMatch(query,/\bmutation\b|productUpdate|inventoryAdjust|metafieldsSet/);
}
let response=await run('?view=products&q=Custom%20Tote');
let json=await response.json();
assert.equal(response.status,200);
assert.equal(response.headers.get('cache-control'),'private, no-store, max-age=0');
assert.equal(json.state,'ready');
assert.equal(json.search,'Custom Tote');
assert.equal(json.view,'products');
assert.equal(json.currency,'USD');
assert.equal(json.next_cursor,'NEXT_CURSOR');
assert.equal(json.records.length,1);
assert.deepEqual(json.records[0].variants[0],{
  id:'gid://shopify/ProductVariant/221',title:'8x8',price:'14.95',
  sku:'KIT-8',inventory_policy:'DENY'});
assert.equal(json.records[0].vendor,'JILL');
assert.equal(json.records[0].total_inventory,14);
assert.equal(json.records[0].variants_truncated,true);
assert.equal(json.records[0].admin_url,'https://admin.shopify.com/store/jill-work/products/111');
assert.equal(lastVariables.search,'title:"Custom Tote"');
assert.equal(lastVariables.after,null);
assert.equal(reads,1);
response=await run('?view=products&q=Custom%20Tote&after=NEXT_CURSOR');
json=await response.json();
assert.equal(json.next_cursor,'NEXT_CURSOR');
assert.equal(lastVariables.after,'NEXT_CURSOR');
assert.equal(lastVariables.search,'title:"Custom Tote"');
assert.equal(reads,2);
response=await run('?view=products');
assert.equal((await response.json()).state,'ready');
assert.equal(lastVariables.search,null);
assert.equal(reads,3);
for(const query of ['?view=inventory&q=tote','?view=products&q=shirt%22',
  '?view=products&q=abc%3Adef','?view=products&q=x',
  '?view=products&q=one&q=two','?view=products&after=%20cursor',
  '?view=products&extra=anything']){
  response=await run(query);assert.equal(response.status,400);
  assert.equal((await response.json()).state,'invalid_request');
}
assert.equal(reads,3,'Bad parameters must never reach Shopify');
response=await run('?view=products',false);
assert.equal((await response.json()).state,'not_connected');
assert.equal(reads,3,'Disabled catalog must never call Shopify');
const locations=[{id:'gid://shopify/Location/301',name:'WORK shop',isActive:true}];
reply=page('locations',locations);
response=await run('?view=locations');
json=await response.json();
assert.equal(json.state,'ready');
assert.deepEqual(json.records[0],{id:locations[0].id,title:'WORK shop',
  active:true,admin_url:'https://admin.shopify.com/store/jill-work/settings/locations/301'});
assert.equal(Object.hasOwn(lastVariables,'search'),false);
reply=page('collections',[{id:'gid://shopify/Collection/401',title:'Party Favors'}]);
response=await run('?view=collections');
json=await response.json();assert.equal(json.records[0].title,'Party Favors');
reply=page('inventory',[{id:'gid://shopify/ProductVariant/221',
  title:'8x8',product:{id:prod.id,title:prod.title},
  inventoryItem:{id:'gid://shopify/InventoryItem/501',tracked:true,
    inventoryLevels:{nodes:[{location:{id:locations[0].id,name:'WORK shop'},
      quantities:[{name:'available',quantity:7}]}],
      pageInfo:{hasNextPage:false,endCursor:null}}}]);
response=await run('?view=inventory');json=await response.json();
assert.equal(json.records[0].locations[0].available,7);
assert.equal(json.capacity_state,'not_measured');
const before=reads;
reply=page('products',[{...prod,totalInventory:2.5}]);
response=await run('?view=products');
assert.equal(response.status,503);
assert.equal((await response.json()).state,'source_unavailable');
assert.equal(reads,before+1);
reply={data:{shop:{myshopifyDomain:'live.myshopify.com',currencyCode:'USD'},
 products:page('products',[prod]).data.products}};
response=await run('?view=products');
assert.equal(response.status,503);
assert.equal((await response.json()).state,'source_unavailable');
const deny={admin:async()=>({session:{...session,
  onlineAccessInfo:{...session.onlineAccessInfo,
    associated_user:{id:999,account_owner:false}}},admin:{graphql:async()=>{
      throw Error('Denied request called Shopify');}}})};
response=await handleWorkCatalogRead({request:new Request(
 'https://work.example/app/catalog?view=products'),authenticate:deny,db,enabled:true});
assert.equal(response.status,403);
assert.equal((await response.json()).state,'access_denied');
const ui=readFileSync('services/jill-order-desk/app-home/app/routes/app.catalog.tsx','utf8');
const style=readFileSync('services/jill-order-desk/app-home/app/styles/hq-catalog.css','utf8');
assert.match(ui,/<Form method="get" action="\/app\/catalog"/);
assert.match(ui,/name="q"/);
assert.match(ui,/next\.set\("q",data\.search!\)/);
assert.match(ui,/variants_truncated/);
assert.match(ui,/product\.total_inventory/);
assert.match(ui,/href=\{product\.admin_url\}/);
assert.match(ui,/WORK · SHOPIFY ADMIN/);
assert.match(ui,/No product, price or inventory edits from HQ/);
assert.match(style,/@media\(max-width:980px\)/);
assert.match(style,/\.jill-catalog__table/);
for(const source of [ui,style]){
  assert.doesNotMatch(source,/fetch\(|localStorage|sessionStorage|document\.cookie|window\.parent|!important/);
}
console.log('PASS HQ WORK Shopify Catalog: Owner authenticated reads, title query sanitized, pagination and SKU/inventory projection, no inventory/price mutations, safe gate/denial, responsive UI. OFFLINE.');
