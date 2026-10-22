// Owner-scoped WORK quote worksheet. Input and verified saved-draft
// projections are request-scoped. HTTP Save/Reload is available ONLY after
// the new WORK quote capability and authenticated Owner checks pass.
// No Shopify Draft Order, customer notice, R2 or payment action.
import {useEffect,useRef,useState} from "react";
import {useFetcher} from "react-router";
import {JillChevronDown} from "./JillChevronDown";
import {evaluateWorkQuoteWorksheet,formatWorkUsd}
  from "../../../work-quote-worksheet.mjs";
import {hydrateVerifiedWorkQuoteWorksheet}
  from "../../../work-quote-restore-model.mjs";
import {prepareWorkQuoteUiSavePayload,workQuoteDraftReadPath}
  from "../../../work-quote-ui-payload.mjs";
import {inspectWorkQuoteUnitReview}
  from "../../../work-quote-unit-review.mjs";
import {inspectWorkQuotePreflight}
  from "../../../work-quote-preflight-view.mjs";
import {inspectWorkQuoteUnitLinePlan}
  from "../../../work-quote-unit-line-plan.mjs";
import {projectWorkQuoteUnitPriceReview}
  from "../../../work-quote-unit-price-review.mjs";
import {WorkQuoteCatalogComparison} from "./WorkQuoteCatalogComparison";
import {WorkQuoteArtworkAudit} from "./WorkQuoteArtworkAudit";
import "../styles/quote-worksheet.css";

