import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JILL_WORK_MERCHANT_CLIENT_ID as APP}
 from '../backend/jill-merchant-auth.mjs';
import {
 WORK_QUOTE_CUSTOMER_QUERY,projectWorkQuoteOwnerBinding,
 projectExactWorkShopifyCustomer,readAuthorizedWorkQuoteCustomer,
} from '../services/jill-order-desk/work-quote-shopify-customer-bridge.mjs';

const SHOP='jill-work.myshopify.com';
const ID='jill:11111111-2222-4333-8444-555555555555';
const GID='gid://shopify/Customer/111';
const NOW=1792497600000;
const signed={
 version:1,operation:'custom_order.merchant.owner_binding.result',
 ok:true,shop:SHOP,submission_id:ID,source_revision:3,
 owner_status:'signed_shopify_customer',
 owner_customer_gid:GID,raw_payload_sha256:'a'.repeat(64),
 verified_at_ms:NOW-1000,
};
const valid=projectWorkQuoteOwnerBinding({
 source:signed,submissionId:ID,sourceRevision:3,nowMs:NOW,
});
assert.equal(valid.state,'owner_binding_projected');
assert.equal(valid.backend_signature_verified,false,
 'JSON schema MUST NEVER count as an authenticated Google read');
for(const part of [
 {shop:'jill-live.myshopify.com'},
 {submission_id:'jill:foreign-request-111'},
 {source_revision:4},
 {owner_status:'guest'},
 {owner_customer_gid:'a@example.test'},
 {raw_payload_sha256:'0'},
 {verified_at_ms:NOW-300001},
 {verified_at_ms:NOW+1},
 {ok:false},
 {operation:'custom_order.merchant.list.result'},
]){
 assert.equal(projectWorkQuoteOwnerBinding({
  source:{...signed,...part},submissionId:ID,sourceRevision:3,
  nowMs:NOW,
 }).state,'held','Wrong/guest/stale/fabricated owner proof cannot authorize');
}
const graphqlResult=(gid=GID)=>({data:{
 shop:{myshopifyDomain:SHOP,currencyCode:'USD'},
 currentAppInstallation:{app:{apiKey:APP}},
 node:{__typename:'Customer',id:gid,
  email:'must-never-be-returned@example.test',defaultAddress:{address1:'PRIVATE'}},
}});
const verified=projectExactWorkShopifyCustomer({
 result:graphqlResult(),expectedGid:GID,nowMs:NOW,
});
assert.equal(verified.state,'exact_shopify_customer_verified');
assert.equal(verified.full_delivery_address_verified,false);
assert.equal(verified.shipping_terms_verified,false);
assert.equal(JSON.stringify(verified).includes('PRIVATE'),false);
assert.equal(JSON.stringify(verified).includes('must-never'),false);
for(const result of [
 graphqlResult('gid://shopify/Customer/222'),
 {...graphqlResult(),errors:[{message:'Access denied'}]},
 {...graphqlResult(),data:{...graphqlResult().data,
  shop:{myshopifyDomain:'jill-live.myshopify.com',currencyCode:'USD'}}},
 {...graphqlResult(),data:{...graphqlResult().data,
  shop:{myshopifyDomain:SHOP,currencyCode:'CAD'}}},
 {...graphqlResult(),data:{...graphqlResult().data,
  currentAppInstallation:{app:{apiKey:'another-application'}}}},
 {...graphqlResult(),data:{...graphqlResult().data,
  node:{__typename:'Product',id:GID}}},
 {...graphqlResult(),data:{...graphqlResult().data,node:null}},
 ]){
 assert.equal(projectExactWorkShopifyCustomer({
  result,expectedGid:GID,nowMs:NOW,
 }).state,'held');
}
const state={auth:0,d1:0,ownership:0,graphql:0};
const session={shop:SHOP,isOnline:true,
 onlineAccessInfo:{associated_user:{id:123,account_owner:true},
 associated_user_scope:'read_products,read_inventory,read_locations,read_customers,read_draft_orders,write_draft_orders'}};
