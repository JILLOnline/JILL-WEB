// Existing Quote Studio companion: no browser variant lookups, writes,
// customer approval or native calculated tax. Purely a price review.
import {useFetcher} from "react-router";
import {formatWorkUsd} from "../../../work-quote-worksheet.mjs";
import {compareWorkQuoteUnitCatalogPrices}
 from "../../../work-quote-catalog-comparison.mjs";
type Unit={source_item_id:string;unit_id:string;group_id:string|null;
 variant_id:string;quoted_unit_cents:number};
type PriceReview={state:string;units:readonly Unit[]};
type ShopifySnapshot={state:string;review_only?:boolean;can_publish?:boolean;
 submission_id?:string;source_revision?:number;currency?:string;
 verified_at_ms?:number;variants?:Array<{variant_id:string;
 product_status:string;shopify_unit_price_cents:number}>;};
export function WorkQuoteCatalogComparison({submissionId,sourceRevision,
  review,enabled}:{submissionId:string;sourceRevision?:number;
  review:PriceReview;enabled:boolean}){
 const fetcher=useFetcher<ShopifySnapshot>();
 const available=enabled&&review.state==="review_only"&&
   typeof sourceRevision==="number";
 const priceComparison=fetcher.state==="idle"&&fetcher.data?
   compareWorkQuoteUnitCatalogPrices({review,snapshot:fetcher.data,
     submissionId,sourceRevision,nowMs:Date.now()}):null;
 return <section className="jill-quote__catalog-comparison"
  aria-label="Shopify Catalog quote price verification">
  <h4>Compare with live Shopify Catalog</h4>
  <p>Check the original request’s variant IDs against the WORK store.
   This is a private Owner read, not a published quote or automatic price update.</p>
  <button type="button" disabled={!available||fetcher.state!=="idle"}
    onClick={()=>fetcher.load("/app/requests/quote-catalog?submission_id="+
      encodeURIComponent(submissionId))}>
    {fetcher.state!=="idle"?"Checking Catalog…":"Check Shopify prices"}
  </button>
  {!enabled&&<p role="status">Catalog-to-Quote review is disabled in this
   WORK version. No product-price verification is claimed.</p>}
  {enabled&&review.state!=="review_only"&&
    <p role="status">Complete and verify the P1/P2 unit price review first.</p>}
  {fetcher.state!=="idle"&&<p role="status">Reading verified Shopify prices…</p>}
  {fetcher.state==="idle"&&fetcher.data&&priceComparison?.state!=="review_only"&&
   <p role="status">Could not verify the Catalog comparison
     ({fetcher.data.state==="verified_catalog_snapshot"?
       priceComparison?.reason??"source_changed":fetcher.data.state}).
      No quote prices were changed.</p>}
  {priceComparison?.state==="review_only"&&
   <div className="jill-quote__catalog-results">
    <p role="status">Catalog checked. {priceComparison.difference_count} unit price
      difference(s); {priceComparison.inactive_count} inactive-product unit(s).
      Compare the quoted amount before proceeding.</p>
    <div className="jill-quote__unit-scroll">
      <table className="jill-quote__unit-table">
        <thead><tr><th scope="col">Unit</th><th scope="col">Group</th>
         <th scope="col">Your quote</th><th scope="col">Shopify price</th>
         <th scope="col">Review</th></tr></thead>
        <tbody>{priceComparison.rows.map((row:{source_item_id:string;
          unit_id:string;group_id:string|null;quoted_unit_cents:number;
          shopify_unit_price_cents:number;status:string})=>
         <tr key={row.source_item_id+":"+row.unit_id}>
          <td>{row.unit_id}</td><td>{row.group_id??"Item-wide"}</td>
          <td>{formatWorkUsd(row.quoted_unit_cents)}</td>
          <td>{formatWorkUsd(row.shopify_unit_price_cents)}</td>
          <td>{row.status==="price_equal"?"Same list price":
            row.status==="inactive_product"?"Inactive product":"Price difference"}</td>
         </tr>)}</tbody>
      </table>
    </div>
    <p>List-price equality does not approve a customized quote. Shipping,
     taxes, fees, discounts and current Shopify stock still need separate checks.</p>
   </div>}
 </section>;
}
