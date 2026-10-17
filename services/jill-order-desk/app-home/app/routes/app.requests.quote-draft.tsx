// Source-only WORK quote Save Draft endpoint. Intentionally HARD OFF.
// Neither the WORK nor canary manifest, OAuth settings nor an arbitrary
// request can enable it. Owner must separately approve a real D1 migration,
// full-source release review and explicit version/traffic deployment.
import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {readWorkGoogleQaMerchantDetail}
  from "../../../work-google-merchant-detail.mjs";
import {readWorkGoogleQaMerchantList}
  from "../../../work-google-merchant-read.mjs";
import {handleWorkQuoteDraftSave}
  from "../../../work-quote-save-boundary.mjs";

export async function loader(){
  return Response.json({ok:false,code:"quote_drafts_not_enabled"},{
    status:503,headers:{"cache-control":"private, no-store, max-age=0"},
  });
}
export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env;
  return handleWorkQuoteDraftSave({
    request,enabled:false, // NOT a config flag: always OFF in this revision.
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
