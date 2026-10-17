import {workMerchantWritesReady} from "../../../work-merchant-write-readiness.mjs";
import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkMerchantCommand} from "../../../merchant-command.mjs";

export async function loader(){
  return new Response(null,{status:405,headers:{"cache-control":"no-store"}});
}
export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env;
  // The gate defaults OFF even in WORK; never turn it on in source configs.
  const enabled=workMerchantWritesReady(env);
  return handleWorkMerchantCommand({
    request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    enabled,secret:env.JILL_HQ_MERCHANT_WRITE_SECRET,
    fastIndexEnabled:(env as typeof env & {
      JILL_WORK_HQ_FAST_INBOX_ENABLED?:string
    }).JILL_WORK_HQ_FAST_INBOX_ENABLED==="true",
  });
}