type QuoteValue=string|number|boolean|Array<string|number|boolean>;
type QuoteAttribute={id:string;label?:string;value:QuoteValue};
type QuoteItem={item_id:string;title:string;quantity:number;
  variant_allocations?:Array<{variant_id:string;title:string;quantity:number;
    unit_ids:string[]}>;
  personalization_groups?:Array<{id:string;
    allocations:Array<{unit_id:string}>;attributes:QuoteAttribute[]}>;
  reference_ids?:string[];};
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
function WorkQuoteUnitReview({item}:{item:QuoteItem}){
  if(!item.variant_allocations?.length&&!item.personalization_groups?.length)
    return null;
  const review=inspectWorkQuoteUnitReview(item);
  const showValue=(v:QuoteValue)=>Array.isArray(v)?v.map(String).join(", "):
    typeof v==="boolean"?(v?"Yes":"No"):String(v);
  return <details className="jill-quote__unit-review">
    <summary>Unit &amp; P1/P2 review · Qty {item.quantity}<span className="jill-ui__end-chevron"><JillChevronDown/></span></summary>
    {review.state==="held"
      ?<p role="status">Unit allocations need verification ({review.reason}).
        No per-unit pricing or Shopify invoice is authorized.</p>
      :<div className="jill-quote__unit-body">
        {review.variants.map(variant=><p key={variant.variant_id}>
          <strong>{variant.title||"Selected variation"}</strong>
          {" · "}{variant.quantity} unit(s):
          {" "}{variant.unit_ids.join(", ")}
        </p>)}
        {review.groups.length===0?<p>
          No different per-unit personalization was supplied.
        </p>:review.groups.map(group=><section key={group.id}>
          <strong>{group.id}</strong>
          <small>Unit(s): {group.unit_ids.join(", ")}</small>
          {group.attributes.map(a=><p key={a.id}>
            {a.label||a.id}: {showValue(a.value)}
          </p>)}
        </section>)}
        {review.unassigned_unit_ids.length>0&&<p role="status">
          Unassigned unit(s): {review.unassigned_unit_ids.join(", ")}.
          Review before quoting.
        </p>}
        {review.reference_count>0&&<p>
          {review.reference_count} original reference(s) require private-media
          verification; no file preview or download is assumed.
        </p>}
        <p className="jill-quote__unit-warning">
          Review only. Per-unit pricing, variant matching, customer
          acceptance and invoicing are not enabled here.
        </p>
      </div>}
  </details>;
}
export function WorkQuoteWorksheet({
  model,submissionId,customerStatus,sourceRevision,
  savedDraft=null,saveDraftEnabled=false,catalogReviewEnabled=false,
}:{
  model:VerifiedModel|undefined;submissionId:string;customerStatus:string;
  sourceRevision?:number;
  savedDraft?:VerifiedSavedDraft|null;
  saveDraftEnabled?:boolean;catalogReviewEnabled?:boolean;
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
  type DraftResult={ok:boolean;code:string;revision?:number;
    duplicate?:boolean;state?:string;draft?:VerifiedSavedDraft};
  const saveFetcher=useFetcher<DraftResult>();
  const readFetcher=useFetcher<DraftResult>();
  const operation=useRef<string|null>(null);
  const initialReadStarted=useRef(false);
  const merchantEdited=useRef(false);
  const merchantExplicitReload=useRef(false);
  const [draftRevision,setDraftRevision]=useState(restored?.draftRevision??0);
  const [restoredActive,setRestoredActive]=useState(restored!==null);
  const [blocked,setBlocked]=useState(false);
  const [feedback,setFeedback]=useState("");
  const busy=saveFetcher.state!=="idle"||readFetcher.state!=="idle";
  const verifiedSource=typeof sourceRevision==="number"&&
    model?.state==="ready"&&model.detail?.revision===sourceRevision;
  // The first verified WORK page load retrieves the draft automatically.
  // No remote call occurs with the current source-only OFF switch.
  // If the merchant starts typing during this read, never silently
  // replace the new unsaved input with an older draft.
  useEffect(()=>{
    if(!saveDraftEnabled||!verifiedSource||initialReadStarted.current)
      return;
    initialReadStarted.current=true;
    readFetcher.load(workQuoteDraftReadPath(submissionId));
  },[saveDraftEnabled,verifiedSource,submissionId]);
  // A failed or ambiguous commit is never automatically retried. Reopen
  // a freshly verified request to reconcile before another write.
  useEffect(()=>{
    if(!saveDraftEnabled||saveFetcher.state!=="idle"||
       !saveFetcher.data)return;
    if(saveFetcher.data.ok&&saveFetcher.data.code==="draft_saved"&&
       Number.isSafeInteger(saveFetcher.data.revision)){
      const rev=saveFetcher.data.revision!;
      setDraftRevision(rev);
      operation.current=null;
      // A server acknowledgment is not an independently verified readback.
      // Keep the next Save blocked until a fresh Owner-backed Reload succeeds.
      setBlocked(true);
      setFeedback("Draft revision "+rev+
        " was acknowledged. Reload the saved draft to verify before saving again.");
    }else{
      setBlocked(true);
      setFeedback("Save not confirmed ("+saveFetcher.data.code+
        "). Stop and verify the latest draft before another save.");
    }
  },[saveDraftEnabled,saveFetcher.state,saveFetcher.data]);
  useEffect(()=>{
    if(!saveDraftEnabled||readFetcher.state!=="idle"||
       !readFetcher.data)return;
    if(readFetcher.data.ok&&readFetcher.data.code==="draft_ready"){
      const projection=hydrateVerifiedWorkQuoteWorksheet({
        draft:readFetcher.data.draft,
        detail:model?.state==="ready"?model.detail:null,
        submissionId,
      });
      if(projection){
        if(merchantEdited.current&&!merchantExplicitReload.current){
          setFeedback("A saved draft exists. Your newer unsaved inputs were "+
            "kept. Select Reload saved draft to replace them explicitly.");
          return;
        }
        merchantEdited.current=false;
        merchantExplicitReload.current=false;
        setPrices(projection.prices);
        setFees(projection.fees as Fees);
        setDraftRevision(projection.draftRevision);
        setRestoredActive(true);
        setBlocked(false);
        operation.current=null;
        setFeedback("Verified draft revision "+
          projection.draftRevision+" restored.");
        return;
      }
    }
    if(readFetcher.data.ok&&readFetcher.data.code==="no_saved_draft"){
      setFeedback("No saved quote draft exists for this request.");
      return;
    }
    setBlocked(true);
    setFeedback("Draft could not be verified ("+readFetcher.data.code+
      "). No prices were overwritten.");
  },[saveDraftEnabled,readFetcher.state,readFetcher.data,
    model,submissionId]);
  const edited=()=>{
    // Do not replace the operation ID after an ambiguous commit.
    merchantEdited.current=true;
    if(!blocked)operation.current=null;
    setRestoredActive(false);
    setFeedback("");
  };

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
  const preflight=inspectWorkQuotePreflight({
    submissionId,detail,sourceRevision,worksheet:quote,
  });
  const unitPlan=inspectWorkQuoteUnitLinePlan({detail,lines});
  const readyQuote=quote.state==="ready"?
    quote as {state:"ready";itemsSubtotalCents:number;
      discountCents:number;manualTaxCents:number;
      estimatedTotalCents:number;feesCents:Record<FeeKey,number>}:null;
  const priceReview=projectWorkQuoteUnitPriceReview({
    plan:unitPlan,itemSubtotalCents:readyQuote?.itemsSubtotalCents??null,
  });
  const ready=detail!==null&&!locked&&readyQuote!==null;
  // An uncertain or just-acknowledged commit must STOP further writes,
  // but must NOT disable the independent Owner/D1 Reload recovery path.
  const canReloadDraft=saveDraftEnabled===true&&verifiedSource&&
    detail!==null&&!locked&&!busy;
  const canSaveDraft=canReloadDraft&&!blocked;
  const onSaveDraft=()=>{
    if(!canSaveDraft||!readyQuote)return;
    const op=operation.current??"jill:hq:quote:"+crypto.randomUUID();
    const intent=prepareWorkQuoteUiSavePayload({
      submissionId,detail,sourceRevision,customerStatus,
      prices,fees,draftRevision,operationId:op,
    });
    if(intent.state!=="ready"){
      setFeedback("Draft cannot be saved until all prices and the "+
        "verified request revision agree.");
      return;
    }
    operation.current=op;
    saveFetcher.submit(intent.payload,{
      method:"post",action:"/app/requests/quote-draft",
      encType:"application/json",
    });
  };
  const onReloadDraft=()=>{
    if(!canReloadDraft)return;
    // Explicit user action may replace unsaved form inputs. The
    // initial automatic read cannot.
    merchantExplicitReload.current=true;
    readFetcher.load(workQuoteDraftReadPath(submissionId));
  };

  // Native disclosure keeps the quote form mounted while collapsed.
  // This is essential: collapsing the worksheet must never discard edits,
  // reset pricing or trigger a network save/reload.
  return <details className="jill-request__panel jill-request__full jill-quote jill-request__fold"
    aria-label="Quote worksheet">
    <summary className="jill-request__fold-head">
      <span className="jill-request__fold-title">Quote worksheet</span>
      <span className="jill-quote__tag">
        {restoredActive?"RESTORED DRAFT · NOT SENT":"NOT SAVED · NOT SENT"}
      </span>
      <span className="jill-request__fold-chevron jill-ui__end-chevron" aria-hidden="true"><JillChevronDown/></span>
    </summary>
    <div className="jill-request__fold-body">
    {!detail
      ? <p className="jill-quote__notice" role="status">
          Verified original items are required before pricing.
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
                  <WorkQuoteUnitReview item={item}/>
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
                    disabled={busy}
                    onChange={e=>{edited();setPrices(prev=>({
                      ...prev,[item.item_id]:e.target.value,
                    }));}}/>
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
                  disabled={busy}
                  onChange={e=>{edited();setFees(prev=>({
                    ...prev,[key]:e.target.value,
                  }));}}/>
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
          <section className="jill-quote__preflight" aria-label="Quote release readiness">
            <h4>Quote → Customer → Shopify readiness</h4>
            <p>Estimate and source review only. Nothing below sends a quote,
              creates an order or invoices a customer.</p>
            <ol>
              {preflight.checks.map((check:{
                id:string;status:"clear"|"hold"|"verify";label:string;
              })=><li key={check.id}
                data-state={check.status}>
                <strong>{check.status==="clear"?"Reviewed":
                  check.status==="hold"?"Needs work":"Verification required"}</strong>
                <span>{check.label}</span>
              </li>)}
            </ol>
          </section>
          <section className="jill-quote__unit-plan"
            aria-label="Personalization unit mapping and price review">
            <h4>P1/P2 + variants · unit price review</h4>
            {priceReview.state!=="review_only"?
              <p role="status">Unit price review held ({priceReview.reason}).
                Confirm all item prices, original P1/P2 allocations and exact variants.</p>:<>
              <p>{priceReview.count} individually priced units across
                {" "}{priceReview.variant_count} variant(s).
                Verified worksheet items subtotal: {formatWorkUsd(priceReview.quoted_items_cents!)}.</p>
              <div className="jill-quote__unit-scroll">
                <table className="jill-quote__unit-table">
                  <thead><tr><th scope="col">Unit</th><th scope="col">Personalization group</th>
                    <th scope="col">Shopify variant ID</th><th scope="col">Quoted unit price</th></tr></thead>
                  <tbody>{priceReview.units.map((unit:{source_item_id:string;
                    unit_id:string;group_id:string|null;variant_id:string;
                    quoted_unit_cents:number})=><tr key={unit.source_item_id+":"+unit.unit_id}>
                    <td>{unit.unit_id}</td><td>{unit.group_id??"Item-wide"}</td>
                    <td><code>{unit.variant_id}</code></td>
                    <td>{formatWorkUsd(unit.quoted_unit_cents)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            </>}
            <p>For internal review only. No Shopify catalog prices, tax, customer
              approval, invoice or order creation have been verified.</p>
          </section>
          <WorkQuoteCatalogComparison
            submissionId={submissionId} sourceRevision={sourceRevision}
            review={priceReview} enabled={catalogReviewEnabled}/>
          <WorkQuoteArtworkAudit detail={detail}
            submissionId={submissionId} sourceRevision={sourceRevision}/>
          <div className="jill-quote__draft-actions" aria-label="Quote draft management">
            <div className="jill-quote__draft-buttons">
              <button type="button" disabled={!canSaveDraft||!ready}
                onClick={onSaveDraft}>
                {saveFetcher.state!=="idle"?"Saving draft…":"Save Draft"}
              </button>
              <button type="button" disabled={!canReloadDraft}
                onClick={onReloadDraft}>
                {readFetcher.state!=="idle"?"Checking draft…":"Reload saved draft"}
              </button>
            </div>
            {!saveDraftEnabled&&<p className="jill-quote__notice" role="status">
              Saving is unavailable in this WORK version. Entries are lost on refresh.
            </p>}
            {saveDraftEnabled&&feedback&&<p className="jill-quote__notice"
              role="status">{feedback}</p>}
          </div>
        </>}
    </div>
  </details>;
}
