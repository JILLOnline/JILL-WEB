import assert from 'node:assert/strict';
import {prepareWorkQuoteCalculation as prepare,projectWorkQuoteCalculation as project,
 calculateAuthorizedWorkQuote as calculate,WORK_QUOTE_CALCULATE,WORK_QUOTE_SHOP_QUERY} from '../services/jill-order-desk/work-quote-calculation.mjs';
import {freezeWorkQuote} from '../services/jill-order-desk/work-quote-agreement.mjs';
const SHOP='jill-work.myshopify.com',CUSTOMER='gid://shopify/Customer/111';
const now=Date.now();
const intent={customer_gid:CUSTOMER,lines:[{variant_id:'gid://shopify/ProductVariant/111',quantity:3,unit_price_cents:33,options:'Blue / Maya'}],
 fulfillment:'shipping',address:{address1:'1 Synthetic Test Way',city:'Jacksonville',provinceCode:'FL',zip:'32218',countryCode:'US'},
 shipping:{title:'Reviewed shipping amount',amount_cents:500},reward:null};
const bag=n=>({shopMoney:{amount:(n/100).toFixed(2),currencyCode:'USD'},presentmentMoney:{amount:(n/100).toFixed(2),currencyCode:'USD'}});
function result(p){const i=p.variables.input;return {data:{draftOrderCalculate:{userErrors:[],calculatedDraftOrder:{
 currencyCode:'USD',presentmentCurrencyCode:'USD',customer:{id:CUSTOMER},taxesIncluded:false,acceptAutomaticDiscounts:false,
 discountCodes:i.discountCodes,warnings:[],lineItems:i.lineItems.map(l=>({variant:{id:l.variantId},quantity:l.quantity,custom:false,
 customAttributes:l.customAttributes,originalTotalSet:bag(99)})),totalShippingPriceSet:bag(500),totalTaxSet:bag(7),
 totalDiscountsSet:bag(p.intent.reward?.discount_cents??0),totalPriceSet:bag(606-(p.intent.reward?.discount_cents??0))}}}};}
const prepared=prepare(intent),raw=result(prepared),calculated=project({prepared,result:raw,nowMs:now});
const mutable=structuredClone(intent),copied=prepare(mutable);
mutable.lines[0].unit_price_cents=999;mutable.address.city='Changed';mutable.shipping.amount_cents=999;
assert.equal(copied.variables.input.lineItems[0].priceOverride.amount,'0.33');
assert.equal(copied.variables.input.shippingAddress.city,'Jacksonville');
assert.equal(copied.intent.shipping.amount_cents,500);
assert.equal(calculated.state,'calculated');assert.equal(calculated.calculation.lines[0].subtotal_cents,99);
assert.equal(calculated.calculation.total_cents,606);assert.equal(prepared.variables.input.lineItems[0].priceOverride.amount,'0.33');
const frozen=freezeWorkQuote({submissionId:'jill:synthetic-calculation-111',revision:1,
 source:{customer_gid:CUSTOMER,revision:2,sha256:'a'.repeat(64)},calculation:calculated.calculation,
 nowMs:now,expiresAtMs:now+3600000,staffId:'123'});
assert.equal(frozen.terms.totals.total_cents,606);
const absent=prepare({...intent,address:null}),preview=project({prepared:absent,result:result(absent),nowMs:now});
assert.equal(preview.state,'address_required');assert.equal(preview.calculation,null);assert.equal(preview.publishable,false);
assert.throws(()=>freezeWorkQuote({submissionId:'jill:synthetic-calculation-111',revision:1,
 source:{customer_gid:CUSTOMER,revision:2,sha256:'a'.repeat(64)},calculation:preview.calculation,
 nowMs:now,expiresAtMs:now+3600000,staffId:'123'}));
for(const change of [x=>x.customer.id='gid://shopify/Customer/222',x=>x.lineItems[0].quantity=2,
 x=>x.lineItems[0].customAttributes[0].value='changed',x=>x.totalPriceSet=bag(600),x=>x.totalDiscountsSet=bag(1),
 x=>x.totalShippingPriceSet=bag(501),x=>x.taxesIncluded=true,x=>x.discountCodes=['UNREVIEWED'],
 x=>x.acceptAutomaticDiscounts=true,x=>x.warnings=[{__typename:'PriceWarning'}],x=>x.lineItems[0].originalTotalSet.shopMoney.currencyCode='CAD',
 x=>x.lineItems[0].originalTotalSet=bag(100),x=>x.lineItems[0].originalTotalSet.shopMoney.amount='0.333',
 x=>x.lineItems.push({...x.lineItems[0]}),x=>x.lineItems[0].custom=true]){
 const changed=structuredClone(raw);change(changed.data.draftOrderCalculate.calculatedDraftOrder);
 assert.throws(()=>project({prepared,result:changed,nowMs:now}));
}
assert.throws(()=>project({prepared,result:{errors:[{message:'PRIVATE ERROR'}]}}));
const rejected=structuredClone(raw);rejected.data.draftOrderCalculate.userErrors=[{message:'PRIVATE ERROR'}];
assert.throws(()=>project({prepared,result:rejected}));
const changedInput=structuredClone(prepared);changedInput.variables.input.lineItems[0].quantity=2;
assert.throws(()=>project({prepared:changedInput,result:raw}));
const reward=prepare({...intent,reward:{reservation_id:'reward:synthetic-111',code:'ORIGINAL_V13_CODE',discount_cents:10,policy:'v13'}});
const withReward=project({prepared:reward,result:result(reward),nowMs:now});
assert.equal(withReward.calculation.reward.code,'ORIGINAL_V13_CODE');assert.equal(withReward.calculation.discount_cents,10);
assert.equal(reward.variables.input.acceptAutomaticDiscounts,false);assert.equal(reward.variables.input.allowDiscountCodesInCheckout,false);
for(const invalid of [{...intent,lines:[...intent.lines,...intent.lines]}, {...intent,address:{...intent.address,email:'extra'}},
 {...intent,lines:[{...intent.lines[0],unit_price_cents:0.33}]}, {...intent,lines:[{...intent.lines[0],quantity:1000}]},
 {...intent,customer_gid:'email@example.invalid'}, {...intent,reward:{...reward.intent.reward,policy:'new-policy'}}])assert.throws(()=>prepare(invalid));
