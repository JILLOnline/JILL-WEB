// Server-only Shopify pricing adapter. No public route, create, invoice,
// completion, wallet mutation, persistence or automatic retry. Source callers
// must load the quote intent from the existing authorized draft/source owners.
import {agreementHash,normalizeWorkQuoteAddress} from './work-quote-agreement.mjs';
import {readWorkMerchantPermission} from './merchant-access.mjs';
import {JILL_WORK_MERCHANT_SHOP as SHOP,JILL_WORK_MERCHANT_CLIENT_ID as CLIENT} from '../../backend/jill-merchant-auth.mjs';
const MAX=100000000;
const PERSONALIZATION='JILL personalization';
const fail=code=>{throw Error('work_quote_calculation_'+code);};
const check=(ok,code)=>{if(!ok)fail(code);};
const object=x=>Boolean(x&&Object.getPrototypeOf(x)===Object.prototype);
const keys=(x,allowed,required=allowed)=>object(x)&&Object.keys(x).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(x,k));
const cents=x=>Number.isSafeInteger(x)&&x>=0&&x<=MAX;
const gid=(x,type)=>new RegExp('^gid://shopify/'+type+'/[1-9][0-9]*$').test(x||'');
const text=(x,max)=>typeof x==='string'&&x.length<=max&&!/[\x00-\x1f\x7f]/.test(x);
const moneyInput=n=>({amount:Math.floor(n/100)+'.'+String(n%100).padStart(2,'0'),currencyCode:'USD'});
function money(bag){
 const values=['shopMoney','presentmentMoney'].map(key=>{
  const m=bag?.[key];check(m?.currencyCode==='USD'&&typeof m.amount==='string'&&/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(m.amount),'money_invalid');
  const [whole,fraction='']=m.amount.split('.'),n=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  check(cents(n),'money_invalid');return n;
 });
 check(values[0]===values[1],'currency_conversion');return values[0];
}
const bag='{ shopMoney { amount currencyCode } presentmentMoney { amount currencyCode } }';
export const WORK_QUOTE_SHOP_QUERY=`query JillWorkQuoteShop {
 shop { myshopifyDomain currencyCode }
 currentAppInstallation { app { apiKey } }
}`;
export const WORK_QUOTE_CALCULATE=`mutation JillWorkQuoteCalculate($input: DraftOrderInput!) {
 draftOrderCalculate(input: $input) {
  calculatedDraftOrder {
   currencyCode presentmentCurrencyCode customer { id }
   taxesIncluded acceptAutomaticDiscounts discountCodes warnings { __typename }
   lineItems {
    variant { id } quantity custom customAttributes { key value }
    originalTotalSet ${bag}
   }
   totalShippingPriceSet ${bag}
   totalTaxSet ${bag}
   totalDiscountsSet ${bag}
   totalPriceSet ${bag}
  }
  userErrors { field message }
 }
}`;
export function prepareWorkQuoteCalculation(intent){
 check(keys(intent,['customer_gid','lines','fulfillment','address','shipping','reward']),'input_invalid');
 check(gid(intent.customer_gid,'Customer')&&['pickup','shipping'].includes(intent.fulfillment),'input_invalid');
 check(Array.isArray(intent.lines)&&intent.lines.length>=1&&intent.lines.length<=20,'lines_invalid');
 const lines=intent.lines.map(line=>{
  check(keys(line,['variant_id','quantity','unit_price_cents','options'])&&gid(line.variant_id,'ProductVariant')&&
   Number.isSafeInteger(line.quantity)&&line.quantity>0&&line.quantity<=999&&cents(line.unit_price_cents)&&
   cents(line.quantity*line.unit_price_cents)&&text(line.options,500),'line_invalid');
  return {...line};
 });
 check(new Set(lines.map(x=>x.variant_id)).size===lines.length,'duplicate_variant');
 check(cents(lines.reduce((sum,line)=>sum+line.quantity*line.unit_price_cents,0)),'quote_over_limit');
 const address=intent.address===null?null:normalizeWorkQuoteAddress(intent.address);
 check(keys(intent.shipping,['title','amount_cents'])&&text(intent.shipping.title,255)&&
  intent.shipping.title.trim()&&cents(intent.shipping.amount_cents),'shipping_invalid');
 let reward=null;
 if(intent.reward!==null){
  const r=intent.reward;check(keys(r,['reservation_id','code','discount_cents','policy'])&&
   /^[A-Za-z0-9._:-]{8,128}$/.test(r.reservation_id||'')&&/^[A-Za-z0-9_-]{4,80}$/.test(r.code||'')&&
   cents(r.discount_cents)&&r.discount_cents>0&&['v13','universal_v1'].includes(r.policy),'reward_invalid');
  reward={...r};
 }
 const normalized={customer_gid:intent.customer_gid,lines,fulfillment:intent.fulfillment,address,
  shipping:{...intent.shipping},reward};
 const input={purchasingEntity:{customerId:normalized.customer_gid},presentmentCurrencyCode:'USD',
  useCustomerDefaultAddress:false,acceptAutomaticDiscounts:false,allowDiscountCodesInCheckout:false,
  discountCodes:reward?[reward.code]:[],
  lineItems:lines.map(line=>({variantId:line.variant_id,quantity:line.quantity,
   priceOverride:moneyInput(line.unit_price_cents),
   customAttributes:line.options?[{key:PERSONALIZATION,value:line.options}]:[]})),
  shippingLine:{title:normalized.shipping.title,priceWithCurrency:moneyInput(normalized.shipping.amount_cents)},
  ...(address?{shippingAddress:address}:{})};
 // Copy all values: caller mutation cannot change the dispatched calculation.
 return {intent:normalized,variables:{input},input_sha256:agreementHash({shop:SHOP,input}),
  address_sha256:address?agreementHash(address):null};
}
export function projectWorkQuoteCalculation({prepared,result,nowMs=Date.now()}={}){
 // Rebuild hashes from the captured normalized intent, not caller fingerprints.
 const p=prepareWorkQuoteCalculation(prepared?.intent);
 check(agreementHash(prepared)===agreementHash(p),'input_changed');
 check(Number.isSafeInteger(nowMs)&&nowMs>0,'clock_invalid');
 check(result&&(!result.errors||Array.isArray(result.errors)&&result.errors.length===0),'upstream_failed');
 const payload=result.data?.draftOrderCalculate;
 check(Array.isArray(payload?.userErrors)&&payload.userErrors.length===0,'shopify_rejected');
 const c=payload.calculatedDraftOrder;
 check(c?.currencyCode==='USD'&&c.presentmentCurrencyCode==='USD'&&
  c.customer?.id===p.intent.customer_gid,'customer_or_currency_changed');
 check(c.taxesIncluded===false,'tax_inclusive_not_supported');
 check(c.acceptAutomaticDiscounts===false&&Array.isArray(c.discountCodes)&&
  agreementHash(c.discountCodes)===agreementHash(p.variables.input.discountCodes),'discount_changed');
 check(Array.isArray(c.warnings)&&c.warnings.length===0,'shopify_warning');
 check(Array.isArray(c.lineItems)&&c.lineItems.length===p.intent.lines.length,'lines_changed');
 const byVariant=new Map();
 for(const line of c.lineItems){
  check(line.custom===false&&gid(line.variant?.id,'ProductVariant')&&!byVariant.has(line.variant.id),'lines_changed');
  byVariant.set(line.variant.id,line);
 }
 const lines=p.intent.lines.map(expected=>{
  const actual=byVariant.get(expected.variant_id);
  check(actual?.quantity===expected.quantity&&
   agreementHash(actual.customAttributes)===agreementHash(expected.options?[{key:PERSONALIZATION,value:expected.options}]:[]),'personalization_or_quantity_changed');
  const subtotal=money(actual.originalTotalSet);
  check(subtotal===expected.unit_price_cents*expected.quantity,'price_changed');
  return {variant_id:expected.variant_id,quantity:expected.quantity,subtotal_cents:subtotal,options:expected.options};
 });
 const totals={items_cents:lines.reduce((sum,line)=>sum+line.subtotal_cents,0),
  shipping_cents:money(c.totalShippingPriceSet),tax_cents:money(c.totalTaxSet),
  discount_cents:money(c.totalDiscountsSet),total_cents:money(c.totalPriceSet)};
 check(Object.values(totals).every(cents)&&totals.shipping_cents===p.intent.shipping.amount_cents&&
  totals.discount_cents===(p.intent.reward?.discount_cents??0),'shipping_or_discount_changed');
 check(totals.items_cents+totals.shipping_cents+totals.tax_cents-totals.discount_cents===totals.total_cents,'totals_changed');
 // No address means no accepted/publishable tax result. Keep an explicitly
 // provisional preview, never manufacture a verified address fingerprint.
 if(!p.intent.address)return {state:'address_required',calculation:null,preview:{currency:'USD',totals},publishable:false};
 return {state:'calculated',publishable:true,calculation:{shop:SHOP,customer_gid:p.intent.customer_gid,currency:'USD',
  input_sha256:p.input_sha256,address_sha256:p.address_sha256,calculated_at_ms:nowMs,
  lines,fulfillment:p.intent.fulfillment,address:p.intent.address,shipping_title:p.intent.shipping.title,
  shipping_cents:totals.shipping_cents,tax_cents:totals.tax_cents,
  discount_cents:totals.discount_cents,total_cents:totals.total_cents,reward:p.intent.reward}};
}
async function graphql(admin,query,variables){
 check(typeof admin?.graphql==='function','admin_missing');
 const response=await admin.graphql(query,{variables,tries:1,signal:AbortSignal.timeout(10000)});
 check(response.ok,'upstream_failed');const result=await response.json();
 check(result&&(!result.errors||Array.isArray(result.errors)&&result.errors.length===0),'upstream_failed');return result;
}
// This consumes official SDK-verified online context. It is not an HTTP route
// and must never receive a browser role, customer ID, price or raw session.
export async function calculateAuthorizedWorkQuote({request,authenticate,db,enabled=false,readIntent,now=Date.now}={}){
 if(enabled!==true)return {state:'not_enabled',calculation:null,publishable:false};
 const {session,admin}=await authenticate.admin(request);
 const permission=await readWorkMerchantPermission({db,session,action:'quote.calculate'});
 if(!permission.allowed||permission.role!=='owner')return {state:'access_denied',calculation:null,publishable:false};
 try{
  const shop=await graphql(admin,WORK_QUOTE_SHOP_QUERY,{});
  check(shop.data?.shop?.myshopifyDomain===SHOP&&shop.data.shop.currencyCode==='USD'&&
   shop.data.currentAppInstallation?.app?.apiKey===CLIENT,'shop_or_app_changed');
  check(typeof readIntent==='function','source_missing');
  const prepared=prepareWorkQuoteCalculation(await readIntent({staffId:permission.staffId}));
  const started=now(),result=await graphql(admin,WORK_QUOTE_CALCULATE,prepared.variables),ended=now();
  check(ended>=started&&ended-started<=30000,'calculation_stale');
  return projectWorkQuoteCalculation({prepared,result,nowMs:ended});
 }catch{return {state:'calculation_unavailable',calculation:null,publishable:false};}
}