let owner=true,scopes=session.onlineAccessInfo.associated_user_scope;
const authenticate={admin:async()=>{
 state.auth++;
 return {session:{...session,onlineAccessInfo:{
  associated_user:{id:123,account_owner:owner},
  associated_user_scope:scopes,
 }},
 admin:{graphql:async(query,opts)=>{
  state.graphql++;
  assert.equal(query,WORK_QUOTE_CUSTOMER_QUERY);
  assert.deepEqual(opts.variables,{id:GID});
  assert.equal(opts.tries,1);
  assert.ok(opts.signal);
  return new Response(JSON.stringify(graphqlResult()),{status:200});
 }},
 };
}};
const db={prepare:(sql)=>{
 state.d1++;
 return{bind(){return{first:async()=>{
  if(sql.includes('FROM jill_merchant_authority'))
   return {shop:SHOP,environment:'WORK',app_client_id:APP,
    owner_staff_id:'123',policy_version:1};
  if(sql.includes('FROM jill_merchant_grants'))return null;
  throw Error('Unexpected D1 read');
 }}}};
}};
const readSignedOwnerBinding=async({submissionId,sourceRevision})=>{
 state.ownership++;
 assert.equal(submissionId,ID);
 assert.equal(sourceRevision,3);
 return signed;
};
const args={request:new Request('https://jill-work.example/app/requests/quote-preflight'),
 authenticate,db,readSignedOwnerBinding,submissionId:ID,sourceRevision:3,
 now:()=>NOW};
const none=await readAuthorizedWorkQuoteCustomer({...args,enabled:false});
assert.equal(none.state,'held');
assert.deepEqual(state,{auth:0,d1:0,ownership:0,graphql:0},
 'OFF means no auth, no D1, no Google ownership, no Shopify');
const noSource=await readAuthorizedWorkQuoteCustomer({...args,
 enabled:true,readSignedOwnerBinding:undefined});
assert.equal(noSource.reason,'owner_customer_source_unavailable');
assert.deepEqual(state,{auth:0,d1:0,ownership:0,graphql:0});
owner=false;
const refused=await readAuthorizedWorkQuoteCustomer({...args,enabled:true});
assert.equal(refused.reason,'owner_customer_access_denied');
assert.equal(state.ownership,0);assert.equal(state.graphql,0);
owner=true;scopes='read_products,read_customers';
const noScopes=await readAuthorizedWorkQuoteCustomer({...args,enabled:true});
assert.equal(noScopes.reason,'owner_customer_access_denied');
assert.equal(state.ownership,0);assert.equal(state.graphql,0);
scopes=session.onlineAccessInfo.associated_user_scope;
const good=await readAuthorizedWorkQuoteCustomer({...args,enabled:true});
assert.equal(good.state,'owner_customer_identity_verified');
assert.equal(good.customer_gid,GID);
assert.equal(good.full_delivery_address_verified,false);
assert.equal(good.shipping_terms_verified,false);
for(const key of ['can_publish','can_invoice','can_create_order',
 'can_charge_customer','can_send_email'])assert.equal(good[key],false);
assert.equal(state.ownership,1);assert.equal(state.graphql,1);
assert.equal(JSON.stringify(good).includes('must-never'),false);
assert.equal(JSON.stringify(good).includes('PRIVATE'),false);
const guest=await readAuthorizedWorkQuoteCustomer({...args,enabled:true,
 readSignedOwnerBinding:async()=>({...signed,
  owner_status:'guest',owner_customer_gid:null})});
assert.equal(guest.reason,'signed_owner_binding_missing_or_stale');
assert.equal(state.graphql,1,'Guest never triggers Shopify Customer Admin lookup');
const wrong=await readAuthorizedWorkQuoteCustomer({...args,enabled:true,
 readSignedOwnerBinding:async()=>({...signed,owner_customer_gid:'gid://shopify/Customer/222'})});
assert.equal(wrong.reason,'shopify_customer_identity_unverified');
const script=readFileSync('services/jill-order-desk/work-quote-shopify-customer-bridge.mjs','utf8');
assert.doesNotMatch(script,/draftOrderCreate|draftOrderInvoiceSend|draftOrderCalculate|db\.batch\s*\(/);
assert.doesNotMatch(script,/customerByEmail|email\s*:/);
assert.match(script,/action:'quote\.calculate'/);
assert.match(script,/readSignedOwnerBinding/);
assert.match(script,/source\.owner_status!=='signed_shopify_customer'/);
assert.match(script,/full_delivery_address_verified:false/);
console.log('PASS exact WORK quote customer proof: signed binding schema, real owner scopes, Shopify GID/shop/app/USD, guest/email/takeover denied, no address inference, no writes.');
