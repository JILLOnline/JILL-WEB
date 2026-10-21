// Internal-only art reference counts from verified canonical request.
// No file previews, untrusted URLs, cloud keys or media mutations.
import {auditWorkQuoteArtworkReferences}
 from "../../../work-quote-artwork-audit.mjs";
type RequestDetail={submission_id:string;revision:number;
 attachment_state?:string;reference_ids?:string[];
 items:Array<{item_id:string;reference_ids?:string[]}>};
export function WorkQuoteArtworkAudit({
 detail,submissionId,sourceRevision,
}:{detail:RequestDetail|null;submissionId:string;sourceRevision?:number}){
 const audit=auditWorkQuoteArtworkReferences({
   detail,submissionId,sourceRevision,
 });
 return <section className="jill-quote__artwork-audit"
  aria-label="Private reference artwork readiness">
  <h4>Artwork &amp; reference files · secure review</h4>
  {audit.state==="held"?<p role="status">
   Artwork references cannot be verified from this request snapshot.
   Secure previews and quotation publication remain unavailable.
  </p>:<>
   <p role="status">{audit.references===0?
    "No reference files were included in the verified request.":
    audit.references+" submitted reference(s) require Owner-only private-media verification before proof approval."}
   </p>
   <p>Request-wide references: {audit.request_references}</p>
   <ul>{audit.items.map((item:{item_number:number;reference_count:number})=>
    <li key={item.item_number}>Item {item.item_number}:
     {" "}{item.reference_count} reference(s)</li>)}</ul>
  </>}
  <p>References are not accessible here. This screen neither uploads,
   previews nor confirms provider storage or customer artwork approval.</p>
 </section>;
}
