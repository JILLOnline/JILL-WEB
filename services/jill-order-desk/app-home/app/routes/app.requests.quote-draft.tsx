// WORK-only quote Save/Reload route prepared for a distinct release.
// The new JILL_WORK_HQ_QUOTE_DRAFTS_ENABLED capability is absent from
// current manifests and v34; no remote upload/switch is approved.
// Worker ingress independently requires this switch and the real WORK D1
// tables, and this route rechecks capability before Shopify Owner/D1 auth.
import {type ActionFunctionArgs,type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {readWorkGoogleQaMerchantDetail}
  from "../../../work-google-merchant-detail.mjs";
import {readWorkGoogleQaMerchantList}
  from "../../../work-google-merchant-read.mjs";
import {handleWorkQuoteDraftSave}
  from "../../../work-quote-save-boundary.mjs";
import {handleWorkQuoteDraftRead}
  from "../../../work-quote-draft-read.mjs";
import {workQuoteDraftFeatureReady}
  from "../../../work-quote-release-readiness.mjs";

export async function loader({request,context}:LoaderFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkQuoteDraftRead({
    request,enabled:workQuoteDraftFeatureReady(env),
    authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    readFreshList:()=>readWorkGoogleQaMerchantList({
      secret:env.JILL_HQ_MERCHANT_READ_SECRET,
    }),
    readExactDetail:({submissionId}:{submissionId:string})=>
      readWorkGoogleQaMerchantDetail({
        submissionId,secret:env.JILL_HQ_MERCHANT_READ_SECRET,
      }),
  });
}
export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkQuoteDraftSave({
    request,enabled:workQuoteDraftFeatureReady(env),
    authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    readFreshList:()=>readWorkGoogleQaMerchantList({
      secret:env.JILL_HQ_MERCHANT_READ_SECRET,
    }),
    readExactDetail:({submissionId}:{submissionId:string})=>
      readWorkGoogleQaMerchantDetail({
        submissionId,secret:env.JILL_HQ_MERCHANT_READ_SECRET,
      }),
  });
}
