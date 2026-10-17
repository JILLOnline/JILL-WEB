// Owner-scoped, browser-memory-only WORK draft estimate. This component
// receives ONLY the separately verified immutable Google QA detail projection.
// No calls to Shopify, Google, R2, D1, storage, checkout or external services.
// Nothing is saved or sent; request navigation/unmount discards inputs.
import {useState} from "react";
import {evaluateWorkQuoteWorksheet,formatWorkUsd}
  from "../../../work-quote-worksheet.mjs";
import "../styles/quote-worksheet.css";

type QuoteItem={item_id:string;title:string;quantity:number};
type VerifiedModel={
  state:string;
  detail?:{
    submission_id:string;revision:number;items:QuoteItem[];
  }|null;
};
type FeeKey="materials"|"labor"|"shipping"|"other"|"discount"|"tax";
type Fees=Record<FeeKey,string>;
const EMPTY_FEES:Fees={
  materials:"",labor:"",shipping:"",other:"",discount:"",tax:"",
};
const FIELD_LABELS:Array<[FeeKey,string,string]>=[
  ["materials","Materials / supplies","Materials beyond item prices"],
  ["labor","Labor / customization","Design, assembly and additional labor"],
  ["shipping","Shipping / delivery","Estimated; not a carrier rate"],
  ["other","Other charge","Other approved business charge"],
  ["discount","Discount","Flat USD discount, not a percentage"],
  ["tax","Estimated tax","Manual estimate; Shopify determines checkout taxes"],
];
const ERROR:Record<string,string>={
  invalid_quote_structure:"Verified items are not available for estimating.",
  invalid_verified_item:"Request item quantities or identifiers are invalid.",
  invalid_money:"Enter USD amounts only, up to $99,999.99 with two decimals.",
  quote_over_limit:"This estimate exceeds the $1,000,000 worksheet limit.",
  discount_exceeds_charges:"The discount cannot exceed the charges before tax.",
};
export function WorkQuoteWorksheet({model,submissionId,customerStatus}:{
  model:VerifiedModel|undefined;submissionId:string;customerStatus:string;
}){
  const [prices,setPrices]=useState<Record<string,string>>({});
  const [fees,setFees]=useState<Fees>({...EMPTY_FEES});
  const detail=model?.state==="ready"&&
    model.detail?.submission_id===submissionId?model.detail:null;
  const locked=customerStatus==="cancelled"||customerStatus==="completed";
  const items=detail?.items??[];
  // React route instance is keyed by submission ID in the parent. Prices
  // are never written to localStorage, cookies, a backend or a URL.
  const lines=items.map((item,index)=>({
    id:item.item_id||"invalid-"+index,
    quantity:item.quantity,
    unitPrice:prices[item.item_id]??"",
  }));
  const quote=evaluateWorkQuoteWorksheet({lines,fees});
  const ready=detail!==null&&!locked&&quote.state==="ready";
  return <section className="jill-request__panel jill-request__full jill-quote"
    aria-labelledby="jill-quote-title">
    <div className="jill-request__panel-head">
      <div>
        <p className="jill-inbox__eyebrow">NEXT STEP · ESTIMATING</p>
        <h3 id="jill-quote-title">Quote worksheet</h3>
      </div>
      <span className="jill-quote__tag">NOT SAVED · NOT SENT</span>
    </div>
    <p className="jill-request__muted">
      Prepare a private USD price estimate from verified request items.
      Item quantities come from the original submission. Your figures stay
      in this browser view and are lost on refresh or navigation.
    </p>
    {!detail
      ? <p className="jill-quote__notice" role="status">
          Verified original item details are required before pricing.
          The worksheet cannot use unverified inbox summaries.
        </p>
      : locked
        ? <p className="jill-quote__notice" role="status">
            This request is {customerStatus}. New quote preparation is disabled.
          </p>
        : <>
          <div className="jill-quote__lines" aria-label="Verified items and unit prices">
            <div className="jill-quote__row jill-quote__row--heading" aria-hidden="true">
              <span>Verified item</span><span>Quantity</span><span>Unit price (USD)</span>
            </div>
            {items.map((item,index)=>
              <div className="jill-quote__row" key={item.item_id+"-"+index}>
                <div>
                  <strong>{item.title||"Custom item"}</strong>
                  <small>Item {index+1}</small>
                </div>
                <span className="jill-quote__qty">{item.quantity}</span>
                <label>
                  <span className="jill-quote__mobile-label">
                    Unit price (USD) for item {index+1}
                  </span>
                  <input type="text" inputMode="decimal" autoComplete="off"
                    maxLength={8} placeholder="0.00"
                    aria-label={"USD unit price for item "+(index+1)}
                    value={prices[item.item_id]??""}
                    onChange={e=>setPrices(prev=>({
                      ...prev,[item.item_id]:e.target.value,
                    }))}/>
                </label>
              </div>)}
          </div>
          <h4 className="jill-quote__fees-title">Additional amounts</h4>
          <div className="jill-quote__fees">
            {FIELD_LABELS.map(([key,label,hint])=>
              <label key={key}>
                <span>{label}</span>
                <small>{hint}</small>
                <input type="text" inputMode="decimal" autoComplete="off"
                  maxLength={8} placeholder="0.00"
                  aria-label={label+" in USD"}
                  value={fees[key]}
                  onChange={e=>setFees(prev=>({...prev,[key]:e.target.value}))}/>
              </label>)}
          </div>
          <div className="jill-quote__summary" aria-live="polite">
            {ready?<dl>
              <div><dt>Item subtotal</dt><dd>{formatWorkUsd(quote.itemsSubtotalCents)}</dd></div>
              <div><dt>Materials</dt><dd>{formatWorkUsd(quote.feesCents.materials)}</dd></div>
              <div><dt>Labor</dt><dd>{formatWorkUsd(quote.feesCents.labor)}</dd></div>
              <div><dt>Shipping</dt><dd>{formatWorkUsd(quote.feesCents.shipping)}</dd></div>
              <div><dt>Other charge</dt><dd>{formatWorkUsd(quote.feesCents.other)}</dd></div>
              <div><dt>Discount</dt><dd>−{formatWorkUsd(quote.discountCents)}</dd></div>
              <div><dt>Manual estimated tax</dt><dd>{formatWorkUsd(quote.manualTaxCents)}</dd></div>
              <div className="jill-quote__total">
                <dt>Estimated total</dt>
                <dd>{formatWorkUsd(quote.estimatedTotalCents)}</dd>
              </div>
            </dl>:<p role="status">
              {quote.state==="incomplete"
                ?"Enter a unit price for every verified item to calculate the estimate."
                : ERROR[quote.code]??"The quote cannot be calculated."}
            </p>}
          </div>
          <p className="jill-quote__disclaimer">
            This is an internal worksheet, not an approved customer quote.
            Nothing is saved to the request, sent to My JILL, charged, taxed
            by Shopify or converted to a Shopify Draft Order. The future
            approval and invoice workflow will be separately enabled.
          </p>
        </>}
  </section>;
}
