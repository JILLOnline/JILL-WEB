import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planLocalWorkQuoteDraftSave}
 from '../services/jill-order-desk/work-quote-draft-plan.mjs';
import {projectVerifiedWorkQuoteCatalog}
 from '../services/jill-order-desk/work-quote-shopify-catalog-bridge.mjs';
import {JILL_WORK_MERCHANT_CLIENT_ID as APP}
 from '../backend/jill-merchant-auth.mjs';
import {handleWorkQuoteOwnerPreflight,workQuoteOwnerPreflightReady}
 from '../services/jill-order-desk/work-quote-owner-preflight.mjs';

const SHOP='jill-work.myshopify.com',ROOT='https://jill-work.example';
const ID='jill:22222222-3333-4444-8555-666666666666';
const VID='gid://shopify/ProductVariant/111',NOW=1792497600000;
const item={item_id:'item:synthetic-111',title:'Synthetic favor',
 quantity:2,variant_id:VID,attributes:[],
 reference_ids:[],personalization_groups:[],variant_allocations:[]};
const detail={submission_id:ID,revision:3,items:[item],
 planning:{fulfillment:'shipping',attributes:[]},
 request_attributes:[],reference_ids:[]};
const record={submission_id:ID,revision:3,customer_status:'reviewing',
 internal_status:'needs_quote',submitted_at:'2026-10-20T08:00:00Z',
 updated_at:'2026-10-20T09:00:00Z',date_needed:'2026-10-31',
 fulfillment:'shipping',item_count:1};
const list=()=>({version:1,operation:'custom_order.merchant.list.result',
 ok:true,shop:SHOP,complete:true,records:[record]});
const fees={materials:'0.00',labor:'0.00',shipping:'5.00',
 other:'0.00',discount:'0.00',tax:'0.00'};
const plan=planLocalWorkQuoteDraftSave({shop:SHOP,
 submissionId:ID,detail,record,
 lines:[{id:item.item_id,quantity:2,unitPrice:'23.50'}],
 fees,expectedDraftRevision:0,
 operationId:'jill:hq:quote:11111111-2222-4333-8444-555555555555',
 nowMs:NOW});
assert.equal(plan.quoted_total_cents,5200);
const p=plan.statements[0].params;
const row={shop:p[0],submission_id:p[1],draft_revision:p[2],
 source_revision:p[3],source_sha256:p[4],quote_sha256:p[5],
 quote_json:p[6],total_cents:p[7],currency:p[8],state:p[9],
 updated_at_ms:p[12]};
const gqlPrice=price=>({data:{
 shop:{myshopifyDomain:SHOP,currencyCode:'USD'},
 currentAppInstallation:{app:{apiKey:APP}},
 nodes:[{__typename:'ProductVariant',id:VID,title:'Favor size',
 sku:'TEST-111',price,
 product:{id:'gid://shopify/Product/222',title:'Synthetic favor',
 status:'ACTIVE'}}],
}});
const snapshot=projectVerifiedWorkQuoteCatalog({
 variantIds:[VID],result:gqlPrice('23.50'),nowMs:NOW});
const scopes='read_products,read_inventory,read_locations';
const session={shop:SHOP,isOnline:true,
 expires:new Date(Date.now()+600000),
 onlineAccessInfo:{associated_user:{id:123,account_owner:true},
 associated_user_scope:scopes}};
const state={auth:0,list:0,detail:0,db:0,catalog:0,mutations:0};
let owner=true,saved=row,sourceDetail=detail,sourceList=list(),
 catalogSnapshot=snapshot,catalogStatus='verified';
const authenticate={admin:async()=>{
 state.auth++;return {session:{...session,
 onlineAccessInfo:{...session.onlineAccessInfo,
 associated_user:{id:123,account_owner:owner}}}};
}};
const db={prepare:sql=>{
 state.db++;assert.ok(!/^INSERT|^UPDATE|^DELETE/i.test(sql));
 return {bind(...args){return {first:async()=>{
  if(sql.includes('FROM jill_merchant_authority'))
   return {shop:SHOP,environment:'WORK',app_client_id:APP,
    owner_staff_id:'123',policy_version:1};
  if(sql.includes('FROM jill_merchant_grants'))return null;
  if(sql.includes('FROM jill_work_quote_drafts')){
   assert.deepEqual(args,[SHOP,ID]);return saved;
  }
  throw Error('Unexpected D1 table');
 }}}};
}};
const readFreshList=async()=>{state.list++;return sourceList};
const readExactDetail=async({submissionId})=>{
 state.detail++;assert.equal(submissionId,ID);return sourceDetail;
};
const readCatalog=async({variantIds,enabled,authenticate:catalogAuth,db:boundDb})=>{
 state.catalog++;
 assert.equal(enabled,true);
 assert.equal(boundDb,db);
 assert.deepEqual(variantIds,[VID]);
 const {session:again}=await catalogAuth.admin();
 assert.equal(again.shop,SHOP);
 return {state:catalogStatus,snapshot:catalogSnapshot};
};
const base={enabled:true,authenticate,db,readFreshList,readExactDetail,
 readCatalog,now:()=>NOW+1000};
