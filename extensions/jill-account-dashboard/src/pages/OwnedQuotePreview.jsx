// Presentational ONLY. Must be mounted ONLY with an authenticated,
// ownership-verified readOwnedWorkQuote result from a future reviewed endpoint.
// No Accept, Checkout, Invoice or Shopify Admin action exists in this card.
import {projectOwnedWorkQuotePreview}
  from '../../../../shared/work-owned-quote-preview.mjs';
const usd=cents=>new Intl.NumberFormat('en-US',{
  style:'currency',currency:'USD',minimumFractionDigits:2,
}).format(cents/100);
export default function OwnedQuotePreview({verifiedOwnedQuote}){
  const view=projectOwnedWorkQuotePreview(verifiedOwnedQuote);
  if(!view.quote)return <s-text color="subdued">
    {view.state==='source_changed'?'The request changed; this quote needs review.':
      'No customer quote has been published for this request.'}
  </s-text>;
  return <s-box padding="base" border="base base solid" borderRadius="large">
    <s-stack direction="block" gap="small-300">
      <s-heading>JILL quote · Revision {view.quote.revision}</s-heading>
      <s-text>{view.state==='accepted'?'Acceptance recorded':
        view.state==='expired'?'Quote expired':'Quote available for review'}</s-text>
      {view.quote.lines.map((line,index)=><s-stack key={index} direction="inline"
        justifyContent="space-between">
        <s-text>Item {index+1} · Qty {line.quantity}</s-text>
        <s-text>{usd(line.subtotal_cents)}</s-text>
      </s-stack>)}
      <s-divider/>
      <s-stack direction="inline" justifyContent="space-between">
        <s-text>Items</s-text><s-text>{usd(view.quote.totals.items_cents)}</s-text>
      </s-stack>
      <s-stack direction="inline" justifyContent="space-between">
        <s-text>Shipping</s-text><s-text>{usd(view.quote.totals.shipping_cents)}</s-text>
      </s-stack>
      <s-stack direction="inline" justifyContent="space-between">
        <s-text>Shopify-calculated tax</s-text><s-text>{usd(view.quote.totals.tax_cents)}</s-text>
      </s-stack>
      <s-stack direction="inline" justifyContent="space-between">
        <s-text>Discount</s-text><s-text>{usd(view.quote.totals.discount_cents)}</s-text>
      </s-stack>
      <s-stack direction="inline" justifyContent="space-between">
        <s-text type="strong">Total</s-text>
        <s-text type="strong">{usd(view.quote.totals.total_cents)}</s-text>
      </s-stack>
      <s-text color="subdued">
        This view does not accept, invoice or place your order.
        A separately verified approval action is required.
      </s-text>
    </s-stack>
  </s-box>;
}
