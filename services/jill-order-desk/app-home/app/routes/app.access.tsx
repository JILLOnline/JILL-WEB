import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {readWorkOwnerAccessEvidence} from "../../../admin-home.mjs";
import "../styles/inbox.css";

export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env;
  const response=await readWorkOwnerAccessEvidence({
    request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,runtimeVersion:env.CF_VERSION_METADATA?.id,
  });
  // Do not expose any environment capability before verified Owner + D1.
  if(response.status!==200)return response;
  const evidence=await response.json();
  return Response.json({...evidence,capabilities:{
    requestsConfigured:env.JILL_WORK_HOST_STAGE==="canary"&&
      Boolean(env.JILL_HQ_MERCHANT_READ_SECRET),
    catalogConfigured:env.JILL_WORK_CATALOG_ENABLED==="true",
    conversationsEnabled:env.JILL_WORK_CONVERSATION_ENABLED==="true",
    quoteDraftsEnabled:env.JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED==="true",
  }},{status:response.status,headers:response.headers});
}

type Evidence={state:string;shop?:string;staff_id?:string;runtime_version?:string|null;
  scopes?:string[];actions?:{action:string;feature_enabled:boolean;shopify_scope_intersection:boolean}[];
  capabilities?:{requestsConfigured:boolean;catalogConfigured:boolean;
    conversationsEnabled:boolean;quoteDraftsEnabled:boolean};};
export default function OwnerAccess(){
  const data=useLoaderData<typeof loader>() as unknown as Evidence;
  return <s-page heading="JILL HQ — Settings" inlineSize="large">
    <s-section><main className="jill-inbox">
      <Link className="jill-inbox__back" to="/app">← Home</Link>
      {data.state!=="verified_owner"?<p role="status">Current Owner access could not be verified.</p>:<>
        <h2>Access &amp; permissions</h2>
        <p>Permissions verified for your current Shopify session.</p>
        <h3>WORK connections</h3>
        <p>Configuration status, not proof of a delivered message or saved quote.</p>
        <ul className="jill-workspace__scope-list">
          <li><Link to="/app/requests">Custom Order requests</Link>: {data.capabilities?.requestsConfigured?"Source configured · verify records in Requests":"Source not configured"}</li>
          <li><Link to="/app/catalog">Shopify Catalog</Link>: {data.capabilities?.catalogConfigured?"Catalog read enabled · inspect Shopify data in Catalog":"Catalog read disabled"}</li>
          <li><Link to="/app/messages">Customer conversations</Link>: {data.capabilities?.conversationsEnabled?"Read configured · verify authorized customer threads":"Two-sided conversation read disabled"}</li>
          <li><Link to="/app/requests">Quote drafts</Link>: {data.capabilities?.quoteDraftsEnabled?"Save configured · verify persistence before use":"Durable Save/Reload disabled"}</li>
        </ul>
        <h3>Available actions</h3>
        <ul className="jill-workspace__scope-list">{data.actions?.map(item=><li key={item.action}>
          {item.action}: Shopify {item.shopify_scope_intersection?"verified":"missing"};
          {" "}HQ {item.feature_enabled?"enabled":"disabled"}.
        </li>)}</ul>
        <details className="jill-workspace__disclosure"><summary>Session details &amp; technical permissions</summary>
        <p>Store: {data.shop}. Staff: {data.staff_id}.</p>
        <p>HQ version: {data.runtime_version||"Not attributed"}.</p>
        <h3>Online scopes</h3>
        <ul className="jill-workspace__scope-list">{data.scopes?.map(scope=><li key={scope}>{scope}</li>)}</ul>
        </details>
      </>}
    </main></s-section>
  </s-page>;
}