const url=ROOT+'/app/requests/quote-preflight?submission_id='+encodeURIComponent(ID);
const req=(input=url,options)=>new Request(input,options);
function safe(x){
 assert.equal(x.can_publish,false);assert.equal(x.can_invoice,false);
 assert.equal(x.can_create_order,false);assert.equal(x.can_charge_customer,false);
 assert.equal(x.can_send_email,false);assert.equal(x.source_only,true);
 assert.equal(x.native_shopify_calculation_performed,false);
 for(const secret of [ID,SHOP,'Synthetic favor','23.50','jill:hq:quote:']){
  assert.equal(JSON.stringify(x).includes(secret),false,'No private/saved quote data');
 }
}
let response=await handleWorkQuoteOwnerPreflight({
 ...base,request:req(),enabled:false});
assert.equal(response.status,503);
assert.equal((await response.json()).reason,'not_enabled');
assert.deepEqual(state,{auth:0,list:0,detail:0,db:0,catalog:0,mutations:0});
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,200);
let data=await response.json();
assert.equal(data.state,'held');assert.equal(data.reason,'trusted_customer_context_unavailable');
assert.equal(data.next_action,'verify_shopify_customer');
safe(data);
assert.equal(state.auth,1);assert.equal(state.list,1);
assert.equal(state.detail,1);assert.equal(state.catalog,1);
assert.ok(state.db>=2);
assert.deepEqual(workQuoteOwnerPreflightReady({}),false);
assert.deepEqual(workQuoteOwnerPreflightReady({
 JILL_WORK_HQ_QUOTE_CATALOG_PREFLIGHT_ENABLED:'true',
 JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED:'false',
}),false);

const before=()=>({...state});
const countNoExtra=(previous,field)=>{
 for(const key of ['list','detail','catalog']){
  if(key!==field)assert.equal(state[key],previous[key]);
 }
};
owner=false;
const old=before();
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,403);safe(await response.json());
assert.equal(state.list,old.list);assert.equal(state.catalog,old.catalog);
owner=true;
response=await handleWorkQuoteOwnerPreflight({
 ...base,request:req(url,{method:'POST',body:'{}'})});
assert.equal(response.status,405);safe(await response.json());
const previous=before();
response=await handleWorkQuoteOwnerPreflight({...base,request:req(url+'&email=forged@example.test')});
assert.equal(response.status,400);
assert.equal(state.auth,previous.auth,'Bad query must be denied before Shopify');
response=await handleWorkQuoteOwnerPreflight({...base,
 request:req(url,{headers:{origin:'https://untrusted.example.invalid'}})});
assert.equal(response.status,400);
sourceList={...sourceList,records:[]};
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,404);safe(await response.json());
sourceList=list();
sourceDetail={...detail,revision:4};
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,409);assert.equal((await response.json()).reason,'source_revision_changed');
sourceDetail=detail;
saved=null;
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,200);assert.equal((await response.json()).reason,'no_saved_draft');
saved={...row,quote_sha256:'a'.repeat(64)};
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,409);assert.equal((await response.json()).reason,'unverified_saved_draft');
saved=row;
catalogSnapshot={...snapshot,variants:[{
 ...snapshot.variants[0],shopify_unit_price_cents:2450}]};
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal((await response.json()).reason,'catalog_price_review_required');
catalogSnapshot={...snapshot,variants:[{
 ...snapshot.variants[0],product_status:'DRAFT'}]};
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,409);assert.equal((await response.json()).reason,'catalog_unverified');
catalogSnapshot=snapshot;
sourceDetail={...detail,items:[{...item,
 personalization_groups:[{id:'P1',attributes:[]}],
 variant_allocations:[{variant_id:VID,quantity:2,unit_ids:['u1','u2']}] }]};
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal((await response.json()).reason,'personalization_requires_review');
sourceDetail=detail;
catalogStatus='access_denied';
response=await handleWorkQuoteOwnerPreflight({...base,request:req()});
assert.equal(response.status,403);assert.equal((await response.json()).reason,'catalog_unavailable');
catalogStatus='verified';
const customerContext={
 customerGid:'gid://shopify/Customer/111',
 address:{address1:'1 Synthetic Road',city:'Jacksonville',provinceCode:'FL',
 zip:'32218',countryCode:'US'},
 shippingTitle:'Standard shipping',
};
response=await handleWorkQuoteOwnerPreflight({
 ...base,request:req(),
 resolveTrustedCustomerContext:async()=>customerContext,
});
assert.equal(response.status,200);
data=await response.json();
assert.equal(data.state,'ready_for_native_shopify_calculation');
assert.equal(data.next_action,'request_fresh_shopify_calculation');
assert.equal(data.can_invoice,false);assert.equal(data.can_create_order,false);
assert.equal(data.shopify_totals_verified,false);
assert.equal(JSON.stringify(data).includes('Synthetic Road'),false);
const source=readFileSync('services/jill-order-desk/work-quote-owner-preflight.mjs','utf8');
for(const forbidden of [/draftOrderCreate/,/draftOrderInvoiceSend/,/db\.batch\s*\(/,
 /fetch\s*\(/,/productUpdate/,/inventoryAdjust/]){
 assert.doesNotMatch(source,forbidden,'No Shopify/Google/D1 writes');
}
console.log('PASS WORK quote Owner preflight: OFF zero reads, OAuth+Owner/D1, exact signed request, hash-verified D1 draft, WORK catalog prices, stale/P1/P2 holds, unavailable customer context, no commerce/PII.');
