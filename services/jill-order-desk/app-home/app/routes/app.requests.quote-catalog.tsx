// M2 read-only, signed-source, Owner+D1 Catalog check. OFF by default.
import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {handleWorkQuoteCatalogReview,workQuoteCatalogReviewReady}
  from "../../../work-quote-catalog-review.mjs";
import {readWorkGoogleQaMerchantList}
  from "../../../work-google-merchant-read.mjs";
import {readWorkGoogleQaMerchantDetail}
  from "../../../work-google-merchant-detail.mjs";
export async function loader({request,context}:LoaderFunctionArgs){
 const env=context.cloudflare.env;
 return handleWorkQuoteCatalogReview({
   request,enabled:workQuoteCatalogReviewReady(env),
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
 });
}
