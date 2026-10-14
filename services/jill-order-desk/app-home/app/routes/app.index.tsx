import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkShopifyAdminRoute} from "../../../shopify-host/app-home-route.mjs";
export async function loader({request,context}:LoaderFunctionArgs) {
  const env=context.cloudflare.env;
  return loadWorkShopifyAdminRoute({
    request,authenticate:workShopify(env).authenticate,env,
  });
}
export default function OrderDesk() {
  const data=useLoaderData() as {state:string;description:string;role?:string};
  return <s-page heading="JILL Order Desk">
    <s-section heading="Your merchant workspace">
      <s-paragraph>{data.description}</s-paragraph>
      {data.state==="staff_verified"
        ? <>
            <s-banner tone="info">Identity verified. The WORK merchant inbox is available for source-connection testing; live requests are not connected yet.</s-banner>
            {data.role==="owner"
              ? <s-paragraph><Link to="/app/requests">Open Custom Orders inbox (read-only)</Link></s-paragraph>
              : null}
          </>
        : <s-banner tone="warning">Merchant access is locked until the WORK Shopify Owner and JILL permissions are verified.</s-banner>}
      {data.state==="merchant_setup_required"
        ? <s-paragraph>
            <Link to="/app/setup-owner">WORK Owner commissioning</Link>
          </s-paragraph>
        : null}
      <s-text>Customer Custom Orders, Rewards balances, invoicing and fulfillment remain unchanged.</s-text>
    </s-section>
  </s-page>;
}
