// WORK merchant-only estimate worksheet: deterministic USD integer cents.
// No persistence, taxes rules, Shopify draft orders, customer messages or I/O.
// Input item details must have been verified by the existing Owner route.
const MONEY=/^(?:0|[1-9]\d{0,4})(?:\.\d{1,2})?$/;
const FEES=Object.freeze(['materials','labor','shipping','other','discount','tax']);
const MAX_TOTAL_CENTS=100_000_000; // $1m; require separate pricing policy above.
const ok=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function amount(value,{required=false}={}){
  if(typeof value!=='string')throw Error('invalid_money');
  if(value===''&&!required)return 0;
  if(value===''&&required)return null;
  if(!MONEY.test(value))throw Error('invalid_money');
  const [d,c='']=value.split('.');
  const cents=Number(d)*100+Number(c.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents<0||cents>=MAX_TOTAL_CENTS)
    throw Error('invalid_money');
  return cents;
}
const incomplete=()=>Object.freeze({state:'incomplete',code:'enter_every_item_price'});
const invalid=code=>Object.freeze({state:'invalid',code});
export function evaluateWorkQuoteWorksheet({lines,fees}={}){
  if(!Array.isArray(lines)||lines.length===0||lines.length>50||
     !ok(fees)||Object.keys(fees).length!==FEES.length||
     !FEES.every(x=>Object.hasOwn(fees,x)))
    return invalid('invalid_quote_structure');
  let sub=0,missing=0;
  const seen=new Set();
  try{
    for(const line of lines){
      if(!ok(line)||Object.keys(line).sort().join(',')!==
         'id,quantity,unitPrice'||typeof line.id!=='string'||
         !/^[A-Za-z0-9._:-]{1,128}$/.test(line.id)||seen.has(line.id)||
         !Number.isSafeInteger(line.quantity)||
         line.quantity<1||line.quantity>999)
        return invalid('invalid_verified_item');
      seen.add(line.id);
      const cents=amount(line.unitPrice,{required:true});
      if(cents===null){missing++;continue;}
      sub+=line.quantity*cents;
      if(!Number.isSafeInteger(sub)||sub>MAX_TOTAL_CENTS)
        return invalid('quote_over_limit');
    }
    // Keep fee fields statically typed for the React Router/TSX consumer.
    const f={
      materials:amount(fees.materials),
      labor:amount(fees.labor),
      shipping:amount(fees.shipping),
      other:amount(fees.other),
      discount:amount(fees.discount),
      tax:amount(fees.tax),
    };
    if(missing)return incomplete();
    const charges=sub+f.materials+f.labor+f.shipping+f.other;
    if(!Number.isSafeInteger(charges)||charges>MAX_TOTAL_CENTS)
      return invalid('quote_over_limit');
    if(f.discount>charges)return invalid('discount_exceeds_charges');
    const due=charges-f.discount+f.tax;
    if(!Number.isSafeInteger(due)||due>MAX_TOTAL_CENTS)
      return invalid('quote_over_limit');
    return Object.freeze({
      state:'ready',code:'estimate_only',currency:'USD',
      itemsSubtotalCents:sub,chargesBeforeDiscountCents:charges,
      discountCents:f.discount,manualTaxCents:f.tax,
      estimatedTotalCents:due,
      itemCount:lines.length,
      feesCents:Object.freeze(f),
      saved:false,customerApproved:false,
      shopifyDraftOrderCreated:false,invoiceSent:false,
    });
  }catch{
    return invalid('invalid_money');
  }
}
export function formatWorkUsd(cents){
  if(!Number.isSafeInteger(cents)||cents<0||cents>MAX_TOTAL_CENTS)
    throw Error('invalid_cents');
  return new Intl.NumberFormat('en-US',{
    style:'currency',currency:'USD',minimumFractionDigits:2,
    maximumFractionDigits:2,
  }).format(cents/100);
}
