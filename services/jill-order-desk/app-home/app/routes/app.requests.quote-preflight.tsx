// JILL HQ WORK — Owner-only saved quote + exact Shopify Catalog preflight.
// This route is HARD OFF in the current WORK manifest; the enabling flag
// JILL_WORK_HQ_QUOTE_CATALOG_PREFLIGHT_ENABLED has NEVER been deployed.
// No mutation, customer acceptance, invoice or Shopify calculation.
import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
 from "../../../work-admin-auth-once.mjs";
import {handleWorkQuoteOwnerPreflight,workQuoteOwnerPreflightReady}
 from "../../../work-quote-owner-preflight.mjs";
import {readWorkGoogleQaMerchantList}
 from "../../../work-google-merchant-read.mjs";
import {readWorkGoogleQaMerchantDetail}
 from "../../../work-google-merchant-detail.mjs";

export async function loader({request,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 return handleWorkQuoteOwnerPreflight({
  request,enabled:workQuoteOwnerPreflightReady(env),
  authenticate:{admin:()=>authenticateWorkAdminOnce({
   scope:context.cloudflare,
   authenticate:()=>workShopify(env).authenticate.admin(request),
  })},
  db:env.JILL_ORDER_DESK_WORK_DB,
  readFreshList:()=>readWorkGoogleQaMerchantList({
   secret:env.JILL_HQ_MERCHANT_READ_SECRET,
  }),
  readExactDetail:({submissionId}:{submissionId:string})=>
   readWorkGoogleQaMerchantDetail({
    submissionId,secret:env.JILL_HQ_MERCHANT_READ_SECRET,
   }),
  // No customer identity resolver: absent independently authorized Shopify
  // customer/address source ALWAYS remains a hold, never "invoice ready".
 });
}
