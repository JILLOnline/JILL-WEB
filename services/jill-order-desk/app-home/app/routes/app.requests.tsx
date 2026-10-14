import {Link,useLoaderData,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {loadWorkMerchantInbox} from "../../../merchant-inbox-read.mjs";

type InboxRecord={
  submission_id:string;
  revision:number;
  customer_status:string;
  internal_status:string;
  submitted_at:string;
  updated_at:string;
  date_needed:string;
  fulfillment:string;
  item_count:number;
};
type InboxModel={
  state:"ready"|"source_not_connected"|"source_unavailable"|"access_denied";
  requestsConnected:boolean;
  records:InboxRecord[];
  readOnly:boolean;
};

export async function loader({request,context}:LoaderFunctionArgs) {
  const env=context.cloudflare.env;
  const result=await loadWorkMerchantInbox({
    request,
    authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    // No merchant source reader until a distinct WORK Google QA signed,
    // read-only contract has been certified. Never reuse customer listing.
  });
  return Response.json(result.model,{
    status:result.status,headers:result.headers,
  });
}

export default function WorkMerchantInbox() {
  const data=useLoaderData() as InboxModel;
  return <s-page heading="JILL Custom Orders — Inbox">
    <s-section heading="Merchant requests">
      <s-paragraph><Link to="/app">Back to Order Desk</Link></s-paragraph>
      {data.state==="source_not_connected"
        ? <s-banner tone="warning">
            The canonical WORK Google QA merchant feed is not connected yet.
            Existing submissions and status events remain in their original source.
            No request count is available until source certification.
          </s-banner>
        : data.state==="source_unavailable"
          ? <s-banner tone="critical">
              Request source unavailable. No cached customer records are shown.
            </s-banner>
          : data.state==="access_denied"
            ? <s-banner tone="critical">Merchant inbox access is not authorized.</s-banner>
            : data.records.length===0
              ? <s-banner tone="info">The verified merchant feed returned no requests.</s-banner>
              : data.records.map(item=>
                  <s-section key={item.submission_id} heading={item.submission_id}>
                    <s-paragraph>
                      Status: {item.customer_status} · Internal: {item.internal_status}
                    </s-paragraph>
                    <s-paragraph>
                      Submitted: {item.submitted_at} · Updated: {item.updated_at}
                    </s-paragraph>
                    <s-paragraph>
                      Items: {item.item_count} · Needed: {item.date_needed||"Not supplied"} · Fulfillment: {item.fulfillment||"Not supplied"}
                    </s-paragraph>
                  </s-section>
                )}
      <s-paragraph>
        This workspace is read-only. Quotes, invoices, payments, fulfillment
        and production status changes are not available.
      </s-paragraph>
    </s-section>
  </s-page>;
}
