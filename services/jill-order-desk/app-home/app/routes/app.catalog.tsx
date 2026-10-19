import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkCatalogRead} from "../../../work-catalog-read.mjs";
import "../styles/inbox.css";
import "../styles/request-detail.css";

export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkCatalogRead({request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,enabled:env.JILL_WORK_CATALOG_ENABLED==="true"});
}
type Catalog={state:string;as_of?:string;next_cursor?:string;view?:string;currency?:string;
  records?:{id:string;title:string;status?:string;admin_url:string;variants_truncated?:boolean;active?:boolean;
    product_title?:string;tracked?:boolean;locations_truncated?:boolean;
    locations?:{id:string;name:string;available:number|null}[];
    variants?:{id:string;title:string;price:string}[]}[]};
export default function Catalog(){
  const data=useLoaderData<typeof loader>() as unknown as Catalog;
  return <s-page heading="JILL HQ — Catalog" inlineSize="large">
    <s-section><main className="jill-inbox">
      <Link className="jill-inbox__back" to="/app">← Home</Link>
      <nav className="jill-workspace__tabs" aria-label="Catalog views">
        <Link aria-current={(data.view||"products")==="products"?"page":undefined} to="?view=products">Products</Link>
        <Link aria-current={(data.view||"products")==="collections"?"page":undefined} to="?view=collections">Collections</Link>
        <Link aria-current={(data.view||"products")==="inventory"?"page":undefined} to="?view=inventory">Inventory</Link>
        <Link aria-current={(data.view||"products")==="locations"?"page":undefined} to="?view=locations">Locations</Link>
      </nav>
      <h2>Shopify {data.view||"catalog"}</h2>
      {data.state!=="ready"?<p role="status">{data.state==="access_denied"?
        "The current account needs Owner access and Shopify permission for this view.":
        "The catalog source is unavailable. No product or stock counts are assumed."}</p>:<>
        <p className="jill-workspace__meta">Updated {data.as_of} · {data.currency}</p>
        {data.view==="inventory"?<p>Inventory counts do not measure production capacity.</p>:null}
        {data.records?.length===0?<p>No records on this page.</p>:<div className="jill-workspace__cards">{data.records?.map(product=>
          <section key={product.id} className="jill-request__panel">
            <h3>{product.product_title&&product.product_title+" · "}{product.title}</h3>
            {product.status&&<span className="jill-workspace__badge">{product.status}</span>}
            <ul>{product.variants?.map(variant=><li key={variant.id}>{variant.title} — {variant.price}</li>)}</ul>
            {product.active!==undefined&&<p>{product.active?"Active location":"Inactive location"}</p>}
            {product.tracked===false&&<p>Inventory tracking is off. Available stock is unknown.</p>}
            {product.locations&&<ul>{product.locations.map(location=><li key={location.id}>
              {location.name}: {location.available===null?"Not tracked":location.available+" available"}
            </li>)}</ul>}
            {product.tracked===true&&product.locations?.length===0&&<p>No stocking locations returned.</p>}
            {product.locations_truncated&&<p>Additional locations are available in Shopify Admin.</p>}
            {product.variants_truncated&&<p>More variants are available in Shopify Admin.</p>}
            <a className="jill-button jill-button--quiet" href={product.admin_url} target="_top">Open in Shopify ↗</a>
          </section>)}</div>}
        {data.next_cursor&&<Link className="jill-button" to={"?"+new URLSearchParams({view:data.view||"products",after:data.next_cursor})}>Next page →</Link>}
      </>}
      <a className="jill-button" href="https://admin.shopify.com/store/jill-work/products" target="_top">Manage products in Shopify</a>
    </main></s-section>
  </s-page>;
}
