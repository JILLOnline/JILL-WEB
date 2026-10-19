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
  return <s-page heading="JILL HQ — Catalog">
    <s-section><main className="jill-inbox">
      <Link className="jill-inbox__back" to="/app">← HQ overview</Link>
      <nav aria-label="Catalog views">
        <Link to="?view=products">Products</Link>{" · "}
        <Link to="?view=collections">Collections</Link>{" · "}
        <Link to="?view=inventory">Inventory</Link>{" · "}
        <Link to="?view=locations">Locations</Link>
      </nav>
      <h2>Shopify {data.view||"catalog"}</h2>
      {data.state!=="ready"?<p role="status">{data.state==="access_denied"?
        "The current account needs Owner access and Shopify permission for this view.":
        "The catalog source is unavailable. No product or stock counts are assumed."}</p>:<>
        <p>Verified {data.as_of}. Store currency: {data.currency}. Inventory tracking does not measure production capacity.</p>
        {data.records?.length===0?<p>No records on this page.</p>:data.records?.map(product=>
          <section key={product.id} className="jill-request__panel">
            <h3><a href={product.admin_url} target="_top">{product.product_title&&product.product_title+" · "}{product.title}</a>{product.status&&" · "+product.status}</h3>
            <ul>{product.variants?.map(variant=><li key={variant.id}>{variant.title} — {variant.price}</li>)}</ul>
            {product.active!==undefined&&<p>{product.active?"Active location":"Inactive location"}</p>}
            {product.tracked===false&&<p>Inventory tracking is off. Available stock is unknown.</p>}
            {product.locations&&<ul>{product.locations.map(location=><li key={location.id}>
              {location.name}: {location.available===null?"Not tracked":location.available+" available"}
            </li>)}</ul>}
            {product.tracked===true&&product.locations?.length===0&&<p>No stocking locations returned.</p>}
            {product.locations_truncated&&<p>Additional locations are available in Shopify Admin.</p>}
            {product.variants_truncated&&<p>More variants are available in Shopify Admin.</p>}
          </section>)}
        {data.next_cursor&&<Link to={"?"+new URLSearchParams({view:data.view||"products",after:data.next_cursor})}>Next page →</Link>}
      </>}
      <a href="https://admin.shopify.com/store/jill-work/products" target="_top">Manage products in Shopify</a>
    </main></s-section>
  </s-page>;
}
