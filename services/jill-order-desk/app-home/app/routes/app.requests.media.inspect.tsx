// WORK merchant artwork readiness: disabled-by-default authenticated route.
// No artwork upload, R2 storage, preview, download or customer API.
import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {authenticateWorkAdminOnce}
  from "../../../work-admin-auth-once.mjs";
import {readWorkGoogleQaMerchantDetail}
  from "../../../work-google-merchant-detail.mjs";
import {handleWorkPrivateMediaOwnerInspect}
  from "../../../work-private-media-owner-boundary.mjs";

export async function loader(){
  return new Response(null,{
    status:405,headers:{"cache-control":"private, no-store"},
  });
}

export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env as typeof context.cloudflare.env & {
    JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED?:string
  };
  // A source-only opt-in: the flag is intentionally ABSENT from all
  // deployable WORK/canary manifests. Even if someone opts it in later,
  // the helper always returns private_media_storage_not_connected.
  return handleWorkPrivateMediaOwnerInspect({
    request,
    stage:env.JILL_WORK_HOST_STAGE,
    enabled:env.JILL_WORK_HQ_MEDIA_OWNER_INSPECT_ENABLED==="true" &&
      env.JILL_WORK_HQ_DETAIL_ENABLED==="true" &&
      typeof env.JILL_HQ_MERCHANT_READ_SECRET==="string" &&
      env.JILL_HQ_MERCHANT_READ_SECRET.length>=32,
    authenticate:incoming=>authenticateWorkAdminOnce({
      scope:context.cloudflare,
      authenticate:()=>workShopify(env).authenticate.admin(incoming),
    }),
    db:env.JILL_ORDER_DESK_WORK_DB,
    readExactDetail:({submissionId})=>readWorkGoogleQaMerchantDetail({
      secret:env.JILL_HQ_MERCHANT_READ_SECRET!,
      submissionId,
    }),
  });
}
