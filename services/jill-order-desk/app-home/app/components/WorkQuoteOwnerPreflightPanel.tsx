// WORK Owner-only quote source review. The component is NEVER mounted until
// the exact signed original detail reader grants quotePreflightEnabled.
// It only loads a PII-free read-only GET; no calculated charge/payment action.
import {useFetcher} from "react-router";

type State={
 state:string;reason:string;next_action?:string;
 can_publish:boolean;can_invoice:boolean;can_create_order:boolean;
 can_charge_customer:boolean;can_send_email:boolean;
 shopify_totals_verified?:boolean;verified_line_count?:number;
};
const guide:Record<string,string>={
 save_quote_draft:"Save and verify an Owner quote draft first.",
 reload_original_request:"The request changed. Reload its signed original.",
 verify_shopify_customer:"Verify the customer's exact Shopify identity, address, and shipping method.",
 compare_shopify_price:"A Shopify price differs. Review the saved quote before continuing.",
 manual_owner_review:"This quote needs additional Owner verification.",
};
export function WorkQuoteOwnerPreflightPanel({
 submissionId,
}:{submissionId:string}){
 const fetcher=useFetcher<State>();
 const data=fetcher.state==="idle"?fetcher.data:null;
 const trustworthy=data&&
   data.can_publish===false&&data.can_invoice===false&&
   data.can_create_order===false&&data.can_charge_customer===false&&
   data.can_send_email===false;
 const ready=trustworthy&&data.state==="ready_for_native_shopify_calculation";
 const text=trustworthy?guide[data.next_action??""]??
   "This quote is on hold pending additional verified information.":
   "No approved quote-readiness result is available.";
 return <section className="jill-quote__catalog-comparison"
   aria-label="Owner saved quote to Shopify readiness">
   <h4>Saved quote → Shopify readiness</h4>
   <p>Check the original request, saved quote, and WORK Shopify Catalog
     against one another. This does not approve a payment, invoice, or order.</p>
   <button type="button" disabled={fetcher.state!=="idle"}
     onClick={()=>fetcher.load("/app/requests/quote-preflight?submission_id="+
       encodeURIComponent(submissionId))}>
     {fetcher.state!=="idle"?"Verifying saved quote…":"Verify saved quote"}
   </button>
   {fetcher.state!=="idle"&&
     <p role="status">Reading signed sources and current WORK catalog prices…</p>}
   {fetcher.state==="idle"&&fetcher.data&&<div role="status">
     {ready?
       <p>Source and catalog checks passed for {data?.verified_line_count}
         verified line(s). A fresh Shopify calculation, customer terms,
         acceptance, and invoice authorization are still required.</p>:
       <p>HOLD: {text} {trustworthy&&data?.reason&&
         <small>Review code: {data.reason}</small>}</p>}
   </div>}
 </section>;
}
