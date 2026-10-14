import {useLoaderData,type LoaderFunctionArgs} from "react-router";
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
        ? <s-banner tone="info">Identity verified. The merchant inbox will be connected after Owner registration and read-only source certification.</s-banner>
        : <s-banner tone="warning">Merchant access is locked until the WORK Shopify Owner and JILL permissions are verified.</s-banner>}
      <s-text>Customer Custom Orders, Rewards balances, invoicing and fulfillment remain unchanged.</s-text>
    </s-section>
  </s-page>;
}
