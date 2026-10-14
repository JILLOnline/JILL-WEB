import {
  useFetcher,useLoaderData,
  type ActionFunctionArgs,type LoaderFunctionArgs,
} from "react-router";
import {workShopify} from "../shopify.server";
import {
  readWorkOwnerSetup,commitWorkOwnerSetup,
} from "../../../owner-bootstrap-route.mjs";

export async function loader({request,context}:LoaderFunctionArgs) {
  return readWorkOwnerSetup({
    request,authenticate:workShopify(context.cloudflare.env).authenticate,
    env:context.cloudflare.env,
  });
}

export async function action({request,context}:ActionFunctionArgs) {
  return commitWorkOwnerSetup({
    request,authenticate:workShopify(context.cloudflare.env).authenticate,
    env:context.cloudflare.env,
  });
}

type Result={
  ok:boolean;
  code?:string;
  state?:"ready_to_bind"|"already_bound"|"owner_bound";
  shop?:string;
};

export default function WorkOwnerSetup() {
  const loaded=useLoaderData() as Result;
  // Keep the embedded Shopify App Home mounted during Owner confirmation.
  // A full-document form navigation can lose its authenticated app context.
  const fetcher=useFetcher<Result>();
  const submitted=fetcher.data;
  const submitting=fetcher.state!=="idle";
  const bound=loaded.state==="already_bound" ||
    submitted?.state==="owner_bound";
  return <s-page heading="JILL HQ — WORK / Owner setup">
    <s-section heading="Shopify WORK ownership">
      <s-paragraph>
        This page registers only the verified Shopify account owner of
        jill-work.myshopify.com. It cannot register an email address,
        another staff member or the LIVE store.
      </s-paragraph>
      {bound
        ? <s-banner tone="success">WORK Owner binding is confirmed. Merchant writes remain disabled.</s-banner>
        : loaded.state==="ready_to_bind"
          ? <>
              <s-banner tone="warning">Confirm only if you are the Shopify WORK account owner.</s-banner>
              <fetcher.Form method="post">
                <input type="hidden" name="confirm" value="bind-my-work-shopify-owner"/>
                <button type="submit" disabled={submitting}>
                  {submitting?"Verifying WORK Owner…":"Confirm WORK Owner registration"}
                </button>
              </fetcher.Form>
            </>
          : <s-banner tone="warning">
              Setup is unavailable. Only the authenticated WORK Shopify Owner can complete it after the server-side commissioning switch is enabled.
            </s-banner>}
      {submitted?.code
        ? <s-paragraph>Owner registration was not completed: {submitted.code}</s-paragraph>
        : null}
      {submitted?.state==="owner_bound"
        ? <s-paragraph>Owner registration succeeded. The WORK authority record is now bound. The commissioning switch must be disabled immediately.</s-paragraph>
        : null}
      <s-paragraph>
        No invoices, refunds, staff invitations or production changes are enabled here.
      </s-paragraph>
    </s-section>
  </s-page>;
}