let networkCalls=0,authCalls=0;
const scopes='write_draft_orders,read_draft_orders,read_customers,read_products';
const session={shop:SHOP,isOnline:true,scope:scopes,expires:new Date(now+3600000),
 onlineAccessInfo:{associated_user:{id:123,account_owner:true},associated_user_scope:scopes}};
const authority={shop:SHOP,environment:'WORK',app_client_id:'f8e1ebdbae84490dc8ea5b133637e6c0',owner_staff_id:'123',policy_version:1};
const db={prepare:sql=>({bind:()=>({first:async()=>sql.includes('jill_merchant_authority')?authority:null})})};
const admin={graphql:async (query,options)=>{networkCalls++;assert.equal(options.tries,1);return Response.json(query===WORK_QUOTE_SHOP_QUERY?
 {data:{shop:{myshopifyDomain:SHOP,currencyCode:'USD'},currentAppInstallation:{app:{apiKey:'f8e1ebdbae84490dc8ea5b133637e6c0'}}}}:raw);}};
const args={enabled:true,db,authenticate:{admin:async()=>{authCalls++;return {session,admin};}},readIntent:async()=>intent,now:()=>now};
assert.equal((await calculate({...args,enabled:false})).state,'not_enabled');assert.equal(authCalls,0);
assert.equal((await calculate(args)).state,'calculated');assert.equal(networkCalls,2);
for(const invalidSession of [{...session,shop:'live.myshopify.com'},{...session,isOnline:false},
 {...session,expires:new Date(now-1)},
 {...session,onlineAccessInfo:{...session.onlineAccessInfo,associated_user_scope:''}},
 ...scopes.split(',').map(scope=>({...session,onlineAccessInfo:{...session.onlineAccessInfo,
  associated_user_scope:scopes.split(',').filter(x=>x!==scope).join(',')}})),
 {...session,onlineAccessInfo:{...session.onlineAccessInfo,associated_user:{id:999,account_owner:false}}}]){
 const previous=networkCalls;assert.equal((await calculate({...args,authenticate:{admin:async()=>({session:invalidSession,admin})}})).state,'access_denied');
 assert.equal(networkCalls,previous,'denial must precede Shopify calculation');
}
let sourceRead=false;
const foreignAdmin={graphql:async()=>Response.json({data:{shop:{myshopifyDomain:'live.myshopify.com',currencyCode:'USD'}}})};
assert.equal((await calculate({...args,authenticate:{admin:async()=>({session,admin:foreignAdmin})},readIntent:async()=>{sourceRead=true;return intent;}})).state,'calculation_unavailable');
assert.equal(sourceRead,false,'foreign app/shop cannot access quote intent');
const otherApp={graphql:async()=>Response.json({data:{shop:{myshopifyDomain:SHOP,currencyCode:'USD'},currentAppInstallation:{app:{apiKey:'foreign-app'}}}})};
assert.equal((await calculate({...args,authenticate:{admin:async()=>({session,admin:otherApp})}})).state,'calculation_unavailable');
const unavailableDb={prepare:()=>{throw Error('PRIVATE D1 DETAILS');}};
assert.equal((await calculate({...args,db:unavailableDb})).state,'access_denied');
let tick=0;
assert.equal((await calculate({...args,now:()=>tick++===0?now:now+31000})).state,'calculation_unavailable');
const outage={graphql:async()=>{throw Error('PRIVATE UPSTREAM TOKEN');}};
assert.deepEqual(await calculate({...args,authenticate:{admin:async()=>({session,admin:outage})}}),{state:'calculation_unavailable',calculation:null,publishable:false});
await assert.rejects(()=>calculate({...args,authenticate:{admin:async()=>{throw new Response('auth required',{status:401});}}}),x=>x instanceof Response&&x.status===401);
assert.doesNotMatch(WORK_QUOTE_CALCULATE,/draftOrderCreate|draftOrderComplete|draftOrderInvoiceSend/);
console.log('PASS canonical WORK quote calculation: exact integer prices/totals/personalization/customer, address-required hold, reservation discount read-back, non-stacking inputs, fail-closed online Owner/app/shop authority, no create/invoice/retry.');
