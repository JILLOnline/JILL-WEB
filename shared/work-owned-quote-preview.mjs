// Customer-facing read-only projection of readOwnedWorkQuote's already
// authenticated response. Never read customer identity/email from browser.
// No quote approval, invoice or message operation is initiated here.
const GID=/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/;
const HASH=/^[0-9a-f]{64}$/;
const money=n=>Number.isSafeInteger(n)&&n>=0&&n<=100000000;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const error=()=>{throw Error('unverified_owned_quote');};
export function projectOwnedWorkQuotePreview(result){
  if(!object(result)||!['no_quote','source_changed','available','expired','accepted'].includes(result.state))error();
  if(['no_quote','source_changed'].includes(result.state)){
    if(result.quote!==null)return error();
    return Object.freeze({state:result.state,quote:null,can_accept:false,
      can_invoice:false,can_create_order:false});
  }
  const q=result.quote;
  if(!object(q)||!Number.isSafeInteger(q.revision)||q.revision<1||q.revision>100||
    !HASH.test(q.hash||'')||q.currency!=='USD'||
    !Number.isSafeInteger(q.expires_at_ms)||q.expires_at_ms<1||
    !['pickup','shipping'].includes(q.fulfillment)||
    !Array.isArray(q.lines)||q.lines.length<1||q.lines.length>20||
    !object(q.totals))error();
  const lines=q.lines.map(line=>{
    if(!object(line)||!GID.test(line.variant_id||'')||
      !Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>999||
      !money(line.subtotal_cents)||typeof line.options!=='string'||line.options.length>500)
      error();
    return Object.freeze({quantity:line.quantity,subtotal_cents:line.subtotal_cents});
  });
  const {items_cents,shipping_cents,tax_cents,discount_cents,total_cents}=q.totals;
  if(![items_cents,shipping_cents,tax_cents,discount_cents,total_cents].every(money)||
    lines.reduce((n,x)=>n+x.subtotal_cents,0)!==items_cents||
    items_cents+shipping_cents+tax_cents-discount_cents!==total_cents)error();
  // Address, Shopify Customer GID, codes and original personalization values
  // are deliberately NOT copied into this compact inbox card.
  return Object.freeze({state:result.state,quote:Object.freeze({
    revision:q.revision,hash:q.hash,currency:'USD',expires_at_ms:q.expires_at_ms,
    fulfillment:q.fulfillment,lines:Object.freeze(lines),
    totals:Object.freeze({...q.totals}),
  }),can_accept:false,can_invoice:false,can_create_order:false});
}
