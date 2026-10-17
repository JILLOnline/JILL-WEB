// Exact WORK request detail — never fetched in the inbox loader.
// OFF by default until a separate, signed Google QA detail deployment
// and Worker flag are certified. Authenticated Owner + D1 are required
// BEFORE any private source read, including on direct detail URLs.
import {type LoaderFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce} from "../../../work-admin-auth-once.mjs";
import {readWorkMerchantPermission} from "../../../merchant-access.mjs";
import {readWorkGoogleQaMerchantDetail}
  from "../../../work-google-merchant-detail.mjs";
import {workQuoteDraftFeatureReady}
  from "../../../work-quote-release-readiness.mjs";

const ID=/^[A-Za-z0-9._:-]{8,128}$/;
const headers={"cache-control":"private, no-store, max-age=0",
  "x-content-type-options":"nosniff"};
function result(status:number,state:string,detail:unknown=null,
  quoteDraftEnabled=false){
  return Response.json({state,detail,quoteDraftEnabled},{status,headers});
}
export async function loadAuthorizedWorkRequestDetail({
  request,context,params,
}:LoaderFunctionArgs){
  const id=params.submissionId;
  if(typeof id!=="string"||!ID.test(id))
    return result(404,"not_found");
  const env=context.cloudflare.env as typeof context.cloudflare.env & {
    JILL_WORK_HQ_DETAIL_ENABLED?:string
  };
  if(env.JILL_WORK_HOST_STAGE!=="canary" ||
     env.JILL_WORK_HQ_DETAIL_ENABLED!=="true")
    return result(200,"not_connected");
  if(!env.JILL_HQ_MERCHANT_READ_SECRET)
    return result(503,"source_unavailable");
  // A direct URL and child-route navigation reuses ONLY the SDK's
  // authentication promise for THIS incoming request. No cross-request cache.
  const {session}=await authenticateWorkAdminOnce<{session:unknown}>({
    scope:context.cloudflare,
    authenticate:()=>workShopify(env).authenticate.admin(request),
  });
  const grant=await readWorkMerchantPermission({
    db:env.JILL_ORDER_DESK_WORK_DB,session,action:"requests.read",
  });
  if(grant.allowed!==true || !("role" in grant) || grant.role!=="owner")
    return result(grant.code==="authority_unavailable"?503:403,
      "access_denied");
  try{
    const detail=await readWorkGoogleQaMerchantDetail({
      secret:env.JILL_HQ_MERCHANT_READ_SECRET,
      submissionId:id,
    });
    // ONLY after signed Google detail + Shopify online Owner/D1 grant.
    // Merely surfacing this boolean never authorizes a write: the quote
    // endpoint independently checks capability, origin, and fresh source.
    return result(200,"ready",detail,workQuoteDraftFeatureReady(env));
  }catch{
    // No internal failure details, stale customer data, raw records or keys.
    return result(503,"source_unavailable");
  }
}
