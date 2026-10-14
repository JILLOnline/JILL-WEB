import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkShopifyAdminRoute} from "../../../shopify-host/app-home-route.mjs";
export async function loader({request,context}:LoaderFunctionArgs) {
  const env=context.cloudflare.env;
  return loadWorkShopifyAdminRoute({
    request,authenticate:workShopify(env).authenticate,env,
  });
}
export default function JillHQ() {
  const data=useLoaderData() as {state:string;description:string;role?:string};
  return <s-page heading="JILL HQ — WORK">
    <s-section heading="Business Management Center">
      <s-paragraph>{data.description}</s-paragraph>
      {data.state==="staff_verified"
        ? <s-banner tone="info">Merchant identity verified. Management modules are enabled individually after permission and source certification.</s-banner>
        : <s-banner tone="warning">Merchant access is locked until the WORK Shopify Owner and JILL permissions are verified.</s-banner>}
      {data.state==="merchant_setup_required"
        ? <s-paragraph>
            <Link to="/app/setup-owner">WORK Owner commissioning</Link>
          </s-paragraph>
        : null}
      <s-text>Customer Custom Orders, Rewards balances, invoicing and fulfillment remain unchanged.</s-text>
    </s-section>
    {data.state==="staff_verified"
      ? <>
          <s-section heading="Requests &amp; Operations">
            <s-paragraph>
              Custom Orders, quotes, production stages and delivery workflows
              will share the original JILL submission and event history.
              The read-only WORK merchant inbox is under source certification.
            </s-paragraph>
            {data.role==="owner"
              ? <s-paragraph>
                  <Link to="/app/requests">Open Custom Orders inbox (read-only)</Link>
                </s-paragraph>
              : null}
          </s-section>
          <s-section heading="Customers &amp; Loyalty">
            <s-paragraph>
              Customer profiles, verified order history, Rewards activity
              and coupons will be available through permission-scoped views.
              No customer data has been imported into JILL HQ.
            </s-paragraph>
          </s-section>
          <s-section heading="Store &amp; Commerce">
            <s-paragraph>
              Products, inventory, Shopify orders, financial observations
              and fulfillment will use Shopify as the canonical source.
              Sales and payment actions remain disabled.
            </s-paragraph>
          </s-section>
          <s-section heading="Team, Analytics &amp; Audit">
            <s-paragraph>
              Staff permissions, operational reports and security activity
              are planned. The registered Owner is verified; other roles
              remain restricted until explicit grants are certified.
            </s-paragraph>
          </s-section>
        </>
      : null}
  </s-page>;
}
