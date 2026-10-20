// WORK-only exact-field search; authenticated Shopify online Owner + WORK D1.
// Never expose Google QA secrets, raw request details or search terms in URLs.
import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkRequestDetailSearch}
  from "../../../work-request-detail-search-action.mjs";
import {readWorkGoogleQaMerchantList}
  from "../../../work-google-merchant-read.mjs";
import {readWorkGoogleQaMerchantDetail}
  from "../../../work-google-merchant-detail.mjs";

export async function loader(){
  return new Response(null,{status:405,headers:{"cache-control":"no-store"}});
}
export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkRequestDetailSearch({
    request,
    enabled:env.JILL_WORK_HOST_STAGE==="canary" &&
      env.JILL_WORK_HQ_DETAIL_ENABLED==="true" &&
      Boolean(env.JILL_HQ_MERCHANT_READ_SECRET),
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
