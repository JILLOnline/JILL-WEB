import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {readWorkOwnerAccessEvidence} from "../../../admin-home.mjs";
import "../styles/inbox.css";

export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env;
  return readWorkOwnerAccessEvidence({request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,runtimeVersion:env.CF_VERSION_METADATA?.id});
}

type Evidence={state:string;shop?:string;staff_id?:string;runtime_version?:string|null;
  scopes?:string[];actions?:{action:string;feature_enabled:boolean;shopify_scope_intersection:boolean}[]};
export default function OwnerAccess(){
  const data=useLoaderData<typeof loader>() as unknown as Evidence;
  return <s-page inlineSize="large" heading="JILL HQ — Owner access">
    <s-section><main className="jill-inbox">
      <Link className="jill-inbox__back" to="/app">← HQ overview</Link>
      {data.state!=="verified_owner"?<p role="status">Current Owner access could not be verified.</p>:<>
        <h2>Verified online Owner session</h2>
        <p>Store: {data.shop}. Staff: {data.staff_id}.</p>
        <p>HQ version: {data.runtime_version||"Not attributed"}.</p>
        <p>These permissions come from your authenticated online session. Shopify app consent alone does not verify staff access.</p>
        <h3>Scope checks</h3>
        <ul className="jill-workspace__scope-list">{data.actions?.map(item=><li key={item.action}>
          {item.action}: Shopify scope intersection {item.shopify_scope_intersection?"verified":"missing"};
          {" "}HQ policy {item.feature_enabled?"enabled":"disabled"}.
        </li>)}</ul>
        <h3>Online scopes</h3>
        <ul className="jill-workspace__scope-list">{data.scopes?.map(scope=><li key={scope}>{scope}</li>)}</ul>
        <p>Full WORK operational acceptance remains incomplete.</p>
      </>}
    </main></s-section>
  </s-page>;
}
