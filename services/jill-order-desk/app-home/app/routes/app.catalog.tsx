import {Form,Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkCatalogRead} from "../../../work-catalog-read.mjs";
import {describeWorkCatalogProductInventory}
  from "../../../work-catalog-stock-label.mjs";
import "../styles/inbox.css";
import "../styles/request-detail.css";
import "../styles/hq-catalog.css";

export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkCatalogRead({request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,enabled:env.JILL_WORK_CATALOG_ENABLED==="true"});
}
type Variant={id:string;title:string;price:string;sku?:string;inventory_policy?:string};
type Location={id:string;name:string;available:number|null};
type Record={id:string;title:string;status?:string;admin_url:string;
  variants_truncated?:boolean;active?:boolean;product_title?:string;
  tracked?:boolean;locations_truncated?:boolean;locations?:Location[];
  variants?:Variant[];handle?:string;vendor?:string;product_type?:string;
  total_inventory?:number|null};
type Catalog={state:string;as_of?:string;next_cursor?:string;
  view?:string;search?:string;currency?:string;records?:Record[]};
const viewOptions=["products","collections","inventory","locations"] as const;
function ProductStock({reported}:{reported:number|null|undefined}){
  const stock=describeWorkCatalogProductInventory(reported);
  return <><strong>{stock.label}</strong><small>{stock.detail}</small></>;
}
function price(value:string,currency:string){
  // Preserve Shopify-provided amount; never convert currencies client-side.
  return value+" "+currency;
}
export default function Catalog(){
  const data=useLoaderData<typeof loader>() as unknown as Catalog;
  const view=viewOptions.includes(data.view as typeof viewOptions[number])
    ?data.view!:"products";
  const records=data.records||[];
  const searching=view==="products"&&Boolean(data.search);
  const next=new URLSearchParams({view,after:data.next_cursor||""});
  if(searching)next.set("q",data.search!);
  return <s-page heading="JILL HQ — Catalog" inlineSize="large">
    <s-section><main className="jill-catalog">
      <div className="jill-catalog__heading">
        <div>
          <Link className="jill-inbox__back" to="/app">← Home</Link>
          <h2>Shopify Catalog</h2>
          <p>Real WORK store products, collections, inventory and locations.
            Read-only — manage product changes in Shopify.</p>
        </div>
        <span className="jill-catalog__source">WORK · SHOPIFY ADMIN</span>
      </div>
      <nav className="jill-workspace__tabs" aria-label="Catalog views">
        {viewOptions.map(tab=><Link key={tab}
          aria-current={view===tab?"page":undefined}
          to={"?"+new URLSearchParams({view:tab})}>
          {tab.charAt(0).toUpperCase()+tab.slice(1)}
        </Link>)}
      </nav>
      {view==="products"&&<Form method="get" action="/app/catalog"
        className="jill-catalog__search" role="search" aria-label="Search Shopify product titles">
        <input type="hidden" name="view" value="products"/>
        <label htmlFor="jill-catalog-product-search">Find a Shopify product
          <input id="jill-catalog-product-search" type="search" name="q"
            defaultValue={data.search||""} maxLength={64}
            placeholder="Enter product title (2–64 characters)"/>
        </label>
        <button type="submit">Search Shopify</button>
        <Link className="jill-button jill-button--quiet" to="?view=products">Clear</Link>
      </Form>}
      {data.state!=="ready"?<div className="jill-catalog__notice" role="status">
        {data.state==="access_denied"
          ?"Owner authorization and the required Shopify scopes are needed."
          :data.state==="invalid_request"
          ?"Search is invalid. Use 2–64 letters, numbers, spaces or simple punctuation."
          :data.state==="not_connected"
          ?"The verified Shopify Catalog connection is not enabled in this WORK runtime."
          :"Shopify Catalog is temporarily unavailable. No product or stock totals are assumed."}
      </div>:<>
        <div className="jill-catalog__meta">
          <strong>{records.length} {records.length===1?"record":"records"} on this page</strong>
          <span>Shopify read {data.as_of} · Currency {data.currency}</span>
          {searching&&<span>Title search: <strong>{data.search}</strong></span>}
        </div>
        {view==="inventory"&&<p className="jill-catalog__notice">
          Available stock is reported by Shopify per stocking location.
          It does not measure JILL's custom-production capacity.
        </p>}
        {view==="products"?<div className="jill-catalog__table">
          <div className="jill-catalog__columns" aria-hidden="true">
            <span>Product</span><span>Status</span><span>Shopify product inventory report</span>
            <span>Variants / price / SKU</span><span>Manage</span>
          </div>
          {records.length===0?<p className="jill-catalog__empty">
            {searching?"No products matched on this Shopify page. Try another product title."
              :"No products were returned from Shopify."}
          </p>:records.map(product=><article className="jill-catalog__row" key={product.id}>
            <div className="jill-catalog__cell jill-catalog__identity" data-label="Product">
              <strong>{product.title}</strong>
              {product.vendor&&<span>Vendor: {product.vendor}</span>}
              {product.product_type&&<span>Type: {product.product_type}</span>}
              {product.handle&&<span className="jill-catalog__handle">{product.handle}</span>}
            </div>
            <div className="jill-catalog__cell" data-label="Status">
              <span className={"jill-catalog__status jill-catalog__status--"+
                (product.status||"UNKNOWN").toLowerCase()}>{product.status||"Unknown"}</span>
            </div>
            <div className="jill-catalog__cell" data-label="Shopify inventory report">
              <ProductStock reported={product.total_inventory}/>
            </div>
            <div className="jill-catalog__cell jill-catalog__variants" data-label="Variants">
              {product.variants?.map(variant=><div key={variant.id}>
                <strong>{variant.title}</strong>
                <span>{price(variant.price,data.currency||"USD")}</span>
                {variant.sku&&<code title="Shopify SKU">SKU {variant.sku}</code>}
              </div>)}
              {product.variants_truncated&&<em>
                More variants in Shopify Admin
              </em>}
            </div>
            <div className="jill-catalog__cell" data-label="Manage">
              <a className="jill-button jill-button--quiet" href={product.admin_url}
                target="_top" rel="noopener noreferrer">Open in Shopify ↗</a>
            </div>
          </article>)}
        </div>:<div className="jill-catalog__collection-grid">
          {records.length===0?<p>No records on this Shopify page.</p>:records.map(entry=>
            <article className="jill-catalog__collection" key={entry.id}>
              <h3>{entry.product_title?entry.product_title+" · ":""}{entry.title}</h3>
              {entry.active!==undefined&&<p>{entry.active?"Active location":"Inactive location"}</p>}
              {entry.tracked===false&&<p>Not tracked / quantity unknown. No out-of-stock conclusion.</p>}
              {entry.locations&&<ul>{entry.locations.map(location=><li key={location.id}>
                {location.name}: {location.available===null?"Not tracked / quantity unknown":location.available+" available"}
              </li>)}</ul>}
              {entry.tracked===true&&entry.locations?.length===0&&<p>No stocking locations returned.</p>}
              {entry.locations_truncated&&<p>More locations are available in Shopify Admin.</p>}
              <a className="jill-button jill-button--quiet" href={entry.admin_url}
                target="_top" rel="noopener noreferrer">Open in Shopify ↗</a>
            </article>)}
        </div>}
        {data.next_cursor&&<Link className="jill-button jill-catalog__next"
          to={"?"+next.toString()}>Next Shopify page →</Link>}
      </>}
      <footer className="jill-catalog__footer">
        <span>WORK-only read connection · No product, price or inventory edits from HQ.</span>
        <a className="jill-button" href="https://admin.shopify.com/store/jill-work/products"
          target="_top" rel="noopener noreferrer">Manage products in Shopify</a>
      </footer>
    </main></s-section>
  </s-page>;
}
