// Owner-scoped, browser-memory-only WORK draft estimate. This component
// receives ONLY the separately verified immutable Google QA detail projection.
// No calls to Shopify, Google, R2, D1, storage, checkout or external services.
// Nothing is saved or sent; request navigation/unmount discards inputs.
import {useState} from "react";
import {evaluateWorkQuoteWorksheet,formatWorkUsd}
  from "../../../work-quote-worksheet.mjs";
import {hydrateVerifiedWorkQuoteWorksheet}
  from "../../../work-quote-restore-model.mjs";
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
type VerifiedSavedDraft={
  state:string;submission_id:string;draft_revision:number;
  source_revision:number;estimated_total_cents:number;
  lines:Array<{id:string;quantity:number;unitPrice:string}>;
  fees:Fees;
};
export function WorkQuoteWorksheet({
  model,submissionId,customerStatus,savedDraft=null,
}:{
  model:VerifiedModel|undefined;submissionId:string;customerStatus:string;
  savedDraft?:VerifiedSavedDraft|null;
}){
  // Hydration only accepts the server's verified projection matched to the
  // exact canonical item snapshot. This parent is keyed by submission ID.
  const restored=hydrateVerifiedWorkQuoteWorksheet({
    draft:savedDraft,
    detail:model?.state==="ready"?model.detail:null,
    submissionId,
  });
  const [prices,setPrices]=useState<Record<string,string>>(
    ()=>restored?.prices??{},
  );
  const [fees,setFees]=useState<Fees>(
    ()=>({...EMPTY_FEES,...restored?.fees}),
  );
  const detail=model?.state==="ready"&&
    model.detail?.submission_id===submissionId?model.detail:null;
  const locked=customerStatus==="cancelled"||customerStatus==="completed";
  const items=detail?.items??[];
  // React route instance is keyed by submission ID in the parent. Prices
  // are never written to persistent browser data, a backend or a URL.
  const lines=items.map((item,index)=>({
    id:item.item_id||"invalid-"+index,
    quantity:item.quantity,
    unitPrice:prices[item.item_id]??"",
  }));
  const quote=evaluateWorkQuoteWorksheet({lines,fees});
  const readyQuote=quote.state==="ready"?
    quote as {state:"ready";itemsSubtotalCents:number;
      discountCents:number;manualTaxCents:number;
      estimatedTotalCents:number;feesCents:Record<FeeKey,number>}:null;
  const ready=detail!==null&&!locked&&readyQuote!==null;
  return <section className="jill-request__panel jill-request__full jill-quote"
    aria-labelledby="jill-quote-title">
    <div className="jill-request__panel-head">
      <div>
        <p className="jill-inbox__eyebrow">NEXT STEP · ESTIMATING</p>
        <h3 id="jill-quote-title">Quote worksheet</h3>
      </div>
      <span className="jill-quote__tag">
        {restored?"RESTORED DRAFT · NOT SENT":"NOT SAVED · NOT SENT"}
      </span>
    </div>
    <p className="jill-request__muted">
      Prepare a private USD price estimate from verified request items.
      Item quantities come from the original submission.
      {restored
        ? " Verified draft revision "+restored.draftRevision+
          " has been loaded into this browser view. Edits are not saved."
        : " Your figures stay in this browser view and are lost on refresh or navigation."}
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
              <div><dt>Item subtotal</dt><dd>{formatWorkUsd(readyQuote!.itemsSubtotalCents)}</dd></div>
              <div><dt>Materials</dt><dd>{formatWorkUsd(readyQuote!.feesCents.materials)}</dd></div>
              <div><dt>Labor</dt><dd>{formatWorkUsd(readyQuote!.feesCents.labor)}</dd></div>
              <div><dt>Shipping</dt><dd>{formatWorkUsd(readyQuote!.feesCents.shipping)}</dd></div>
              <div><dt>Other charge</dt><dd>{formatWorkUsd(readyQuote!.feesCents.other)}</dd></div>
              <div><dt>Discount</dt><dd>−{formatWorkUsd(readyQuote!.discountCents)}</dd></div>
              <div><dt>Manual estimated tax</dt><dd>{formatWorkUsd(readyQuote!.manualTaxCents)}</dd></div>
              <div className="jill-quote__total">
                <dt>Estimated total</dt>
                <dd>{formatWorkUsd(readyQuote!.estimatedTotalCents)}</dd>
              </div>
            </dl>:<p role="status">
              {quote.state==="incomplete"
                ?"Enter a unit price for every verified item to calculate the estimate."
                : ERROR[quote.code]??"The quote cannot be calculated."}
            </p>}
          </div>
          <p className="jill-quote__disclaimer">
            This is an internal worksheet, not an approved customer quote.
            {restored
              ? " A verified draft was loaded, but any new edits remain unsaved."
              : " Nothing has been saved from this worksheet."}
            Nothing is sent to My JILL, charged, taxed by Shopify or converted
            to a Shopify Draft Order. The future approval and invoice workflow
            will be separately enabled.
          </p>
        </>}
  </section>;
}
