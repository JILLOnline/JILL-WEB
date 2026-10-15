import {type ActionFunctionArgs} from "react-router";
import {workShopify} from "../shopify.server";
import {handleWorkMerchantCommand} from "../../../merchant-command.mjs";

export async function loader(){
  return new Response(null,{status:405,headers:{"cache-control":"no-store"}});
}
export async function action({request,context}:ActionFunctionArgs){
  const env=context.cloudflare.env;
  // The gate defaults OFF even in WORK; never turn it on in source configs.
  const enabled=env.JILL_WORK_HOST_STAGE==="canary" &&
    env.JILL_WORK_MERCHANT_WRITES_ENABLED==="true" &&
    typeof env.JILL_HQ_MERCHANT_WRITE_SECRET==="string" &&
    env.JILL_HQ_MERCHANT_WRITE_SECRET.length>=32 &&
    env.JILL_HQ_MERCHANT_WRITE_SECRET!==env.JILL_HQ_MERCHANT_READ_SECRET &&
    env.JILL_HQ_MERCHANT_WRITE_SECRET!==env.SHOPIFY_API_SECRET;
  return handleWorkMerchantCommand({
    request,authenticate:workShopify(env).authenticate,
    db:env.JILL_ORDER_DESK_WORK_DB,
    enabled,secret:env.JILL_HQ_MERCHANT_WRITE_SECRET,
  });
}
