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
type Catalog={state:string;as_of?:string;next_cursor?:string;
  records?:{id:string;title:string;status:string;admin_url:string;variants_truncated:boolean;
    variants:{id:string;title:string;price:string}[]}[]};
export default function Catalog(){
  const data=useLoaderData<typeof loader>() as unknown as Catalog;
  return <s-page heading="JILL HQ — Catalog">
    <s-section><main className="jill-inbox">
      <Link className="jill-inbox__back" to="/app">← HQ overview</Link>
      <h2>Shopify products</h2>
      {data.state!=="ready"?<p role="status">{data.state==="access_denied"?
        "The current account needs Owner access and Shopify product-read permission.":
        "The catalog source is unavailable. No product or stock counts are assumed."}</p>:<>
        <p>Verified {data.as_of}. Prices are in the store currency. Stock requires a separate inventory read.</p>
        {data.records?.length===0?<p>No products on this page.</p>:data.records?.map(product=>
          <section key={product.id} className="jill-request__panel">
            <h3><a href={product.admin_url} target="_top">{product.title}</a> · {product.status}</h3>
            <ul>{product.variants.map(variant=><li key={variant.id}>{variant.title} — {variant.price}</li>)}</ul>
            {product.variants_truncated&&<p>More variants are available in Shopify Admin.</p>}
          </section>)}
        {data.next_cursor&&<Link to={"?"+new URLSearchParams({after:data.next_cursor})}>Next products →</Link>}
      </>}
      <a href="https://admin.shopify.com/store/jill-work/products" target="_top">Manage products in Shopify</a>
    </main></s-section>
  </s-page>;
}
